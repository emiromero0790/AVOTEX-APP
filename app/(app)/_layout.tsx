import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { Tabs, router, usePathname } from 'expo-router';
import {
  Home,
  Camera,
  Map,
  BarChart3,
  AlertTriangle,
  MessageCircle,
  Shield,
  User,
  Lock,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Poppins_600SemiBold, Poppins_400Regular } from '@expo-google-fonts/poppins';
import { useGuest } from '../../context/GuestContext';
import { useState } from 'react';

function GuestLockedModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.lockOverlay}>
        <View style={styles.lockCard}>
          <View style={styles.lockIconCircle}>
            <Lock size={30} color="#0f766e" />
          </View>
          <Text style={styles.lockTitle}>Función bloqueada</Text>
          <Text style={styles.lockBody}>
            Registra una cuenta con VEX para continuar y acceder a todas las funciones de Avotex.
          </Text>
          <TouchableOpacity
            style={styles.lockLoginBtn}
            onPress={() => { onClose(); router.replace('/(auth)'); }}
          >
            <LinearGradient colors={['#34d399', '#0f766e']} style={styles.lockBtnGrad}>
              <Text style={styles.lockBtnText}>Crear cuenta / Iniciar sesión</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.lockCancelBtn} onPress={onClose}>
            <Text style={styles.lockCancelText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function TabLayout() {
  const pathname = usePathname();
  const shouldHideTabs = pathname === '/(app)/chatbot' || pathname === '/chatbot';
  const { isGuest } = useGuest();
  const [showLockModal, setShowLockModal] = useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [fontsLoaded] = useFonts({ Poppins_600SemiBold, Poppins_400Regular });

  if (!fontsLoaded) return null;

  const tabHeight = isTablet ? 82 : 72;
  const tabBottom = isTablet ? 24 : 18;
  const tabLabelSize = isTablet ? 13 : 11;

  const handleLockedPress = () => {
    if (isGuest) setShowLockModal(true);
  };

  const LockedTabIcon = ({ color, focused }: { color: string; focused?: boolean }) => (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Lock size={isTablet ? 26 : 22} color={isGuest ? '#cbd5e1' : color} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <GuestLockedModal visible={showLockModal} onClose={() => setShowLockModal(false)} />

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: shouldHideTabs ? { display: 'none' } : [
            styles.tabBar,
            {
              bottom: tabBottom,
              height: tabHeight,
            },
            isTablet && styles.tabBarTablet,
          ],
          tabBarActiveTintColor: '#0f766e',
          tabBarInactiveTintColor: '#94a3b8',
          tabBarShowLabel: true,
          tabBarLabelStyle: [styles.tabBarLabel, { fontSize: tabLabelSize }],
          tabBarItemStyle: styles.tabBarItem,
          tabBarBackground: () => (
            <LinearGradient
              colors={['rgba(236,253,245,0.98)', 'rgba(240,253,250,0.98)']}
              style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
            />
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inicio',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Home size={isTablet ? 26 : 22} color={focused ? '#0f766e' : color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Escanear',
            tabBarIcon: () => (
              <View style={[styles.scanIconContainer, isTablet && styles.scanIconContainerTablet]}>
                <LinearGradient
                  colors={['#34d399', '#14b8a6']}
                  style={[styles.scanGradient, isTablet && styles.scanGradientTablet]}
                >
                  <Camera size={isTablet ? 28 : 24} color="#ffffff" />
                </LinearGradient>
              </View>
            ),
            tabBarLabelStyle: [styles.tabBarLabel, { color: '#0f766e', fontSize: tabLabelSize }],
          }}
        />
        <Tabs.Screen
          name="mapping"
          options={{
            title: 'Mapeo',
            tabBarIcon: ({ color, focused }) => isGuest ? (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Lock size={isTablet ? 26 : 22} color="#cbd5e1" />
              </View>
            ) : (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Map size={isTablet ? 26 : 22} color={focused ? '#0f766e' : color} />
              </View>
            ),
            tabBarButton: isGuest ? (props) => (
              <TouchableOpacity style={props.style} onPress={handleLockedPress} activeOpacity={0.7}>
                {props.children}
              </TouchableOpacity>
            ) : undefined,
          }}
        />
        <Tabs.Screen
          name="results"
          options={{
            title: 'Resultados',
            tabBarIcon: ({ color, focused }) => isGuest ? (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Lock size={isTablet ? 26 : 22} color="#cbd5e1" />
              </View>
            ) : (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <BarChart3 size={isTablet ? 26 : 22} color={focused ? '#0f766e' : color} />
              </View>
            ),
            tabBarButton: isGuest ? (props) => (
              <TouchableOpacity style={props.style} onPress={handleLockedPress} activeOpacity={0.7}>
                {props.children}
              </TouchableOpacity>
            ) : undefined,
          }}
        />
        <Tabs.Screen
          name="agenda"
          options={{
            title: 'Medidas',
            tabBarIcon: ({ color, focused }) => isGuest ? (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Lock size={isTablet ? 26 : 22} color="#cbd5e1" />
              </View>
            ) : (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <AlertTriangle size={isTablet ? 26 : 22} color={focused ? '#0f766e' : color} />
              </View>
            ),
            tabBarButton: isGuest ? (props) => (
              <TouchableOpacity style={props.style} onPress={handleLockedPress} activeOpacity={0.7}>
                {props.children}
              </TouchableOpacity>
            ) : undefined,
          }}
        />
        <Tabs.Screen name="chatbot" options={{ href: null }} />
        <Tabs.Screen name="privacy" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>

      {!shouldHideTabs && (
        <>
          <View style={[
            styles.bottomBar,
            { bottom: isTablet ? tabBottom + tabHeight + 8 : 100 },
            isTablet && styles.bottomBarTablet,
          ]}>
            <TouchableOpacity
              style={styles.privacyBtn}
              onPress={() => router.push('/(app)/privacy')}
              activeOpacity={0.75}
            >
              <Shield size={isTablet ? 15 : 13} color="#0f766e" />
              <Text style={[styles.privacyBtnText, isTablet && styles.barTextTablet]}>Aviso de Privacidad</Text>
            </TouchableOpacity>

            <View style={styles.barDivider} />

            {isGuest ? (
              <TouchableOpacity
                style={styles.profileBtn}
                onPress={() => router.replace('/(auth)')}
                activeOpacity={0.75}
              >
                <Lock size={isTablet ? 15 : 13} color="#0f766e" />
                <Text style={[styles.profileBtnText, isTablet && styles.barTextTablet]}>Iniciar sesión</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.profileBtn}
                onPress={() => router.push('/(app)/profile')}
                activeOpacity={0.75}
              >
                <User size={isTablet ? 15 : 13} color="#0f766e" />
                <Text style={[styles.profileBtnText, isTablet && styles.barTextTablet]}>Mi Perfil</Text>
              </TouchableOpacity>
            )}
          </View>

          {!isGuest && (
            <TouchableOpacity
              style={[
                styles.fab,
                { bottom: isTablet ? tabBottom + tabHeight + 68 : 170 },
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
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    elevation: 0,
    borderRadius: 24,
    shadowColor: '#0f766e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    borderTopWidth: 0,
    paddingBottom: 0,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.12)',
  },
  tabBarTablet: {
    left: 40,
    right: 40,
    borderRadius: 28,
    paddingHorizontal: 16,
  },
  tabBarLabel: {
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: 6,
  },
  tabBarItem: {
    paddingTop: 6,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(20,184,166,0.12)',
  },
  scanIconContainer: {
    marginTop: -18,
    shadowColor: '#0f766e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 8,
    borderRadius: 28,
  },
  scanIconContainerTablet: {
    marginTop: -22,
  },
  scanGradient: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  scanGradientTablet: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },

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

  bottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(240,253,250,0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.18)',
    shadowColor: '#0f766e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
    marginBottom: 2,
  },
  bottomBarTablet: {
    left: 40,
    right: 40,
    borderRadius: 20,
  },
  privacyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  privacyBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: '#0f766e',
  },
  barDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(20,184,166,0.25)',
  },
  profileBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(240,253,250,0.85)',
  },
  profileBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: '#0f766e',
  },
  barTextTablet: {
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
