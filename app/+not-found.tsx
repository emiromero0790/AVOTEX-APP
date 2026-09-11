import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { TranslationResource, useTranslations } from '../context/LanguageContext';

const translations: TranslationResource = {
  title: { es: 'Página no encontrada', en: 'Page not found' },
  subtitle: {
    es: 'La ruta que buscas no existe.{newline}Regresa al inicio para continuar.',
    en: 'The route you are looking for does not exist.{newline}Return home to continue.',
  },
  goHome: { es: 'Ir al inicio', en: 'Go home' },
  crops: { es: 'Limón · Mango · Café · Guayaba · Berries · Aguacate', en: 'Lemon · Mango · Coffee · Guava · Berries · Avocado' },
};

export default function NotFoundScreen() {
  const t = useTranslations(translations);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.root}>
        <View style={s.center}>
          <Image
            source={require('../assets/images/AvotexNuevoLogo.png')}
            style={s.logo}
            resizeMode="contain"
          />

          <View style={s.badge}>
            <Text style={s.badgeText}>404</Text>
          </View>

          <Text style={s.title}>{t('title')}</Text>
          <Text style={s.subtitle}>
            {t('subtitle', { newline: '\n' })}
          </Text>

          <TouchableOpacity style={s.btn} onPress={() => router.replace('/')} activeOpacity={0.88}>
            <Text style={s.btnText}>{t('goHome')}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>{t('crops')}</Text>
        </View>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', alignItems: 'center', padding: 28, backgroundColor: '#FFFFFF' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },

  logo: { width: 260, height: 90, marginBottom: 24 },

  badge: {
    backgroundColor: '#F7FAF8',
    borderWidth: 1,
    borderColor: '#B8DCC7',
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 10,
    marginBottom: 18,
    shadowColor: '#c0392b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  badgeText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 38,
    color: '#2F7D55',
    letterSpacing: 4,
  },

  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    color: '#18352B',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 15,
    color: '#6b8a5e',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },

  btn: {
    borderRadius: 50,
    overflow: 'hidden',
    shadowColor: '#2F7D55',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  btnGradient: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 50,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 17,
    color: '#2F7D55',
    letterSpacing: 0.3,
  },

  footer: { marginBottom: 30 },
  footerText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#9aba8a',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
});
