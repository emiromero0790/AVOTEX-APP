

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TranslationResource, useTranslations } from '../context/LanguageContext';

const translations: TranslationResource = {
  mobileOnly: { es: '🗺️ El mapa solo está disponible en la app móvil.', en: '🗺️ The map is only available in the mobile app.' },
};

type MapViewComponentProps = {
  location: unknown;
  errorMsg: string | null;
  compact?: boolean;
};

export default function MapViewComponent({ location, errorMsg, compact = false }: MapViewComponentProps) {
  const t = useTranslations(translations);
  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <Text style={styles.text}>{t('mobileOnly')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 200,
    marginHorizontal: 24,
    marginVertical: 24,
    borderRadius: 24,
    backgroundColor: '#e9e9e9',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    color: '#666',
    textAlign: 'center',
    fontFamily: 'sans-serif', 
  },
  compactContainer: {
    width: '100%',
    height: '100%',
    marginHorizontal: 0,
    marginVertical: 0,
    borderRadius: 0,
  },
});