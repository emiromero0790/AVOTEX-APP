/**
 * Selector de capas de Mis escaneos: panel flotante ligero (no es un modal) que sale junto al botón Capas.
 * - Tipo de mapa: Oscuro (predeterminado) y Estándar.
 * - Estilo de ruta: Clásica (degradado por avance), Velocidad y Tiempo.
 * - Qué se dibuja: rutas, fotos, hallazgos y huertas.
 * Cada toque cambia el mapa al instante: el mapa solo alterna visibilidad de capas, no se recarga.
 */
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { Bug, Camera, Leaf, Moon, Route, Signpost } from 'lucide-react-native';
import { TranslationResource, useTranslations } from '../../context/LanguageContext';
import type { ScansMapLayer, ScansMapRouteStyle, ScansMapShow } from '../scansMapHtml';

const C = {
  glass: 'rgba(14,21,25,0.94)', border: 'rgba(255,255,255,0.09)', text: '#F1F5F4', muted: '#93A3AC',
  mint: '#A7F3D0', neon: '#8BF52B', ink: '#06110D', chip: 'rgba(255,255,255,0.06)',
};

const translations: TranslationResource = {
  mapTypes: { es: 'Mapa', en: 'Map' },
  routeStyles: { es: 'Ruta', en: 'Route' },
  showTitle: { es: 'Mostrar', en: 'Show' },
  oscuro: { es: 'Oscuro', en: 'Dark' },
  estandar: { es: 'Estándar', en: 'Standard' },
  clasica: { es: 'Avance', en: 'Progress' },
  velocidad: { es: 'Velocidad', en: 'Speed' },
  tiempo: { es: 'Tiempo', en: 'Time' },
  routes: { es: 'Rutas', en: 'Routes' },
  photos: { es: 'Fotos', en: 'Photos' },
  findings: { es: 'Hallazgos', en: 'Findings' },
  orchards: { es: 'Huertas', en: 'Orchards' },
};

const LAYER_ICON = { oscuro: Moon, estandar: Signpost } as const;
const LAYERS = ['oscuro', 'estandar'] as const;
const ROUTE_STYLES: ScansMapRouteStyle[] = ['clasica', 'velocidad', 'tiempo'];
const SHOW_ICON = { routes: Route, photos: Camera, findings: Bug, orchards: Leaf } as const;

type Props = {
  layer: ScansMapLayer;
  routeStyle: ScansMapRouteStyle;
  show: ScansMapShow;
  onLayer: (l: ScansMapLayer) => void;
  onRouteStyle: (r: ScansMapRouteStyle) => void;
  onShow: (k: keyof ScansMapShow, v: boolean) => void;
  style?: object;
};

function MapStylePicker({ layer, routeStyle, show, onLayer, onRouteStyle, onShow, style }: Props) {
  const t = useTranslations(translations);
  const reduced = useReducedMotion();
  const current = layer === 'oscuro' ? 'oscuro' : 'estandar';
  return (
    <Reanimated.View entering={FadeIn.duration(reduced ? 0 : 140)} exiting={FadeOut.duration(reduced ? 0 : 110)} style={[s.panel, style]} accessibilityViewIsModal>
      <Text style={s.section}>{t('mapTypes')}</Text>
      <View style={s.tiles} accessibilityRole="radiogroup">
        {LAYERS.map(l => {
          const on = current === l;
          const Icon = LAYER_ICON[l];
          return (
            <Pressable key={l} onPress={() => onLayer(l)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={t(l)}
              style={({ pressed }) => [s.tile, on && s.tileOn, pressed && s.pressed]}>
              <Icon size={18} color={on ? C.ink : C.text} />
              <Text style={[s.tileText, on && s.textOn]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{t(l)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={s.section}>{t('routeStyles')}</Text>
      <View style={s.row} accessibilityRole="radiogroup">
        {ROUTE_STYLES.map(r => {
          const on = routeStyle === r;
          return (
            <Pressable key={r} onPress={() => onRouteStyle(r)} accessibilityRole="radio" accessibilityState={{ checked: on }}
              style={({ pressed }) => [s.chip, on && s.chipOn, pressed && s.pressed]}>
              <Text style={[s.chipText, on && s.textOn]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{t(r)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={s.section}>{t('showTitle')}</Text>
      <View style={s.grid}>
        {(Object.keys(SHOW_ICON) as (keyof ScansMapShow)[]).map(k => {
          const on = show[k];
          const Icon = SHOW_ICON[k];
          return (
            <Pressable key={k} onPress={() => onShow(k, !on)} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={t(k)}
              style={({ pressed }) => [s.toggle, on && s.toggleOn, pressed && s.pressed]}>
              <Icon size={14} color={on ? C.mint : C.muted} />
              <Text style={[s.chipText, on ? { color: C.text } : { color: C.muted }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{t(k)}</Text>
            </Pressable>
          );
        })}
      </View>
    </Reanimated.View>
  );
}

export default memo(MapStylePicker);

const s = StyleSheet.create({
  panel: {
    width: 236, padding: 12, gap: 8, borderRadius: 20, backgroundColor: C.glass, borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 14,
  },
  section: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, letterSpacing: 0.6, color: C.muted, textTransform: 'uppercase', marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tiles: { flexDirection: 'row', gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  tile: { flex: 1, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: C.chip, borderWidth: 1, borderColor: C.border },
  tileOn: { backgroundColor: C.mint, borderColor: C.mint },
  tileText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: C.text },
  textOn: { color: C.ink },
  chip: { flex: 1, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: C.chip, borderWidth: 1, borderColor: C.border },
  chipOn: { backgroundColor: C.mint, borderColor: C.mint },
  chipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: C.text },
  toggle: { width: 100, height: 34, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border },
  toggleOn: { backgroundColor: 'rgba(167,243,208,0.12)', borderColor: 'rgba(167,243,208,0.45)' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
});
