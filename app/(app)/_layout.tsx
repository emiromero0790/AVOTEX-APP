import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Tabs, router, usePathname } from 'expo-router';
import { Home, Camera, Map, BarChart3, AlertTriangle, MessageCircle } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useFonts, Poppins_600SemiBold } from '@expo-google-fonts/poppins';

export default function TabLayout() {
  const pathname = usePathname();
  const shouldHideTabs = pathname === '/(app)/chatbot' || pathname === '/chatbot';

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
  });

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: shouldHideTabs ? { display: 'none' } : styles.tabBar,
          tabBarActiveTintColor: '#50c878',
          tabBarInactiveTintColor: '#9e9e9e',
          tabBarShowLabel: true,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarItemStyle: styles.tabBarItem,
          tabBarBackground: () =>
            Platform.OS === 'ios' ? (
              <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.androidTabBarBackground]} />
            ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inicio',
            tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Escanear',
            tabBarIcon: ({ size }) => (
              <View style={styles.scanIconContainer}>
                <Camera size={size + 4} color="#ffffff" />
              </View>
            ),
            tabBarLabelStyle: [styles.tabBarLabel, { color: '#4fbcff' }],
          }}
        />
        <Tabs.Screen
          name="mapping"
          options={{
            title: 'Mapeo',
            tabBarIcon: ({ color, size }) => <Map size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="results"
          options={{
            title: 'Resultados',
            tabBarIcon: ({ color, size }) => <BarChart3 size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="agenda"
          options={{
            title: 'Medidas',
            tabBarIcon: ({ color, size }) => <AlertTriangle size={size} color={color} />,
          }}
        />
        
        <Tabs.Screen
          name="chatbot"
          options={{
            href: null,
          }}
        />
      </Tabs>

      {/* El FAB también se oculta cuando estás en la pantalla del chatbot */}
      {!shouldHideTabs && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(app)/chatbot')}
        >
          <MessageCircle size={28} color="#ffffff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    elevation: 0,
    borderRadius: 20,
    height: 70,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    borderTopWidth: 0,
    paddingBottom: 0,
    paddingHorizontal: 10,
  },
  androidTabBarBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  tabBarLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    marginBottom: 8,
  },
  tabBarItem: {
    paddingTop: 8,
  },
  scanIconContainer: {
    backgroundColor: '#4fbcff',
    width: 50,
    height: 50,
    borderRadius: 25,
    marginTop: -15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fab: {
    position: 'absolute',
    bottom: 100, 
    right: 25,  
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2BC45B', 
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  }
});