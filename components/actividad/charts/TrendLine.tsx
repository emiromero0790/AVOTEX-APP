/**
 * Evolución de análisis: línea verde con curva monótona (no inventa picos ni valores bajo cero entre puntos),
 * área con degradado, puntos y etiqueta flotante. Tocar o arrastrar elige un periodo y muestra su cantidad
 * y la comparación con el periodo anterior (solo si el anterior tuvo actividad y el elegido ya terminó: no se
 * inventan crecimientos).
 * Al aparecer, la línea se dibuja de izquierda a derecha; al filtrar, los puntos se desplazan.
 */
import React, { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient as SvgLinear, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { A, useSvgId, useTween } from './core';

export type TrendPoint = { label: string; long: string; count: number };

/** Máximo «redondo» del eje (1, 2, 5 × 10ⁿ). */
function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Curva monótona (Fritsch–Carlson): suave y sin rebasar los valores reales. */
function monotonePath(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n === 0) return '';
  if (n === 1) return `M${xs[0]} ${ys[0]}`;
  const d: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  let p = `M${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (xs[i + 1] - xs[i]) / 3;
    p += ` C${(xs[i] + dx).toFixed(1)} ${(ys[i] + m[i] * dx).toFixed(1)}, ${(xs[i + 1] - dx).toFixed(1)} ${(ys[i + 1] - m[i + 1] * dx).toFixed(1)}, ${xs[i + 1].toFixed(1)} ${ys[i + 1].toFixed(1)}`;
  }
  return p;
}

function TrendLine({ points, width, reduced, fmt, compareLabel }: {
  points: TrendPoint[]; width: number; reduced: boolean; fmt: (n: number) => string;
  /** Texto de comparación con el periodo anterior, o null si no hay base para compararlo. */
  compareLabel: (cur: number, prev: number) => string | null;
}) {
  const gid = useSvgId('tl');
  const [sel, setSel] = useState(points.length - 1);
  useEffect(() => { setSel(points.length - 1); }, [points.length]);
  const max = niceMax(Math.max(...points.map(p => p.count), 0));
  const vals = useTween(points.map(p => p.count), reduced, 650);
  const [reveal] = useTween([1], reduced, 900, 120);
  const axisW = 40, top = 34, plotH = 120, right = 14;
  const plotW = Math.max(60, width - axisW - right);
  const H = top + plotH + 24;
  const xs = points.map((_, i) => axisW + (points.length === 1 ? plotW / 2 : (plotW * i) / (points.length - 1)));
  const ys = vals.map(v => top + plotH - (plotH * Math.max(0, v)) / max);
  const line = monotonePath(xs, ys);
  const area = line ? `${line} L${xs[xs.length - 1]} ${top + plotH} L${xs[0]} ${top + plotH} Z` : '';
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  const lastTick = useRef(sel);

  const pick = (x: number) => {
    if (!points.length) return;
    let best = 0, bd = Infinity;
    xs.forEach((px, i) => { const d = Math.abs(px - x); if (d < bd) { bd = d; best = i; } });
    if (best !== lastTick.current) { lastTick.current = best; Haptics.selectionAsync().catch(() => {}); }
    setSel(best);
  };

  const i = Math.min(sel, points.length - 1);
  const cur = points[i];
  // El último periodo está en curso (incompleto): compararlo con uno completo engañaría.
  const cmp = cur && i > 0 && i < points.length - 1 ? compareLabel(cur.count, points[i - 1].count) : null;
  const tipX = xs[i] ?? 0, tipY = ys[i] ?? 0;
  const tipW = 150;
  const tipLeft = Math.max(4, Math.min(width - tipW - 4, tipX - tipW / 2));

  return (
    <View
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={e => pick(e.nativeEvent.locationX)}
      onResponderMove={e => pick(e.nativeEvent.locationX)}
      onResponderTerminationRequest={() => true}
      accessible accessibilityRole="adjustable"
      accessibilityLabel={cur ? `${cur.long}: ${fmt(cur.count)}` : undefined}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => setSel(s => Math.max(0, Math.min(points.length - 1, s + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}
    >
      <Svg width={width} height={H} pointerEvents="none">
        <Defs>
          <SvgLinear id={`${gid}a`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#3CC45C" stopOpacity={0.38} />
            <Stop offset="1" stopColor="#3CC45C" stopOpacity={0} />
          </SvgLinear>
          <SvgLinear id={`${gid}l`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#1E9E46" />
            <Stop offset="1" stopColor="#3FD16A" />
          </SvgLinear>
          <ClipPath id={`${gid}c`}>
            <Rect x={0} y={0} width={axisW + plotW * reveal + 8} height={H} />
          </ClipPath>
        </Defs>
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const yy = top + plotH - plotH * f;
          return (
            <G key={f}>
              <Line x1={axisW} x2={width - right} y1={yy} y2={yy} stroke="#E8EEE8" strokeDasharray={f === 0 ? undefined : '3 4'} />
              <SvgText x={axisW - 6} y={yy + 3.5} fontSize={10} fill={A.muted} textAnchor="end" fontFamily="Poppins_400Regular">{fmt(Math.round(max * f))}</SvgText>
            </G>
          );
        })}
        <G clipPath={`url(#${gid}c)`}>
          <Path d={area} fill={`url(#${gid}a)`} />
          {/* sombra de la línea y línea */}
          <Path d={line} stroke="#1E9E46" strokeOpacity={0.18} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 3)" />
          <Path d={line} stroke={`url(#${gid}l)`} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {xs.map((x, k) => (
            <Circle key={k} cx={x} cy={ys[k]} r={k === i ? 0 : 3.4} fill="#FFFFFF" stroke="#1E9E46" strokeWidth={2} />
          ))}
        </G>
        {/* punto elegido con brillo */}
        {cur && (
          <G>
            <Line x1={tipX} x2={tipX} y1={tipY} y2={top + plotH} stroke="#1E9E46" strokeOpacity={0.3} strokeDasharray="3 3" />
            <Circle cx={tipX} cy={tipY} r={11} fill="#3CC45C" opacity={0.2} />
            <Circle cx={tipX} cy={tipY} r={6} fill="#FFFFFF" stroke="#1E9E46" strokeWidth={3} />
          </G>
        )}
        {points.map((p, k) => (k % labelEvery === 0 || k === points.length - 1) && (k === points.length - 1 || points.length - 1 - k >= labelEvery * 0.6) ? (
          <SvgText key={k} x={xs[k]} y={H - 6} fontSize={10.5} fill={k === i ? A.ink : A.muted} textAnchor="middle" fontFamily="Poppins_400Regular">{p.label}</SvgText>
        ) : null)}
      </Svg>
      {cur && (
        <View pointerEvents="none" style={[st.tip, { left: tipLeft, top: Math.max(0, tipY - 58), width: tipW }]}>
          <Text style={st.tipValue} numberOfLines={1}>{fmt(cur.count)}</Text>
          <Text style={st.tipLabel} numberOfLines={1}>{cur.long}</Text>
          {cmp ? <Text style={st.tipCmp} numberOfLines={1}>{cmp}</Text> : null}
        </View>
      )}
    </View>
  );
}

export default memo(TrendLine);

const st = StyleSheet.create({
  tip: {
    position: 'absolute', alignItems: 'center', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, backgroundColor: '#15803D',
    shadowColor: '#14532D', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  tipValue: { fontFamily: 'Poppins_700Bold', fontSize: 13.5, lineHeight: 18, color: '#FFFFFF' },
  tipLabel: { fontFamily: 'Poppins_400Regular', fontSize: 10, lineHeight: 13, color: 'rgba(255,255,255,0.88)' },
  tipCmp: { fontFamily: 'Poppins_600SemiBold', fontSize: 10, lineHeight: 13, color: '#D9F99D' },
});
