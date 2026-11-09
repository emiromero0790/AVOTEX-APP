/**
 * Estilos del mapa de «Mis escaneos», al estilo de los mapas de actividad de Strava:
 * - Tipos de mapa: Satélite, Híbrido, Estándar, Topográfico, Oscuro (y Zonas si hay huertas).
 *   Cada miniatura es un mosaico REAL de tu zona (el centro del mapa), de la misma fuente que el mapa.
 * - Estilo de ruta: Clásica, Velocidad, Tiempo y Calor (vista previa dibujada).
 * Elegir aplica al instante (Haptics.selectionAsync); el borde y el texto de la tarjeta elegida cambian
 * con una transición corta.
 */
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import Reanimated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { TranslationResource, useTranslations } from '../../context/LanguageContext';
import { CSS_EASE_OUT } from '../scan/motion';
import { SPEED_COLORS, TIME_COLORS, type ScansMapLayer, type ScansMapRouteStyle } from '../scansMapHtml';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
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

function tiles(layer: ScansMapLayer, c: { lat: number; lng: number }): string[] {
  const z = layer === 'oscuro' ? 15 : 16;
  const { x, y } = tileOf(c.lat, c.lng, z);
  const at = (svc: string) => `${ESRI}${svc}/MapServer/tile/${z}/${y}/${x}`;
  switch (layer) {
    case 'estandar': return [at('World_Street_Map')];
    case 'topo': return [at('World_Topo_Map')];
    case 'oscuro': return [at('Canvas/World_Dark_Gray_Base'), at('Canvas/World_Dark_Gray_Reference')];
    case 'hibrido': return [at('World_Imagery'), at('Reference/World_Transportation'), at('Reference/World_Boundaries_and_Places')];
    default: return [at('World_Imagery')];
  }
}

function Card({ on, label, sub, onPress, children, width }: { on: boolean; label: string; sub?: string; onPress: () => void; children: React.ReactNode; width: number }) {
  const t = useTranslations(translations);
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${label}${sub ? `, ${sub}` : ''}${on ? `, ${t('selected')}` : ''}`} style={{ width }}>
      {({ pressed }) => (
        <View style={{ alignItems: 'center', gap: 5 }}>
          <Reanimated.View style={[s.thumbWrap, { width, height: Math.round(width * 0.78), borderColor: on ? TEAL : 'transparent', transform: [{ scale: pressed ? 0.96 : 1 }], transitionProperty: ['borderColor', 'transform'], transitionDuration: 150, transitionTimingFunction: CSS_EASE_OUT } as object]}>
            <View style={s.thumb}>{children}</View>
          </Reanimated.View>
          <Text style={[s.label, on && s.labelOn]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label}</Text>
          {sub ? <Text style={s.sub} numberOfLines={1} maxFontSizeMultiplier={1.2}>{sub}</Text> : null}
        </View>
      )}
    </Pressable>
  );
}

const ROUTE_D = 'M6 52 C 18 22, 34 58, 48 34 S 78 14, 94 40';

function RoutePreview({ kind, w, h }: { kind: ScansMapRouteStyle; w: number; h: number }) {
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
  const layers: ScansMapLayer[] = ['satelite', 'hibrido', 'estandar', 'topo', 'oscuro', ...(zonesAvailable ? ['zonas' as const] : [])];
  const styles: ScansMapRouteStyle[] = ['clasica', 'velocidad', 'tiempo', 'calor'];
  const pickLayer = (l: ScansMapLayer) => { if (l !== layer) Haptics.selectionAsync().catch(() => {}); onLayer(l); };
  const pickStyle = (r: ScansMapRouteStyle) => { if (r !== routeStyle) Haptics.selectionAsync().catch(() => {}); onRouteStyle(r); };

  return (
    <View style={{ gap: 14 }}>
      <Text style={s.section} accessibilityRole="header">{t('mapTypes')}</Text>
      <View style={[s.grid, { gap }]} accessibilityRole="radiogroup">
        {layers.map(l => (
          <Card key={l} on={layer === l} label={t(l)} onPress={() => pickLayer(l)} width={cardW}>
            {tiles(l === 'zonas' ? 'satelite' : l, center).map((u, i) => (
              <Image key={u} source={{ uri: u }} style={[StyleSheet.absoluteFill, i > 0 && { opacity: 0.95 }]} resizeMode="cover" accessibilityIgnoresInvertColors />
            ))}
            {l === 'zonas' && (
              <View style={[StyleSheet.absoluteFill, s.zones]}>
                {['#84CC16', '#F59E0B', '#22C55E', '#EF4444'].map(c => <View key={c} style={[s.zone, { backgroundColor: c }]} />)}
              </View>
            )}
          </Card>
        ))}
      </View>

      <Text style={[s.section, { marginTop: 4 }]} accessibilityRole="header">{t('routeStyles')}</Text>
      <View style={[s.grid, { gap }]} accessibilityRole="radiogroup">
        {styles.map(r => (
          <Card key={r} on={routeStyle === r} label={t(r)} sub={t(`${r}Sub`)} onPress={() => pickStyle(r)} width={cardW}>
            {tiles(r === 'calor' ? 'oscuro' : 'satelite', center).slice(0, 1).map(u => (
              <Image key={u} source={{ uri: u }} style={[StyleSheet.absoluteFill, { opacity: r === 'calor' ? 1 : 0.85 }]} resizeMode="cover" accessibilityIgnoresInvertColors />
            ))}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: r === 'calor' ? 'rgba(0,0,0,0.25)' : 'rgba(15,23,42,0.18)' }]} />
            <RoutePreview kind={r} w={cardW - 9} h={Math.round(cardW * 0.78) - 9} />
          </Card>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: '#0F172A', letterSpacing: -0.2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  thumbWrap: { borderRadius: 16, borderWidth: 2.5, padding: 2 },
  thumb: { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#CBD5E1' },
  label: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#334155' },
  labelOn: { fontFamily: 'Poppins_700Bold', color: TEAL },
  sub: { fontFamily: 'Poppins_400Regular', fontSize: 10.5, color: '#64748B', marginTop: -4 },
  zones: { flexDirection: 'row', flexWrap: 'wrap', opacity: 0.45 },
  zone: { width: '50%', height: '50%', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.8)' },
});
