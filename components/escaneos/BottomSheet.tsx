/**
 * Panel inferior con tres alturas (contraído, intermedio, expandido).
 *
 * Movimiento (animate-expo): el arrastre corre en el hilo de UI (Gesture.Pan + shared value), con
 * resistencia elástica en los extremos; al soltar decide por velocidad o distancia y asienta con un
 * resorte que conserva la velocidad del dedo. Con "Reducir movimiento" cambia de altura sin resorte.
 * Solo se arrastra desde la cabecera, así la lista interior se desplaza normalmente.
 */
import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';

type Props = {
  /** Alturas visibles de menor a mayor. */
  snaps: number[];
  index: number;
  onIndexChange: (i: number) => void;
  reduced: boolean;
  header: React.ReactNode;
  children: React.ReactNode;
  style?: object;
};

const SPRING = { duration: 300, dampingRatio: 0.85 };

export default function BottomSheet({ snaps, index, onIndexChange, reduced, header, children, style }: Props) {
  const full = snaps[snaps.length - 1];
  const y = useSharedValue(full - snaps[index]);
  const start = useSharedValue(0);

  useEffect(() => {
    const target = full - snaps[index];
    y.set(reduced ? withTiming(target, { duration: 0 }) : withSpring(target, SPRING));
  }, [index, full, snaps, reduced, y]);

  const notify = (i: number) => {
    if (i !== index) {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onIndexChange(i);
    }
  };

  const pan = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onStart(() => { start.set(y.get()); })
    .onUpdate(e => {
      'worklet';
      const max = full - snaps[0];
      let next = start.get() + e.translationY;
      // Resistencia elástica fuera de los extremos.
      if (next < 0) next = next / 3;
      if (next > max) next = max + (next - max) / 3;
      y.set(next);
    })
    .onEnd(e => {
      'worklet';
      const cur = y.get();
      const positions = snaps.map(h => full - h);
      let target = 0;
      if (Math.abs(e.velocityY) > 600) {
        // Un movimiento rápido basta: pasa a la siguiente altura en esa dirección.
        const dir = e.velocityY > 0 ? 1 : -1; // hacia abajo = menos altura
        const nearest = positions.reduce((b, p, i) => (Math.abs(p - start.get()) < Math.abs(positions[b] - start.get()) ? i : b), 0);
        target = Math.max(0, Math.min(snaps.length - 1, nearest - dir));
      } else {
        target = positions.reduce((b, p, i) => (Math.abs(p - cur) < Math.abs(positions[b] - cur) ? i : b), 0);
      }
      y.set(withSpring(positions[target], { ...SPRING, velocity: e.velocityY }));
      scheduleOnRN(notify, target);
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));

  return (
    <Reanimated.View style={[s.sheet, { height: full }, style, sheetStyle]}>
      <GestureDetector gesture={pan}>
        <View collapsable={false}>
          <View style={s.handleZone} accessible accessibilityRole="adjustable" accessibilityLabel="Panel">
            <View style={s.handle} />
          </View>
          {header}
        </View>
      </GestureDetector>
      <View style={s.body}>{children}</View>
    </Reanimated.View>
  );
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#0f172a', shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: -4 }, elevation: 12,
  },
  handleZone: { alignItems: 'center', paddingTop: 8, paddingBottom: 6 },
  handle: { width: 38, height: 4.5, borderRadius: 3, backgroundColor: '#CBD5E1' },
  body: { flex: 1, overflow: 'hidden' },
});
