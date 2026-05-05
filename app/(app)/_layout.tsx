import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Poppins_600SemiBold, Poppins_400Regular } from '@expo-google-fonts/poppins';

export default function TabLayout() {
  const pathname = usePathname();
  const shouldHideTabs = pathname === '/(app)/chatbot' || pathname === '/chatbot';

  const [fontsLoaded] = useFonts({ Poppins_600SemiBold, Poppins_400Regular });

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: shouldHideTabs ? { display: 'none' } : styles.tabBar,
          tabBarActiveTintColor: '#0f766e',
          tabBarInactiveTintColor: '#94a3b8',
          tabBarShowLabel: true,
          tabBarLabelStyle: styles.tabBarLabel,
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
                <Home size={22} color={focused ? '#0f766e' : color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Escanear',
            tabBarIcon: () => (
              <View style={styles.scanIconContainer}>
                <LinearGradient
                  colors={['#34d399', '#14b8a6']}
                  style={styles.scanGradient}
                >
                  <Camera size={24} color="#ffffff" />
                </LinearGradient>
              </View>
            ),
            tabBarLabelStyle: [styles.tabBarLabel, { color: '#0f766e' }],
          }}
        />
        <Tabs.Screen
          name="mapping"
          options={{
            title: 'Mapeo',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Map size={22} color={focused ? '#0f766e' : color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="results"
          options={{
            title: 'Resultados',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <BarChart3 size={22} color={focused ? '#0f766e' : color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="agenda"
          options={{
            title: 'Medidas',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <AlertTriangle size={22} color={focused ? '#0f766e' : color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen name="chatbot" options={{ href: null }} />
        <Tabs.Screen name="privacy" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>

      {!shouldHideTabs && (
        <>
          {/* ── Bottom bar: Privacy + Mi Perfil ── */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.privacyBtn}
              onPress={() => router.push('/(app)/privacy')}
              activeOpacity={0.75}
            >
              <Shield size={13} color="#0f766e" />
              <Text style={styles.privacyBtnText}>Aviso de Privacidad</Text>
            </TouchableOpacity>

            <View style={styles.barDivider} />

            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => router.push('/(app)/profile')}
              activeOpacity={0.75}
            >
              <User size={13} color="#0f766e" />
              <Text style={styles.profileBtnText}>Mi Perfil</Text>
            </TouchableOpacity>
          </View>

          {/* ── FAB Chatbot ── */}
          <TouchableOpacity
            style={styles.fab}
            onPress={() => router.push('/(app)/chatbot')}
          >
            <LinearGradient
              colors={['#34d399', '#14b8a6']}
              style={styles.fabGradient}
            >
              <MessageCircle size={26} color="#ffffff" />
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 18,
    left: 16,
    right: 16,
    elevation: 0,
    borderRadius: 24,
    height: 72,
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
  tabBarLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
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
  scanGradient: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.8)',
  },

  bottomBar: {
    position: 'absolute',
    bottom: 100,
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

  fab: {
    position: 'absolute',
    bottom: 170,
    right: 22,
    borderRadius: 30,
    shadowColor: '#0f766e',
    shadowOpacity: 0.32,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabGradient: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
