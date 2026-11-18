/**
 * Barra de métricas rápidas bajo el hero: escaneos · cultivos · superficie · periodo, sobre verde bosque.
 * Los valores llegan ya calculados (datos reales); aquí solo hay presentación.
 * La decoración vegetal inferior es SVG muy tenue y no recibe toques.
 */
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import type { LucideIcon } from 'lucide-react-native';
import { P } from './charts/core';

export type Metric = { key: string; Icon: LucideIcon; value: string; label: string; onPress?: () => void; hint?: string };

function Cell({ m }: { m: Metric }) {
  const body = (
    <>
      <View style={st.icon}><m.Icon size={19} color={P.lime} strokeWidth={2.2} /></View>
      <Text style={st.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.15}>{m.value}</Text>
      <Text style={st.label} numberOfLines={1} maxFontSizeMultiplier={1.2}>{m.label}</Text>
    </>
  );
  return m.onPress ? (
    <Pressable onPress={m.onPress} accessibilityRole="button" accessibilityLabel={`${m.label}: ${m.value}`} accessibilityHint={m.hint}
      style={({ pressed }) => [st.cell, pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] }]}>{body}</Pressable>
  ) : (
    <View style={st.cell} accessible accessibilityLabel={`${m.label}: ${m.value}`}>{body}</View>
  );
}

function QuickMetrics({ items }: { items: Metric[] }) {
  return (
    <View style={st.card}>
      <LinearGradient colors={['#0E6B36', P.deep, P.forest]} locations={[0, 0.5, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} />
      <View pointerEvents="none" style={st.deco}>
        <Svg width="100%" height="100%" viewBox="0 0 400 40" preserveAspectRatio="none">
          <Path d="M0 30 C 60 12, 120 34, 190 22 C 260 10, 330 30, 400 18 L400 40 L0 40 Z" fill={P.lime} opacity={0.08} />
          <Path d="M0 36 C 80 24, 150 40, 230 30 C 300 22, 350 36, 400 30 L400 40 L0 40 Z" fill={P.leaf} opacity={0.22} />
        </Svg>
      </View>
      {items.map((m, i) => (
        <React.Fragment key={m.key}>
          {i > 0 && <View style={st.sep} />}
          <Cell m={m} />
        </React.Fragment>
      ))}
    </View>
  );
}

export default memo(QuickMetrics);

const st = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', minHeight: 98, paddingVertical: 12, borderRadius: 22, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(185,246,47,0.22)', backgroundColor: P.forest,
    shadowColor: '#06301B', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  deco: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 28 },
  cell: { flex: 1, alignItems: 'center', gap: 3, paddingHorizontal: 4 },
  icon: {
    width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(185,246,47,0.12)', borderWidth: 1, borderColor: 'rgba(185,246,47,0.25)', marginBottom: 2,
  },
  value: { fontFamily: 'Poppins_700Bold', fontSize: 18, lineHeight: 23, color: '#FFFFFF', letterSpacing: -0.3 },
  label: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: 'rgba(240,250,230,0.85)' },
  sep: { width: 1, height: 52, backgroundColor: 'rgba(216,255,121,0.2)' },
});
