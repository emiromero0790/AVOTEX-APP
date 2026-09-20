import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  UserRound,
  ShieldCheck,
  MapPin,
  Languages,
  ChevronRight,
  LogIn,
  Info,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { getAuth } from 'firebase/auth';
import { useGuest } from '../../context/GuestContext';
import { TranslationResource, useLanguage, useTranslations } from '../../context/LanguageContext';

const LOCATION_SETTING_KEY = 'avotex_share_location';
const translations: TranslationResource = {
  settings: { es: 'Ajustes', en: 'Settings' },
  signIn: { es: 'Iniciar sesión', en: 'Sign in' },
  profile: { es: 'Mi perfil', en: 'My profile' },
  guestSubtitle: { es: 'Accede a todas las funciones de Avotex', en: 'Access all Avotex features' },
  accountSubtitle: { es: 'Administra tu cuenta', en: 'Manage your account' },
  privacySection: { es: 'PRIVACIDAD', en: 'PRIVACY' },
  privacyNotice: { es: 'Aviso de privacidad', en: 'Privacy notice' },
  privacySubtitle: { es: 'Consulta cómo protegemos tus datos', en: 'See how we protect your data' },
  shareLocation: { es: 'Compartir ubicación', en: 'Share location' },
  shareLocationSubtitle: { es: 'Clima y mapa en Inicio', en: 'Weather and map on Home' },
  languageSection: { es: 'IDIOMA', en: 'LANGUAGE' },
  language: { es: 'Idioma de la aplicación', en: 'App language' },
  languageSubtitle: { es: 'Elige cómo quieres ver Avotex', en: 'Choose how you want to view Avotex' },
  information: { es: 'INFORMACIÓN', en: 'INFORMATION' },
  avotexSubtitle: { es: 'Versión 1.0.3', en: 'Version 1.0.3' },
  footer: {
    es: 'La ubicación está activada por defecto y puedes cambiarla aquí cuando quieras.',
    en: 'Location is enabled by default and you can change it here at any time.',
  },
};

type SettingsRowProps = {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  isLast?: boolean;
};

function SettingsRow({ icon, title, subtitle, onPress, trailing, isLast }: SettingsRowProps) {
  const content = (
    <>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={[styles.rowBody, !isLast && styles.rowDivider]}>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
        {trailing ?? (onPress ? <ChevronRight size={20} color="#C7C7CC" /> : null)}
      </View>
    </>
  );

  return onPress ? (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.55}>
      {content}
    </TouchableOpacity>
  ) : (
    <View style={styles.row}>{content}</View>
  );
}

export default function SettingsScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold });
  const { isGuest, exitGuestMode } = useGuest();
  const { language, setLanguage } = useLanguage();
  const t = useTranslations(translations);
  const [shareLocation, setShareLocation] = useState(true);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(LOCATION_SETTING_KEY).then((savedValue) => {
        setShareLocation(savedValue !== 'false');
      });
    }, [])
  );

  const updateLocationSetting = async (enabled: boolean) => {
    setShareLocation(enabled);
    await AsyncStorage.setItem(LOCATION_SETTING_KEY, String(enabled));
  };

  if (!fontsLoaded) return <View style={styles.screen} />;

  const user = getAuth().currentUser;
  const accountTitle = isGuest ? t('signIn') : user?.displayName || t('profile');
  const accountSubtitle = isGuest
    ? t('guestSubtitle')
    : user?.email || t('accountSubtitle');

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, isTablet && styles.titleTablet]}>{t('settings')}</Text>

        <TouchableOpacity
          style={styles.accountCard}
          activeOpacity={0.6}
          onPress={async () => {
            if (isGuest) {
              await exitGuestMode();
              router.replace('/(auth)');
              return;
            }
            router.push('/(app)/profile');
          }}
        >
          <View style={styles.accountAvatar}>
            {isGuest
              ? <LogIn size={27} color="#FFFFFF" />
              : <UserRound size={29} color="#FFFFFF" />}
          </View>
          <View style={styles.accountCopy}>
            <Text style={styles.accountTitle}>{accountTitle}</Text>
            <Text style={styles.accountSubtitle} numberOfLines={1}>{accountSubtitle}</Text>
          </View>
          <ChevronRight size={21} color="#C7C7CC" />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>{t('privacySection')}</Text>
        <View style={styles.group}>
          <SettingsRow
            icon={<ShieldCheck size={20} color="#FFFFFF" />}
            title={t('privacyNotice')}
            subtitle={t('privacySubtitle')}
            onPress={() => router.push('/(app)/privacy')}
          />
          <SettingsRow
            icon={<MapPin size={20} color="#FFFFFF" />}
            title={t('shareLocation')}
            subtitle={t('shareLocationSubtitle')}
            trailing={
              <Switch
                value={shareLocation}
                onValueChange={updateLocationSetting}
                trackColor={{ false: '#D1D1D6', true: '#007AFF' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#D1D1D6"
              />
            }
            isLast
          />
        </View>

        <Text style={styles.sectionLabel}>{t('languageSection')}</Text>
        <View style={styles.group}>
          <SettingsRow
            icon={<Languages size={20} color="#FFFFFF" />}
            title={t('language')}
            subtitle={t('languageSubtitle')}
            trailing={
              <View style={styles.languageControl}>
                <TouchableOpacity
                  onPress={() => setLanguage('es')}
                  style={[styles.languageButton, language === 'es' && styles.languageButtonActive]}
                  accessibilityRole="radio"
                  accessibilityLabel="Español"
                  accessibilityState={{ selected: language === 'es' }}
                >
                  <Text style={[styles.languageButtonText, language === 'es' && styles.languageButtonTextActive]}>ES</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setLanguage('en')}
                  style={[styles.languageButton, language === 'en' && styles.languageButtonActive]}
                  accessibilityRole="radio"
                  accessibilityLabel="English"
                  accessibilityState={{ selected: language === 'en' }}
                >
                  <Text style={[styles.languageButtonText, language === 'en' && styles.languageButtonTextActive]}>EN</Text>
                </TouchableOpacity>
              </View>
            }
            isLast
          />
        </View>

        <Text style={styles.sectionLabel}>{t('information')}</Text>
        <View style={styles.group}>
          <SettingsRow
            icon={<Info size={20} color="#FFFFFF" />}
            title="Avotex"
            subtitle={t('avotexSubtitle')}
            isLast
          />
        </View>

        <Text style={styles.footer}>{t('footer')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 42,
    paddingBottom: 130,
  },
  contentTablet: {
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
    paddingTop: 58,
  },
  title: {
    color: '#000000',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 32,
    letterSpacing: -1,
    marginBottom: 20,
  },
  titleTablet: {
    fontSize: 40,
    marginBottom: 26,
  },
  accountCard: {
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 28,
  },
  accountAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8E8E93',
  },
  accountCopy: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  accountTitle: {
    color: '#111111',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 17,
  },
  accountSubtitle: {
    color: '#7A7A80',
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  sectionLabel: {
    color: '#6D6D72',
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    marginLeft: 15,
    marginBottom: 7,
  },
  group: {
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 25,
  },
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8E8E93',
    marginRight: 12,
  },
  rowBody: {
    minHeight: 60,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 14,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D8D8DC',
  },
  rowCopy: {
    flex: 1,
    paddingVertical: 9,
  },
  rowTitle: {
    color: '#171719',
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
  },
  rowSubtitle: {
    color: '#8A8A90',
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    marginTop: 1,
  },
  languageControl: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 10,
    backgroundColor: '#E9E9EE',
  },
  languageButton: {
    minWidth: 34,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  languageButtonActive: { backgroundColor: '#FFFFFF' },
  languageButtonText: {
    color: '#8A8A90',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
  },
  languageButtonTextActive: { color: '#007AFF' },
  footer: {
    color: '#8E8E93',
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 18,
  },
});