/**
 * Anillo de uso de tokens (como el indicador de límites de uso de Claude).
 * - Círculo con contorno: el arco muestra el porcentaje del plan mensual que ya se usó.
 *   Color: verde azulado < 70 %, ámbar 70–90 %, rojo > 90 %.
 * - Al tocarlo, una tarjeta muestra el plan, el porcentaje, cuántos tokens quedan y una barra.
 *   «Ver planes» lleva a la pantalla de Planes.
 * Invitados: el total son los escaneos de invitado (GUEST_MAX_SCANS × 100).
 *
 * Movimiento (animate-expo): la tarjeta aparece con escala 0.96 → 1 y opacidad (160 ms, curva de
 * salida) desde la esquina del anillo; con "Reducir movimiento", solo opacidad. Toque: Haptics.selectionAsync.
 */
import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Reanimated, { FadeIn, Keyframe, useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ArrowRight, Coins } from 'lucide-react-native';
import { TranslationResource, useLanguage, useTranslations } from '../context/LanguageContext';
import { GUEST_MAX_SCANS } from '../context/GuestContext';
import { PLAN_NAME, PLAN_TOKENS, usePlan, usageOf } from '../services/plan';
import { EASE_OUT } from './scan/motion';

const translations: TranslationResource = {
  title: { es: 'Plan {plan}', en: '{plan} plan' },
  titleGuest: { es: 'Escaneos de invitado', en: 'Guest scans' },
  monthly: { es: 'Uso mensual', en: 'Monthly usage' },
  guestUse: { es: 'Uso', en: 'Usage' },
  left: { es: 'Quedan {left} de {total}', en: '{left} of {total} left' },
  extra: { es: 'Tienes {left}: más que los {total} de tu plan', en: 'You have {left}: more than your plan’s {total}' },
  seePlans: { es: 'Ver planes', en: 'See plans' },
  a11y: { es: 'Tokens: {pct} % usado. Quedan {left}. Toca para ver el detalle', en: 'Tokens: {pct}% used. {left} left. Tap for details' },
  loading: { es: 'Tokens', en: 'Tokens' },
  close: { es: 'Cerrar', en: 'Close' },
};

const POP_IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.96 }, { translateY: -4 }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }], easing: EASE_OUT },
}).duration(160);

type Props = {
  /** Tokens que quedan, en las unidades que ve el usuario (users.tokens × 100). null = cargando. */
  remaining: number | null;
  isGuest?: boolean;
  email?: string | null;
  /** dark: sobre la cámara o fotos oscuras. */
  variant?: 'light' | 'dark';
  size?: number;
};

const colorFor = (pct: number) => (pct > 90 ? '#DC2626' : pct >= 70 ? '#D97706' : '#0D9488');

export default function TokenRing({ remaining, isGuest = false, email = null, variant = 'light', size = 40 }: Props) {
  const t = useTranslations(translations);
  const { locale, language } = useLanguage();
  const reduced = useReducedMotion();
  const { width: winW } = useWindowDimensions();
  const plan = usePlan(isGuest ? null : email);
  const ref = useRef<React.ComponentRef<typeof Pressable>>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const total = isGuest ? GUEST_MAX_SCANS * 100 : plan ? PLAN_TOKENS[plan] : null;
  const ready = remaining != null && total != null;
  const { usedPct, extra } = ready ? usageOf(remaining!, total!) : { usedPct: 0, extra: false };
  const color = colorFor(usedPct);
  const fmt = (n: number) => n.toLocaleString(locale);
  const planName = plan ? PLAN_NAME[plan][(language === 'en' ? 'en' : 'es') as 'es' | 'en'] : '';

  const stroke = Math.max(3, Math.round(size * 0.1));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dark = variant === 'dark';

  const open = () => {
    if (!ready) return;
    Haptics.selectionAsync().catch(() => {});
    ref.current?.measureInWindow((x, y, w, h) => setAnchor({ x, y, w, h }));
  };

  const cardW = Math.min(320, winW - 24);
  const cardLeft = anchor ? Math.max(12, Math.min(winW - cardW - 12, anchor.x + anchor.w - cardW)) : 12;

  return (
    <>
      <Pressable ref={ref} onPress={open} hitSlop={8} accessibilityRole="button"
        accessibilityLabel={ready ? t('a11y', { pct: usedPct, left: fmt(remaining!) }) : t('loading')}
        style={({ pressed }) => [{ width: size, height: size, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
        <View style={[s.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: dark ? 'rgba(15,23,42,0.55)' : '#FFFFFF' }, !dark && s.discShadow]}>
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={dark ? 'rgba(255,255,255,0.22)' : '#E2E8F0'} strokeWidth={stroke} fill="none" />
            {ready && usedPct > 0 && (
              <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
                strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - Math.max(usedPct, 2) / 100)}
                transform={`rotate(-90 ${size / 2} ${size / 2})`} />
            )}
          </Svg>
          <Coins size={Math.round(size * 0.38)} color={dark ? '#FBBF24' : '#B45309'} />
        </View>
      </Pressable>

      <Modal visible={!!anchor} transparent animationType="none" statusBarTranslucent onRequestClose={() => setAnchor(null)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setAnchor(null)} accessibilityRole="button" accessibilityLabel={t('close')} />
        {anchor && ready && (
          <Reanimated.View entering={reduced ? FadeIn.duration(120) : POP_IN} accessibilityViewIsModal
            style={[s.card, { width: cardW, left: cardLeft, top: anchor.y + anchor.h + 8, transformOrigin: 'top right' } as object]}>
            <View style={s.head}>
              <Text style={s.title} numberOfLines={1} maxFontSizeMultiplier={1.2}>{isGuest ? t('titleGuest') : t('title', { plan: planName })}</Text>
              <Pressable onPress={() => { setAnchor(null); router.push('/(app)/plans'); }} hitSlop={8} accessibilityRole="link" style={s.link}>
                <Text style={s.linkText} maxFontSizeMultiplier={1.2}>{t('seePlans')}</Text>
                <ArrowRight size={14} color="#0F172A" />
              </Pressable>
            </View>
            <View style={s.rowHead}>
              <Text style={s.rowTitle} maxFontSizeMultiplier={1.2}>{isGuest ? t('guestUse') : t('monthly')}</Text>
              <Text style={[s.pct, { color }]} maxFontSizeMultiplier={1.2}>{usedPct} %</Text>
            </View>
            <Text style={s.sub} maxFontSizeMultiplier={1.25}>
              {extra ? t('extra', { left: fmt(remaining!), total: fmt(total!) }) : t('left', { left: fmt(remaining!), total: fmt(total!) })}
            </Text>
            <View style={s.track}>
              <View style={[s.fill, { width: `${Math.max(usedPct, usedPct > 0 ? 2 : 0)}%`, backgroundColor: color }]} />
            </View>
          </Reanimated.View>
        )}
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center' },
  discShadow: { shadowColor: '#0F172A', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  card: {
    position: 'absolute', padding: 16, gap: 6, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#0F172A', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  title: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#64748B' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#0F172A' },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  rowTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 14.5, color: '#0F172A' },
  pct: { fontFamily: 'Poppins_700Bold', fontSize: 14.5 },
  sub: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: '#64748B', textAlign: 'right' },
  track: { height: 6, borderRadius: 3, backgroundColor: '#E5E7EB', overflow: 'hidden', marginTop: 4 },
  fill: { height: 6, borderRadius: 3 },
});
