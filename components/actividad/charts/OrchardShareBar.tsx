/**
 * Estado por huerta: barra horizontal segmentada (un segmento por huerta, «Otras» y «Sin huerta asignada»)
 * con leyenda debajo. Los segmentos salen de orchardShare() — admite cualquier cantidad de huertas: las
 * principales se muestran y el resto queda en «Otras», que abre el selector completo.
 *
 * Tocar un segmento o su leyenda filtra el Resumen por esa huerta (otro toque lo quita).
 * Movimiento: la barra se desliza desde la izquierda al aparecer y al cambiar los datos (650 ms, salida fuerte).
 */
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { P } from './core';
import { growStyle } from './GrowBar';

export type ShareSeg = {
  key: string; name: string; count: number; pct: number; kind: 'orchard' | 'none' | 'other';
  colors: readonly [string, string];
};

/** Degradados de huerta (verde profundo → lima) y neutros para «Otras» y «Sin huerta». */
export const ORCHARD_GRADIENTS = [
  ['#2FA84A', '#0F6A31'], ['#CFF76A', '#93D12C'], ['#6CC769', '#2F8F3E'], ['#E2F7A8', '#B3DB62'],
] as const;
export const OTHER_GRADIENT = ['#CBD8C4', '#9FB39A'] as const;
export const NONE_GRADIENT = ['#C7D1DD', '#A8B5C5'] as const;

function OrchardShareBar({ segs, selected, onSelect, reduced, countLabel }: {
  segs: ShareSeg[]; selected: string | null; onSelect: (seg: ShareSeg) => void; reduced: boolean;
  countLabel: (n: number) => string;
}) {
  const sig = segs.map(s => `${s.key}:${s.count}`).join('|');
  return (
    <View style={{ gap: 12 }}>
      <View style={st.track}>
        <Reanimated.View key={sig} style={[st.row, growStyle(reduced, 60)]}>
          {segs.map((s, i) => {
            const on = selected === s.key;
            return (
              <Pressable key={s.key} onPress={() => onSelect(s)} accessibilityRole="button" accessibilityState={{ selected: on }}
                accessibilityLabel={`${s.name}: ${Math.round(s.pct)} %, ${countLabel(s.count)}`}
                style={[{ flexGrow: Math.max(s.pct, 0.8), flexBasis: 0 }, i > 0 && st.gap, selected && !on ? { opacity: 0.45 } : null]}>
                <LinearGradient colors={s.colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
                <View style={st.gloss} />
              </Pressable>
            );
          })}
        </Reanimated.View>
      </View>
      <View style={st.legend}>
        {segs.map(s => {
          const on = selected === s.key;
          return (
            <Pressable key={s.key} onPress={() => onSelect(s)} hitSlop={4} accessibilityRole="button" accessibilityState={{ selected: on }}
              accessibilityLabel={`${s.name}: ${Math.round(s.pct)} %, ${countLabel(s.count)}`}
              style={({ pressed }) => [st.item, on && st.itemOn, pressed && { transform: [{ scale: 0.97 }] }]}>
              <View style={[st.dot, { backgroundColor: s.colors[1] }]} />
              <Text style={st.name} numberOfLines={1} maxFontSizeMultiplier={1.2}>{s.name}</Text>
              <Text style={st.pct} maxFontSizeMultiplier={1.2}>{Math.round(s.pct)}%</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default memo(OrchardShareBar);

const st = StyleSheet.create({
  track: {
    height: 22, borderRadius: 11, overflow: 'hidden', backgroundColor: '#EEF2EA',
    borderWidth: 1, borderColor: 'rgba(16,45,34,0.06)',
  },
  row: { flex: 1, flexDirection: 'row' },
  gap: { marginLeft: 2 },
  gloss: { position: 'absolute', left: 4, right: 4, top: 3, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 6, rowGap: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 12, maxWidth: '100%' },
  itemOn: { backgroundColor: '#EEF8E4' },
  dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 1.5, borderColor: '#FFFFFF' },
  name: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: P.ink, flexShrink: 1 },
  pct: { fontFamily: 'Poppins_700Bold', fontSize: 12.5, color: P.ink, fontVariant: ['tabular-nums'] },
});
