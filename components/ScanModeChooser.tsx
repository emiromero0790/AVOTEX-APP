import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { FadeInUp } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { ArrowRight, Bell, Camera, Lock, Trees, WifiOff, Wifi, Zap, Coins, Lightbulb } from 'lucide-react-native';
import { TranslationResource, useTranslations } from '../context/LanguageContext';

const translations: TranslationResource = {
  title: { es: 'Escanear', en: 'Scan' },
  subtitle: { es: '¿Cómo quieres analizar tu cultivo?', en: 'How do you want to analyze your crop?' },
  photoTitle: { es: 'Foto individual', en: 'Single photo' },
  photoBody: {
    es: 'Apunta a un fruto, toma la foto y recibe el diagnóstico en segundos.',
    en: 'Point at a fruit, take the photo and get the diagnosis in seconds.',
  },
  photoChip1: { es: 'Resultado al instante', en: 'Instant result' },
  photoChip2: { es: 'Requiere internet', en: 'Needs internet' },
  photoCta: { es: 'Tomar foto', en: 'Take photo' },
  walkTitle: { es: 'Recorrido con IA', en: 'AI field walk' },
  walkBody: {
    es: 'Lleva el celular en el pecho o en un casco: toma una foto cada 2–3 m mientras caminas por la huerta.',
    en: 'Wear the phone on your chest or a helmet: it takes a photo every 2–3 m while you walk the orchard.',
  },
  walkChip1: { es: 'Funciona sin internet', en: 'Works offline' },
  walkChip2: { es: 'Muchas plantas a la vez', en: 'Many plants at once' },
  walkChip3: { es: 'Te avisamos al terminar', en: 'We notify you when done' },
  walkCta: { es: 'Empezar recorrido', en: 'Start walk' },
  walkPending: { es: '{count} por subir', en: '{count} to upload' },
  walkLocked: { es: 'Crea una cuenta para usar el recorrido', en: 'Create an account to use field walks' },
  hintTitle: { es: '¿Cuál elijo?', en: 'Which one?' },
  hintBody: {
    es: 'Foto individual para revisar un fruto en particular. Recorrido para revisar muchos árboles de una sola vez.',
    en: 'Single photo to check one particular fruit. Field walk to check many trees in one go.',
  },
};

type Props = {
  isGuest: boolean;
  tokensLabel: string | null;
  pendingWalks: number;
  onPhoto: () => void;
  onWalk: () => void;
};

function Chip({ icon, label, dark }: { icon: React.ReactNode; label: string; dark?: boolean }) {
  return (
    <View style={[s.chip, dark && s.chipDark]}>
      {icon}
      <Text style={[s.chipText, dark && s.chipTextDark]}>{label}</Text>
    </View>
  );
}

/** Ilustración: una ruta por la huerta con los puntos donde se toma cada foto. */
function WalkArt() {
  return (
    <Svg width={120} height={84} viewBox="0 0 120 84" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={20} cy={18} r={11} fill="rgba(167,243,208,0.22)" />
      <Circle cx={98} cy={20} r={13} fill="rgba(167,243,208,0.22)" />
      <Circle cx={62} cy={64} r={12} fill="rgba(167,243,208,0.22)" />
      <Path d="M8 74 C 30 70, 30 40, 54 40 S 86 10, 112 8" stroke="#a7f3d0" strokeWidth={3} strokeLinecap="round" strokeDasharray="2 8" fill="none" />
      {[[8, 74], [33, 52], [54, 40], [78, 26], [112, 8]].map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={i === 4 ? 6 : 4.5} fill={i === 4 ? '#ffffff' : '#34d399'} stroke="#ffffff" strokeWidth={i === 4 ? 0 : 1.5} />
      ))}
    </Svg>
  );
}

export default function ScanModeChooser({ isGuest, tokensLabel, pendingWalks, onPhoto, onWalk }: Props) {
  const t = useTranslations(translations);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.content, isTablet && s.contentTablet, { paddingTop: insets.top + (isTablet ? 48 : 36) }]}
      showsVerticalScrollIndicator={false}
    >
      <Reanimated.View entering={FadeInUp.duration(500)} style={s.header}>
        <Text style={[s.title, isTablet && s.titleTablet]}>{t('title')}</Text>
        <Text style={[s.subtitle, isTablet && s.subtitleTablet]}>{t('subtitle')}</Text>
        {tokensLabel ? (
          <View style={s.tokens}>
            <Coins size={14} color="#0f766e" />
            <Text style={s.tokensText}>{tokensLabel}</Text>
          </View>
        ) : null}
      </Reanimated.View>

      <View style={[s.cards, isTablet && s.cardsTablet]}>
        {/* Foto individual */}
        <Reanimated.View entering={FadeInUp.delay(120).duration(550)} style={[s.cardWrap, isTablet && s.cardWrapTablet]}>
          <TouchableOpacity style={s.touch} activeOpacity={0.9} onPress={onPhoto} accessibilityRole="button" accessibilityLabel={`${t('photoTitle')}. ${t('photoBody')}`}>
            <LinearGradient colors={['#E7E1FF', '#F6DDF8', '#F9E8EF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.card, isTablet && s.cardTablet]}>
              <View style={s.cardTop}>
                <View style={[s.iconBubble, { backgroundColor: 'rgba(255,255,255,0.85)' }]}>
                  <Camera size={28} color="#44227C" />
                </View>
                <View style={s.focusFrame} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <View style={[s.corner, s.cTL]} /><View style={[s.corner, s.cTR]} />
                  <View style={[s.corner, s.cBL]} /><View style={[s.corner, s.cBR]} />
                  <View style={s.focusDot} />
                </View>
              </View>
              <Text style={[s.cardTitle, { color: '#2E1A57' }]}>{t('photoTitle')}</Text>
              <Text style={[s.cardBody, { color: '#4B3A6B' }]}>{t('photoBody')}</Text>
              <View style={s.chips}>
                <Chip icon={<Zap size={13} color="#6D28D9" />} label={t('photoChip1')} />
                <Chip icon={<Wifi size={13} color="#6D28D9" />} label={t('photoChip2')} />
              </View>
              <View style={[s.cta, { backgroundColor: '#44227C' }]}>
                <Text style={s.ctaText}>{t('photoCta')}</Text>
                <ArrowRight size={18} color="#ffffff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Reanimated.View>

        {/* Recorrido con IA */}
        <Reanimated.View entering={FadeInUp.delay(220).duration(550)} style={[s.cardWrap, isTablet && s.cardWrapTablet]}>
          <TouchableOpacity
            style={s.touch}
            activeOpacity={0.9}
            onPress={isGuest ? undefined : onWalk}
            disabled={isGuest}
            accessibilityRole="button"
            accessibilityState={{ disabled: isGuest }}
            accessibilityLabel={`${t('walkTitle')}. ${isGuest ? t('walkLocked') : t('walkBody')}`}
          >
            <LinearGradient colors={['#0f766e', '#115e59', '#134e4a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.card, isTablet && s.cardTablet]}>
              <View style={s.cardTop}>
                <View style={[s.iconBubble, { backgroundColor: '#d1fae5' }]}>
                  {isGuest ? <Lock size={26} color="#0f766e" /> : <Trees size={28} color="#0f766e" />}
                </View>
                <WalkArt />
              </View>
              {pendingWalks > 0 && !isGuest && (
                <View style={s.pending}><Text style={s.pendingText}>{t('walkPending', { count: pendingWalks })}</Text></View>
              )}
              <Text style={[s.cardTitle, { color: '#ffffff' }]}>{t('walkTitle')}</Text>
              <Text style={[s.cardBody, { color: 'rgba(236,253,245,0.9)' }]}>{t('walkBody')}</Text>
              <View style={s.chips}>
                <Chip dark icon={<WifiOff size={13} color="#a7f3d0" />} label={t('walkChip1')} />
                <Chip dark icon={<Trees size={13} color="#a7f3d0" />} label={t('walkChip2')} />
                <Chip dark icon={<Bell size={13} color="#a7f3d0" />} label={t('walkChip3')} />
              </View>
              <View style={[s.cta, { backgroundColor: isGuest ? 'rgba(255,255,255,0.18)' : '#ffffff' }]}>
                <Text style={[s.ctaText, { color: isGuest ? '#d1fae5' : '#0f766e' }]}>{isGuest ? t('walkLocked') : t('walkCta')}</Text>
                {!isGuest && <ArrowRight size={18} color="#0f766e" />}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Reanimated.View>
      </View>

      <Reanimated.View entering={FadeInUp.delay(320).duration(550)} style={[s.hint, isTablet && s.hintTablet]}>
        <View style={s.hintIcon}><Lightbulb size={16} color="#0f766e" /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.hintTitle}>{t('hintTitle')}</Text>
          <Text style={s.hintBody}>{t('hintBody')}</Text>
        </View>
      </Reanimated.View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 18, paddingBottom: 140, gap: 18 },
  contentTablet: { maxWidth: 1000, width: '100%', alignSelf: 'center', paddingHorizontal: 32 },
  header: { gap: 6 },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 38, lineHeight: 42, letterSpacing: -1.2, color: '#0A0A0A' },
  titleTablet: { fontSize: 46, lineHeight: 52 },
  subtitle: { fontFamily: 'Poppins_400Regular', fontSize: 15, color: '#52606D' },
  subtitleTablet: { fontSize: 18 },
  tokens: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 6, backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  tokensText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#0f766e' },
  cards: { gap: 16 },
  cardsTablet: { flexDirection: 'row', alignItems: 'stretch' },
  cardWrap: {
    borderRadius: 28,
    shadowColor: '#0f766e',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  cardWrapTablet: { flex: 1 },
  touch: { flex: 1 },
  card: { flex: 1, borderRadius: 28, padding: 20, gap: 10, minHeight: 300 },
  cardTablet: { minHeight: 380, padding: 26 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  iconBubble: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  focusFrame: { width: 76, height: 76, marginRight: 6, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: 18, height: 18, borderColor: '#7C5BC4' },
  cTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  focusDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(124,91,196,0.25)', borderWidth: 2, borderColor: '#7C5BC4' },
  cardTitle: { fontFamily: 'Poppins_700Bold', fontSize: 23, letterSpacing: -0.4, marginTop: 4 },
  cardBody: { fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.75)' },
  chipDark: { backgroundColor: 'rgba(255,255,255,0.13)' },
  chipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#4B3A6B' },
  chipTextDark: { color: '#d1fae5' },
  cta: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16 },
  ctaText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#ffffff' },
  pending: { alignSelf: 'flex-start', backgroundColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pendingText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#713f12' },
  hint: { flexDirection: 'row', gap: 12, backgroundColor: '#F0FDFA', borderRadius: 18, padding: 14, alignItems: 'flex-start' },
  hintTablet: { padding: 18 },
  hintIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center' },
  hintTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#0f766e' },
  hintBody: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, lineHeight: 18, color: '#334155' },
});
