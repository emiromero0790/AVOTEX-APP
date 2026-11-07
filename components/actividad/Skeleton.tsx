/**
 * Bloques de carga con destello gris (pulso de opacidad en el hilo de UI).
 * Con "Reducir movimiento" quedan fijos.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Reanimated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

export function SkeletonBlock({ w = '100%', h, r = 14, style }: { w?: DimensionValue; h: number; r?: number; style?: object }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    o.set(withRepeat(withTiming(0.45, { duration: 750, easing: Easing.inOut(Easing.ease) }), -1, true));
    return () => cancelAnimation(o);
  }, [reduced, o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Reanimated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: '#E5EAE7' }, anim, style]} />;
}

/** Esqueleto de cada sección de Actividad. */
export function SectionSkeleton({ kind, heroH }: { kind: 'summary' | 'history' | 'plan'; heroH: number }) {
  if (kind === 'summary') {
    return (
      <View style={s.wrap}>
        <SkeletonBlock h={heroH} r={26} />
        <SkeletonBlock h={84} r={20} />
        <View style={s.row}><SkeletonBlock w="45%" h={36} r={18} /><SkeletonBlock w="45%" h={36} r={18} /></View>
        <SkeletonBlock w="55%" h={20} r={8} />
        {[0, 1, 2].map(i => <SkeletonBlock key={i} h={78} r={20} />)}
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
  row: { flexDirection: 'row', gap: 10 },
});
