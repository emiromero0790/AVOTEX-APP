/**
 * Contenido de «Hallazgos que requieren atención»: porcentaje de análisis con un problema detectado
 * (confianza suficiente), cantidad de hallazgos, diagnósticos más frecuentes con su barra de prevalencia
 * (sobre los análisis con problema) y el cultivo con más hallazgos.
 * No hay criterio de severidad en la base: no se habla de «riesgo» ni de diagnósticos definitivos, y se
 * recuerda que el resultado de la IA es orientativo.
 */
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgLinear, Path, Stop } from 'react-native-svg';
import { Info } from 'lucide-react-native';
import { P, useSvgId } from './core';
import GrowBar from './GrowBar';

/** Hoja con manchas (ilustración vectorial original). */
export function SickLeaf({ size = 92 }: { size?: number }) {
  const gid = useSvgId('sl');
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <SvgLinear id={gid} x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor="#3C7A22" />
          <Stop offset="0.6" stopColor="#6DAA36" />
          <Stop offset="1" stopColor="#A8CF5A" />
        </SvgLinear>
      </Defs>
      <Ellipse cx={50} cy={92} rx={30} ry={4} fill="#7F1D1D" opacity={0.12} />
      <G transform="rotate(-8 50 50)">
        <Path d="M12 84 C 14 48, 40 18, 90 10 C 86 54, 58 82, 12 84 Z" fill={`url(#${gid})`} />
        <Path d="M12 84 C 40 60, 62 38, 90 10" stroke="#E9F5C9" strokeOpacity={0.8} strokeWidth={1.8} fill="none" />
        {[0.28, 0.46, 0.64].map(t => {
          const x = 12 + 78 * t, y = 84 - 74 * t;
          return <Path key={t} d={`M${x} ${y} q -5 -11 -3 -19 M${x} ${y} q 12 1 18 -4`} stroke="#E9F5C9" strokeOpacity={0.45} strokeWidth={1.1} fill="none" />;
        })}
        {[[34, 56, 5.5], [52, 44, 4], [60, 58, 6], [44, 70, 3.5], [70, 34, 3.8], [28, 70, 3]].map(([x, y, r], i) => (
          <G key={i}>
            <Circle cx={x} cy={y} r={r + 2.2} fill="#D9A441" opacity={0.55} />
            <Circle cx={x} cy={y} r={r} fill="#7A2E1A" />
            <Circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.35} fill="#B45A3C" opacity={0.7} />
          </G>
        ))}
      </G>
    </Svg>
  );
}

const BARS = [['#FF8A78', '#E4493B'], ['#FFB06B', '#EE7D2A'], ['#F9C989', '#E39B45']] as const;

function AttentionPanel({ pct, total, top, topCrop, lowConfidence, reduced, labels, onOpen }: {
  pct: number; total: number; top: { label: string; pct: number; count: number }[];
  topCrop: { label: string; count: number } | null; lowConfidence: number; reduced: boolean;
  labels: {
    ofAnalyses: string; findings: (n: number) => string; topCrop: string; low: (n: number) => string; ofProblems: string;
    frequent: string; disclaimer: string;
  };
  onOpen?: () => void;
}) {
  return (
    <View style={{ gap: 14 }}>
      <View style={st.hero}>
        <View style={st.leafBubble}><SickLeaf size={70} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.big} maxFontSizeMultiplier={1.15}>{Math.round(pct)}%</Text>
          <Text style={st.bigLabel} numberOfLines={2} maxFontSizeMultiplier={1.2}>{labels.ofAnalyses}</Text>
          <View style={st.countChip}><Text style={st.countText} numberOfLines={1}>{labels.findings(total)}</Text></View>
        </View>
      </View>

      {top.length > 0 && (
        <View style={st.box}>
          <Text style={st.boxTitle}>{labels.frequent}</Text>
          {top.map((t, k) => (
            <Pressable key={t.label} onPress={onOpen} disabled={!onOpen} accessibilityRole={onOpen ? 'button' : undefined}
              accessibilityLabel={`${t.label}: ${Math.round(t.pct)} % ${labels.ofProblems}, ${labels.findings(t.count)}`}
              style={({ pressed }) => [st.item, pressed && { opacity: 0.8 }]}>
              <View style={st.itemHead}>
                <Text style={st.itemLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>{t.label}</Text>
                <Text style={st.itemCount} numberOfLines={1}>{labels.findings(t.count)}</Text>
                <Text style={[st.itemPct, { color: BARS[k][1] }]}>{Math.round(t.pct)}%</Text>
              </View>
              <GrowBar pct={t.pct} height={12} colors={BARS[Math.min(k, BARS.length - 1)]} track="#F8E7E2" reduced={reduced} delay={100 + k * 70} />
            </Pressable>
          ))}
        </View>
      )}

      {(topCrop || lowConfidence > 0) && (
        <View style={{ gap: 3 }}>
          {topCrop && <Text style={st.footText} numberOfLines={1}>{labels.topCrop}: <Text style={st.footStrong}>{topCrop.label}</Text> ({topCrop.count})</Text>}
          {lowConfidence > 0 && <Text style={st.footMuted} numberOfLines={2}>{labels.low(lowConfidence)}</Text>}
        </View>
      )}
      <View style={st.note} accessible accessibilityRole="text">
        <Info size={15} color="#9A5B0F" />
        <Text style={st.noteText} maxFontSizeMultiplier={1.25}>{labels.disclaimer}</Text>
      </View>
    </View>
  );
}

export default memo(AttentionPanel);

const st = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  leafBubble: { width: 86, height: 86, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDEBE5' },
  big: { fontFamily: 'Poppins_700Bold', fontSize: 34, lineHeight: 40, color: '#D9493B', letterSpacing: -1 },
  bigLabel: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, lineHeight: 16, color: P.ink },
  countChip: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: '#FDE3DC' },
  countText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11.5, color: '#B23A2D' },
  box: {
    gap: 10, padding: 12, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F6DDD5',
    shadowColor: '#9A3412', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1,
  },
  boxTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: P.muted },
  item: { gap: 5 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemLabel: { flex: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: P.ink },
  itemCount: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: P.muted },
  itemPct: { width: 42, textAlign: 'right', fontFamily: 'Poppins_700Bold', fontSize: 13.5, fontVariant: ['tabular-nums'] },
  footText: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: P.ink },
  footStrong: { fontFamily: 'Poppins_600SemiBold', color: P.ink },
  footMuted: { fontFamily: 'Poppins_400Regular', fontSize: 11, lineHeight: 15, color: P.muted },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 14, backgroundColor: '#FFF4DA' },
  noteText: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 11.5, lineHeight: 16, color: '#6E4A0E' },
});
