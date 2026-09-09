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
  Eye,
  ChevronRight,
  LogIn,
  Info,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { getAuth } from 'firebase/auth';
import { useGuest } from '../../context/GuestContext';
import { useAccessibility } from '../../context/AccessibilityContext';

const LOCATION_SETTING_KEY = 'avotex_share_location';

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
  const { isGuest } = useGuest();
  const { isColorblindMode, toggleColorblindMode } = useAccessibility();
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
  const accountTitle = isGuest ? 'Iniciar sesión' : user?.displayName || 'Mi perfil';
  const accountSubtitle = isGuest
    ? 'Accede a todas las funciones de Avotex'
    : user?.email || 'Administra tu cuenta';

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, isTablet && styles.titleTablet]}>Ajustes</Text>

        <TouchableOpacity
          style={styles.accountCard}
          activeOpacity={0.6}
          onPress={() => isGuest ? router.replace('/(auth)') : router.push('/(app)/profile')}
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

        <Text style={styles.sectionLabel}>PRIVACIDAD</Text>
        <View style={styles.group}>
          <SettingsRow
            icon={<ShieldCheck size={20} color="#FFFFFF" />}
            title="Aviso de privacidad"
            subtitle="Consulta cómo protegemos tus datos"
            onPress={() => router.push('/(app)/privacy')}
          />
          <SettingsRow
            icon={<MapPin size={20} color="#FFFFFF" />}
            title="Compartir ubicación"
            subtitle="Clima y mapa en Inicio"
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

        <Text style={styles.sectionLabel}>ACCESIBILIDAD</Text>
        <View style={styles.group}>
          <SettingsRow
            icon={<Eye size={20} color="#FFFFFF" />}
            title="Modo para daltonismo"
            subtitle="Ajusta los colores de diagnóstico"
            trailing={
              <Switch
                value={isColorblindMode}
                onValueChange={toggleColorblindMode}
                trackColor={{ false: '#D1D1D6', true: '#007AFF' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#D1D1D6"
              />
            }
            isLast
          />
        </View>

        <Text style={styles.sectionLabel}>INFORMACIÓN</Text>
        <View style={styles.group}>
          <SettingsRow
            icon={<Info size={20} color="#FFFFFF" />}
            title="Avotex"
            subtitle="Detección y seguimiento agrícola"
            isLast
          />
        </View>

        <Text style={styles.footer}>La ubicación está activada por defecto y puedes cambiarla aquí cuando quieras.</Text>
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
    paddingTop: 24,
    paddingBottom: 130,
  },
  contentTablet: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingTop: 38,
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
  footer: {
    color: '#8E8E93',
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 18,
  },
});