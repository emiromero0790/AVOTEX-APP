/**
 * Aviso de proximidad de Mapeo, debajo de "Comentarios" y "Tus huertas".
 * - far: tarjeta roja "Estás muy lejos de tu huerta" (no intercepta toques: el mapa sigue usable).
 * - unknown: "No pudimos verificar tu ubicación" con botón para reintentar o abrir ajustes.
 * - near / imprecise: indicador discreto. inside: nada.
 *
 * Movimiento (animate-expo): aparece con desplazamiento corto + escala 0.97 + opacidad (280 ms, curva
 * de salida) y se va con un fundido de 180 ms. Con movimiento reducido solo opacidad.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeIn, FadeOut, Keyframe } from 'react-native-reanimated';
import { AlertTriangle, LocateFixed, MapPinOff, Navigation, RefreshCw } from 'lucide-react-native';
import { TranslationResource, useTranslations } from '../../context/LanguageContext';
import { EASE_OUT } from '../scan/motion';
import type { Proximity } from '../../services/proximity';

export type GpsIssue = 'denied' | 'blocked' | 'off' | 'error' | null;

const translations: TranslationResource = {
  farTitle: { es: 'Estás muy lejos de tu huerta', en: 'You are far from your orchard' },
  farText: { es: 'Tu ubicación actual no se encuentra cerca de esta huerta.', en: 'Your current location is not near this orchard.' },
  unknownTitle: { es: 'No pudimos verificar tu ubicación', en: 'We could not verify your location' },
  denied: { es: 'Permite el acceso a tu ubicación para comprobar si estás en la huerta.', en: 'Allow location access to check whether you are at the orchard.' },
  off: { es: 'El GPS de tu celular está desactivado.', en: 'Your phone GPS is turned off.' },
  error: { es: 'Aún no hay una lectura GPS válida.', en: 'There is no valid GPS reading yet.' },
  retry: { es: 'Reintentar', en: 'Retry' },
  openSettings: { es: 'Abrir ajustes', en: 'Open settings' },
  near: { es: 'A {meters} m de tu huerta', en: '{meters} m from your orchard' },
  imprecise: { es: 'Ubicación imprecisa (±{meters} m)', en: 'Imprecise location (±{meters} m)' },
  impreciseNoAcc: { es: 'Ubicación imprecisa', en: 'Imprecise location' },
};

const CARD_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -10 }, { scale: 0.97 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: EASE_OUT },
}).duration(280);
const OUT = FadeOut.duration(180);
const IN_REDUCED = FadeIn.duration(200);

type Props = {
  proximity: Proximity | null;
  gpsIssue: GpsIssue;
  onRetry: () => void;
  reduced: boolean;
  top: number;
  wide: boolean;
};

export default function ProximityAlert({ proximity, gpsIssue, onRetry, reduced, top, wide }: Props) {
  const t = useTranslations(translations);
  if (!proximity || proximity.state === 'inside') return null;
  const entering = reduced ? IN_REDUCED : CARD_IN;
  const pos = [{ top }, wide ? s.posWide : s.pos];

  if (proximity.state === 'far') {
    return (
      <Reanimated.View key="far" entering={entering} exiting={OUT} pointerEvents="none" style={[s.card, s.cardFar, pos]}
        accessible accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={`${t('farTitle')}. ${t('farText')}`}>
        <View style={s.iconFar}><AlertTriangle size={18} color="#FFFFFF" strokeWidth={2.4} /></View>
        <View style={s.divider} />
        <View style={s.copy}>
          <Text style={s.title} numberOfLines={2} maxFontSizeMultiplier={1.15}>{t('farTitle')}</Text>
          <Text style={s.textSmall} maxFontSizeMultiplier={1.15}>{t('farText')}</Text>
        </View>
      </Reanimated.View>
    );
  }

  if (proximity.state === 'unknown') {
    const blocked = gpsIssue === 'blocked';
    const detail = gpsIssue === 'denied' || blocked ? t('denied') : gpsIssue === 'off' ? t('off') : t('error');
    return (
      <Reanimated.View key="unknown" entering={entering} exiting={OUT} pointerEvents="box-none" style={[s.card, s.cardUnknown, pos]}>
        <View style={s.iconUnknown}><MapPinOff size={20} color="#FDE68A" /></View>
        <View style={s.copy}>
          <Text style={s.titleSmall} maxFontSizeMultiplier={1.2}>{t('unknownTitle')}</Text>
          <Text style={s.text} maxFontSizeMultiplier={1.2}>{detail}</Text>
        </View>
        <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel={blocked ? t('openSettings') : t('retry')} hitSlop={8}
          style={({ pressed }) => [s.retry, pressed && { transform: [{ scale: 0.97 }] }]}>
          <RefreshCw size={14} color="#14231A" />
          <Text style={s.retryText} maxFontSizeMultiplier={1.15}>{blocked ? t('openSettings') : t('retry')}</Text>
        </Pressable>
      </Reanimated.View>
    );
  }

  // near / imprecise: indicador discreto
  const isNear = proximity.state === 'near';
  const label = isNear
    ? t('near', { meters: Math.max(1, Math.round(proximity.distanceM ?? 0)) })
    : proximity.accuracyM != null ? t('imprecise', { meters: Math.round(proximity.accuracyM) }) : t('impreciseNoAcc');
  return (
    <Reanimated.View key={proximity.state} entering={reduced ? IN_REDUCED : FadeIn.duration(220)} exiting={OUT} pointerEvents="none"
      style={[s.chip, { top }, wide ? s.chipWide : s.chipPos]} accessible accessibilityLabel={label}>
      {isNear ? <Navigation size={13} color="#99F6E4" fill="#99F6E4" /> : <LocateFixed size={13} color="#FDE68A" />}
      <Text style={s.chipText} maxFontSizeMultiplier={1.15}>{label}</Text>
    </Reanimated.View>
  );
}

const s = StyleSheet.create({
  pos: { left: 18, right: 18 },
  posWide: { left: 18, width: 460 },
  card: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 24, borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },
  cardFar: { backgroundColor: 'rgba(110,14,14,0.86)', borderColor: '#FF4545', paddingVertical: 10, paddingHorizontal: 12, gap: 10, borderRadius: 18 },
  cardUnknown: { backgroundColor: 'rgba(5,7,7,0.9)', borderColor: 'rgba(253,230,138,0.45)', gap: 12 },
  iconFar: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5302F',
    shadowColor: '#FF4545', shadowOpacity: 0.7, shadowRadius: 7, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  divider: { width: 1.5, alignSelf: 'stretch', marginVertical: 2, borderRadius: 1, backgroundColor: 'rgba(255,90,80,0.7)' },
  iconUnknown: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(253,230,138,0.14)' },
  copy: { flex: 1, gap: 3 },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 15, lineHeight: 19, color: '#FFFFFF' },
  textSmall: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,0.84)' },
  titleSmall: { fontFamily: 'Poppins_700Bold', fontSize: 14.5, lineHeight: 19, color: '#FFFFFF' },
  text: { fontFamily: 'Poppins_400Regular', fontSize: 13.5, lineHeight: 18.5, color: 'rgba(255,255,255,0.84)' },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: '#A3E635' },
  retryText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: '#14231A' },
  chip: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 7, height: 32, paddingHorizontal: 12, borderRadius: 16,
    backgroundColor: 'rgba(5,7,7,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  chipPos: { left: 18 },
  chipWide: { left: 18 },
  chipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#F0FDF4' },
});
