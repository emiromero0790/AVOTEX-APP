/**
 * Selector Resumen / Escaneos / Historial / Plan de trabajo: cápsula verde bosque semitransparente con
 * separadores finos; la opción activa lleva un degradado verde luminoso → verde profundo con contorno lima.
 *
 * Movimiento (animate-expo): se usa decenas de veces por sesión, así que la selección es un fundido de
 * opacidad de 160 ms (transición CSS, sin valores compartidos) y la pulsación una escala 0.97 de 120 ms.
 * Nada se desliza entre pestañas. Con «Reducir movimiento» el cambio es inmediato.
 *
 * Solo cambia el aspecto: la navegación la decide quien lo usa (onPress).
 */
import React, { memo } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Reanimated, { useReducedMotion } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import { CSS_OUT } from './charts/GrowBar';
import { P } from './charts/core';

export type TabItem<K extends string> = { key: K; label: string; Icon: LucideIcon; weight?: number };

function ActividadTabsBase<K extends string>({ items, active, onPress }: { items: TabItem<K>[]; active: K; onPress: (key: K) => void }) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  // Teléfonos estrechos: algo menos de padding, icono y letra; muy estrechos (< 380 dp): icono solo en la activa.
  // Cada opción toma el ancho de su contenido y el sobrante se reparte por igual (flexGrow), así
  // «Plan de trabajo» recibe más espacio que «Resumen» sin truncarse.
  const narrow = width < 430;
  const tiny = width < 380;
  const icon = tiny ? 13 : narrow ? 14 : 16;
  const font = tiny ? 10.5 : narrow ? 11 : 12.5;
  return (
    <View style={[st.wrap, { marginHorizontal: narrow ? 10 : 16 }]} accessibilityRole="tablist">
      {items.map(({ key, label, Icon, weight }, i) => {
        const on = key === active;
        const showIcon = !tiny || on;
        return (
          <React.Fragment key={key}>
            {i > 0 && <View style={[st.sep, (on || items[i - 1].key === active) && { opacity: 0 }]} />}
            <Pressable onPress={() => onPress(key)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label}
              hitSlop={{ top: 6, bottom: 6 }} pressRetentionOffset={16}
              style={({ pressed }) => [st.item, { flexGrow: weight ?? 1, paddingHorizontal: tiny ? 2 : narrow ? 3 : 8, gap: narrow ? 3 : 6 }, pressed && !reduced && { transform: [{ scale: 0.97 }] }]}>
              <Reanimated.View pointerEvents="none"
                style={[st.activeBg, { opacity: on ? 1 : 0 }, reduced ? null : ({ transitionProperty: 'opacity', transitionDuration: 160, transitionTimingFunction: CSS_OUT } as object)]}>
                <LinearGradient colors={['#4FBF45', P.agri, P.deep]} locations={[0, 0.5, 1]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 24 }]} />
                <View style={st.activeGloss} />
              </Reanimated.View>
              {/* El icono va en una View: en web un <svg> suelto quedaría debajo del fondo activo (absoluto). */}
              {showIcon && <View><Icon size={on ? icon + 1 : icon} color={on ? '#FFFFFF' : P.limeSoft} strokeWidth={on ? 2.5 : 2} /></View>}
              <Text style={[st.text, { fontSize: font }, on && st.textOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.15}>{label}</Text>
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
}

export const ActividadTabs = memo(ActividadTabsBase) as typeof ActividadTabsBase;
export default ActividadTabs;

const st = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', height: 58, padding: 4, borderRadius: 29,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(8,61,37,0.86)' : 'rgba(8,61,37,0.92)',
    borderWidth: 1, borderColor: 'rgba(216,255,121,0.45)',
    shadowColor: '#06301B', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 7,
  },
  sep: { width: 1, height: 24, marginHorizontal: 1, backgroundColor: 'rgba(216,255,121,0.22)' },
  item: { height: '100%', flexShrink: 1, flexBasis: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  activeBg: {
    ...StyleSheet.absoluteFill, borderRadius: 24, borderWidth: 1.5, borderColor: P.lime,
    shadowColor: P.lime, shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  activeGloss: { position: 'absolute', left: 10, right: 10, top: 3, height: 10, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.18)' },
  text: { fontFamily: 'Poppins_600SemiBold', color: 'rgba(240,250,230,0.92)', flexShrink: 1, letterSpacing: -0.1 },
  textOn: { color: '#FFFFFF' },
});
