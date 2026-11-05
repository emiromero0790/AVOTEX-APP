/**
 * Encabezado de Escanear y Mis escaneos: marca AVOTEX, saldo de tokens y acceso a Ajustes.
 * Va sobre la fotografía o el mapa, con fondo de vidrio oscuro para que siempre se lea.
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

export default function ScanHeader({ tokensValue }: { tokensValue: string | null }) {
  const t = useTranslations(translations);
  return (
    <View style={s.row}>
      {/* Marca sobre fondo claro: así se lee el logotipo ilustrado de AVOTEX también sobre fotos oscuras. */}
      <View style={s.brand}>
        <Image source={WORDMARK} style={s.logo} resizeMode="contain" accessibilityRole="image" accessibilityLabel="AVOTEX" />
      </View>
      <View style={s.right}>
        {tokensValue ? (
          <View style={s.tokens} accessible accessibilityLabel={t('tokens', { value: tokensValue })}>
            <View style={s.coin}><Coins size={13} color="#FDE68A" /></View>
            <Text style={s.tokensText}>{tokensValue}</Text>
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
  brand: { height: 40, paddingHorizontal: 12, borderRadius: 20, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.94)' },
  logo: { width: 104, height: 24 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tokens: {
    flexDirection: 'row', alignItems: 'center', gap: 7, height: 40, paddingLeft: 6, paddingRight: 14, borderRadius: 20,
    backgroundColor: SCAN.glass, borderWidth: 1, borderColor: 'rgba(253,230,138,0.28)',
  },
  coin: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(217,119,6,0.35)' },
  tokensText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: SCAN.ink, fontVariant: ['tabular-nums'] },
  gear: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: SCAN.glass, borderWidth: 1, borderColor: SCAN.line,
  },
});
