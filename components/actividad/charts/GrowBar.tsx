/**
 * Barra horizontal con volumen (degradado, reflejo superior y base algo más oscura) que crece al aparecer.
 *
 * Movimiento (animate-expo):
 * - Entrada: el relleno se desliza desde la izquierda dentro de su propio canal (translateX −100 % → 0,
 *   650 ms, salida fuerte). Solo transform: no hay relayout por fotograma y las esquinas no se deforman.
 * - Cambio de filtro: el ancho del relleno (absoluto, fuera del flujo) pasa al valor nuevo con una transición
 *   CSS de 450 ms; nada más de la tarjeta se vuelve a medir.
 * - «Reducir movimiento»: sin deslizamiento ni transición; los valores aparecen directamente.
 */
import React, { memo } from 'react';
import { StyleSheet, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import Reanimated, { cubicBezier } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

export const CSS_OUT = cubicBezier(0.23, 1, 0.32, 1);
export const CSS_IN_OUT = cubicBezier(0.77, 0, 0.175, 1);

/** Entrada deslizando desde la izquierda (keyframes CSS de Reanimated). */
export const SLIDE_IN = { from: { transform: [{ translateX: '-100%' }] }, to: { transform: [{ translateX: '0%' }] } };

/** Estilo de entrada reutilizable: deslizamiento + transición de ancho. */
export function growStyle(reduced: boolean, delay = 0): object {
  if (reduced) return {};
  return {
    animationName: SLIDE_IN, animationDuration: 650, animationDelay: delay,
    animationTimingFunction: CSS_OUT, animationFillMode: 'backwards',
  };
}
export function widthTransition(reduced: boolean): object {
  return reduced ? {} : { transitionProperty: 'width', transitionDuration: 450, transitionTimingFunction: CSS_IN_OUT };
}

type Props = {
  /** 0–100 */
  pct: number;
  height?: number;
  colors: readonly [ColorValue, ColorValue, ...ColorValue[]];
  track?: string;
  reduced: boolean;
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

function GrowBar({ pct, height = 18, colors, track = '#EEF2EA', reduced, delay = 0, style }: Props) {
  const r = height / 2;
  const w = Math.max(0, Math.min(100, pct));
  return (
    <View style={[st.track, { height, borderRadius: r, backgroundColor: track }, style]}>
      {/* sombra interior del canal */}
      <View pointerEvents="none" style={[st.inset, { borderRadius: r }]} />
      <Reanimated.View style={[st.fillBox, { width: `${w}%`, borderRadius: r }, widthTransition(reduced)]}>
        <Reanimated.View style={[StyleSheet.absoluteFill, growStyle(reduced, delay)]}>
          <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: r }]} />
          {/* base más oscura y reflejo superior: volumen sin 3D real */}
          <View style={[st.base, { borderBottomLeftRadius: r, borderBottomRightRadius: r }]} />
          <View style={[st.gloss, { top: height * 0.14, height: height * 0.32, borderRadius: height * 0.16, left: Math.min(6, r), right: Math.min(6, r) }]} />
        </Reanimated.View>
      </Reanimated.View>
    </View>
  );
}

export default memo(GrowBar);

const st = StyleSheet.create({
  track: { overflow: 'hidden', width: '100%' },
  inset: { ...StyleSheet.absoluteFill, borderTopWidth: 1, borderColor: 'rgba(16,45,34,0.06)' },
  fillBox: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  base: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%', backgroundColor: 'rgba(6,40,20,0.14)' },
  gloss: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.42)' },
});
