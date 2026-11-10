/**
 * Contenido de «Hallazgos que requieren atención»: porcentaje de análisis con un problema detectado
 * (confianza suficiente), los dos diagnósticos más frecuentes con su barra, y el cultivo con más hallazgos.
 * No hay criterio de severidad en la base: no se habla de «riesgo» ni de diagnósticos definitivos.
 */
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgLinear, Path, Stop } from 'react-native-svg';
import { AlertTriangle, Bug } from 'lucide-react-native';
import { A, useSvgId, useTween } from './core';

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

function AttentionPanel({ pct, total, top, topCrop, lowConfidence, reduced, labels, onOpen, width }: {
  pct: number; total: number; top: { label: string; pct: number; count: number }[];
  topCrop: { label: string; count: number } | null; lowConfidence: number; reduced: boolean; width: number;
  labels: { ofAnalyses: string; findings: (n: number) => string; topCrop: string; low: (n: number) => string; ofProblems: string };
  onOpen?: () => void;
}) {
  const vals = useTween([pct, ...top.map(t => t.pct)], reduced, 700);
  const narrow = width < 330;
  return (
    <View style={{ gap: 10 }}>
      <View style={[st.row, narrow && { flexDirection: 'column', alignItems: 'stretch' }]}>
        <View style={st.hero}>
          <SickLeaf size={76} />
          <View style={{ flexShrink: 1 }}>
            <Text style={st.big} maxFontSizeMultiplier={1.15}>{Math.round(vals[0] ?? 0)}%</Text>
            <Text style={st.bigLabel} numberOfLines={2} maxFontSizeMultiplier={1.2}>{labels.ofAnalyses}</Text>
            <Text style={st.count} numberOfLines={1}>{labels.findings(total)}</Text>
          </View>
        </View>
        <View style={[st.tops, narrow ? null : { flex: 1 }]}>
          {top.map((t, k) => (
            <Pressable key={t.label} onPress={onOpen} disabled={!onOpen} accessibilityRole="button"
              accessibilityLabel={`${t.label}: ${Math.round(t.pct)} % ${labels.ofProblems}`} style={st.mini}>
              <View style={[st.miniIcon, k === 1 && { backgroundColor: '#FFF1DE' }]}>
                {k === 0 ? <Bug size={16} color={A.coral} /> : <AlertTriangle size={15} color={A.orange} />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.miniLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>{t.label}</Text>
                <View style={st.miniBarRow}>
                  <View style={st.track}>
                    <View style={[st.fill, { width: `${Math.max(0, Math.min(100, vals[k + 1] ?? 0))}%`, backgroundColor: k === 0 ? A.coral : A.orange }]} />
                  </View>
                  <Text style={[st.miniPct, { color: k === 0 ? '#C2412F' : '#C2650F' }]}>{Math.round(vals[k + 1] ?? 0)}%</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
      {(topCrop || lowConfidence > 0) && (
        <View style={st.footer}>
          {topCrop && <Text style={st.footText} numberOfLines={1}>{labels.topCrop}: <Text style={st.footStrong}>{topCrop.label}</Text> ({topCrop.count})</Text>}
          {lowConfidence > 0 && <Text style={st.footMuted} numberOfLines={2}>{labels.low(lowConfidence)}</Text>}
        </View>
      )}
    </View>
  );
}

export default memo(AttentionPanel);

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  big: { fontFamily: 'Poppins_700Bold', fontSize: 30, lineHeight: 36, color: '#E0473A', letterSpacing: -0.8 },
  bigLabel: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 15, color: A.inkSoft, maxWidth: 110 },
  count: { fontFamily: 'Poppins_600SemiBold', fontSize: 10.5, color: A.muted, marginTop: 2 },
  tops: { gap: 8 },
  mini: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 16,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F6DED8',
    shadowColor: '#9A3412', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1,
  },
  miniIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDE7E3' },
  miniLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: A.ink },
  miniBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#F7E3DF', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  miniPct: { fontFamily: 'Poppins_700Bold', fontSize: 12.5, minWidth: 34, textAlign: 'right' },
  footer: { paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F5E4DF', gap: 2 },
  footText: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: A.inkSoft },
  footStrong: { fontFamily: 'Poppins_600SemiBold', color: A.ink },
  footMuted: { fontFamily: 'Poppins_400Regular', fontSize: 11, lineHeight: 15, color: A.muted },
});
