/**
 * Mapa de zonas de la huerta para «Ubica tus fotos» (y la tarjeta de grabaciones en Mis escaneos).
 *
 * - Fondo: imagen satelital REAL de la ubicación de la huerta (Esri World Imagery, la misma fuente que el mapa
 *   de Mapeo), recortada exactamente a la caja visible y con la misma proyección que el polígono, así que las
 *   zonas caen sobre la huerta. Sin conexión: fondo verde oscuro con cuadrícula.
 * - Perspectiva oblicua con extrusión baja, o «Vista superior» (plano). La cara superior visible de cada zona
 *   es EXACTAMENTE su área de toque/soltado: project3D() la devuelve para el arrastre en el hilo de UI.
 * - Aguacates: uno por foto asignada (hasta 6 por zona, después «+N»), cada uno sobre un círculo blanco; se
 *   quedan en el mapa. El último en caer se asienta con un resorte corto (sin animación con «Reducir movimiento»).
 *   La zona activa muestra «Zona D · 3 fotos».
 */
import React, { memo, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient as SvgGradient, Path, Pattern, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import Reanimated, { type SharedValue, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { Layers } from 'lucide-react-native';
import type { LatLng, ZoneId } from '../../services/satZones';
import { ZONE_UI, type ZonaSnapshot } from '../../services/grabacion';
import { pointInPolygon } from './ZoneBoard';

/** Inclinación (escala vertical) y altura de la extrusión en px; en vista superior ambas se anulan. */
const TILT = 0.64;
const DEPTH = 11;
const M = 18;   // margen lateral
const TOP = 26; // espacio arriba para los marcadores

export type Face3D = { id: ZoneId; top: [number, number][]; label: [number, number] };
type Geo = { minLat: number; maxLat: number; minLng: number; k: number; s: number; ox: number; oy: number; tilt: number };

/** Proyección: lat/lng → píxeles (corrige longitud por latitud, conserva proporción, aplica la inclinación). */
function geoOf(zonas: ZonaSnapshot[], outline: LatLng[] | null, w: number, h: number, flat: boolean): Geo | null {
  const all = [...zonas.flatMap(z => z.ring), ...(outline ?? [])];
  if (!all.length || w <= 0 || h <= 0) return null;
  const tilt = flat ? 1 : TILT;
  const depth = flat ? 0 : DEPTH;
  const minLat = Math.min(...all.map(p => p.lat)), maxLat = Math.max(...all.map(p => p.lat));
  const minLng = Math.min(...all.map(p => p.lng)), maxLng = Math.max(...all.map(p => p.lng));
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const sw = Math.max(1e-9, (maxLng - minLng) * k), sh = Math.max(1e-9, maxLat - minLat);
  const availW = w - 2 * M, availH = (h - depth - 2 * M - TOP) / tilt;
  const s = Math.min(availW / sw, Math.max(20, availH) / sh);
  const ox = M + (availW - sw * s) / 2;
  const oy = (Math.max(20, availH) - sh * s) / 2; // en espacio plano (antes de inclinar)
  return { minLat, maxLat, minLng, k, s, ox, oy, tilt };
}
const toXY = (g: Geo, p: LatLng): [number, number] => [g.ox + (p.lng - g.minLng) * g.k * g.s, M + TOP + (g.oy + (g.maxLat - p.lat) * g.s) * g.tilt];
/** Inverso (para pedir la imagen satelital de toda la caja visible). */
const toLatLng = (g: Geo, x: number, y: number): LatLng => ({ lng: g.minLng + (x - g.ox) / (g.k * g.s), lat: g.maxLat - ((y - M - TOP) / g.tilt - g.oy) / g.s });

/** Caras superiores (área de toque) y puntos de etiqueta, en coordenadas del componente w×h. */
export function project3D(zonas: ZonaSnapshot[], outline: LatLng[] | null, w: number, h: number, flat = false): Face3D[] {
  const g = geoOf(zonas, outline, w, h, flat);
  if (!g) return [];
  return zonas.map(z => ({ id: z.id, top: z.ring.map(p => toXY(g, p)), label: toXY(g, z.label) }));
}

/** URL de la imagen satelital (Esri World Imagery) de la caja lat/lng, al doble de resolución. */
function satelliteUrl(sw: LatLng, ne: LatLng, w: number, h: number) {
  const W = Math.min(1600, Math.round(w * 2)), H = Math.min(1600, Math.round(h * 2));
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${sw.lng},${sw.lat},${ne.lng},${ne.lat}&bboxSR=4326&imageSR=4326&size=${W},${H}&format=jpg&f=image`;
}

/** URL del fondo satelital tal como la pide ZoneMap3D; sirve para descargarla antes (Image.prefetch) y que no tarde. */
export function zoneMapSatelliteUrl(zonas: ZonaSnapshot[], outline: LatLng[] | null, width: number, height: number, flat = false): string | null {
  const g = geoOf(zonas, outline, width, height, flat);
  if (!g) return null;
  const tl = toLatLng(g, 0, 0), br = toLatLng(g, width, height);
  return satelliteUrl({ lat: br.lat, lng: tl.lng }, { lat: tl.lat, lng: br.lng }, width, height);
}

const pathOf = (pts: [number, number][], dy = 0) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${(p[1] + dy).toFixed(1)}`).join(' ') + ' Z';

const AnimatedPath = Reanimated.createAnimatedComponent(Path);

const TopFace = memo(function TopFace({ face, index, fill, hover, highlight, onPress, sat }: {
  face: Face3D; index: number; fill: string; hover?: SharedValue<number>; highlight: boolean; onPress?: () => void; sat: boolean;
}) {
  // Con satélite, relleno translúcido para ver los árboles debajo.
  const base = sat ? 0.32 : 0.9;
  const animatedProps = useAnimatedProps(() => {
    const on = hover ? hover.get() === index : false;
    return { fillOpacity: on ? Math.min(0.85, base + 0.3) : highlight ? base + 0.12 : base, strokeOpacity: on || highlight ? 1 : 0.85, strokeWidth: on ? 3.5 : highlight ? 2.6 : 1.8 };
  });
  return <AnimatedPath d={pathOf(face.top)} fill={fill} stroke="#FFFFFF" strokeLinejoin="round" animatedProps={animatedProps} onPress={onPress} />;
});

/** Aguacate vectorial (relleno degradado, brillo y pedúnculo). */
export function AvocadoGlyph({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.25} viewBox="0 0 40 50">
      <Defs>
        <RadialGradient id="avg" cx="38%" cy="35%" r="70%">
          <Stop offset="0" stopColor="#7DA43A" />
          <Stop offset="0.55" stopColor="#3F6B1F" />
          <Stop offset="1" stopColor="#1F3A0F" />
        </RadialGradient>
      </Defs>
      <Path d="M20 4 C 13 4 10 13 9 20 C 6 26 4 31 4 36 C 4 44 11 48 20 48 C 29 48 36 44 36 36 C 36 31 34 26 31 20 C 30 13 27 4 20 4 Z" fill="url(#avg)" />
      <Ellipse cx="14.5" cy="22" rx="3" ry="7" fill="#FFFFFF" opacity={0.22} transform="rotate(-12 14.5 22)" />
      <Path d="M20 4.5 C 20 2.5 21 1 23 0.5" stroke="#5B3A1E" strokeWidth={1.8} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/** Posiciones de los aguacates de una zona: anillo alrededor de la etiqueta, solo puntos dentro de la zona. */
// Arriba y a los lados de la letra (que va debajo del punto de etiqueta), sin taparla.
const OFFSETS: [number, number][] = [[0, -22], [-26, -10], [26, -10], [-22, -40], [22, -40], [-48, 6], [48, 6], [0, -56]];
function spotsFor(face: Face3D, n: number, tilt: number): [number, number][] {
  const out: [number, number][] = [];
  for (const [dx, dy] of OFFSETS) {
    if (out.length >= n) break;
    const p: [number, number] = [face.label[0] + dx, face.label[1] + dy * Math.max(0.75, tilt)];
    if (pointInPolygon(p[0], p[1], face.top)) out.push(p);
  }
  while (out.length < n) out.push([face.label[0] + (out.length % 2 ? 16 : -16), face.label[1] - 26]); // zona angosta
  return out;
}

const AVO = 22; // ancho del aguacate en el mapa

/** Aguacate sobre su círculo blanco; si es el recién soltado, cae y se asienta. */
const AvocadoPin = memo(function AvocadoPin({ x, y, fresh, tick }: { x: number; y: number; fresh: boolean; tick: number }) {
  const reduced = useReducedMotion();
  const fall = useSharedValue(0);
  useEffect(() => {
    if (!fresh || !tick || reduced) return;
    fall.set(-30);
    fall.set(withSpring(0, { duration: 420, dampingRatio: 0.55 }));
  }, [fresh, tick, reduced, fall]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: fall.get() }] }));
  return (
    <View pointerEvents="none" style={[st.pin, { left: x - 15, top: y - AVO * 1.25 - 2 }]}>
      {/* Círculo blanco en el suelo; el aguacate se apoya en su centro */}
      <View style={st.ring} />
      <Reanimated.View style={[{ position: 'absolute', left: 15 - AVO / 2, top: 0 }, style]}><AvocadoGlyph size={AVO} /></Reanimated.View>
    </View>
  );
});

type Props = {
  zonas: ZonaSnapshot[];
  outline?: LatLng[] | null;
  width: number;
  height: number;
  /** Fotos (o hallazgos) por zona. */
  counts: Partial<Record<ZoneId, number>>;
  /** Zona de la última asignación (marcador «Zona X · N fotos» y aguacate que cae). */
  activeZone: ZoneId | null;
  /** Cambia en cada asignación para repetir la animación del último aguacate. */
  dropTick: number;
  hover?: SharedValue<number>;
  onZonePress?: (id: ZoneId) => void;
  activeText?: (id: ZoneId, n: number) => string;
  /** Vista superior (plano) en vez de perspectiva. */
  flat?: boolean;
  onToggleFlat?: () => void;
  flatLabel?: string;
  /** Fondo satelital de la ubicación real (por defecto sí). */
  satellite?: boolean;
  /** Texto mientras carga la imagen satelital. */
  loadingLabel?: string;
};

export default function ZoneMap3D({ zonas, outline = null, width, height, counts, activeZone, dropTick, hover, onZonePress, activeText, flat = false, onToggleFlat, flatLabel, satellite = true, loadingLabel = 'Cargando satélite…' }: Props) {
  const g = useMemo(() => geoOf(zonas, outline, width, height, flat), [zonas, outline, width, height, flat]);
  const faces = useMemo(() => (g ? zonas.map(z => ({ id: z.id, top: z.ring.map(p => toXY(g, p)), label: toXY(g, z.label) })) : []), [g, zonas]);
  const outlinePts = useMemo(() => (g && outline && outline.length >= 3 ? outline.map(p => toXY(g, p)) : null), [g, outline]);
  const depth = flat ? 0 : DEPTH;
  const colorOf = (id: ZoneId) => ZONE_UI[zonas.find(z => z.id === id)?.color ?? 'green'];
  const active = activeZone ? faces.find(f => f.id === activeZone) ?? null : null;

  // Imagen satelital de TODA la caja visible (mismo sistema de coordenadas que el polígono).
  const [satFailed, setSatFailed] = useState(false);
  // URL ya cargada (si cambia la vista, se espera la nueva sin dejar la caja en negro).
  const [satLoaded, setSatLoaded] = useState<string | null>(null);
  const sat = useMemo(() => {
    if (!satellite || !g) return null;
    const tl = toLatLng(g, 0, 0), br = toLatLng(g, width, height);
    return satelliteUrl({ lat: br.lat, lng: tl.lng }, { lat: tl.lat, lng: br.lng }, width, height);
  }, [satellite, g, width, height]);
  const showSat = !!sat && !satFailed;
  const satReady = showSat && satLoaded === sat;

  // Aguacates: uno por foto, hasta 6 por zona.
  const pins = useMemo(() => faces.flatMap(f => {
    const n = counts[f.id] ?? 0;
    return spotsFor(f, Math.min(6, n), flat ? 1 : TILT).map((p, i) => ({ key: `${f.id}${i}`, zone: f.id, x: p[0], y: p[1], last: i === Math.min(6, n) - 1 }));
  }), [faces, counts, flat]);

  return (
    <View style={{ width, height, borderRadius: 22, overflow: 'hidden', backgroundColor: '#0A2618' }}>
      {/* Satélite debajo del SVG, estirado exactamente a la caja (mismo sistema de coordenadas que las zonas). */}
      {showSat && <Image source={{ uri: sat! }} style={[StyleSheet.absoluteFill, { opacity: satReady ? 1 : 0 }]} resizeMode="stretch"
        onLoad={() => setSatLoaded(sat)} onError={() => setSatFailed(true)} accessibilityIgnoresInvertColors />}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="grid" width={22} height={22} patternUnits="userSpaceOnUse">
            <Path d="M22 0 L0 0 0 22" fill="none" stroke="rgba(190,242,100,0.07)" strokeWidth={1} />
          </Pattern>
          <SvgGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#123D2A" />
            <Stop offset="1" stopColor="#0A2618" />
          </SvgGradient>
          <SvgGradient id="vig" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity={0.28} />
            <Stop offset="0.35" stopColor="#000000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.22} />
          </SvgGradient>
          <ClipPath id="card"><Rect x={0} y={0} width={width} height={height} rx={22} /></ClipPath>
        </Defs>
        <G clipPath="url(#card)">
          {!satReady && <Rect x={0} y={0} width={width} height={height} fill="url(#bg)" />}
          {!satReady && <Rect x={0} y={0} width={width} height={height} fill="url(#grid)" />}
          {showSat && <Rect x={0} y={0} width={width} height={height} fill="url(#vig)" />}
          {/* Contorno real de la huerta */}
          {outlinePts && <Path d={pathOf(outlinePts)} fill="none" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1.2} strokeDasharray="4 3" />}
          {/* Sombra y paredes de la extrusión (solo en perspectiva) */}
          {depth > 0 && faces.map(f => <Path key={`s${f.id}`} d={pathOf(f.top, depth + 7)} fill="#000000" opacity={0.25} />)}
          {depth > 0 && faces.map(f => {
            const c = colorOf(f.id);
            return (
              <G key={`w${f.id}`} opacity={showSat ? 0.85 : 1}>
                <Path d={pathOf(f.top, depth)} fill={c.line} />
                {f.top.map((p, i) => {
                  const q = f.top[(i + 1) % f.top.length];
                  return <Path key={i} d={`M${p[0]},${p[1]} L${q[0]},${q[1]} L${q[0]},${q[1] + depth} L${p[0]},${p[1] + depth} Z`} fill={c.line} />;
                })}
              </G>
            );
          })}
          {/* Caras superiores = área de toque */}
          {faces.map((f, i) => (
            <TopFace key={`t${f.id}`} face={f} index={i} fill={colorOf(f.id).fill} hover={hover} highlight={f.id === activeZone} sat={showSat}
              onPress={onZonePress ? () => onZonePress(f.id) : undefined} />
          ))}
          {/* Letra de la zona y total */}
          {faces.map(f => {
            const c = colorOf(f.id);
            const n = counts[f.id] ?? 0;
            const lx = f.label[0], ly = f.label[1] + 14;
            return (
              <G key={`l${f.id}`} onPress={onZonePress ? () => onZonePress(f.id) : undefined}>
                <Circle cx={lx} cy={ly} r={13} fill="#FFFFFF" stroke={c.line} strokeWidth={2.5} />
                <SvgText x={lx} y={ly + 5} fontSize={13.5} fontWeight="700" fontFamily="Poppins_700Bold" fill={c.ink} textAnchor="middle">{f.id}</SvgText>
                <Circle cx={lx + 12} cy={ly - 11} r={8.5} fill="#0B1A12" stroke="#BEF264" strokeWidth={1} />
                <SvgText x={lx + 12} y={ly - 7.5} fontSize={10} fontWeight="700" fontFamily="Poppins_700Bold" fill="#ECFCCB" textAnchor="middle">{n > 99 ? '99' : String(n)}</SvgText>
                {n > 6 && <SvgText x={lx} y={ly + 30} fontSize={10.5} fontWeight="700" fontFamily="Poppins_700Bold" fill="#FFFFFF" textAnchor="middle">{`+${n - 6}`}</SvgText>}
              </G>
            );
          })}
          {active && activeText && (() => {
            const n = counts[active.id] ?? 0;
            const txt = activeText(active.id, n);
            const w = Math.min(width - 16, 24 + txt.length * 7.2);
            const x = Math.max(8, Math.min(width - w - 8, active.label[0] - w / 2));
            const y = Math.max(6, active.label[1] - 76);
            return (
              <G>
                <Line x1={active.label[0]} y1={y + 30} x2={active.label[0]} y2={active.label[1] - 34} stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={1.4} strokeDasharray="3 3" />
                <Rect x={x} y={y} width={w} height={30} rx={15} fill="#D9F99D" stroke="#A3E635" strokeWidth={1.5} />
                <SvgText x={x + w / 2} y={y + 20} fontSize={13} fontWeight="700" fontFamily="Poppins_700Bold" fill="#14231A" textAnchor="middle">{txt}</SvgText>
              </G>
            );
          })()}
        </G>
      </Svg>
      {pins.map(p => <AvocadoPin key={p.key} x={p.x} y={p.y} fresh={p.zone === activeZone && p.last} tick={dropTick} />)}
      {showSat && !satReady && (
        <View style={st.loading} pointerEvents="none" accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color="#FFFFFF" /><Text style={st.loadingText}>{loadingLabel}</Text>
        </View>
      )}
      {onToggleFlat && (
        <Pressable onPress={onToggleFlat} accessibilityRole="switch" accessibilityState={{ checked: flat }} hitSlop={6} style={st.toggle}>
          <Layers size={15} color="#FFFFFF" /><Text style={st.toggleText}>{flatLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  pin: { position: 'absolute', width: 30, height: AVO * 1.25 + 5 },
  ring: { position: 'absolute', left: 1, bottom: 0, width: 28, height: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  loading: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: 'rgba(11,38,24,0.82)' },
  loadingText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#FFFFFF' },
  toggle: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: 'rgba(11,38,24,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  toggleText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#FFFFFF' },
});
