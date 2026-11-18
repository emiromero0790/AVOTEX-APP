/**
 * Escaneos por periodo: línea verde con curva monótona (no inventa picos ni valores bajo cero entre puntos),
 * área con degradado translúcido, puntos por periodo (incluidos los ceros) y tooltip verde bosque. Tocar o
 * arrastrar elige un periodo y muestra su cantidad y la comparación con el anterior (solo si el anterior tuvo
 * actividad y el elegido ya terminó: no se inventan crecimientos).
 *
 * Movimiento (animate-expo): al aparecer o cambiar los datos, la línea se revela de izquierda a derecha con un
 * recorte animado en el hilo de UI (550 ms, salida fuerte). Con «Reducir movimiento» aparece directamente.
 */
import React, { memo, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient as SvgLinear, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import Reanimated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { P, useSvgId } from './core';

const AnimatedRect = Reanimated.createAnimatedComponent(Rect);

export type TrendPoint = { label: string; long: string; count: number };

/** Máximo del eje con 4 divisiones enteras: 0–4 → 4; hasta 40 → múltiplo de 4 (p. ej. 9 → 12: 0·3·6·9·12);
 *  más allá, pasos «redondos» (1, 2, 2.5, 5 × 10ⁿ) que siguen siendo enteros. Nunca hay marcas fraccionarias. */
function niceMax(v: number) {
  if (v <= 4) return 4;
  const step = v / 4;
  if (step <= 10) return Math.ceil(step) * 4;
  const p = Math.pow(10, Math.floor(Math.log10(step)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= step) return m * p * 4;
  return 10 * p * 4;
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
  const sig = points.map(p => `${p.label}:${p.count}`).join('|');
  useEffect(() => { setSel(points.length - 1); }, [sig, points.length]);
  const max = niceMax(Math.max(...points.map(p => p.count), 0));
  const axisW = 34, top = 62, plotH = 128, right = 14;
  const plotW = Math.max(60, width - axisW - right);
  const H = top + plotH + 28;
  const xs = points.map((_, i) => axisW + (points.length === 1 ? plotW / 2 : (plotW * i) / (points.length - 1)));
  const ys = points.map(p => top + plotH - (plotH * Math.max(0, p.count)) / max);
  const line = monotonePath(xs, ys);
  const area = line ? `${line} L${xs[xs.length - 1]} ${top + plotH} L${xs[0]} ${top + plotH} Z` : '';
  const labelEvery = Math.max(1, Math.ceil(points.length / 5));
  const lastTick = useRef(sel);

  // Revelado de izquierda a derecha (ancho del recorte), en el hilo de UI.
  const full = width + 20;
  const reveal = useSharedValue(reduced ? full : 0);
  useEffect(() => {
    if (reduced) { reveal.set(full); return; }
    reveal.set(0);
    reveal.set(withDelay(120, withTiming(full, { duration: 550, easing: Easing.bezier(0.23, 1, 0.32, 1) })));
  }, [sig, reduced, full, reveal]);
  const clipProps = useAnimatedProps(() => ({ width: reveal.get() }));

  const pick = (x: number) => {
    if (!points.length) return;
    let best = 0, bd = Infinity;
    xs.forEach((px, i) => { const d = Math.abs(px - x); if (d < bd) { bd = d; best = i; } });
    if (best !== lastTick.current) {
      lastTick.current = best;
      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    }
    setSel(best);
  };

  const i = Math.max(0, Math.min(sel, points.length - 1));
  const cur = points[i];
  // El último periodo está en curso (incompleto): compararlo con uno completo engañaría.
  const cmp = cur && i > 0 && i < points.length - 1 ? compareLabel(cur.count, points[i - 1].count) : null;
  const tipX = xs[i] ?? 0, tipY = ys[i] ?? 0;
  const tipW = 156;
  const tipLeft = Math.max(0, Math.min(width - tipW, tipX - tipW / 2));
  const tipH = cmp ? 60 : 46;
  const tipTop = Math.max(0, tipY - tipH - 14);
  const arrowLeft = Math.max(12, Math.min(tipW - 24, tipX - tipLeft - 6));

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
      onAccessibilityAction={e => setSel(v => Math.max(0, Math.min(points.length - 1, v + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}
    >
      <Svg width={width} height={H} pointerEvents="none">
        <Defs>
          <SvgLinear id={`${gid}a`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={P.leaf} stopOpacity={0.34} />
            <Stop offset="0.7" stopColor={P.leaf} stopOpacity={0.08} />
            <Stop offset="1" stopColor={P.leaf} stopOpacity={0} />
          </SvgLinear>
          <SvgLinear id={`${gid}l`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={P.agri} />
            <Stop offset="1" stopColor="#4CC064" />
          </SvgLinear>
          <ClipPath id={`${gid}c`}>
            <AnimatedRect x={0} y={0} height={H} animatedProps={clipProps} />
          </ClipPath>
        </Defs>
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const yy = top + plotH - plotH * f;
          return (
            <G key={f}>
              <Line x1={axisW} x2={width - right} y1={yy} y2={yy} stroke="#E6ECE2" strokeWidth={1} strokeDasharray={f === 0 ? undefined : '2 5'} />
              <SvgText x={axisW - 8} y={yy + 3.5} fontSize={10.5} fill={P.muted} textAnchor="end" fontFamily="Poppins_400Regular">{fmt(Math.round(max * f))}</SvgText>
            </G>
          );
        })}
        <G clipPath={`url(#${gid}c)`}>
          <Path d={area} fill={`url(#${gid}a)`} />
          <Path d={line} stroke={P.agri} strokeOpacity={0.14} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 3)" />
          <Path d={line} stroke={`url(#${gid}l)`} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {xs.map((x, k) => (
            <Circle key={k} cx={x} cy={ys[k]} r={k === i ? 0 : 4} fill="#FFFFFF" stroke={P.agri} strokeWidth={2.2} />
          ))}
        </G>
        {cur && (
          <G>
            <Line x1={tipX} x2={tipX} y1={tipY + 8} y2={top + plotH} stroke={P.agri} strokeOpacity={0.28} strokeDasharray="3 3" />
            <Circle cx={tipX} cy={tipY} r={13} fill={P.leaf} opacity={0.18} />
            <Circle cx={tipX} cy={tipY} r={7.5} fill={P.agri} stroke="#FFFFFF" strokeWidth={3} />
            <Circle cx={tipX} cy={tipY} r={2.6} fill={P.limeSoft} />
          </G>
        )}
        {points.map((p, k) => (k % labelEvery === 0 || k === points.length - 1) && (k === points.length - 1 || points.length - 1 - k >= labelEvery * 0.6) ? (
          <SvgText key={k} x={Math.max(axisW + 14, Math.min(width - 20, xs[k]))} y={H - 6} fontSize={11} fill={k === i ? P.ink : P.muted}
            fontWeight={k === i ? '600' : '400'} textAnchor="middle" fontFamily="Poppins_400Regular">{p.label}</SvgText>
        ) : null)}
      </Svg>
      {cur && (
        <View pointerEvents="none" style={[st.tip, { left: tipLeft, top: tipTop, width: tipW }]}>
          <Text style={st.tipValue} numberOfLines={1} maxFontSizeMultiplier={1.1}>{fmt(cur.count)}</Text>
          <Text style={st.tipLabel} numberOfLines={1} maxFontSizeMultiplier={1.1}>{cur.long}</Text>
          {cmp ? <Text style={st.tipCmp} numberOfLines={1} maxFontSizeMultiplier={1.1}>{cmp}</Text> : null}
          <View style={[st.arrow, { left: arrowLeft }]} />
        </View>
      )}
    </View>
  );
}

export default memo(TrendLine);

const st = StyleSheet.create({
  tip: {
    position: 'absolute', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 14, backgroundColor: P.deep,
    borderWidth: 1, borderColor: 'rgba(185,246,47,0.35)',
    shadowColor: '#03200F', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  tipValue: { fontFamily: 'Poppins_700Bold', fontSize: 16, lineHeight: 20, color: '#FFFFFF' },
  tipLabel: { fontFamily: 'Poppins_400Regular', fontSize: 11, lineHeight: 14, color: 'rgba(255,255,255,0.9)' },
  tipCmp: { fontFamily: 'Poppins_600SemiBold', fontSize: 10.5, lineHeight: 14, color: P.limeSoft },
  arrow: {
    position: 'absolute', bottom: -6, width: 12, height: 12, backgroundColor: P.deep, transform: [{ rotate: '45deg' }],
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(185,246,47,0.35)',
  },
});
