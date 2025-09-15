import { Tabs } from 'expo-router';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { Chrome as Home, Camera, Map, ChartBar as BarChart3, AlertTriangle } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useFonts, Poppins_600SemiBold } from '@expo-google-fonts/poppins';

export default function TabLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
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
          tabBarIcon: ({ color, size }) => (
            <View style={styles.iconContainer}>
              <Home size={size} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Escanear',
          tabBarIcon: ({ color, size }) => (
            <View style={[styles.iconContainer, styles.scanIconContainer]}>
              <Camera size={size + 4} color="#ffffff" />
            </View>
          ),
          tabBarActiveTintColor: '#ffffff',
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('scan');
          },
        })}
      />
      <Tabs.Screen
        name="mapping"
        options={{
          title: 'Mapeo',
          tabBarIcon: ({ color, size }) => (
            <View style={styles.iconContainer}>
              <Map size={size} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: 'Results',
          tabBarIcon: ({ color, size }) => (
            <View style={styles.iconContainer}>
              <BarChart3 size={size} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Medidas', 
          tabBarIcon: ({ color, size }) => (
            <View style={styles.iconContainer}>
              <AlertTriangle size={size} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
    
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
    shadowOffset: {
      width: 0,
      height: 4,
    },
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
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
