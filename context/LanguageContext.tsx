import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'es' | 'en';
export type TranslationResource = Record<string, { es: string; en: string }>;
type TranslationParams = Record<string, string | number>;

const LANGUAGE_KEY = 'avotex_language';

type LanguageContextValue = {
  language: Language;
  locale: 'es-MX' | 'en-US';
  setLanguage: (language: Language) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setCurrentLanguage] = useState<Language>('es');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY)
      .then(value => {
        if (value === 'en' || value === 'es') setCurrentLanguage(value);
      })
      .finally(() => setReady(true));
  }, []);

  const setLanguage = useCallback(async (nextLanguage: Language) => {
    setCurrentLanguage(nextLanguage);
    await AsyncStorage.setItem(LANGUAGE_KEY, nextLanguage);
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    locale: language === 'en' ? 'en-US' : 'es-MX',
    setLanguage,
  }), [language, setLanguage]);

  if (!ready) return null;

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}

export function useTranslations(resources: TranslationResource) {
  const { language } = useLanguage();

  return useCallback((key: string, params?: TranslationParams) => {
    const entry = resources[key];
    let text = entry?.[language] ?? entry?.es ?? key;
    if (params) {
      Object.entries(params).forEach(([name, value]) => {
        text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
      });
    }
    return text.replace(/\\n/g, '\n');
  }, [language, resources]);
}

const DOMAIN_LABELS: Record<string, { es: string; en: string }> = {
  aguacate: { es: 'Aguacate', en: 'Avocado' },
  avocado: { es: 'Aguacate', en: 'Avocado' },
  limon: { es: 'Limón', en: 'Lemon' },
  lemon: { es: 'Limón', en: 'Lemon' },
  lime: { es: 'Limón', en: 'Lime' },
  mango: { es: 'Mango', en: 'Mango' },
  guayaba: { es: 'Guayaba', en: 'Guava' },
  guava: { es: 'Guayaba', en: 'Guava' },
  granada: { es: 'Granada', en: 'Pomegranate' },
  pomegranate: { es: 'Granada', en: 'Pomegranate' },
  cafe: { es: 'Café', en: 'Coffee' },
  coffee: { es: 'Café', en: 'Coffee' },
  saludable: { es: 'Saludable', en: 'Healthy' },
  healthy: { es: 'Saludable', en: 'Healthy' },
  sano: { es: 'Saludable', en: 'Healthy' },
  enfermo: { es: 'Enfermo', en: 'Diseased' },
  diseased: { es: 'Enfermo', en: 'Diseased' },
  antracnosis: { es: 'Antracnosis', en: 'Anthracnose' },
  anthracnose: { es: 'Antracnosis', en: 'Anthracnose' },
  'mancha negra': { es: 'Mancha negra', en: 'Black spot' },
  'black spot': { es: 'Mancha negra', en: 'Black spot' },
  pudricion: { es: 'Pudrición', en: 'Rot' },
  rot: { es: 'Pudrición', en: 'Rot' },
  nofruta: { es: 'No es un fruto', en: 'Not a fruit' },
  'no fruta': { es: 'No es un fruto', en: 'Not a fruit' },
  'not a fruit': { es: 'No es un fruto', en: 'Not a fruit' },
};

export function localizeDomainLabel(value: string | null | undefined, language: Language) {
  if (!value) return '';
  const normalized = value.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return DOMAIN_LABELS[normalized]?.[language] ?? value;
}