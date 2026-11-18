import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Tabs, router, usePathname } from 'expo-router';
import { MessageCircle, Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Poppins_600SemiBold, Poppins_400Regular, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { useGuest } from '../../context/GuestContext';
import { useState } from 'react';
import { TranslationResource, useTranslations } from '../../context/LanguageContext';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { configureNotifications, recorridoIdFrom } from '../../services/push';
import { AvotexTabBar, useAvotexTabBarMetrics } from '../../components/tabbar/AvotexTabBar';

/** Opciones que un invitado ve con candado. */
const GUEST_LOCKED: ReadonlySet<string> = new Set(['mapping', 'results', 'satelite']);

const translations: TranslationResource = {
  locked: { es: 'Función bloqueada', en: 'Feature locked' },
  lockedBody: { es: 'Registra una cuenta con VEX para continuar y acceder a todas las funciones de Avotex.', en: 'Create a VEX account to continue and access all Avotex features.' },
  signIn: { es: 'Crear cuenta / Iniciar sesión', en: 'Create account / Sign in' },
  back: { es: 'Volver', en: 'Back' },
  home: { es: 'Inicio', en: 'Home' },
  scan: { es: 'Escanear', en: 'Scan' },
  mapping: { es: 'Mapeo', en: 'Mapping' },
  activity: { es: 'Actividad', en: 'Activity' },
  satellite: { es: 'Satélite', en: 'Satellite' },
  settings: { es: 'Ajustes', en: 'Settings' },
};

function GuestLockedModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTranslations(translations);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.lockOverlay}>
        <View style={styles.lockCard}>
          <View style={styles.lockIconCircle}>
            <Lock size={30} color="#0f766e" />
          </View>
          <Text style={styles.lockTitle}>{t('locked')}</Text>
          <Text style={styles.lockBody}>
            {t('lockedBody')}
          </Text>
          <TouchableOpacity
            style={styles.lockLoginBtn}
            onPress={() => { onClose(); router.replace('/(auth)'); }}
          >
            <LinearGradient colors={['#34d399', '#0f766e']} style={styles.lockBtnGrad}>
              <Text style={styles.lockBtnText}>{t('signIn')}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.lockCancelBtn} onPress={onClose}>
            <Text style={styles.lockCancelText}>{t('back')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Pantallas que viven dentro de las pestañas pero sin botón propio en la barra.
// Desde expo-router 58 `href: null` marca la pantalla como oculta y el router redirige a Inicio
// cuando se intenta abrir (así fallaban Recorrido, Notificaciones, Planes, Perfil, etc.).
// Ocultar solo el botón mantiene la pantalla navegable.
const HIDDEN_TAB = {
  tabBarButton: () => null,
  tabBarItemStyle: { display: 'none' as const },
};

export default function TabLayout() {
  const pathname = usePathname();
  const shouldHideTabs =
    pathname === '/(app)/chatbot' ||
    pathname === '/chatbot' ||
    pathname === '/(app)/plans' ||
    pathname === '/plans' ||
    pathname === '/(app)/recorrido' ||
    pathname === '/recorrido' ||
    pathname === '/(app)/hallazgo' ||
    pathname === '/hallazgo' ||
    pathname === '/(app)/grabacion' ||
    pathname === '/grabacion';
  // Escanear, Mis escaneos e Importar: sin el botón flotante del chatbot (taparía los botones de abajo).
  const scanSection = ['/scan', '/(app)/scan', '/escaneos', '/(app)/escaneos'].includes(pathname);
  const shouldHideChatbot =
    shouldHideTabs ||
    pathname === '/(app)/mapping' ||
    pathname === '/mapping' ||
    pathname === '/(app)/scan' ||
    pathname === '/scan' ||
    scanSection;
  const { isGuest } = useGuest();
  const t = useTranslations(translations);
  const [showLockModal, setShowLockModal] = useState(false);
  const nav = useAvotexTabBarMetrics();
  const isTablet = nav.tablet;

  const [fontsLoaded] = useFonts({ Poppins_600SemiBold, Poppins_400Regular, Poppins_700Bold });

  // Notificación "Tu recorrido está listo": al tocarla se abre Mis escaneos con ese recorrido en el mapa.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    configureNotifications();
    const open = (response: Notifications.NotificationResponse | null) => {
      const id = recorridoIdFrom(response);
      if (id) router.navigate({ pathname: '/(app)/escaneos', params: { focus: `remote:${id}`, n: String(Date.now()) } });
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) return null;

  const handleLockedPress = () => {
    if (isGuest) setShowLockModal(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <GuestLockedModal visible={showLockModal} onClose={() => setShowLockModal(false)} />

      <Tabs
        // "Volver" regresa a la pantalla anterior (p. ej. de Recorrido a Escanear) en lugar de ir siempre a Inicio.
        backBehavior="history"
        // Barra propia (plataforma vegetal + aguacate). Respeta tabPress/tabLongPress y la navegación del router.
        tabBar={(props) => (
          <AvotexTabBar
            {...props}
            hidden={shouldHideTabs}
            locked={isGuest ? GUEST_LOCKED : undefined}
            onLocked={handleLockedPress}
            labels={{
              index: t('home'),
              scan: t('scan'),
              mapping: t('mapping'),
              results: t('activity'),
              satelite: t('satellite'),
              settings: t('settings'),
            }}
          />
        )}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ title: t('home') }} />
        <Tabs.Screen name="scan" options={{ title: t('scan') }} />
        <Tabs.Screen name="mapping" options={{ title: t('mapping') }} />
        <Tabs.Screen name="results" options={{ title: t('activity') }} />
        <Tabs.Screen name="satelite" options={{ title: t('satellite'), tabBarAccessibilityLabel: t('satellite') }} />
        <Tabs.Screen name="agenda" options={HIDDEN_TAB} />
        <Tabs.Screen name="settings" options={{ title: t('settings') }} />
        <Tabs.Screen name="chatbot" options={HIDDEN_TAB} />
        <Tabs.Screen name="privacy" options={HIDDEN_TAB} />
        <Tabs.Screen name="profile" options={HIDDEN_TAB} />
        <Tabs.Screen name="plans" options={HIDDEN_TAB} />
        <Tabs.Screen name="notifications" options={HIDDEN_TAB} />
        <Tabs.Screen name="recorrido" options={HIDDEN_TAB} />
        <Tabs.Screen name="escaneos" options={HIDDEN_TAB} />
        <Tabs.Screen name="grabacion" options={HIDDEN_TAB} />
        <Tabs.Screen name="hallazgo" options={HIDDEN_TAB} />
      </Tabs>

      {!shouldHideChatbot && !isGuest && (
        <TouchableOpacity
          style={[
            styles.fab,
            { bottom: nav.barTop + (isTablet ? 46 : 40) },
            isTablet && styles.fabTablet,
          ]}
          onPress={() => router.push('/(app)/chatbot')}
        >
          <LinearGradient
            colors={['#34d399', '#14b8a6']}
            style={[styles.fabGradient, isTablet && styles.fabGradientTablet]}
          >
            <MessageCircle size={isTablet ? 30 : 26} color="#ffffff" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  guestBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: '#f59e0b',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  guestBannerTablet: {
    paddingVertical: 8,
  },
  guestBannerText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
  },
  guestBannerTextTablet: {
    fontSize: 14,
  },

  fab: {
    position: 'absolute',
    right: 22,
    borderRadius: 30,
    shadowColor: '#0f766e',
    shadowOpacity: 0.32,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabTablet: {
    right: 44,
  },
  fabGradient: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabGradientTablet: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },

  lockOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  lockCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  lockIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  lockTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 20,
    color: '#134e4a',
    marginBottom: 10,
    textAlign: 'center',
  },
  lockBody: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  lockLoginBtn: {
    width: '100%',
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: 10,
  },
  lockBtnGrad: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  lockBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#fff',
  },
  lockCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  lockCancelText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#94a3b8',
  },
});
