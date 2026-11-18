/**
 * Enfermedades por fruto.
 *
 * - StatusStackBars: una barra apilada por cultivo con sus tres estados (saludable · revisar · con problema).
 *   Cada segmento usa su porcentaje real sobre los análisis de ese cultivo; la etiqueta interna solo aparece
 *   si el segmento tiene espacio (≥ 30 px). Tocar una fila abre el detalle de ese cultivo.
 * - ClassBars: detalle de un cultivo, una barra por clase devuelta por el modelo.
 *
 * Movimiento: las barras se deslizan desde la izquierda al aparecer o al cambiar los datos (650 ms, salida
 * fuerte, escalonadas 60 ms). Con «Reducir movimiento» aparecen directamente.
 */
import React, { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { P } from './core';
import GrowBar, { growStyle } from './GrowBar';
import { FruitIcon } from './FruitBars';

export type StackSeg = { key: string; pct: number; colors: readonly [string, string]; label: string };
export type StackRow = { crop: string; label: string; n: number; segs: StackSeg[] };

const BAR_H = 24;
const MIN_LABEL_PX = 30;

function StackedBar({ segs, reduced, delay }: { segs: StackSeg[]; reduced: boolean; delay: number }) {
  const [w, setW] = useState(0);
  const sig = segs.map(s => Math.round(s.pct)).join('|');
  const visible = segs.filter(s => s.pct > 0);
  return (
    <View style={st.track} onLayout={e => setW(e.nativeEvent.layout.width)}>
      <Reanimated.View key={sig} style={[st.row, growStyle(reduced, delay)]}>
        {visible.map((s, i) => {
          const px = (w * s.pct) / 100;
          return (
            <View key={s.key} style={[{ flexGrow: s.pct, flexBasis: 0, justifyContent: 'center' }, i > 0 && st.sep]}>
              <LinearGradient colors={s.colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
              <View style={st.gloss} />
              {px >= MIN_LABEL_PX && (
                <Text style={st.inner} numberOfLines={1} maxFontSizeMultiplier={1}>{Math.round(s.pct)}%</Text>
              )}
            </View>
          );
        })}
      </Reanimated.View>
    </View>
  );
}

function StatusStackBarsBase({ rows, reduced, onPick, a11yLabel }: {
  rows: StackRow[]; reduced: boolean; onPick?: (crop: string) => void;
  a11yLabel: (row: StackRow) => string;
}) {
  return (
    <View style={{ gap: 6 }}>
      {rows.map((row, i) => (
        <Pressable key={row.crop} onPress={onPick ? () => onPick(row.crop) : undefined} disabled={!onPick}
          accessibilityRole={onPick ? 'button' : undefined} accessibilityLabel={a11yLabel(row)}
          style={({ pressed }) => [st.line, pressed && { backgroundColor: '#F3F8EE' }]}>
          <FruitIcon crop={row.crop} size={28} />
          <Text style={st.name} numberOfLines={1} maxFontSizeMultiplier={1.2}>{row.label}</Text>
          <View style={{ flex: 1 }}>
            <StackedBar segs={row.segs} reduced={reduced} delay={80 + i * 60} />
          </View>
          {onPick && <ChevronRight size={15} color="#9AAA9F" />}
        </Pressable>
      ))}
    </View>
  );
}
export const StatusStackBars = memo(StatusStackBarsBase);

export type ClassBar = { key: string; label: string; pct: number; count: number; colors: readonly [string, string] };

function ClassBarsBase({ rows, reduced, countLabel }: { rows: ClassBar[]; reduced: boolean; countLabel: (n: number) => string }) {
  return (
    <View style={{ gap: 10 }}>
      {rows.map((r, i) => (
        <View key={r.key} accessible accessibilityLabel={`${r.label}: ${Math.round(r.pct)} %, ${countLabel(r.count)}`}>
          <View style={st.classHead}>
            <View style={[st.dot, { backgroundColor: r.colors[1] }]} />
            <Text style={st.className} numberOfLines={1} maxFontSizeMultiplier={1.2}>{r.label}</Text>
            <Text style={st.classCount} numberOfLines={1}>{countLabel(r.count)}</Text>
            <Text style={st.classPct}>{Math.round(r.pct)}%</Text>
          </View>
          <GrowBar pct={r.pct} height={14} colors={r.colors} reduced={reduced} delay={60 + i * 60} />
        </View>
      ))}
    </View>
  );
}
export const ClassBars = memo(ClassBarsBase);

const st = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5, paddingHorizontal: 4, borderRadius: 14 },
  name: { width: 78, fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: P.ink },
  track: {
    height: BAR_H, borderRadius: BAR_H / 2, overflow: 'hidden', backgroundColor: '#EEF2EA',
    shadowColor: '#0B3D1C', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  row: { flex: 1, flexDirection: 'row' },
  sep: { borderLeftWidth: 1.5, borderLeftColor: 'rgba(255,255,255,0.85)' },
  gloss: { position: 'absolute', left: 4, right: 4, top: 3, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.28)' },
  inner: {
    textAlign: 'center', fontFamily: 'Poppins_700Bold', fontSize: 11, color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 },
  },
  classHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  className: { flex: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: P.ink },
  classCount: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: P.muted },
  classPct: { width: 40, textAlign: 'right', fontFamily: 'Poppins_700Bold', fontSize: 13, color: P.ink, fontVariant: ['tabular-nums'] },
});
