/**
 * Hero de Actividad: fotografía de huerta con tres círculos superpuestos (saludable · confianza media ·
 * con problema). Todos los valores llegan por props: nada está escrito en la imagen.
 *
 * Movimiento (animate-expo): los círculos entran escalonados (escala 0.9 → 1 + opacidad, curva de salida);
 * los porcentajes cuentan hasta su valor en ~600 ms cuando cambian (huerta, cultivo o periodo).
 * Con "Reducir movimiento" los valores aparecen directamente.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, { Keyframe } from 'react-native-reanimated';
import { AlertTriangle, CheckCircle2, ChevronDown, Leaf } from 'lucide-react-native';

const HERO = require('../../assets/images/actividad/huerta-hero.jpg');

/** Cuenta hasta `value` (0–100) en ~600 ms; null = sin dato. */
function useCount(value: number | null, reduced: boolean) {
  const [shown, setShown] = useState<number | null>(value);
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
      // ~30 fps es suficiente para un número.
      if (now - last > 32 || p === 1) { setShown(Math.round(a + (value - a) * eased)); last = now; }
      if (p < 1) raf = requestAnimationFrame(step); else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  return shown;
}

const enter = (delay: number) => new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.88 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
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
  labels: { confidence: string; healthy: string; problem: string; review: string; empty: string };
  reduced: boolean;
  /** Cambia cuando cambia el filtro: vuelve a reproducir la entrada. */
  animKey: string;
};

export default function StatsHero({ width, height, confidence, healthy, problem, review, orchardLabel, onOrchard, labels, reduced, animKey }: Props) {
  const D = Math.round(Math.min(height * 0.68, width * 0.46));
  const d = Math.round(D * 0.68);
  // Los laterales asoman detrás del central (~1/3 de su ancho queda oculto) y su contenido se corre hacia afuera.
  const off = Math.round(D / 2 + d * 0.32);
  const shift = Math.round(d * 0.11);
  const cx = width / 2;
  const cy = height * 0.45;
  const conf = useCount(confidence, reduced);
  const ok = useCount(healthy, reduced);
  const bad = useCount(problem, reduced);
  const pct = (v: number | null) => (v === null ? '—' : `${v}%`);
  const empty = confidence === null;

  const Side = ({ x, tone, icon, value, label, delay, a11y }: { x: number; tone: 'ok' | 'bad'; icon: React.ReactNode; value: string; label: string; delay: number; a11y: string }) => (
    <Reanimated.View key={`${tone}-${animKey}`} entering={reduced ? undefined : enter(delay)}
      style={[s.circleWrap, { left: x - d / 2 - 6, top: cy - d / 2 - 6, width: d + 12, height: d + 12 }]} accessible accessibilityLabel={a11y}>
      <View style={[s.ring, { borderRadius: (d + 12) / 2, borderColor: tone === 'ok' ? 'rgba(217,249,157,0.65)' : 'rgba(254,215,170,0.7)' }]} />
      <View style={[s.side, { width: d, height: d, borderRadius: d / 2 }, tone === 'ok' ? [s.sideOk, { paddingRight: shift * 2 }] : [s.sideBad, { paddingLeft: shift * 2 }]]}>
        {icon}
        <Text style={[s.sideValue, { fontSize: d * 0.24 }, tone === 'ok' ? { color: '#14532D' } : { color: '#9A3412' }]} numberOfLines={1}>{value}</Text>
        <Text style={[s.sideLabel, tone === 'ok' ? { color: '#166534' } : { color: '#9A3412' }]} numberOfLines={2}>{label}</Text>
      </View>
    </Reanimated.View>
  );

  return (
    <View style={[s.card, { width, height }]}>
      <Image source={HERO} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      <LinearGradient colors={['rgba(5,30,15,0.25)', 'rgba(5,30,15,0.05)', 'rgba(5,30,15,0.45)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />

      {/* Laterales (detrás) */}
      <Side x={cx - off} tone="ok" delay={90} a11y={`${labels.healthy}: ${pct(ok)}`}
        icon={<CheckCircle2 size={d * 0.2} color="#15803D" />} value={pct(ok)} label={labels.healthy} />
      <Side x={cx + off} tone="bad" delay={160} a11y={`${labels.problem}: ${pct(bad)}`}
        icon={<AlertTriangle size={d * 0.19} color="#C2410C" />} value={pct(bad)} label={labels.problem} />

      {/* Central (delante) */}
      <Reanimated.View key={`c-${animKey}`} entering={reduced ? undefined : enter(0)}
        style={[s.circleWrap, { left: cx - D / 2 - 9, top: cy - D / 2 - 9, width: D + 18, height: D + 18 }]} accessible accessibilityLabel={`${labels.confidence}: ${pct(conf)}`}>
        <View style={[s.ring, { borderRadius: (D + 18) / 2, borderColor: 'rgba(255,255,255,0.55)' }]} />
        <LinearGradient colors={['#34A853', '#15803D', '#0F5A2B']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={[s.center, { width: D, height: D, borderRadius: D / 2 }]}>
          <Leaf size={D * 0.15} color="#ECFCCB" />
          <Text style={[s.centerValue, { fontSize: D * 0.25, lineHeight: D * 0.3 }]} numberOfLines={1}>{empty ? '—' : pct(conf)}</Text>
          <Text style={[s.centerLabel, { fontSize: Math.max(11, D * 0.085) }]} numberOfLines={2}>{empty ? labels.empty : labels.confidence}</Text>
        </LinearGradient>
      </Reanimated.View>

      {review !== null && review > 0 && (
        <View style={s.reviewChip} accessible accessibilityLabel={`${labels.review}: ${review}%`}>
          <View style={s.reviewDot} />
          <Text style={s.reviewText}>{review}% {labels.review}</Text>
        </View>
      )}

      <Pressable onPress={onOrchard} accessibilityRole="button" accessibilityLabel={orchardLabel} hitSlop={6}
        style={({ pressed }) => [s.capsule, pressed && { transform: [{ scale: 0.97 }] }]}>
        <Text style={s.capsuleText} numberOfLines={1}>{orchardLabel}</Text>
        <ChevronDown size={16} color="#0F172A" />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 26, overflow: 'hidden', backgroundColor: '#1F3B2A', alignSelf: 'center' },
  circleWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1.2 },
  side: {
    alignItems: 'center', justifyContent: 'center', gap: 1, borderWidth: 1.5,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  sideOk: { backgroundColor: 'rgba(217,249,157,0.88)', borderColor: 'rgba(255,255,255,0.75)' },
  sideBad: { backgroundColor: 'rgba(254,215,190,0.9)', borderColor: 'rgba(255,255,255,0.75)' },
  sideValue: { fontFamily: 'Poppins_700Bold', marginTop: 2, letterSpacing: -0.5 },
  sideLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 10.5, lineHeight: 13, maxWidth: '84%', textAlign: 'center' },
  center: {
    alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 3, borderColor: '#A3E635',
    shadowColor: '#052e16', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 9,
  },
  centerValue: { fontFamily: 'Poppins_700Bold', color: '#FFFFFF', letterSpacing: -1 },
  centerLabel: { fontFamily: 'Poppins_600SemiBold', color: '#F0FDF4', textAlign: 'center', maxWidth: '78%', lineHeight: 16 },
  reviewChip: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)' },
  reviewDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' },
  reviewText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#92400E' },
  capsule: {
    position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '80%',
    paddingHorizontal: 16, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  capsuleText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: '#0F172A', flexShrink: 1 },
});
