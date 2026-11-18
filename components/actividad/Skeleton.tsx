/**
 * Bloques de carga con destello gris (pulso de opacidad en el hilo de UI).
 * Con "Reducir movimiento" quedan fijos.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Reanimated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

export function SkeletonBlock({ w = '100%', h, r = 14, style, color = '#E5EAE7' }: { w?: DimensionValue; h: number; r?: number; style?: object; color?: string }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    o.set(withRepeat(withTiming(0.45, { duration: 750, easing: Easing.inOut(Easing.ease) }), -1, true));
    return () => cancelAnimation(o);
  }, [reduced, o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Reanimated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: color }, anim, style]} />;
}

/** Esqueleto de cada sección de Actividad. */
export function SectionSkeleton({ kind, heroH }: { kind: 'summary' | 'history' | 'plan'; heroH: number }) {
  if (kind === 'summary') {
    return (
      <View style={s.wrap}>
        {/* Resumen: verdes claros y marfil (sin cifras ficticias mientras carga) */}
        <SkeletonBlock h={heroH} r={26} color="#DCEBCB" />
        <SkeletonBlock h={98} r={22} color="#CFE3BC" />
        <View style={s.row}><SkeletonBlock w="40%" h={38} r={19} color="#ECF2E1" /><SkeletonBlock w="40%" h={38} r={19} color="#ECF2E1" /></View>
        {[170, 200, 220].map((h, i) => (
          <View key={i} style={s.card}>
            <View style={s.row}><SkeletonBlock w={40} h={40} r={13} color="#E3F0D6" /><View style={{ flex: 1, gap: 6 }}><SkeletonBlock w="60%" h={16} r={8} color="#E9EFE0" /><SkeletonBlock w="40%" h={11} r={6} color="#EEF2E6" /></View></View>
            <SkeletonBlock h={h - 80} r={14} color="#F0F4EA" />
          </View>
        ))}
      </View>
    );
  }
  if (kind === 'history') {
    return (
      <View style={s.wrap}>
        <SkeletonBlock w="60%" h={24} r={8} />
        <View style={s.row}>{[0, 1, 2, 3].map(i => <SkeletonBlock key={i} w={72} h={34} r={17} />)}</View>
        {[0, 1, 2, 3, 4, 5].map(i => <SkeletonBlock key={i} h={70} r={18} />)}
      </View>
    );
  }
  return (
    <View style={s.wrap}>
      <SkeletonBlock w="50%" h={24} r={8} />
      <SkeletonBlock h={110} r={18} />
      <SkeletonBlock h={48} r={14} />
      <SkeletonBlock h={72} r={15} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, gap: 12 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  card: { gap: 14, padding: 16, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDF1E6' },
});
