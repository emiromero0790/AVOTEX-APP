/**
 * Mapa de zonas semi‑3D (perspectiva oblicua con extrusión baja) para «Ubica tus fotos».
 * Misma geometría y colores que Satélite → Zonas (services/satZones.ts vía la copia ZonaSnapshot).
 *
 * - La superficie visible de cada zona (cara superior) es EXACTAMENTE su área de toque/soltado:
 *   project3D() devuelve esos polígonos y la pantalla los usa para el arrastre en el hilo de UI.
 * - Un marcador por zona con su total; la zona activa muestra «Zona D · 3 fotos» y un aguacate que cae
 *   y se asienta (resorte corto; con «Reducir movimiento» solo aparece).
 */
import React, { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient as SvgGradient, Path, Pattern, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import Reanimated, { type SharedValue, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import type { LatLng, ZoneId } from '../../services/satZones';
import { ZONE_UI, type ZonaSnapshot } from '../../services/grabacion';
import { projectZones } from './ZoneBoard';

/** Inclinación (escala vertical) y altura de la extrusión en px. */
const TILT = 0.64;
const DEPTH = 11;

export type Face3D = { id: ZoneId; top: [number, number][]; label: [number, number] };

/** Caras superiores (área de toque) y puntos de etiqueta, en coordenadas del componente w×h. */
export function project3D(zonas: ZonaSnapshot[], outline: LatLng[] | null, w: number, h: number): Face3D[] {
  const m = 18;
  const flatH = (h - DEPTH - 2 * m - 26) / TILT; // 26 px arriba para los marcadores
  const flat = projectZones(zonas, outline, w - 2 * m, Math.max(40, flatH), 0);
  const tf = ([x, y]: [number, number]): [number, number] => [x + m, y * TILT + m + 26];
  return flat.zones.map(z => ({ id: z.id, top: z.pts.map(tf), label: tf(z.label) }));
}

const pathOf = (pts: [number, number][], dy = 0) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${(p[1] + dy).toFixed(1)}`).join(' ') + ' Z';

const AnimatedPath = Reanimated.createAnimatedComponent(Path);

const TopFace = memo(function TopFace({ face, index, fill, hover, highlight, onPress }: {
  face: Face3D; index: number; fill: string; hover?: SharedValue<number>; highlight: boolean; onPress?: () => void;
}) {
  const animatedProps = useAnimatedProps(() => {
    const on = hover ? hover.get() === index : false;
    return { fillOpacity: on ? 1 : highlight ? 0.98 : 0.9, strokeOpacity: on || highlight ? 1 : 0.5, strokeWidth: on ? 3 : highlight ? 2.2 : 1.2 };
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

type Props = {
  zonas: ZonaSnapshot[];
  outline?: LatLng[] | null;
  width: number;
  height: number;
  /** Fotos por zona. */
  counts: Partial<Record<ZoneId, number>>;
  /** Zona de la última asignación (marcador grande + aguacate). */
  activeZone: ZoneId | null;
  /** Cambia en cada asignación para repetir la animación del aguacate. */
  dropTick: number;
  hover?: SharedValue<number>;
  onZonePress?: (id: ZoneId) => void;
  activeText?: (id: ZoneId, n: number) => string;
};

export default function ZoneMap3D({ zonas, outline = null, width, height, counts, activeZone, dropTick, hover, onZonePress, activeText }: Props) {
  const reduced = useReducedMotion();
  const faces = useMemo(() => project3D(zonas, outline, width, height), [zonas, outline, width, height]);
  const colorOf = (id: ZoneId) => ZONE_UI[zonas.find(z => z.id === id)?.color ?? 'green'];
  const active = activeZone ? faces.find(f => f.id === activeZone) ?? null : null;

  // Aguacate: cae ~34 px y se asienta con un rebote corto; la sombra crece al aterrizar.
  const fall = useSharedValue(0);
  const shadow = useSharedValue(1);
  useEffect(() => {
    if (!dropTick || !activeZone) return;
    if (reduced) { fall.set(0); shadow.set(1); return; }
    fall.set(-34);
    fall.set(withSpring(0, { duration: 420, dampingRatio: 0.55 }));
    shadow.set(0.4);
    shadow.set(withSequence(withTiming(0.4, { duration: 120 }), withTiming(1, { duration: 260 })));
  }, [dropTick, activeZone, reduced, fall, shadow]);
  const avoStyle = useAnimatedStyle(() => ({ transform: [{ translateY: fall.get() }] }));
  const shadowStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: shadow.get() }], opacity: 0.12 + 0.18 * shadow.get() }));

  const AVO = 30;
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <Pattern id="grid" width={22} height={22} patternUnits="userSpaceOnUse">
            <Path d="M22 0 L0 0 0 22" fill="none" stroke="rgba(190,242,100,0.07)" strokeWidth={1} />
          </Pattern>
          <SvgGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#123D2A" />
            <Stop offset="1" stopColor="#0A2618" />
          </SvgGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} rx={22} fill="url(#bg)" />
        <Rect x={0} y={0} width={width} height={height} rx={22} fill="url(#grid)" />
        {/* Sombra del bloque */}
        {faces.map(f => <Path key={`s${f.id}`} d={pathOf(f.top, DEPTH + 7)} fill="#000000" opacity={0.22} />)}
        {/* Paredes: base desplazada + cuadriláteros por arista (color más oscuro) */}
        {faces.map(f => {
          const c = colorOf(f.id);
          return (
            <G key={`w${f.id}`}>
              <Path d={pathOf(f.top, DEPTH)} fill={c.line} />
              {f.top.map((p, i) => {
                const q = f.top[(i + 1) % f.top.length];
                return <Path key={i} d={`M${p[0]},${p[1]} L${q[0]},${q[1]} L${q[0]},${q[1] + DEPTH} L${p[0]},${p[1] + DEPTH} Z`} fill={c.line} />;
              })}
            </G>
          );
        })}
        {/* Caras superiores = área de toque */}
        {faces.map((f, i) => (
          <TopFace key={`t${f.id}`} face={f} index={i} fill={colorOf(f.id).fill} hover={hover} highlight={f.id === activeZone}
            onPress={onZonePress ? () => onZonePress(f.id) : undefined} />
        ))}
        {/* Etiquetas y totales */}
        {faces.map(f => {
          const c = colorOf(f.id);
          const n = counts[f.id] ?? 0;
          const isActive = f.id === activeZone;
          const lx = f.label[0], ly = f.label[1];
          return (
            <G key={`l${f.id}`} onPress={onZonePress ? () => onZonePress(f.id) : undefined}>
              <Circle cx={lx} cy={ly} r={14} fill="#FFFFFF" stroke={c.line} strokeWidth={2.5} />
              <SvgText x={lx} y={ly + 5} fontSize={14} fontWeight="700" fontFamily="Poppins_700Bold" fill={c.ink} textAnchor="middle">{f.id}</SvgText>
              {n > 0 && !isActive && (
                <G>
                  <Rect x={lx + 9} y={ly - 22} width={n > 9 ? 24 : 18} height={16} rx={8} fill="#0B1A12" stroke="#BEF264" strokeWidth={1} />
                  <SvgText x={lx + 9 + (n > 9 ? 12 : 9)} y={ly - 10.5} fontSize={10.5} fontWeight="700" fontFamily="Poppins_700Bold" fill="#ECFCCB" textAnchor="middle">{String(n)}</SvgText>
                </G>
              )}
            </G>
          );
        })}
        {active && activeText && (() => {
          const n = counts[active.id] ?? 0;
          const txt = activeText(active.id, n);
          const w = Math.min(width - 16, 22 + txt.length * 7.2);
          const x = Math.max(8, Math.min(width - w - 8, active.label[0] - w / 2));
          const avoTop = active.label[1] - 16 - AVO * 1.25 - 6;
          const y = Math.max(4, avoTop - 40);
          return (
            <G>
              <Line x1={active.label[0]} y1={y + 30} x2={active.label[0]} y2={avoTop - 2} stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={1.4} strokeDasharray="3 3" />
              <Rect x={x} y={y} width={w} height={30} rx={15} fill="#D9F99D" stroke="#A3E635" strokeWidth={1.5} />
              <SvgText x={x + w / 2} y={y + 20} fontSize={13} fontWeight="700" fontFamily="Poppins_700Bold" fill="#14231A" textAnchor="middle">{txt}</SvgText>
            </G>
          );
        })()}
      </Svg>
      {active && (
        <View pointerEvents="none" style={[st.avoWrap, { left: active.label[0] - AVO / 2, top: active.label[1] - 16 - AVO * 1.25 - 6 }]}>
          <Reanimated.View style={[st.avoShadow, shadowStyle, { width: AVO * 0.8, left: AVO * 0.1, top: AVO * 1.25 - 1 }]} />
          <Reanimated.View style={avoStyle}><AvocadoGlyph size={AVO} /></Reanimated.View>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  avoWrap: { position: 'absolute', width: 30 },
  avoShadow: { position: 'absolute', height: 7, borderRadius: 4, backgroundColor: '#000000' },
});
