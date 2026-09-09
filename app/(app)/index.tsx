import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { Camera, Map, ChartLine as LineChart, Leaf, Sun, Droplets, Wind, LogOut, MapPinOff, Lock, Coins } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import * as Location from 'expo-location';
import MapViewComponent from '../../components/MapViewComponent';
import { auth } from '../../firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import axios from 'axios';
import { useAccessibility } from '../../context/AccessibilityContext';
import { signOut } from 'firebase/auth';
import { supabase } from '../../supabaseConfig';
import Reanimated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useGuest, GUEST_MAX_SCANS } from '../../context/GuestContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OPENWEATHER_API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY!;

interface Scan { label: string; }

type VerticalGaugeProps = {
  value: number | null;
  min: number;
  max: number;
  labels: Array<{ value: number; text: string }>;
};

function VerticalGauge({ value, min, max, labels }: VerticalGaugeProps) {
  const percentage = value === null
    ? null
    : Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <View style={s.gauge}>
      <View style={s.gaugeTicks}>
        {Array.from({ length: 11 }).map((_, index) => (
          <View
            key={index}
            style={[s.gaugeTick, index % 5 === 0 && s.gaugeTickMajor]}
          />
        ))}
        {percentage !== null ? (
          <View style={[s.gaugeIndicator, { bottom: `${percentage}%` as any }]} />
        ) : null}
      </View>
      <View style={s.gaugeLabels}>
        {labels.map((label) => {
          const position = Math.max(0, Math.min(100, ((label.value - min) / (max - min)) * 100));
          return (
            <Text
              key={label.value}
              style={[s.gaugeLabel, { bottom: `${position}%` as any }]}
            >
              {label.text}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const CROP_ORBS = [
  {
    name: 'Aguacate',
    uri: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=400&q=85',
    color: '#16a34a', glow: 'rgba(74,222,128,0.30)',
    xFrac: -0.12, y: 28, sizeFrac: 0.37, dur: 5200, delay: 0, fy: 14, fx: 5,
  },
  {
    name: 'Mango',
    uri: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&q=85',
    color: '#ea580c', glow: 'rgba(251,146,60,0.28)',
    xFrac: 0.7, y: 55, sizeFrac: 0.34, dur: 4800, delay: 700, fy: -12, fx: -6,
  },
  {
    name: 'Limón',
    uri: 'https://sicarfarms.com/wp-content/uploads/2021/01/mx-lemon.png',
    color: '#65a30d', glow: 'rgba(163,230,53,0.28)',
    xFrac: -0.09, y: 270, sizeFrac: 0.295, dur: 6100, delay: 1100, fy: 10, fx: 6,
  },
  {
    name: 'Café',
    uri: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400&q=85',
    color: '#92400e', glow: 'rgba(217,119,6,0.28)',
    xFrac: 0.74, y: 360, sizeFrac: 0.30, dur: 5600, delay: 1800, fy: -10, fx: -5,
  },
  {
    name: 'Guayaba',
    uri: 'https://lirp.cdn-website.com/14807e67/dms3rep/multi/opt/beneficios-de-guayaba-1920w.jpeg',
    color: '#be185d', glow: 'rgba(244,114,182,0.28)',
    xFrac: -0.10, y: 590, sizeFrac: 0.325, dur: 4600, delay: 2500, fy: 13, fx: 7,
  },
  {
    name: 'Berries',
    uri: 'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?w=400&q=85',
    color: '#6d28d9', glow: 'rgba(168,85,247,0.28)',
    xFrac: 0.72, y: 635, sizeFrac: 0.32, dur: 5000, delay: 3200, fy: -11, fx: -4,
  },
];

const FloatingOrb = ({ orb, screenWidth }: { orb: typeof CROP_ORBS[0]; screenWidth: number }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const size = orb.sizeFrac * screenWidth;
  const x = orb.xFrac * screenWidth;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: orb.dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: orb.dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    }, orb.delay);
    return () => clearTimeout(timer);
  }, []);

  const ty = anim.interpolate({ inputRange: [0, 1], outputRange: [0, orb.fy] });
  const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [0, orb.fx] });
  const sc = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.025, 1] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: orb.y,
        width: size,
        height: size,
        transform: [{ translateY: ty }, { translateX: tx }, { scale: sc }],
        zIndex: 0,
      }}
    >
      <View style={{
        position: 'absolute',
        top: -8, left: -8,
        width: size + 16, height: size + 16,
        borderRadius: (size + 16) / 2,
        backgroundColor: orb.glow,
      }} />
      <View style={{
        position: 'absolute',
        top: -4, left: -4,
        width: size + 8, height: size + 8,
        borderRadius: (size + 8) / 2,
        borderWidth: 3,
        borderColor: orb.color + 'aa',
      }} />
      <Image
        source={{ uri: orb.uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: 0.82,
        }}
      />
      <View style={{
        position: 'absolute',
        top: 0, left: 0,
        width: size, height: size,
        borderRadius: size / 2,
        backgroundColor: 'rgba(255,255,255,0.06)',
      }} />
    </Animated.View>
  );
};

const getWeatherEmoji = (temp: number) => {
  if (temp < 15) return 'Frío';
  if (temp < 25) return 'Templado';
  if (temp < 32) return 'Cálido';
  return 'Calor';
};
const formatDate = (date: Date) => {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
};
const formatTime12h = (date: Date) => {
  let h = date.getHours();
  const mm = date.getMinutes().toString().padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mm} ${ap}`;
};

export default function Home() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });
  const { isColorblindMode } = useAccessibility();
  const { isGuest, guestScansLeft, exitGuestMode } = useGuest();

  const [userTokens, setUserTokens] = useState<number | null>(null);

  const [location, setLocation]       = useState<Location.LocationObject | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity]       = useState<number | null>(null);
  const [windSpeed, setWindSpeed]     = useState<number | null>(null);
  const [dateTime, setDateTime]       = useState({ date: '', time: '' });
  const [municipio, setMunicipio]     = useState('');
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [user, setUser]               = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [scans, setScans]             = useState<Scan[]>([]);
  const [healthPct, setHealthPct]     = useState<number | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(true);

  const requestAndSetLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permiso de ubicación denegado');
        setLocationEnabled(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      setErrorMsg(null);
      const places = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (places.length > 0) {
        const p = places[0];
        setMunicipio(`${p.city || p.subregion || ''}, ${p.region || ''}`);
      }
    } catch {
      setErrorMsg('No se pudo obtener ubicación');
    }
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      AsyncStorage.getItem('avotex_share_location').then((savedValue) => {
        if (!active) return;
        const enabled = savedValue !== 'false';
        setLocationEnabled(enabled);
        if (enabled) {
          requestAndSetLocation();
        } else {
          setLocation(null);
          setMunicipio('');
          setTemperature(null);
          setHumidity(null);
          setWindSpeed(null);
          setErrorMsg(null);
        }
      });
      return () => { active = false; };
    }, [])
  );

  useEffect(() => {
    if (!location) return;
    (async () => {
      try {
        const { latitude, longitude } = location.coords;
        const r = await axios.get(
          `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&lang=es&appid=${OPENWEATHER_API_KEY}`
        );
        setTemperature(r.data.main.temp);
        setHumidity(r.data.main.humidity);
        setWindSpeed(r.data.wind?.speed ?? null);
      } catch {}
    })();
  }, [location]);

  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date();
      setDateTime({ date: formatDate(now), time: formatTime12h(now) });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setLoadingUser(false); });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isGuest) { setLoadingUser(false); return; }
    if (!user) { setScans([]); return; }
    supabase.from('scans').select('label').eq('user_id', user.uid)
      .then(({ data }) => { if (data) setScans(data); });
  }, [user, isGuest]);

  useEffect(() => {
    if (!user || isGuest) return;
    supabase.from('users').select('tokens').eq('user_email', user.email).maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.warn('[tokens] error:', error.message); setUserTokens(0); return; }
        setUserTokens(data?.tokens ?? 0);
      });
  }, [user?.email, isGuest]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.email || isGuest) return;
      const email = user.email;
      supabase.from('users').select('tokens').eq('user_email', email).maybeSingle()
        .then(({ data, error }) => {
          if (error) { console.warn('[tokens focus] error:', error.message); setUserTokens(0); return; }
          setUserTokens(data?.tokens ?? 0);
        });
    }, [user?.email, isGuest])
  );

  useEffect(() => {
    if (scans.length > 0) {
      const h = scans.filter(s => s.label.toLowerCase().includes('saludable')).length;
      setHealthPct((h / scans.length) * 100);
    } else setHealthPct(null);
  }, [scans]);

  if (!fontsLoaded || loadingUser) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ecfdf5' }}>
        <ActivityIndicator size="large" color="#14b8a6" />
        <Text style={{ marginTop: 16, fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#0f766e' }}>Cargando…</Text>
      </View>
    );
  }

  const colors = {
    primary:       isColorblindMode ? '#0D47A1' : '#14b8a6',
    primaryDark:   isColorblindMode ? '#0a3580' : '#0f766e',
    secondary:     isColorblindMode ? '#FFC107' : '#f59e0b',
    accent:        isColorblindMode ? '#42A5F5' : '#34d399',
    bg: isColorblindMode
      ? (['#E3F2FD', '#e8f4fd', '#f0f6ff'] as [string, string, string])
      : (['#a7f3d0', '#ecfdf5', '#ffff'] as [string, string, string]),
    textPrimary:   isColorblindMode ? '#0D47A1' : '#134e4a',
    textSecondary: '#64748b',
    cardBg:        'rgba(255, 255, 255, 0.95)',
  };

  const handleLogout = async () => {
    if (isGuest) {
      await exitGuestMode();
      router.replace('/(auth)');
    } else {
      await signOut(auth);
      router.replace('/(auth)');
    }
  };

  const handleLockedCardPress = () => {};

  const contentMaxWidth = isTablet ? 900 : undefined;

  return (
    <View style={{ flex: 1 }}>
      <View style={s.pageBackground} />

      <TouchableOpacity
        style={[s.logoutBtn, isTablet && s.logoutBtnTablet]}
        onPress={handleLogout}
      >
        <LogOut color="#ef4444" size={isTablet ? 16 : 14} />
        <Text style={[s.logoutText, isTablet && s.logoutTextTablet]}>
          {isGuest ? 'Salir (invitado)' : 'Salir'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.tokenWidgetContainer, isTablet && s.tokenWidgetContainerTablet]}
        onPress={() => router.push('/(app)/plans')}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Ver tokens y planes disponibles"
      >
        <View style={s.tokenWidget} pointerEvents="none">
          <Coins size={isTablet ? 30 : 26} color="#d97706" />
          <View style={{ marginLeft: 6 }}>
            <Text style={[s.tokenAmount, isTablet && s.tokenAmountTablet]}>
              {isGuest
                ? (guestScansLeft * 100).toLocaleString('es-MX')
                : userTokens !== null
                  ? (userTokens * 100).toLocaleString('es-MX')
                  : '—'}
            </Text>
            <Text style={[s.tokenLabel, isTablet && s.tokenLabelTablet]}>Tokens</Text>
          </View>
          <View style={[s.tokenAddButton, isTablet && s.tokenAddButtonTablet]}>
            <Text style={[s.tokenAddText, isTablet && s.tokenAddTextTablet]}>+</Text>
          </View>
        </View>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={[s.scroll, isTablet && s.scrollTablet]} showsVerticalScrollIndicator={false}>
        <View style={[s.contentWrapper, { maxWidth: contentMaxWidth }]}>

          <View style={[s.header, isTablet && s.headerTablet]}>
            <Reanimated.View
              entering={FadeInDown.delay(120).duration(700)}
            >
              <LinearGradient
                colors={['#BDE5FF', '#F2A06F', '#FFF8F3', '#FFFFFF']}
                locations={[0, 0.36, 0.7, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[s.environmentPanel, isTablet && s.environmentPanelTablet]}
              >
              <View style={[s.environmentGrid, isTablet && s.environmentGridTablet]}>
              <View style={[s.environmentCard, isTablet && s.environmentCardTablet]}>
                <View style={s.environmentLabelRow}>
                  <Sun color="#f59e0b" size={isTablet ? 23 : 19} />
                  <Text style={[s.environmentLabel, isTablet && s.environmentLabelTablet]}>Temperatura</Text>
                </View>
                <View style={s.environmentReadingRow}>
                  <Text style={[s.environmentValue, isTablet && s.environmentValueTablet]}>
                    {temperature !== null ? `${temperature.toFixed(1)}°` : '—'}
                  </Text>
                  <VerticalGauge
                    value={temperature}
                    min={0}
                    max={45}
                    labels={[
                      { value: 20, text: '20°' },
                      { value: 30, text: '30°' },
                      { value: 35, text: '35°' },
                    ]}
                  />
                </View>
                <View style={[s.statusPill, temperature !== null && temperature >= 15 && temperature <= 30 ? s.statusGood : s.statusNeutral]}>
                  <Text style={s.statusPillText}>
                    {temperature === null ? 'Sin ubicación' : temperature >= 15 && temperature <= 30 ? 'Dentro de rango' : 'Revisar'}
                  </Text>
                </View>
              </View>

              <View style={[s.environmentCard, isTablet && s.environmentCardTablet]}>
                <View style={s.environmentLabelRow}>
                  <Droplets color="#38bdf8" size={isTablet ? 23 : 19} />
                  <Text style={[s.environmentLabel, isTablet && s.environmentLabelTablet]}>Humedad</Text>
                </View>
                <View style={s.environmentReadingRow}>
                  <Text style={[s.environmentValue, isTablet && s.environmentValueTablet]}>
                    {humidity !== null ? `${humidity}%` : '—'}
                  </Text>
                  <VerticalGauge
                    value={humidity}
                    min={0}
                    max={100}
                    labels={[
                      { value: 30, text: '30%' },
                      { value: 60, text: '60%' },
                      { value: 90, text: '90%' },
                    ]}
                  />
                </View>
                <View style={[s.statusPill, humidity !== null && humidity >= 40 && humidity <= 75 ? s.statusGood : s.statusNeutral]}>
                  <Text style={s.statusPillText}>
                    {humidity === null ? 'Sin ubicación' : humidity >= 40 && humidity <= 75 ? 'Adecuada' : 'Fuera de rango'}
                  </Text>
                </View>
              </View>

              <View style={[s.environmentCard, isTablet && s.environmentCardTablet]}>
                <View style={s.environmentLabelRow}>
                  <Leaf color="#22a06b" size={isTablet ? 23 : 19} />
                  <Text style={[s.environmentLabel, isTablet && s.environmentLabelTablet]}>Salud</Text>
                </View>
                <Text style={[s.environmentValue, isTablet && s.environmentValueTablet]}>
                  {isGuest || healthPct === null ? 'N/A' : `${healthPct.toFixed(0)}%`}
                </Text>
                <View style={s.healthGauge}>
                  <View style={s.healthGaugeTrack}>
                    <LinearGradient
                      colors={['#EF4444', '#F97316', '#FACC15', '#84CC16', '#22C55E']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                    {!isGuest && healthPct !== null ? (
                      <View
                        style={[
                          s.healthGaugeMarker,
                          { left: `${Math.max(2, Math.min(98, healthPct))}%` as any },
                        ]}
                      />
                    ) : null}
                  </View>
                  <View style={s.healthLegend}>
                    <View style={s.healthLegendItem}>
                      <View style={[s.healthLegendDot, { backgroundColor: '#EF4444' }]} />
                      <Text style={s.healthLegendText}>Crítica</Text>
                    </View>
                    <View style={s.healthLegendItem}>
                      <View style={[s.healthLegendDot, { backgroundColor: '#F97316' }]} />
                      <Text style={s.healthLegendText}>Atención</Text>
                    </View>
                    <View style={s.healthLegendItem}>
                      <View style={[s.healthLegendDot, { backgroundColor: '#FACC15' }]} />
                      <Text style={s.healthLegendText}>Buena</Text>
                    </View>
                    <View style={s.healthLegendItem}>
                      <View style={[s.healthLegendDot, { backgroundColor: '#22C55E' }]} />
                      <Text style={s.healthLegendText}>Saludable</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={[s.environmentCard, isTablet && s.environmentCardTablet]}>
                <View style={s.environmentLabelRow}>
                  <Wind color="#64748b" size={isTablet ? 23 : 19} />
                  <Text style={[s.environmentLabel, isTablet && s.environmentLabelTablet]}>Viento</Text>
                </View>
                <Text style={[s.environmentValue, isTablet && s.environmentValueTablet]}>
                  {windSpeed !== null ? `${windSpeed.toFixed(1)}` : '—'}
                  {windSpeed !== null ? <Text style={s.environmentUnit}> m/s</Text> : null}
                </Text>
                <View style={[s.statusPill, windSpeed !== null && windSpeed <= 8 ? s.statusGood : s.statusNeutral]}>
                  <Text style={s.statusPillText}>
                    {windSpeed === null ? 'Sin ubicación' : windSpeed <= 8 ? 'Viento estable' : 'Viento fuerte'}
                  </Text>
                </View>
              </View>
              </View>
              <View style={s.environmentPanelFooter}>
                <Text style={s.environmentPanelFooterLabel}>
                  {isGuest ? 'MODO INVITADO' : 'BIENVENIDO'}
                </Text>
                <Text style={s.environmentPanelFooterValue}>
                  {isGuest ? 'Invitado' : user?.email || user?.displayName || 'Usuario'}
                </Text>
              </View>
              </LinearGradient>
            </Reanimated.View>

          </View>

          <Reanimated.View
            entering={FadeInUp.delay(500).duration(700)}
            style={[s.quickActionsPanel, isTablet && s.quickActionsPanelTablet]}
          >
            <Text style={[s.quickActionsTitle, isTablet && s.quickActionsTitleTablet]}>Acciones rápidas</Text>
            <View style={[s.quickActionsGrid, isTablet && s.quickActionsGridTablet]}>
              <TouchableOpacity
                style={[s.quickActionCard, isTablet && s.quickActionCardTablet]}
                onPress={() => router.push('/scan')}
                activeOpacity={0.84}
              >
                <LinearGradient
                  colors={['#E7E1FF', '#F6DDF8', '#F9E8EF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.quickActionGradient}
                >
                  <View style={[s.quickActionIcon, isTablet && s.quickActionIconTablet]}>
                    <Camera color="#44227C" size={isTablet ? 31 : 25} />
                  </View>
                  <Text style={[s.quickActionLabel, isTablet && s.quickActionLabelTablet]}>Escanear</Text>
                  {isGuest ? <Text style={s.quickActionMeta}>{guestScansLeft} restantes</Text> : null}
                </LinearGradient>
              </TouchableOpacity>

              <View style={[s.quickActionCard, s.mapQuickActionCard, isTablet && s.quickActionCardTablet]}>
                {locationEnabled && location?.coords ? (
                  <View style={s.quickMap} pointerEvents="none">
                    <MapViewComponent location={location} errorMsg={errorMsg} compact />
                  </View>
                ) : (
                  <LinearGradient
                    colors={['#DCEBFF', '#E8F2FF', '#F7FAFF']}
                    style={[s.quickActionGradient, s.quickMapFallback]}
                  >
                    <View style={[s.quickActionIcon, isTablet && s.quickActionIconTablet]}>
                      <MapPinOff color="#4772A8" size={isTablet ? 31 : 25} />
                    </View>
                  </LinearGradient>
                )}
                <View style={s.quickMapLabel}>
                  <Text style={[s.quickActionLabel, isTablet && s.quickActionLabelTablet]}>Mapa</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[s.quickActionCard, isTablet && s.quickActionCardTablet]}
                onPress={() => isGuest ? null : router.push('/mapping')}
                disabled={isGuest}
                activeOpacity={0.84}
              >
                <LinearGradient
                  colors={['#F8DCEF', '#FFE1D0', '#FFEAC7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.quickActionGradient}
                >
                  <View style={[s.quickActionIcon, isTablet && s.quickActionIconTablet]}>
                    {isGuest ? <Lock color="#9CA3AF" size={isTablet ? 29 : 23} /> : <Map color="#D29A35" size={isTablet ? 31 : 25} />}
                  </View>
                  <Text style={[s.quickActionLabel, isTablet && s.quickActionLabelTablet, isGuest && s.secTitleLocked]}>Mapeo</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.quickActionCard, isTablet && s.quickActionCardTablet]}
                onPress={() => isGuest ? null : router.push('/results')}
                disabled={isGuest}
                activeOpacity={0.84}
              >
                <LinearGradient
                  colors={['#CFF5E9', '#DDF5DE', '#F1F3C8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.quickActionGradient}
                >
                  <View style={[s.quickActionIcon, isTablet && s.quickActionIconTablet]}>
                    {isGuest ? <Lock color="#9CA3AF" size={isTablet ? 29 : 23} /> : <LineChart color="#298D4B" size={isTablet ? 31 : 25} />}
                  </View>
                  <Text style={[s.quickActionLabel, isTablet && s.quickActionLabelTablet, isGuest && s.secTitleLocked]}>Actividad</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Reanimated.View>

        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  bgLayer: {
    position: 'absolute', width: '100%', height: '100%', overflow: 'hidden', zIndex: 0,
  },
  pageBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFFFFF', zIndex: 0 },
  centerVignette: {
    position: 'absolute',
    top: '15%', left: '8%',
    width: '84%', height: '70%',
    borderRadius: 999,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  tokenWidgetContainer: {
    position: 'absolute', top: 36, left: 16, zIndex: 20,
    alignItems: 'flex-start',
  },
  tokenWidgetContainerTablet: { top: 46, left: 28 },
  tokenWidget: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1.5, borderColor: 'rgba(217,119,6,0.30)',
    shadowColor: '#d97706', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 6, elevation: 5,
  },
  tokenAddButton: {
    width: 25,
    height: 25,
    borderRadius: 13,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
  },
  tokenAddButtonTablet: { width: 31, height: 31, borderRadius: 16, marginLeft: 13 },
  tokenAddText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 20,
    lineHeight: 24,
  },
  tokenAddTextTablet: { fontSize: 24, lineHeight: 28 },
  tokenAmount: {
    fontFamily: 'Poppins_700Bold', fontSize: 17, color: '#92400e', lineHeight: 20,
  },
  tokenAmountTablet: { fontSize: 22, lineHeight: 26 },
  tokenLabel: {
    fontFamily: 'Poppins_600SemiBold', fontSize: 9, color: '#d97706', letterSpacing: 1,
  },
  tokenLabelTablet: { fontSize: 11 },

  logoutBtn: {
    position: 'absolute', top: 40, right: 16, zIndex: 20,
    padding: 8, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 5, elevation: 4,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)',
  },
  logoutBtnTablet: {
    top: 50, right: 28, padding: 12,
  },
  logoutText: { color: '#ef4444', fontSize: 12, fontFamily: 'Poppins_600SemiBold', marginLeft: 4 },
  logoutTextTablet: { fontSize: 14 },

  scroll: { paddingBottom: 200, zIndex: 2 },
  scrollTablet: { paddingBottom: 240, alignItems: 'center' },

  contentWrapper: {
    width: '100%',
    alignSelf: 'center',
  },

  scanCountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginBottom: 8,
    shadowColor: '#0f766e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  scanCountCardTablet: {
    paddingVertical: 9,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  scanCountText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: '#0f766e',
  },
  scanCountTextTablet: { fontSize: 14 },

  guestRegisterHint: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 3,
  },
  guestRegisterHintTablet: { fontSize: 12 },
  header: { paddingTop: 90, paddingHorizontal: 22, marginBottom: 18 },
  headerTablet: { paddingTop: 100, paddingHorizontal: 28 },

  environmentPanel: {
    overflow: 'hidden',
    padding: 12,
    borderRadius: 28,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    shadowColor: '#315765',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 5,
  },
  environmentPanelTablet: {
    padding: 18,
    borderRadius: 34,
    marginBottom: 20,
  },
  environmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  environmentGridTablet: { rowGap: 16 },
  environmentCard: {
    width: '47.5%',
    minHeight: 146,
    justifyContent: 'space-between',
    backgroundColor: '#F5FAFC',
    borderRadius: 19,
    padding: 13,
    borderWidth: 1,
    borderColor: '#E2ECEF',
    shadowColor: '#134e4a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  environmentCardTablet: { width: '48%', minHeight: 200, padding: 21, borderRadius: 26 },
  environmentLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  environmentLabel: { color: '#65767A', fontFamily: 'Poppins_400Regular', fontSize: 12 },
  environmentLabelTablet: { fontSize: 16 },
  environmentReadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 72,
  },
  environmentValue: {
    color: '#102F33',
    fontFamily: 'Poppins_400Regular',
    fontSize: 32,
    lineHeight: 39,
    letterSpacing: -1.5,
  },
  environmentValueTablet: { fontSize: 56, lineHeight: 66 },
  environmentUnit: { fontSize: 13, letterSpacing: 0, color: '#64748b' },
  gauge: {
    width: 45,
    height: 72,
    flexDirection: 'row',
  },
  gaugeTicks: {
    width: 17,
    height: 72,
    justifyContent: 'space-between',
    position: 'relative',
  },
  gaugeTick: {
    width: 9,
    height: 1,
    backgroundColor: '#23474A',
  },
  gaugeTickMajor: {
    width: 15,
    height: 1.5,
  },
  gaugeIndicator: {
    position: 'absolute',
    left: -3,
    width: 21,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#EF4444',
    transform: [{ translateY: 1.5 }],
  },
  gaugeLabels: {
    flex: 1,
    height: 72,
    position: 'relative',
    marginLeft: 3,
  },
  gaugeLabel: {
    position: 'absolute',
    left: 0,
    color: '#52666A',
    fontFamily: 'Poppins_400Regular',
    fontSize: 7,
    transform: [{ translateY: 4 }],
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusGood: { backgroundColor: '#55D990' },
  statusNeutral: { backgroundColor: '#F08078' },
  statusPillText: { color: '#FFFFFF', fontFamily: 'Poppins_600SemiBold', fontSize: 9 },
  healthGauge: {
    width: '100%',
  },
  healthGaugeTrack: {
    width: '100%',
    height: 7,
    borderRadius: 4,
    position: 'relative',
    overflow: 'visible',
  },
  healthGaugeMarker: {
    position: 'absolute',
    top: -5,
    width: 3,
    height: 17,
    marginLeft: -1.5,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#64748B',
  },
  healthLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 2,
    marginTop: 7,
  },
  healthLegendItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthLegendDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginRight: 3,
  },
  healthLegendText: {
    color: '#64748B',
    fontFamily: 'Poppins_400Regular',
    fontSize: 6.5,
  },
  environmentPanelFooter: {
    minHeight: 58,
    marginHorizontal: -12,
    marginBottom: -12,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    justifyContent: 'center',
    backgroundColor: 'rgba(218, 222, 225, 0.88)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.72)',
  },
  environmentPanelFooterLabel: {
    color: '#68757A',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.8,
  },
  environmentPanelFooterValue: {
    color: '#2D4147',
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    marginTop: 2,
  },

  locRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 4, gap: 10,
  },
  locBadge: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  locText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12 },
  locTextTablet: { fontSize: 15 },
  timeBadge: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  timeText: { fontFamily: 'Poppins_700Bold', fontSize: 15 },
  timeTextTablet: { fontSize: 18 },
  dateText: { fontFamily: 'Poppins_400Regular', fontSize: 11, marginTop: 1 },
  dateTextTablet: { fontSize: 13 },

  quickActionsPanel: {
    marginHorizontal: 18,
    marginTop: -22,
    marginBottom: 18,
    padding: 14,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#7C63C6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 6,
  },
  quickActionsPanelTablet: {
    marginHorizontal: 28,
    marginTop: -26,
    padding: 22,
    borderRadius: 34,
  },
  quickActionsTitle: {
    color: '#111118',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 20,
    marginBottom: 12,
    marginLeft: 3,
  },
  quickActionsTitleTablet: {
    fontSize: 26,
    marginBottom: 18,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  quickActionsGridTablet: {
    rowGap: 18,
  },
  quickActionCard: {
    width: '47.7%',
    height: 150,
    overflow: 'hidden',
    borderRadius: 25,
    shadowColor: '#574B80',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 5,
  },
  quickActionCardTablet: {
    width: '48.4%',
    height: 205,
    borderRadius: 30,
  },
  quickActionGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  quickActionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#6B5C91',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  quickActionIconTablet: {
    width: 82,
    height: 82,
    borderRadius: 41,
    marginBottom: 16,
  },
  quickActionLabel: {
    color: '#17141E',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    textAlign: 'center',
  },
  quickActionLabelTablet: {
    fontSize: 21,
  },
  quickActionMeta: {
    color: '#6F6878',
    fontFamily: 'Poppins_400Regular',
    fontSize: 9,
    marginTop: 2,
  },
  mapQuickActionCard: {
    position: 'relative',
    backgroundColor: '#DCEBFF',
  },
  quickMap: {
    ...StyleSheet.absoluteFill,
  },
  quickMapFallback: {
    paddingBottom: 30,
  },
  quickMapLabel: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 9,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.91)',
  },
  secTitleLocked: { color: '#94a3b8' },
});
