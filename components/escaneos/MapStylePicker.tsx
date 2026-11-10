/**
 * Estilos del mapa de «Mis escaneos», al estilo de los mapas de actividad de Strava:
 * - Tipos de mapa: Satélite, Híbrido, Estándar, Topográfico, Oscuro (y Zonas si hay huertas).
 *   Cada miniatura es un mosaico REAL de tu zona (el centro del mapa), de la misma fuente que el mapa.
 * - Estilo de ruta: Clásica, Velocidad, Tiempo y Calor (vista previa dibujada).
 * Elegir aplica al instante (Haptics.selectionAsync); el borde y el texto de la tarjeta elegida cambian
 * con una transición corta.
 */
import React, { memo, startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import Reanimated, { FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { TranslationResource, useTranslations } from '../../context/LanguageContext';
import { CSS_EASE_OUT } from '../scan/motion';
import { SPEED_COLORS, TIME_COLORS, type ScansMapLayer, type ScansMapRouteStyle } from '../scansMapHtml';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
/** Verde menta de selección (paleta oscura de Mis escaneos). */
const MINT = '#A7F3D0';
const TEAL = '#0F766E';

const translations: TranslationResource = {
  mapTypes: { es: 'Tipos de mapa', en: 'Map types' },
  routeStyles: { es: 'Estilo de ruta', en: 'Route style' },
  satelite: { es: 'Satélite', en: 'Satellite' },
  hibrido: { es: 'Híbrido', en: 'Hybrid' },
  estandar: { es: 'Estándar', en: 'Standard' },
  topo: { es: 'Topográfico', en: 'Topographic' },
  oscuro: { es: 'Oscuro', en: 'Dark' },
  zonas: { es: 'Zonas', en: 'Zones' },
  clasica: { es: 'Clásica', en: 'Classic' },
  velocidad: { es: 'Velocidad', en: 'Speed' },
  tiempo: { es: 'Tiempo', en: 'Time' },
  calor: { es: 'Calor', en: 'Heat' },
  clasicaSub: { es: 'Un color', en: 'One color' },
  velocidadSub: { es: 'Lento → rápido', en: 'Slow → fast' },
  tiempoSub: { es: 'Inicio → fin', en: 'Start → end' },
  calorSub: { es: 'Donde más caminas', en: 'Where you walk most' },
  selected: { es: 'seleccionado', en: 'selected' },
};

/** Mosaico (x, y) que contiene el punto a ese zoom. */
function tileOf(lat: number, lng: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const s = Math.sin((lat * Math.PI) / 180);
  const y = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n);
  return { x, y };
}

type TileSpec = { svc: string; z: number; base: boolean };

function tiles(layer: ScansMapLayer): TileSpec[] {
  const b = (svc: string, z = 16): TileSpec => ({ svc, z, base: true });
  const ref = (svc: string, z = 16): TileSpec => ({ svc, z, base: false });
  switch (layer) {
    case 'estandar': return [b('World_Street_Map')];
    case 'topo': return [b('World_Topo_Map')];
    case 'oscuro': return [b('Canvas/World_Dark_Gray_Base', 15), ref('Canvas/World_Dark_Gray_Reference', 15)];
    case 'hibrido': return [b('World_Imagery'), ref('Reference/World_Transportation'), ref('Reference/World_Boundaries_and_Places')];
    default: return [b('World_Imagery')];
  }
}

/**
 * Un mosaico de la miniatura. Si la descarga falla (red lenta, o el servicio no tiene ese mosaico a
 * ese zoom), reintenta una vez y luego baja de zoom hasta 3 niveles: el mosaico padre cubre la misma
 * zona. Las capas de referencia (calles, rótulos) no reintentan: un 404 ahí es un mosaico vacío.
 */
const Tile = memo(function Tile({ spec, lat, lng, opacity, onDone }: { spec: TileSpec; lat: number; lng: number; opacity?: number; onDone?: () => void }) {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { setAttempt(0); }, [spec.svc, lat, lng]);
  const dead = attempt > 4;
  // Sin mosaico tras todos los intentos: se avisa igual, para que el indicador de carga no gire para siempre.
  useEffect(() => { if (dead) onDone?.(); }, [dead, onDone]);
  if (dead) return null;
  const z = spec.z - Math.max(0, attempt - 1);
  const { x, y } = tileOf(lat, lng, z);
  const uri = `${ESRI}${spec.svc}/MapServer/tile/${z}/${y}/${x}${attempt === 1 ? '?r=1' : ''}`;
  return (
    <Image
      source={{ uri }}
      style={[StyleSheet.absoluteFill, opacity != null && { opacity }]}
      resizeMode="cover"
      fadeDuration={120}
      onLoad={onDone}
      onError={() => setAttempt(a => (spec.base ? a + 1 : 99))}
      accessibilityIgnoresInvertColors
    />
  );
});

const Card = memo(function Card({ on, label, sub, onPress, children, width }: { on: boolean; label: string; sub?: string; onPress: () => void; children: React.ReactNode; width: number }) {
  const t = useTranslations(translations);
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${label}${sub ? `, ${sub}` : ''}${on ? `, ${t('selected')}` : ''}`} style={{ width }}>
      {({ pressed }) => (
        <View style={{ alignItems: 'center', gap: 5 }}>
          <Reanimated.View style={[s.thumbWrap, { width, height: Math.round(width * 0.78), borderColor: on ? MINT : 'transparent', transform: [{ scale: pressed ? 0.96 : 1 }], transitionProperty: ['borderColor', 'transform'], transitionDuration: 150, transitionTimingFunction: CSS_EASE_OUT } as object]}>
            <View style={s.thumb}>{children}</View>
          </Reanimated.View>
          <Text style={[s.label, on && s.labelOn]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label}</Text>
          {sub ? <Text style={s.sub} numberOfLines={1} maxFontSizeMultiplier={1.2}>{sub}</Text> : null}
        </View>
      )}
    </Pressable>
  );
});

const ROUTE_D = 'M6 52 C 18 22, 34 58, 48 34 S 78 14, 94 40';

const RoutePreview = memo(function RoutePreview({ kind, w, h }: { kind: ScansMapRouteStyle; w: number; h: number }) {
  const stroke = kind === 'velocidad' ? 'url(#spd)' : kind === 'tiempo' ? 'url(#tim)' : '#14B8A6';
  return (
    <Svg width={w} height={h} viewBox="0 0 100 64" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgGradient id="spd" x1="0" y1="0" x2="1" y2="0">
          {SPEED_COLORS.map((c, i) => <Stop key={c} offset={i / (SPEED_COLORS.length - 1)} stopColor={c} />)}
        </SvgGradient>
        <SvgGradient id="tim" x1="0" y1="0" x2="1" y2="0">
          {TIME_COLORS.map((c, i) => <Stop key={c} offset={i / (TIME_COLORS.length - 1)} stopColor={c} />)}
        </SvgGradient>
      </Defs>
      {kind === 'calor' ? (
        <>
          <Path d={ROUTE_D} stroke="#FF3D00" strokeOpacity={0.35} strokeWidth={12} fill="none" strokeLinecap="round" />
          <Path d="M10 20 C 30 30, 50 40, 90 56" stroke="#FF3D00" strokeOpacity={0.3} strokeWidth={10} fill="none" strokeLinecap="round" />
          <Path d={ROUTE_D} stroke="#FF7A00" strokeOpacity={0.7} strokeWidth={6} fill="none" strokeLinecap="round" />
          <Path d="M10 20 C 30 30, 50 40, 90 56" stroke="#FF7A00" strokeOpacity={0.55} strokeWidth={5} fill="none" strokeLinecap="round" />
          <Path d={ROUTE_D} stroke="#FFD166" strokeWidth={2.2} fill="none" strokeLinecap="round" />
          <Path d="M10 20 C 30 30, 50 40, 90 56" stroke="#FFE7A3" strokeWidth={1.8} fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <Path d={ROUTE_D} stroke="#FFFFFF" strokeOpacity={0.9} strokeWidth={8} fill="none" strokeLinecap="round" />
          <Path d={ROUTE_D} stroke={stroke} strokeWidth={4.5} fill="none" strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
});

const LAYERS: ScansMapLayer[] = ['satelite', 'hibrido', 'estandar', 'topo', 'oscuro'];
// Velocidad y Tiempo usan las horas reales de la ruta; sin ellas la leyenda del mapa lo indica.
const ROUTE_STYLES: ScansMapRouteStyle[] = ['clasica', 'velocidad', 'tiempo'];
const ZONE_COLORS = ['#84CC16', '#F59E0B', '#22C55E', '#EF4444'];

/** Tarjeta de un tipo de mapa. `onPick` es estable, así que al elegir solo se repintan dos tarjetas. */
const LayerCard = memo(function LayerCard({ l, on, label, width, lat, lng, onPick }: { l: ScansMapLayer; on: boolean; label: string; width: number; lat: number; lng: number; onPick: (l: ScansMapLayer) => void }) {
  const [ready, setReady] = useState(false);
  const done = useCallback(() => setReady(true), []);
  return (
    <Card on={on} label={label} onPress={() => onPick(l)} width={width}>
      {tiles(l === 'zonas' ? 'satelite' : l).map((sp, i) => (
        <Tile key={sp.svc} spec={sp} lat={lat} lng={lng} opacity={i > 0 ? 0.95 : undefined} onDone={i === 0 ? done : undefined} />
      ))}
      {l === 'zonas' && (
        <View style={[StyleSheet.absoluteFill, s.zones]}>
          {ZONE_COLORS.map(c => <View key={c} style={[s.zone, { backgroundColor: c }]} />)}
        </View>
      )}
      {!ready && <ThumbLoading />}
    </Card>
  );
});

const RouteCard = memo(function RouteCard({ r, on, label, sub, width, lat, lng, onPick }: { r: ScansMapRouteStyle; on: boolean; label: string; sub: string; width: number; lat: number; lng: number; onPick: (r: ScansMapRouteStyle) => void }) {
  const [ready, setReady] = useState(false);
  const done = useCallback(() => setReady(true), []);
  return (
    <Card on={on} label={label} sub={sub} onPress={() => onPick(r)} width={width}>
      <Tile spec={tiles(r === 'calor' ? 'oscuro' : 'satelite')[0]} lat={lat} lng={lng} opacity={r === 'calor' ? 1 : 0.85} onDone={done} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: r === 'calor' ? 'rgba(0,0,0,0.25)' : 'rgba(15,23,42,0.18)' }]} />
      {!ready && <ThumbLoading dark />}
      <RoutePreview kind={r} w={width - 9} h={Math.round(width * 0.78) - 9} />
    </Card>
  );
});

/**
 * Descarga por adelantado las miniaturas de esa zona (se llama al entrar a «Mis escaneos»), para que
 * al abrir el panel ya estén en la caché de imágenes y no haya que esperarlas.
 */
export function prefetchStyleThumbs(center: { lat: number; lng: number }) {
  const seen = new Set<string>();
  for (const layer of LAYERS) {
    for (const sp of tiles(layer)) {
      const { x, y } = tileOf(center.lat, center.lng, sp.z);
      const uri = `${ESRI}${sp.svc}/MapServer/tile/${sp.z}/${y}/${x}`;
      if (seen.has(uri)) continue;
      seen.add(uri);
      Image.prefetch(uri).catch(() => {});
    }
  }
}

/** Indicador mientras baja la miniatura: se desvanece al llegar la imagen. */
function ThumbLoading({ dark }: { dark?: boolean }) {
  return (
    <Reanimated.View exiting={FadeOut.duration(160)} pointerEvents="none"
      style={[StyleSheet.absoluteFill, s.loading, { backgroundColor: dark ? '#94A3B8' : '#E2E8F0' }]}>
      <ActivityIndicator size="small" color={dark ? '#FFFFFF' : TEAL} />
    </Reanimated.View>
  );
}

type Props = {
  layer: ScansMapLayer;
  routeStyle: ScansMapRouteStyle;
  zonesAvailable: boolean;
  /** Centro del mapa, para que las miniaturas sean de tu zona. */
  center: { lat: number; lng: number };
  width: number;
  onLayer: (l: ScansMapLayer) => void;
  onRouteStyle: (r: ScansMapRouteStyle) => void;
};

export default function MapStylePicker({ layer, routeStyle, zonesAvailable, center, width, onLayer, onRouteStyle }: Props) {
  const t = useTranslations(translations);
  const cols = 3;
  const gap = 12;
  const cardW = Math.floor((width - gap * (cols - 1)) / cols);
  const layers = zonesAvailable ? [...LAYERS, 'zonas' as const] : LAYERS;

  // La elección se marca aquí al instante; la pantalla (mapa + lista, un render pesado) se actualiza
  // en una transición para no congelar el toque ni la animación de la tarjeta.
  const [selLayer, setSelLayer] = useState(layer);
  const [selStyle, setSelStyle] = useState(routeStyle);
  useEffect(() => { setSelLayer(layer); }, [layer]);
  useEffect(() => { setSelStyle(routeStyle); }, [routeStyle]);
  // El centro se fija al abrir: así las miniaturas no se vuelven a descargar mientras eliges.
  const [{ lat, lng }] = useState(center);

  const cur = useRef({ layer: selLayer, style: selStyle });
  cur.current = { layer: selLayer, style: selStyle };

  const pickLayer = useCallback((l: ScansMapLayer) => {
    if (cur.current.layer === l) return;
    Haptics.selectionAsync().catch(() => {});
    setSelLayer(l);
    startTransition(() => onLayer(l));
  }, [onLayer]);
  const pickStyle = useCallback((r: ScansMapRouteStyle) => {
    if (cur.current.style === r) return;
    Haptics.selectionAsync().catch(() => {});
    setSelStyle(r);
    startTransition(() => onRouteStyle(r));
  }, [onRouteStyle]);

  return (
    <View style={{ gap: 14 }}>
      <Text style={s.section} accessibilityRole="header">{t('mapTypes')}</Text>
      <View style={[s.grid, { gap }]} accessibilityRole="radiogroup">
        {layers.map(l => (
          <LayerCard key={l} l={l} on={selLayer === l} label={t(l)} width={cardW} lat={lat} lng={lng} onPick={pickLayer} />
        ))}
      </View>

      <Text style={[s.section, { marginTop: 4 }]} accessibilityRole="header">{t('routeStyles')}</Text>
      <View style={[s.grid, { gap }]} accessibilityRole="radiogroup">
        {ROUTE_STYLES.map(r => (
          <RouteCard key={r} r={r} on={selStyle === r} label={t(r)} sub={t(`${r}Sub`)} width={cardW} lat={lat} lng={lng} onPick={pickStyle} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: '#FFFFFF', letterSpacing: -0.2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  thumbWrap: { borderRadius: 16, borderWidth: 2.5, padding: 2 },
  thumb: { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1E2A30' },
  label: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#AAB5BF' },
  labelOn: { fontFamily: 'Poppins_700Bold', color: MINT },
  sub: { fontFamily: 'Poppins_400Regular', fontSize: 10.5, color: '#7C8A96', marginTop: -4 },
  loading: { alignItems: 'center', justifyContent: 'center' },
  zones: { flexDirection: 'row', flexWrap: 'wrap', opacity: 0.45 },
  zone: { width: '50%', height: '50%', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.8)' },
});
