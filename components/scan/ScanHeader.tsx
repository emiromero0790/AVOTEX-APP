/**
 * Encabezado de Escanear y Mis escaneos: marca AVOTEX, saldo de tokens y acceso a Ajustes.
 * Sobre fondo blanco, como el resto de la app.
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Coins, Settings } from 'lucide-react-native';
import { TranslationResource, useTranslations } from '../../context/LanguageContext';
import { PressableScale } from './motion';
import { SCAN } from './theme';

const WORDMARK = require('../../assets/images/escanear/avotex-wordmark.png');

const translations: TranslationResource = {
  tokens: { es: '{value} tokens disponibles', en: '{value} tokens available' },
  settings: { es: 'Ajustes', en: 'Settings' },
};

/**
 * `onImage`: el encabezado va sobre una foto o video. El logotipo va solo (PNG con transparencia, sin fondo).
 * El logotipo es lo único que se reduce si falta espacio: tokens y Ajustes nunca se recortan.
 */
export default function ScanHeader({ tokensValue }: { tokensValue: string | null; onImage?: boolean }) {
  const t = useTranslations(translations);
  return (
    <View style={s.row}>
      <View style={s.brand}>
        <Image source={WORDMARK} style={s.logo} resizeMode="contain" accessibilityRole="image" accessibilityLabel="AVOTEX" />
      </View>
      <View style={s.right}>
        {tokensValue ? (
          <View style={s.tokens} accessible accessibilityLabel={t('tokens', { value: tokensValue })}>
            <View style={s.coin}><Coins size={13} color="#B45309" /></View>
            <Text style={s.tokensText} numberOfLines={1} maxFontSizeMultiplier={1.2}>{tokensValue}</Text>
          </View>
        ) : null}
        <PressableScale
          style={s.gear}
          onPress={() => router.navigate('/(app)/settings')}
          accessibilityRole="button"
          accessibilityLabel={t('settings')}
          hitSlop={6}
        >
          <Settings size={19} color={SCAN.ink} />
        </PressableScale>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { flexShrink: 1, minWidth: 64, height: 40, justifyContent: 'center' },
  // 600×139 px: misma proporción a cualquier ancho.
  logo: { width: 124, maxWidth: '100%', height: undefined, aspectRatio: 600 / 139 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  tokens: {
    flexDirection: 'row', alignItems: 'center', gap: 7, height: 40, paddingLeft: 6, paddingRight: 12, borderRadius: 20,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
  },
  coin: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF3C7' },
  tokensText: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: '#78350F', fontVariant: ['tabular-nums'] },
  gear: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: SCAN.surface, borderWidth: 1, borderColor: SCAN.line,
  },
});
