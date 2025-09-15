import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Switch } from 'react-native';
import { Camera, Map, ChartLine as LineChart, Leaf, Sun, Droplets, AlertTriangle } from 'lucide-react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, interpolate, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import * as Location from 'expo-location';
import MapViewComponent from '../../components/MapViewComponent';
import { auth } from '../../firebaseConfig';
import Avatar from '../../components/Avatar';
import { onAuthStateChanged, User } from 'firebase/auth';
import axios from 'axios';
import { useAccessibility } from '../../context/AccessibilityContext';

const { width, height } = Dimensions.get('window');

// --- COMPONENTE DE HOJA ANIMADA (VERSIÓN CORREGIDA Y MEJORADA) ---
const AnimatedLeaf = () => {
  const initialX = useSharedValue(Math.random() * width);
  const initialY = useSharedValue(Math.random() * height);
  const size = useSharedValue(20 + Math.random() * 20);
  const progress = useSharedValue(Math.random()); // Inicia en un punto aleatorio de la animación

  // --- CORRECCIÓN: Calculamos los valores aleatorios UNA SOLA VEZ aquí ---
  // Estos valores definen a dónde se moverá la hoja y cuánto rotará.
  const xEnd = Math.random() * 40 - 20; // Movimiento horizontal entre -20 y +20
  const yEnd = Math.random() * 40 - 20; // Movimiento vertical entre -20 y +20
  const rotationEnd = Math.random() * 360;

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { 
        duration: 4000 + Math.random() * 3000, // Duración más lenta y aleatoria
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // Repetir infinitamente
      true // Animación de ida y vuelta (yoyo)
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    // Usamos los valores fijos para un movimiento suave y predecible
    const translateX = interpolate(progress.value, [0, 1], [0, xEnd]);
    const translateY = interpolate(progress.value, [0, 1], [0, yEnd]);
    const rotate = interpolate(progress.value, [0, 1], [0, rotationEnd]);
    
    // --- MEJORA: Añadimos una animación de opacidad para un efecto más suave ---
    const opacity = interpolate(progress.value, [0, 0.5, 1], [0.5, 1, 0.5]);

    return {
      position: 'absolute',
      left: initialX.value,
      top: initialY.value,
      fontSize: size.value,
      opacity: opacity, 
      transform: [ 
        { translateX }, 
        { translateY }, 
        { rotate: `${rotate}deg` } 
      ],
    };
  });

  return ( <Animated.Text style={animatedStyle}>🍃</Animated.Text> );
};


const getWeatherEmoji = (temp: number) => {
  if (temp < 5) return '🌨️';
  if (temp < 15) return '🌧️';
  if (temp < 25) return '⛅';
  if (temp < 32) return '🌤️';
  return '🌩️';
};

const formatDate = (date: Date) => {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

const formatTime12h = (date: Date) => {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
};

export default function Home() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold
  });

  const { isColorblindMode, toggleColorblindMode } = useAccessibility();

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [dateTime, setDateTime] = useState<{ date: string; time: string }>({ date: '', time: '' });
  const [municipioEstado, setMunicipioEstado] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('El permiso para acceder a la ubicación fue denegado');
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
        const places = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        if (places.length > 0) {
          const place = places[0];
          const municipio = place.city || place.subregion || '';
          const estado = place.region || '';
          setMunicipioEstado(`${municipio}, ${estado}`);
        }
      } catch (error) {
        setErrorMsg('No se pudo obtener la ubicación actual');
        console.error(error);
      }
    })();
  }, []);

  useEffect(() => {
    if (location) {
      const fetchWeather = async () => {
        try {
          const { latitude, longitude } = location.coords;
          const API_KEY = '02a20e008e6564743d58753851aea172';
          const response = await axios.get( `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&lang=es&appid=${API_KEY}` );
          setTemperature(response.data.main.temp);
          setHumidity(response.data.main.humidity);
        } catch (error) {
          console.error('Error al obtener clima:', error);
        }
      };
      fetchWeather();
    }
  }, [location]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setDateTime({ date: formatDate(now), time: formatTime12h(now) });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const navigateTo = (route: string) => router.push(route);

  if (!fontsLoaded) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const colors = {
    primary: isColorblindMode ? '#0D47A1' : '#50c878',
    primaryDark: isColorblindMode ? '#0D47A1' : '#2e8b57',
    secondary: isColorblindMode ? '#FFC107' : '#ffaa4f',
    secondaryDark: isColorblindMode ? '#F57F17' : '#ff8c00',
    accent: isColorblindMode ? '#42A5F5' : '#4fbcff',
    accentDark: isColorblindMode ? '#1976D2' : '#2e8bc0',
    danger: isColorblindMode ? '#0D47A1' : '#F54927',
    dangerDark: isColorblindMode ? '#0D47A1' : '#E04324',
    background: isColorblindMode ? ['#E3F2FD', '#ffffff'] : ['#e0f7ec', '#ffffff'],
    welcomeBorder: isColorblindMode ? '#FFC107' : '#30E636',
    textPrimary: isColorblindMode ? '#0D47A1' : '#2a2a2a',
    textSecondary: '#666',
    white: '#ffffff'
  };

  return (
    <LinearGradient colors={colors.background} style={styles.gradientBackground}>
      <View style={styles.decoration} pointerEvents="none">
        {Array.from({ length: 40 }).map((_, i) => (
          <AnimatedLeaf key={i} />
        ))}
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {user && (
            <Animated.View entering={FadeInDown.delay(200).duration(1000)}>
              <TouchableOpacity style={[styles.welcomeContainer, { borderColor: colors.welcomeBorder }]} activeOpacity={0.8}>
                <View style={styles.welcomeTextBox}>
                  <Text style={styles.greetingText}>HOLA DE NUEVO 🥑,</Text>
                  <Text style={[styles.userNameText, {color: colors.textPrimary}]}>{user.displayName || user.email}</Text>
                   <Text style={styles.toggleLabel}>Modo Daltonismo                   <Switch
                trackColor={{ false: "#d3d3d3", true: "#81b0ff" }}
                thumbColor={isColorblindMode ? colors.accent : "#f4f3f4"}
                ios_backgroundColor="#3e3e3e"
                onValueChange={toggleColorblindMode}
                value={isColorblindMode}
              /></Text>
  
                </View>
                <Avatar user={user} />
              </TouchableOpacity>
            </Animated.View>
          )}
{/* 
          <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Modo Daltonismo</Text>
              <Switch
                trackColor={{ false: "#d3d3d3", true: "#81b0ff" }}
                thumbColor={isColorblindMode ? colors.accent : "#f4f3f4"}
                ios_backgroundColor="#3e3e3e"
                onValueChange={toggleColorblindMode}
                value={isColorblindMode}
              />
          </View> */}

          {municipioEstado.length > 0 && (
            <Text style={[styles.municipioEstado, { color: colors.textPrimary }]}>📍{municipioEstado} {dateTime.time} {dateTime.date}</Text>
          )}

          <Animated.View entering={FadeInDown.delay(400).duration(1000)} style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Sun color={colors.primary} size={24} />
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{temperature !== null ? `${getWeatherEmoji(temperature)} ${temperature.toFixed(1)}°C` : '...'}</Text>
              <Text style={styles.statLabel}>Temperatura</Text>
            </View>
            <View style={styles.statCard}>
              <Droplets color={colors.accent} size={24} />
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{humidity !== null ? `${humidity}%` : '...'}</Text>
              <Text style={styles.statLabel}>Humedad</Text>
            </View>
            <View style={styles.statCard}>
              <Leaf color={colors.primary} size={24} />
              <Text style={{ fontSize: 10.5, fontFamily: 'Poppins_600SemiBold', color: colors.textPrimary, marginTop: 10 }}>Accede a Results</Text>
              <Text style={styles.statLabel}>Salud</Text>
            </View>
          </Animated.View>
        </View>
        
          <Animated.View 
            entering={FadeInUp.delay(500).duration(1000)} 
            style={{ marginTop: -30 }}
          >
          <MapViewComponent location={location} errorMsg={errorMsg} />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(600).duration(1000)} style={styles.grid}>
          <TouchableOpacity style={styles.mainCard} onPress={() => navigateTo('/scan')}>
            <LinearGradient colors={[colors.accent, colors.accentDark]} style={styles.cardGradient}>
              <View style={styles.cardIconContainer}><Camera color={colors.white} size={25} /></View>
              <Text style={styles.cardTitle}>Escanear</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.secondaryCardsContainer}>
            <TouchableOpacity style={[styles.secondaryCard, { marginBottom: 16 }]} onPress={() => navigateTo('/mapping')}>
              <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.cardGradient}>
                <View style={styles.cardIconContainer}><Map color={colors.white} size={25} /></View>
                <Text style={styles.secondaryCardTitle}>Mapeo</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.secondaryCard, { marginBottom: 16 }]} onPress={() => navigateTo('/results')}>
              <LinearGradient colors={[colors.secondary, colors.secondaryDark]} style={styles.cardGradient}>
                <View style={styles.cardIconContainer}><LineChart color={colors.white} size={25} /></View>
                <Text style={styles.secondaryCardTitle}>Resultados</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryCard} onPress={() => navigateTo('/agenda')}>
              <LinearGradient colors={[colors.danger, colors.dangerDark]} style={styles.cardGradient}>
                <View style={styles.cardIconContainer}><AlertTriangle color={colors.white} size={25} /></View>
                <Text style={styles.secondaryCardTitle}>Medidas</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
   decoration: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    zIndex: 0,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  gradientBackground: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  header: { paddingTop: 60, paddingHorizontal: 24, marginBottom: 24 },
  welcomeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 10,
    paddingLeft: 24,
    paddingRight: 10,
    borderWidth: 2,
    borderTopLeftRadius: 30,
    borderBottomLeftRadius: 30,
    borderTopRightRadius: 60,
    borderBottomRightRadius: 60,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  welcomeTextBox: { flex: 1, marginRight: 12 },
  greetingText: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: '#666', opacity: 0.8 },
  userNameText: { fontFamily: 'Poppins_600SemiBold', fontSize: 16 },
toggleRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 10,        // antes 10
  marginBottom: 4,     // antes 8
  backgroundColor: 'rgba(255, 255, 255, 0.7)',
  borderRadius: 10,    // un poco menor
  paddingVertical: 4,  // antes 8
  paddingHorizontal: 10, // antes 16
},
toggleLabel: {
  fontFamily: 'Poppins_600SemiBold',
  fontSize: 13,   // antes 15
  color: '#333'
},
  municipioEstado: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 16,
    elevation: 5,
  },
  statCard: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', marginTop: 2 },
  statLabel: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: '#666' },
  grid: { flexDirection: 'row', paddingHorizontal: 24, gap: 16, marginTop: 0 },
  mainCard: { flex: 1, height: 270, borderRadius: 24, overflow: 'hidden', elevation: 8 },
  secondaryCardsContainer: { flex: 1 },
  secondaryCard: { flex: 1, height: 130, borderRadius: 24, overflow: 'hidden', elevation: 8 },
  cardGradient: { flex: 1, padding: 24 },
  cardIconContainer: { width: 50, height: 50, borderRadius: 30, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 20, fontFamily: 'Poppins_600SemiBold', color: '#ffffff', marginTop: 8 },
  secondaryCardTitle: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#ffffff', marginTop: 4 },
});