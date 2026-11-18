/**
 * Hero de Actividad → Resumen: fotografía de huerta con tres indicadores reales.
 *
 *  - Centro: arco de progreso SVG (lima) con la confianza media del modelo. Es otra métrica, no una categoría.
 *  - Izquierda: % de resultados saludables. Derecha: % con problema. Etiqueta superior: % por revisar.
 *    Las tres categorías comparten denominador (análisis de la selección); se muestran tal cual, redondeadas,
 *    sin forzar que sumen 100.
 *  - Cápsula inferior: filtro de huerta (el mismo filtro de todo el Resumen).
 *
 * Movimiento (animate-expo):
 *  - El arco crece desde su valor anterior (o desde 0 al montar) con un withTiming de 900 ms en el hilo de UI;
 *    el punto luminoso del extremo lo acompaña. Los números cuentan hasta su valor (~600 ms, ~30 fps).
 *  - Las tarjetas laterales entran una vez (opacidad + escala 0.94 → 1, 420 ms, salida fuerte).
 *  - «Reducir movimiento»: todo aparece en su valor final, sin escala.
 */
import React, { memo, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinear, Stop } from 'react-native-svg';
import Reanimated, { Easing, Keyframe, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { AlertTriangle, ChevronDown, Leaf, Map as MapIcon, ShieldCheck } from 'lucide-react-native';
import { P } from './charts/core';

const HERO = require('../../assets/images/actividad/actividad-hero.jpg');
const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

/** Barrido del arco: 240° abiertos hacia abajo (de 150° a 390°, sentido horario). */
const SWEEP = 240;
const START = 150;

/** Cuenta hasta `value` (0–100) en ~600 ms; null = sin dato. */
function useCount(value: number | null, reduced: boolean) {
  const [shown, setShown] = useState<number | null>(reduced ? value : value === null ? null : 0);
  const from = useRef(0);
  useEffect(() => {
    if (value === null) { setShown(null); return; }
    if (reduced) { setShown(value); from.current = value; return; }
    const start = Date.now(), a = from.current, dur = 600;
    let raf = 0, last = 0;
    const step = () => {
      const now = Date.now();
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      if (now - last > 32 || p === 1) { setShown(Math.round(a + (value - a) * eased)); last = now; }
      if (p < 1) raf = requestAnimationFrame(step); else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  return shown;
}

const sideIn = (delay: number) => new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.94 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.bezier(0.23, 1, 0.32, 1) },
}).duration(420).delay(delay);

type Props = {
  width: number;
  height: number;
  confidence: number | null;
  healthy: number | null;
  problem: number | null;
  review: number | null;
  orchardLabel: string;
  onOrchard: () => void;
  labels: { confidence: string; healthy: string; problem: string; review: string; empty: string; orchardHint: string };
  reduced: boolean;
};

function Gauge({ size, value, reduced }: { size: number; value: number | null; reduced: boolean }) {
  const stroke = Math.max(10, Math.round(size * 0.07));
  const r = (size - stroke) / 2 - 4;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const arc = (circ * SWEEP) / 360;
  const target = value === null ? 0 : Math.max(0, Math.min(1, value / 100));
  const prog = useSharedValue(reduced ? target : 0);
  useEffect(() => {
    if (reduced) { prog.set(target); return; }
    prog.set(withTiming(target, { duration: 900, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
  }, [target, reduced, prog]);

  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: arc * (1 - prog.get()) }));
  const dotProps = useAnimatedProps(() => {
    const a = ((START + SWEEP * prog.get()) * Math.PI) / 180;
    return { cx: c + r * Math.cos(a), cy: c + r * Math.sin(a), opacity: prog.get() > 0.005 ? 1 : 0 };
  });
  const glowProps = useAnimatedProps(() => {
    const a = ((START + SWEEP * prog.get()) * Math.PI) / 180;
    return { cx: c + r * Math.cos(a), cy: c + r * Math.sin(a), opacity: prog.get() > 0.005 ? 0.35 : 0 };
  });

  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <SvgLinear id="avxGauge" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor="#7FD13A" />
          <Stop offset="0.6" stopColor={P.lime} />
          <Stop offset="1" stopColor={P.limeSoft} />
        </SvgLinear>
      </Defs>
      {/* canal */}
      <Circle cx={c} cy={c} r={r} stroke="rgba(255,255,255,0.22)" strokeWidth={stroke} fill="none"
        strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" transform={`rotate(${START} ${c} ${c})`} />
      {/* resplandor mínimo bajo el arco activo */}
      <AnimatedCircle cx={c} cy={c} r={r} stroke={P.lime} strokeOpacity={0.25} strokeWidth={stroke + 6} fill="none"
        strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" transform={`rotate(${START} ${c} ${c})`} animatedProps={arcProps} />
      <AnimatedCircle cx={c} cy={c} r={r} stroke="url(#avxGauge)" strokeWidth={stroke} fill="none"
        strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" transform={`rotate(${START} ${c} ${c})`} animatedProps={arcProps} />
      <AnimatedCircle r={stroke * 0.95} fill={P.limeSoft} animatedProps={glowProps} />
      <AnimatedCircle r={stroke * 0.42} fill="#FFFFFF" stroke={P.lime} strokeWidth={2} animatedProps={dotProps} />
    </Svg>
  );
}

function ConfidenceHero({ width, height, confidence, healthy, problem, review, orchardLabel, onOrchard, labels, reduced }: Props) {
  const D = Math.round(Math.min(height * 0.74, width * 0.46, 196));
  const side = (width - D) / 2;
  const sw = Math.round(Math.max(76, Math.min(108, side - 6)));
  const sh = Math.round(sw * 1.02);
  const gaugeTop = 18;
  const cy = gaugeTop + D * 0.5;
  const inner = Math.round(D * 0.74);
  const conf = useCount(confidence, reduced);
  const ok = useCount(healthy, reduced);
  const bad = useCount(problem, reduced);
  const pct = (v: number | null) => (v === null ? '—' : `${v}%`);
  const empty = confidence === null;

  return (
    <View style={[s.card, { width, height }]}>
      <Image source={HERO} style={[StyleSheet.absoluteFill, { width, height }]} resizeMode="cover" fadeDuration={0} accessibilityIgnoresInvertColors />
      {/* capa verde: más densa al centro y abajo, donde están los números y la cápsula */}
      <LinearGradient colors={['rgba(6,45,26,0.30)', 'rgba(6,45,26,0.42)', 'rgba(4,34,19,0.72)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(4,34,19,0)', 'rgba(4,34,19,0.35)', 'rgba(4,34,19,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.innerBorder]} />

      {/* Laterales */}
      <Reanimated.View entering={reduced ? undefined : sideIn(120)} accessible accessibilityLabel={`${labels.healthy}: ${pct(ok)}`}
        style={[s.side, s.sideOk, { width: sw, height: sh, borderRadius: sw * 0.34, left: Math.max(10, side - sw + 4), top: cy - sh / 2 }]}>
        <View style={[s.sideIcon, { backgroundColor: 'rgba(23,132,58,0.14)' }]}><ShieldCheck size={sw * 0.2} color={P.agri} strokeWidth={2.3} /></View>
        <Text style={[s.sideValue, { color: P.forest, fontSize: sw * 0.27, lineHeight: sw * 0.33, width: sw - 14 }]}
          numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1}>{pct(ok)}</Text>
        <Text style={[s.sideLabel, { color: P.deep, width: sw - 10, fontSize: Math.min(11.5, sw * 0.118) }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.1}>{labels.healthy}</Text>
      </Reanimated.View>
      <Reanimated.View entering={reduced ? undefined : sideIn(200)} accessible accessibilityLabel={`${labels.problem}: ${pct(bad)}`}
        style={[s.side, s.sideBad, { width: sw, height: sh, borderRadius: sw * 0.34, right: Math.max(10, side - sw + 4), top: cy - sh / 2 }]}>
        <View style={[s.sideIcon, { backgroundColor: 'rgba(196,74,38,0.12)' }]}><AlertTriangle size={sw * 0.2} color="#C44A26" strokeWidth={2.3} /></View>
        <Text style={[s.sideValue, { color: '#9B3A16', fontSize: sw * 0.27, lineHeight: sw * 0.33, width: sw - 14 }]}
          numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1}>{pct(bad)}</Text>
        <Text style={[s.sideLabel, { color: '#8A3A17', width: sw - 10, fontSize: Math.min(11.5, sw * 0.118) }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.1}>{labels.problem}</Text>
      </Reanimated.View>

      {/* Indicador central */}
      <View style={[s.gauge, { width: D, height: D, left: (width - D) / 2, top: gaugeTop }]} accessible accessibilityRole="progressbar"
        accessibilityLabel={`${labels.confidence}: ${pct(conf)}`} accessibilityValue={confidence === null ? undefined : { min: 0, max: 100, now: confidence }}>
        <View style={[s.halo, { width: D - 8, height: D - 8, borderRadius: D / 2 }]} />
        <Gauge size={D} value={confidence} reduced={reduced} />
        <LinearGradient colors={['#1D8E42', P.deep, P.forest]} locations={[0, 0.55, 1]} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
          style={[s.inner, { width: inner, height: inner, borderRadius: inner / 2 }]}>
          <Leaf size={inner * 0.15} color={P.lime} strokeWidth={2.2} />
          <Text style={[s.value, { fontSize: inner * 0.29, lineHeight: inner * 0.35, width: inner * 0.86 }]}
            numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} maxFontSizeMultiplier={1}>{empty ? '—' : pct(conf)}</Text>
          <Text style={[s.valueLabel, { width: inner * 0.92, fontSize: Math.max(10.5, Math.min(13, inner * 0.1)) }]}
            numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.1}>{empty ? labels.empty : labels.confidence}</Text>
        </LinearGradient>
      </View>

      {review !== null && (
        <View style={s.reviewChip} accessible accessibilityLabel={`${review}% ${labels.review}`}>
          <View style={s.reviewDot} />
          <Text style={s.reviewText} maxFontSizeMultiplier={1.15}>{review}% {labels.review}</Text>
        </View>
      )}

      <Pressable onPress={onOrchard} accessibilityRole="button" accessibilityLabel={orchardLabel} accessibilityHint={labels.orchardHint} hitSlop={6}
        style={({ pressed }) => [s.capsule, pressed && { transform: [{ scale: 0.97 }] }]}>
        <MapIcon size={17} color={P.agri} />
        <Text style={s.capsuleText} numberOfLines={1} maxFontSizeMultiplier={1.2}>{orchardLabel}</Text>
        <ChevronDown size={17} color={P.ink} />
      </Pressable>
    </View>
  );
}

export default memo(ConfidenceHero);

const s = StyleSheet.create({
  card: {
    borderRadius: 26, overflow: 'hidden', backgroundColor: P.forest, alignSelf: 'center',
    shadowColor: '#0A2A18', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  innerBorder: { borderRadius: 26, borderWidth: 1.2, borderColor: 'rgba(216,255,121,0.28)' },
  gauge: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', backgroundColor: 'rgba(4,34,19,0.35)' },
  inner: {
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(216,255,121,0.4)',
    shadowColor: '#021A0C', shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 8,
  },
  value: { fontFamily: 'Poppins_700Bold', color: '#FFFFFF', letterSpacing: -1, textAlign: 'center', marginTop: 2 },
  valueLabel: { fontFamily: 'Poppins_600SemiBold', color: '#EAF8DD', textAlign: 'center', lineHeight: 15 },
  side: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center', gap: 1, borderWidth: 1.5,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  sideOk: { backgroundColor: 'rgba(216,255,121,0.80)', borderColor: 'rgba(255,255,255,0.75)' },
  sideBad: { backgroundColor: 'rgba(255,232,206,0.88)', borderColor: 'rgba(255,255,255,0.8)' },
  sideIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  sideValue: { fontFamily: 'Poppins_700Bold', letterSpacing: -0.6, textAlign: 'center' },
  sideLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 11.5, textAlign: 'center' },
  reviewChip: {
    position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  reviewDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: P.amber },
  reviewText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11.5, color: '#7A4B05' },
  capsule: {
    position: 'absolute', bottom: 14, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '78%',
    paddingHorizontal: 16, height: 42, borderRadius: 21, backgroundColor: P.ivory, borderWidth: 1, borderColor: 'rgba(185,246,47,0.55)',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  capsuleText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: P.ink, flexShrink: 1 },
});
