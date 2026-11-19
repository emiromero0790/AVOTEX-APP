/**
 * Planes y precios (rediseño verde bosque + lima).
 *
 * - Hero verde bosque con aguacate vectorial (components/tabbar/AvocadoArt) y hojas; título y subtítulo reales.
 * - Tres tarjetas de plan (datos en PLANS: nombre, precio, tokens de services/plan.ts, beneficios). La
 *   estructura es reutilizable: añadir un plan es añadir una entrada.
 * - «Plan actual» sale de users.plan_suscripcion (usePlan, la misma fuente que el anillo de tokens).
 * - No hay selector Mensual/Anual: la app no tiene precios anuales, así que no se muestra.
 * - El botón principal abre la página de precios de AVOTEX (misma acción que antes).
 *
 * Movimiento (animate-expo): elegir una tarjeta cambia borde y fondo con una transición CSS de 180 ms y una
 * pulsación de escala 0.97; la lista de beneficios entra con un fundido corto al cambiar de plan. Con
 * «Reducir movimiento» los cambios son inmediatos.
 */
import React, { useEffect, useState } from 'react';
import { Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Reanimated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import { Check, ChevronLeft, Crown, Leaf, Satellite, ShieldCheck, Sprout, Star, type LucideIcon } from 'lucide-react-native';
import '../../firebaseConfig'; // inicializa Firebase (getAuth devuelve la misma instancia tipada)
import { TranslationResource, useLanguage, useTranslations } from '../../context/LanguageContext';
import { useGuest } from '../../context/GuestContext';
import { PLAN_TOKENS, usePlan, type PlanKey } from '../../services/plan';
import { AvocadoArt, AvocadoHalo } from '../../components/tabbar/AvocadoArt';
import { BotanicalCardDecoration, P } from '../../components/actividad/charts/core';
import { CSS_OUT } from '../../components/actividad/charts/GrowBar';
import { PressableScale } from '../../components/scan/motion';
import { noOverscroll } from '../../components/ui/noOverscroll';

const LOGO = require('../../assets/images/inicio/avotex-logo-blanco.png');
const PRICING_URL = 'https://vex-mx.com/avotex.html#pricing';
const RANK: Record<PlanKey, number> = { free: 0, basic: 1, pro: 2 };

type PlanDef = { key: PlanKey; name: string; price: string; Icon: LucideIcon; ideal: string; popular?: boolean; features: string[] };
const PLANS: PlanDef[] = [
  { key: 'free', name: 'plans.freeShort', price: '$0', Icon: Leaf, ideal: 'plans.idealFree', features: ['plans.free1', 'plans.free2', 'plans.free3', 'plans.free5'] },
  { key: 'basic', name: 'plans.basicShort', price: '$1,190', Icon: Sprout, ideal: 'plans.idealBasic', popular: true, features: ['plans.basic1', 'plans.basic2', 'plans.basic3', 'plans.basic4', 'plans.basic5', 'plans.basic7'] },
  { key: 'pro', name: 'plans.proShort', price: '$4,490', Icon: Satellite, ideal: 'plans.idealPro', features: ['plans.pro1', 'plans.pro2', 'plans.pro3', 'plans.pro4', 'plans.pro5', 'plans.pro6', 'plans.pro7'] },
];

const translations: TranslationResource = {
  'plans.freeShort': { es: 'Free', en: 'Free' }, 'plans.basicShort': { es: 'Básico', en: 'Basic' }, 'plans.proShort': { es: 'Pro Satelital', en: 'Satellite Pro' },
  'plans.free1': { es: '1 huerto registrado', en: '1 registered orchard' }, 'plans.free2': { es: 'Reportes básicos de clima diario', en: 'Basic daily weather reports' }, 'plans.free3': { es: 'Historial básico de análisis', en: 'Basic analysis history' }, 'plans.free5': { es: 'Notificaciones de uso y recordatorios', en: 'Usage notifications and reminders' },
  'plans.basic1': { es: 'Análisis con IA (85–90% precisión) basado en CNN', en: 'AI analysis (85–90% accuracy) based on CNN' }, 'plans.basic2': { es: 'Historial detallado por árbol y lote', en: 'Detailed history by tree and plot' }, 'plans.basic3': { es: 'Reportes climáticos extendidos', en: 'Extended weather reports' }, 'plans.basic4': { es: 'Alertas tempranas basadas en clima', en: 'Weather-based early alerts' }, 'plans.basic5': { es: 'Acceso a la app móvil', en: 'Access to the mobile app' }, 'plans.basic7': { es: 'Soporte por WhatsApp', en: 'WhatsApp support' },
  'plans.pro1': { es: 'Monitoreo satelital EOSDA', en: 'EOSDA satellite monitoring' }, 'plans.pro2': { es: 'Análisis avanzado de riesgos climáticos', en: 'Advanced climate risk analysis' }, 'plans.pro3': { es: 'IA profesional', en: 'Professional AI' }, 'plans.pro4': { es: 'Diagnósticos ilimitados', en: 'Unlimited diagnoses' }, 'plans.pro5': { es: 'Algoritmo CNN propio TensorFlow', en: 'Proprietary TensorFlow CNN algorithm' }, 'plans.pro6': { es: 'Plataforma Web + App móvil', en: 'Web platform + mobile app' }, 'plans.pro7': { es: 'Soporte premium', en: 'Premium support' },
  'plans.idealFree': { es: 'Ideal para pequeños productores', en: 'Ideal for small growers' },
  'plans.idealBasic': { es: 'Ideal para monitoreo intensivo', en: 'Ideal for intensive monitoring' },
  'plans.idealPro': { es: 'Ideal para uso satelital y multi-lote', en: 'Ideal for satellite and multi-plot use' },
  'plans.back': { es: 'Regresar', en: 'Back' }, 'plans.title': { es: 'Planes y precios', en: 'Plans and pricing' },
  'plans.subtitle': { es: 'Elige el plan que mejor se adapta a tu huerta y obtén más análisis, monitoreo y seguimiento.', en: 'Choose the plan that best fits your orchard and get more analyses, monitoring and follow-up.' },
  'plans.popular': { es: 'Más popular', en: 'Most popular' }, 'plans.current': { es: 'Plan actual', en: 'Current plan' },
  'plans.yourPlan': { es: 'Tu plan: {plan}', en: 'Your plan: {plan}' },
  'plans.tokens': { es: 'tokens', en: 'tokens' }, 'plans.monthly': { es: 'mensuales', en: 'per month' },
  'plans.includes': { es: 'Incluye {plan}', en: 'Includes {plan}' }, 'plans.available': { es: 'Lo que tienes disponible', en: 'What you get' },
  'plans.note': { es: 'Sin cargos por ahora · Puedes cambiar de plan después', en: 'No charges for now · You can change plans later' },
  'plans.choose': { es: 'Contratar plan {plan}', en: 'Get the {plan} plan' }, 'plans.upgrade': { es: 'Mejorar a {plan}', en: 'Upgrade to {plan}' },
  'plans.manage': { es: 'Administrar mi plan', en: 'Manage my plan' },
  'plans.selectLabel': { es: 'Plan {plan}, {price}, {tokens}', en: '{plan} plan, {price}, {tokens}' },
  'plans.urlError': { es: 'URL no disponible', en: 'URL unavailable' }, 'plans.alertTitle': { es: 'No se pudo abrir el sitio', en: 'Could not open the website' },
  'plans.alertBody': { es: 'Intenta nuevamente en unos segundos.', en: 'Try again in a few seconds.' }, 'plans.alertOk': { es: 'Entendido', en: 'Got it' },
};

export default function PlansScreen() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const { isGuest } = useGuest();
  const [user, setUser] = useState<User | null>(() => getAuth().currentUser);
  useEffect(() => onAuthStateChanged(getAuth(), setUser), []);
  const current = usePlan(isGuest ? null : user?.email ?? null);
  const [selected, setSelected] = useState<PlanKey>('basic');
  const plan = PLANS.find(p => p.key === selected) ?? PLANS[1];
  const name = (p: PlanDef) => t(p.name);
  const tokens = (k: PlanKey) => PLAN_TOKENS[k].toLocaleString(locale);

  const contentW = Math.min(width, 560);
  const pad = 16;
  const heroH = insets.top + (current ? 262 : 236);
  const compact = width < 370;
  const titleSize = width < 400 ? 26 : 30;

  const pick = (k: PlanKey) => {
    if (k === selected) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setSelected(k);
  };
  const open = async () => {
    try {
      const supported = await Linking.canOpenURL(PRICING_URL);
      if (!supported) throw new Error(t('plans.urlError'));
      await Linking.openURL(PRICING_URL);
    } catch {
      Alert.alert(t('plans.alertTitle'), t('plans.alertBody'), [{ text: t('plans.alertOk') }]);
    }
  };
  const cta = current && current === selected ? t('plans.manage')
    : current && RANK[selected] > RANK[current] ? t('plans.upgrade', { plan: name(plan) })
    : t('plans.choose', { plan: name(plan) });

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}
        {...noOverscroll}>
        {/* ── Hero verde bosque ── */}
        <View style={[s.hero, { height: heroH }]}>
          <LinearGradient colors={['#0E6B36', P.deep, P.forest]} locations={[0, 0.5, 1]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
          {/* curvas orgánicas muy tenues */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="none">
              <Path d="M-20 120 C 80 60, 180 160, 300 90 S 420 60, 440 40" stroke={P.lime} strokeOpacity={0.08} strokeWidth={1.5} fill="none" />
              <Path d="M-20 160 C 90 100, 190 200, 310 130 S 420 100, 440 80" stroke={P.lime} strokeOpacity={0.06} strokeWidth={1.5} fill="none" />
              <Path d="M-20 200 C 100 140, 200 240, 320 170 S 420 140, 440 120" stroke={P.lime} strokeOpacity={0.05} strokeWidth={1.5} fill="none" />
            </Svg>
          </View>
          {/* aguacate con halo y hojas (decorativo) */}
          <View pointerEvents="none" style={[s.art, { top: insets.top + 54, right: compact ? -18 : -6 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={{ position: 'absolute', left: -30, top: -10 }}><AvocadoHalo width={170} height={180} /></View>
            <View style={s.leafA}><Leaf size={46} color="#7CC24A" fill="rgba(124,194,74,0.55)" strokeWidth={1.4} /></View>
            <View style={s.leafB}><Leaf size={34} color="#5DAA3A" fill="rgba(93,170,58,0.6)" strokeWidth={1.4} /></View>
            <View style={{ transform: [{ rotate: '18deg' }] }}><AvocadoArt width={compact ? 84 : 98} height={compact ? 119 : 139} /></View>
          </View>
          {/* fundido inferior con curva hacia el fondo marfil */}
          <View pointerEvents="none" style={s.curve}>
            <Svg width="100%" height="100%" viewBox="0 0 400 60" preserveAspectRatio="none">
              <Path d="M0 30 C 110 70, 250 -10, 400 26 L400 60 L0 60 Z" fill={P.ivory} />
              <Path d="M0 30 C 110 70, 250 -10, 400 26" stroke={P.lime} strokeOpacity={0.55} strokeWidth={2} fill="none" />
            </Svg>
          </View>

          <View style={[s.heroContent, { paddingTop: insets.top + 8, width: contentW, paddingHorizontal: pad }]}>
            <View style={s.topRow}>
              <PressableScale onPress={() => (router.canGoBack() ? router.back() : router.navigate('/(app)'))} style={s.round} accessibilityRole="button" accessibilityLabel={t('plans.back')} hitSlop={6}>
                <ChevronLeft size={22} color="#FFFFFF" />
              </PressableScale>
              <Image source={LOGO} style={s.logo} resizeMode="contain" accessibilityRole="image" accessibilityLabel="AVOTEX" />
            </View>
            <Reanimated.View entering={reduced ? undefined : FadeInDown.duration(380)} style={{ maxWidth: compact ? '74%' : '72%' }}>
              <View style={s.titleRow}>
                <Crown size={titleSize - 4} color={P.lime} fill="rgba(185,246,47,0.25)" strokeWidth={2} />
                <Text style={[s.title, { fontSize: titleSize, lineHeight: titleSize + 6 }]} accessibilityRole="header" maxFontSizeMultiplier={1.15}>{t('plans.title')}</Text>
              </View>
              <Text style={s.subtitle} maxFontSizeMultiplier={1.2}>{t('plans.subtitle')}</Text>
              {current && (
                <View style={s.currentChip}>
                  <View style={s.currentDot} />
                  <Text style={s.currentText} numberOfLines={1}>{t('plans.yourPlan', { plan: name(PLANS.find(p => p.key === current)!) })}</Text>
                </View>
              )}
            </Reanimated.View>
          </View>
        </View>

        <View style={{ width: contentW, alignSelf: 'center', paddingHorizontal: pad }}>
          {/* ── Tarjetas de plan ── */}
          <View style={s.cards} accessibilityRole="radiogroup">
            {PLANS.map(p => {
              const on = p.key === selected;
              const isCurrent = current === p.key;
              return (
                <Pressable key={p.key} onPress={() => pick(p.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                  accessibilityLabel={t('plans.selectLabel', { plan: name(p), price: `${p.price} MXN`, tokens: `${tokens(p.key)} ${t('plans.tokens')} ${t('plans.monthly')}` }) + (isCurrent ? `. ${t('plans.current')}` : '')}
                  style={({ pressed }) => [{ flex: 1 }, pressed && !reduced && { transform: [{ scale: 0.97 }] }]}>
                  <Reanimated.View style={[s.card, on && s.cardOn, reduced ? null : ({ transitionProperty: ['borderColor', 'backgroundColor'], transitionDuration: 180, transitionTimingFunction: CSS_OUT } as object)]}>
                    {/* Etiqueta flotante del borde superior: «Plan actual» tiene prioridad sobre «Más popular». */}
                    {isCurrent ? (
                      <View style={[s.popular, s.currentPill]}>
                        <Text style={s.currentBadgeText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('plans.current')}</Text>
                      </View>
                    ) : p.popular ? (
                      <View style={s.popular}>
                        <Star size={10} color={P.forest} fill={P.forest} />
                        <Text style={s.popularText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('plans.popular')}</Text>
                      </View>
                    ) : null}
                    {/* Selección en la esquina (antes ocupaba una fila más abajo). */}
                    {!isCurrent && <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioDot} />}</View>}
                    <View style={[s.planIcon, on && { backgroundColor: 'rgba(185,246,47,0.3)' }]}><p.Icon size={18} color={P.agri} strokeWidth={2.2} /></View>
                    <Text style={s.planName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.15}>{name(p)}</Text>
                    <Text style={[s.price, compact && { fontSize: 20 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.1}>{p.price}</Text>
                    {/* Precios en pesos mexicanos. */}
                    <Text style={s.currency} maxFontSizeMultiplier={1.1}>MXN</Text>
                    <View style={[s.tokens, on && { backgroundColor: '#E6F7D2' }]}>
                      <Text style={s.tokensValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.1}>{tokens(p.key)}</Text>
                      <Text style={s.tokensUnit} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.1}>{t('plans.tokens')} {t('plans.monthly')}</Text>
                    </View>
                  </Reanimated.View>
                </Pressable>
              );
            })}
          </View>

          {/* ── Beneficios del plan elegido ── */}
          <View style={s.benefits}>
            <View style={s.clip} pointerEvents="none">
              <BotanicalCardDecoration variant="leaf" corner="br" size={110} opacity={0.18} />
            </View>
            <View style={s.benefitsHead}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.eyebrow}>{t('plans.includes', { plan: name(plan) })}</Text>
                <Text style={s.benefitsTitle} maxFontSizeMultiplier={1.2}>{t('plans.available')}</Text>
              </View>
              <View style={s.shield}><ShieldCheck size={26} color={P.agri} strokeWidth={2} /></View>
            </View>
            <View style={s.ideal}>
              <Sprout size={14} color={P.deep} />
              <Text style={s.idealText} maxFontSizeMultiplier={1.2}>{t(plan.ideal)}</Text>
            </View>
            <Reanimated.View key={plan.key} entering={reduced ? undefined : FadeIn.duration(180)} style={{ gap: 10 }}>
              {plan.features.map(f => (
                <View key={f} style={s.feature}>
                  <View style={s.check}><Check size={13} color="#FFFFFF" strokeWidth={3.2} /></View>
                  <Text style={s.featureText} maxFontSizeMultiplier={1.25}>{t(f)}</Text>
                </View>
              ))}
            </Reanimated.View>
          </View>

          {/* ── CTA ── */}
          <PressableScale onPress={open} style={{ marginTop: 20 }} accessibilityRole="button" accessibilityLabel={cta}>
            <LinearGradient colors={['#1D8E42', P.deep, P.forest]} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cta}>
              <Crown size={21} color={P.lime} strokeWidth={2.2} />
              <Text style={s.ctaText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{cta}</Text>
            </LinearGradient>
          </PressableScale>
          <Text style={s.note}>{t('plans.note')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const shadow = { shadowColor: '#1C3A26', shadowOpacity: 0.09, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 } as const;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.ivory },
  hero: { width: '100%', overflow: 'hidden', alignItems: 'center' },
  heroContent: { alignSelf: 'center' },
  art: { position: 'absolute', width: 130, height: 170, alignItems: 'center' },
  leafA: { position: 'absolute', left: -14, top: 4, transform: [{ rotate: '-40deg' }] },
  leafB: { position: 'absolute', right: 6, bottom: 18, transform: [{ rotate: '70deg' }] },
  curve: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 56 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  round: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  logo: { width: 132, height: 44 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  title: { flexShrink: 1, fontFamily: 'Poppins_700Bold', fontSize: 30, lineHeight: 37, letterSpacing: -0.8, color: '#FFFFFF' },
  subtitle: { marginTop: 6, fontFamily: 'Poppins_400Regular', fontSize: 13.5, lineHeight: 19, color: 'rgba(240,250,230,0.92)' },
  currentChip: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, backgroundColor: 'rgba(185,246,47,0.16)', borderWidth: 1, borderColor: 'rgba(185,246,47,0.4)',
  },
  currentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: P.lime },
  currentText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11.5, color: P.limeSoft },

  cards: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginTop: -10 },
  card: {
    flex: 1, alignItems: 'center', paddingTop: 16, paddingBottom: 10, paddingHorizontal: 7, borderRadius: 22, gap: 2,
    backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#EAEFE3', ...shadow,
  },
  cardOn: { borderColor: P.lime, backgroundColor: '#FBFFF2', shadowColor: '#5C9B12', shadowOpacity: 0.22 },
  popular: {
    position: 'absolute', top: -11, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '96%',
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 11, backgroundColor: P.lime,
  },
  popularText: { fontFamily: 'Poppins_600SemiBold', fontSize: 10.5, color: P.forest },
  planIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF7E4', marginBottom: 2 },
  planName: { alignSelf: 'stretch', fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, lineHeight: 18, color: P.ink, textAlign: 'center' },
  price: { fontFamily: 'Poppins_700Bold', fontSize: 22, lineHeight: 27, color: P.deep, letterSpacing: -0.6 },
  currency: { fontFamily: 'Poppins_600SemiBold', fontSize: 10, lineHeight: 12, letterSpacing: 0.6, color: P.muted, marginTop: -2 },
  tokens: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 4, marginTop: 4, borderRadius: 11, backgroundColor: '#F2F5EE' },
  tokensValue: { fontFamily: 'Poppins_700Bold', fontSize: 13, lineHeight: 17, color: P.ink },
  tokensUnit: { alignSelf: 'stretch', fontFamily: 'Poppins_400Regular', fontSize: 9.5, lineHeight: 12, color: P.muted, textAlign: 'center' },
  radio: { position: 'absolute', top: 9, right: 9, width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#B9C8B2', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: P.agri },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: P.agri },
  currentPill: { backgroundColor: P.deep },
  currentBadgeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 10.5, color: P.limeSoft },

  benefits: { marginTop: 18, padding: 18, borderRadius: 26, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDF1E6', ...shadow },
  clip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 26, overflow: 'hidden' },
  benefitsHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: P.agri },
  benefitsTitle: { fontFamily: 'Poppins_700Bold', fontSize: 19, lineHeight: 25, color: P.ink, letterSpacing: -0.3 },
  shield: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF7E4' },
  ideal: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 14, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#E9FFB8' },
  idealText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: P.deep },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  check: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: P.leaf, marginTop: 0 },
  featureText: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 21, color: '#2F453A' },

  cta: {
    minHeight: 60, borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 20,
    borderWidth: 1.5, borderColor: 'rgba(185,246,47,0.7)',
    shadowColor: '#06301B', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  ctaText: { flexShrink: 1, fontFamily: 'Poppins_700Bold', fontSize: 16.5, color: '#FFFFFF', letterSpacing: -0.2 },
  note: { textAlign: 'center', color: P.muted, fontFamily: 'Poppins_400Regular', fontSize: 11.5, lineHeight: 16, paddingHorizontal: 20, marginTop: 14 },
});
