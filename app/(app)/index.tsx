import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Modal,
  Pressable,
} from 'react-native';
import { Camera, Map, ChartLine as LineChart, Leaf, Sun, Droplets, Wind, LogOut, MapPinOff, Lock, Coins, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
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

interface Scan {
  label: string;
  created_at?: string;
}

interface ProductivityScan {
  label: string;
  created_at: string;
}

interface MonthlyReport {
  key: string;
  date: Date;
  total: number;
  healthy: number;
  affected: number;
  healthPct: number;
  activeDays: number;
  topFinding: string;
}

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

const normalizeScanLabel = (label: string) => label.trim().toLowerCase().replace(/\s/g, '');
const isNoFruitLabel = (label: string) => normalizeScanLabel(label) === 'nofruta';
const isHealthyScanLabel = (label: string) => {
  const normalized = normalizeScanLabel(label);
  return ['saludable', 'healthy', 'sano', 'sana', 'fresh', 'fresco', 'fresca']
    .some(value => normalized.includes(value));
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
  const [productivityScans, setProductivityScans] = useState<ProductivityScan[]>([]);
  const reportScrollX = useRef(new Animated.Value(0)).current;
  const [activeReportIndex, setActiveReportIndex] = useState(0);
  const [reportViewportWidth, setReportViewportWidth] = useState(Math.min(width, 900));
  const [monthlyReportLoading, setMonthlyReportLoading] = useState(false);
  const [monthlyReportError, setMonthlyReportError] = useState(false);
  const [healthPct, setHealthPct]     = useState<number | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [mapExpanded, setMapExpanded] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      return () => setMapExpanded(false);
    }, []),
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
    supabase.from('scans').select('label, created_at').eq('user_id', user.uid)
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

  useFocusEffect(useCallback(() => {
    if (!user || isGuest) {
      setProductivityScans([]);
      setMonthlyReportLoading(false);
      setMonthlyReportError(false);
      return undefined;
    }

    let active = true;
    setMonthlyReportLoading(true);
    setMonthlyReportError(false);

    (async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const pageSize = 1000;
      const loadedScans: ProductivityScan[] = [];

      for (let from = 0; active; from += pageSize) {
        const { data, error } = await supabase
          .from('scans')
          .select('label, created_at')
          .eq('user_id', user.uid)
          .gte('created_at', start.toISOString())
          .lt('created_at', end.toISOString())
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (!active) return;
        if (error) {
          console.warn('[reporte mensual] error:', error.message);
          setProductivityScans([]);
          setMonthlyReportError(true);
          setMonthlyReportLoading(false);
          return;
        }

        loadedScans.push(...(data ?? []));
        if (!data || data.length < pageSize) break;
      }

      if (active) {
        setProductivityScans(loadedScans);
        setMonthlyReportLoading(false);
      }
    })();

    return () => { active = false; };
  }, [user?.uid, isGuest]));

  const monthlyReports = useMemo<MonthlyReport[]>(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const monthScans = productivityScans.filter(scan => {
        const scanDate = new Date(scan.created_at);
        return scanDate.getFullYear() === date.getFullYear()
          && scanDate.getMonth() === date.getMonth()
          && !isNoFruitLabel(scan.label);
      });
      const healthy = monthScans.filter(scan => isHealthyScanLabel(scan.label)).length;
      const affected = monthScans.length - healthy;
      const activeDays = new Set(monthScans.map(scan => new Date(scan.created_at).toDateString())).size;
      const findings = monthScans.reduce<Record<string, number>>((result, scan) => {
        result[scan.label] = (result[scan.label] ?? 0) + 1;
        return result;
      }, {});
      const topFinding = Object.entries(findings).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Sin actividad';

      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        date,
        total: monthScans.length,
        healthy,
        affected,
        healthPct: monthScans.length ? Math.round((healthy / monthScans.length) * 100) : 0,
        activeDays,
        topFinding,
      };
    });
  }, [productivityScans]);

  const reportCardWidth = Math.min(reportViewportWidth * (isTablet ? 0.58 : 0.79), 430);
  const reportCardOverlap = reportCardWidth * (isTablet ? 0.68 : 0.72);
  const reportSnapInterval = reportCardWidth - reportCardOverlap;
  const reportGeometryKey = `${Math.round(reportViewportWidth)}-${Math.round(reportSnapInterval)}`;

  useEffect(() => {
    reportScrollX.setValue(activeReportIndex * reportSnapInterval);
  }, [reportSnapInterval]);

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
          <Coins size={isTablet ? 26 : 22} color="#d97706" />
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

      <Modal
        visible={mapExpanded}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMapExpanded(false)}
      >
        <Pressable style={s.mapModalBackdrop} onPress={() => setMapExpanded(false)}>
          <Pressable
            style={[s.mapModalCard, isTablet && s.mapModalCardTablet]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={s.mapModalHeader}>
              <View>
                <Text style={s.mapModalTitle}>Tu ubicación</Text>
                <Text style={s.mapModalSubtitle}>{municipio || 'Mapa en tiempo real'}</Text>
              </View>
              <TouchableOpacity
                accessibilityLabel="Cerrar mapa"
                style={s.mapModalClose}
                onPress={() => setMapExpanded(false)}
              >
                <X size={20} color="#18352B" />
              </TouchableOpacity>
            </View>
            <View style={s.mapModalContent}>
              {locationEnabled && location?.coords ? (
                <MapViewComponent location={location} errorMsg={errorMsg} compact />
              ) : (
                <View style={s.mapModalEmpty}>
                  <MapPinOff color="#6B7D78" size={38} />
                  <Text style={s.mapModalEmptyText}>
                    {locationEnabled ? 'Obteniendo ubicación…' : 'Activa la ubicación en Ajustes para ver el mapa'}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
                <View style={s.environmentPanelFooterCopy}>
                  <Text style={s.environmentPanelFooterLabel}>
                    {isGuest ? 'MODO INVITADO' : 'BIENVENIDO'}
                  </Text>
                  <Text style={s.environmentPanelFooterValue}>
                    {isGuest ? 'Invitado' : user?.email || user?.displayName || 'Usuario'}
                  </Text>
                </View>
                <Image
                  source={require('../../assets/images/AvotexNuevoLogo.png')}
                  style={s.environmentPanelFooterLogo}
                  resizeMode="cover"
                />
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

              <TouchableOpacity
                style={[s.quickActionCard, s.mapQuickActionCard, isTablet && s.quickActionCardTablet]}
                onPress={() => setMapExpanded(true)}
                activeOpacity={0.9}
                accessibilityLabel="Ampliar mapa"
              >
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
              </TouchableOpacity>

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

          <Reanimated.View
            entering={FadeInUp.delay(620).duration(700)}
            style={[s.monthlyReportSection, isTablet && s.monthlyReportSectionTablet]}
          >
            <View style={s.monthlyReportHeader}>
              <View>
                <Text style={s.productivityEyebrow}>TU ACTIVIDAD</Text>
                <Text style={[s.productivityTitle, isTablet && s.productivityTitleTablet]}>Reporte mensual</Text>
              </View>
              <Text style={s.monthlySwipeHint}>Desliza para explorar</Text>
            </View>
            <View
              onLayout={(event) => {
                const nextWidth = event.nativeEvent.layout.width;
                if (Math.abs(nextWidth - reportViewportWidth) > 1) setReportViewportWidth(nextWidth);
              }}
            >
            <Animated.FlatList
              key={reportGeometryKey}
              horizontal
              data={monthlyReports}
              keyExtractor={(item) => item.key}
              showsHorizontalScrollIndicator={false}
              snapToInterval={reportSnapInterval}
              decelerationRate="fast"
              contentContainerStyle={[
                s.monthlyCarouselContent,
                { paddingRight: Math.max(34, reportViewportWidth - reportCardWidth - 22) },
              ]}
              initialScrollIndex={activeReportIndex}
              getItemLayout={(_, index) => ({
                length: reportSnapInterval,
                offset: reportSnapInterval * index,
                index,
              })}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: reportScrollX } } }],
                { useNativeDriver: true },
              )}
              onMomentumScrollEnd={(event) => {
                setActiveReportIndex(Math.max(0, Math.min(11, Math.round(event.nativeEvent.contentOffset.x / reportSnapInterval))));
              }}
              scrollEventThrottle={16}
              renderItem={({ item, index }) => {
                const inputRange = [
                  (index - 1) * reportSnapInterval,
                  index * reportSnapInterval,
                  (index + 1) * reportSnapInterval,
                ];
                const scale = reportScrollX.interpolate({
                  inputRange,
                  outputRange: [0.94, 1, 0.91],
                  extrapolate: 'clamp',
                });
                const translateY = reportScrollX.interpolate({
                  inputRange,
                  outputRange: [10, 0, 14],
                  extrapolate: 'clamp',
                });
                const rotateY = reportScrollX.interpolate({
                  inputRange,
                  outputRange: ['-5deg', '0deg', '8deg'],
                  extrapolate: 'clamp',
                });
                const translateX = reportScrollX.interpolate({
                  inputRange,
                  outputRange: [-10, 0, 13],
                  extrapolate: 'clamp',
                });
                const affectedPct = item.total ? (item.affected / item.total) * 100 : 0;

                return (
                  <Animated.View
                    style={[
                      s.monthlyCard,
                      {
                        width: reportCardWidth,
                        marginRight: -reportCardOverlap,
                        zIndex: monthlyReports.length - index,
                      },
                      { transform: [{ perspective: 900 }, { translateX }, { translateY }, { scale }, { rotateY }] },
                    ]}
                  >
                    <LinearGradient
                      colors={['#E9F1FF', '#D7E4FC']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={s.monthlyCardGradient}
                    >
                      <View style={s.monthlyCardTop}>
                        <View>
                          <Text style={s.monthlyCardEyebrow}>{index === 0 ? 'MES ACTUAL' : 'REPORTE'}</Text>
                          <Text style={s.monthlyCardMonth}>
                            {item.date.toLocaleDateString('es-MX', { month: 'long' })}
                          </Text>
                        </View>
                        <Text style={s.monthlyCardYear}>{item.date.getFullYear()}</Text>
                      </View>

                      <View style={s.monthlyHeroRow}>
                        <View>
                          <Text style={s.monthlyHeroValue}>{item.total}</Text>
                          <Text style={s.monthlyHeroLabel}>escaneos realizados</Text>
                        </View>
                        <View style={s.monthlyHealthBadge}>
                          <Text style={s.monthlyHealthValue}>{item.total ? `${item.healthPct}%` : '—'}</Text>
                          <Text style={s.monthlyHealthLabel}>salud</Text>
                        </View>
                      </View>

                      <View style={s.monthlyStatsRow}>
                        <View style={s.monthlyStat}>
                          <Text style={s.monthlyStatValue}>{item.healthy}</Text>
                          <Text style={s.monthlyStatLabel}>Saludables</Text>
                        </View>
                        <View style={s.monthlyStatDivider} />
                        <View style={s.monthlyStat}>
                          <Text style={s.monthlyStatValue}>{item.affected}</Text>
                          <Text style={s.monthlyStatLabel}>Con problemas</Text>
                        </View>
                        <View style={s.monthlyStatDivider} />
                        <View style={s.monthlyStat}>
                          <Text style={s.monthlyStatValue}>{item.activeDays}</Text>
                          <Text style={s.monthlyStatLabel}>Días activos</Text>
                        </View>
                      </View>

                      <View style={s.monthlyDistribution}>
                        <View style={[s.monthlyDistributionHealthy, { flex: item.total ? item.healthy || 0.001 : 1 }]} />
                        <View style={[s.monthlyDistributionAffected, { flex: item.total ? item.affected || 0.001 : 0 }]} />
                      </View>
                      <View style={s.monthlyFindingRow}>
                        <View style={[s.monthlyFindingDot, { backgroundColor: affectedPct > 0 ? '#F97316' : '#238B57' }]} />
                        <View style={s.monthlyFindingCopy}>
                          <Text style={s.monthlyFindingLabel}>Hallazgo principal</Text>
                          <Text style={s.monthlyFindingValue} numberOfLines={1}>
                            {monthlyReportLoading
                              ? 'Cargando actividad…'
                              : monthlyReportError
                                ? 'No se pudo cargar el reporte'
                                : isGuest
                                  ? 'Inicia sesión para ver tu historial'
                                  : item.total
                                    ? item.topFinding
                                    : 'No hubo actividad este mes'}
                          </Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </Animated.View>
                );
              }}
            />
            </View>
            <View style={s.monthlyPagination}>
              {monthlyReports.slice(0, 6).map((report, index) => (
                <View
                  key={report.key}
                  style={[
                    s.monthlyPaginationDot,
                    Math.min(activeReportIndex, 5) === index && s.monthlyPaginationDotActive,
                  ]}
                />
              ))}
              <Text style={s.monthlyPaginationText}>{activeReportIndex + 1} de 12</Text>
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
    borderRadius: 18, paddingHorizontal: 9, paddingVertical: 5,
    borderWidth: 1.5, borderColor: 'rgba(217,119,6,0.30)',
    shadowColor: '#d97706', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 6, elevation: 5,
  },
  tokenAddButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
  },
  tokenAddButtonTablet: { width: 27, height: 27, borderRadius: 14, marginLeft: 10 },
  tokenAddText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 17,
    lineHeight: 21,
  },
  tokenAddTextTablet: { fontSize: 20, lineHeight: 24 },
  tokenAmount: {
    fontFamily: 'Poppins_700Bold', fontSize: 15, color: '#92400e', lineHeight: 18,
  },
  tokenAmountTablet: { fontSize: 19, lineHeight: 23 },
  tokenLabel: {
    fontFamily: 'Poppins_600SemiBold', fontSize: 8, color: '#d97706', letterSpacing: 0.8,
  },
  tokenLabelTablet: { fontSize: 10 },

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

  scroll: { paddingBottom: 112, zIndex: 2 },
  scrollTablet: { paddingBottom: 132, alignItems: 'center' },

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
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.72)',
  },
  environmentPanelFooterCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  environmentPanelFooterLogo: {
    width: 132,
    height: 52,
    marginLeft: 12,
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
  mapModalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 54,
    backgroundColor: 'rgba(7, 20, 19, 0.68)',
  },
  mapModalCard: {
    width: '100%',
    height: '62%',
    maxHeight: 560,
    padding: 10,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 18,
  },
  mapModalCardTablet: {
    width: 720,
    height: 520,
    padding: 13,
    borderRadius: 34,
  },
  mapModalHeader: {
    minHeight: 62,
    paddingHorizontal: 8,
    paddingBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  mapModalTitle: {
    color: '#18352B',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
  },
  mapModalSubtitle: {
    color: '#73817C',
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
    marginTop: 1,
  },
  mapModalClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF4F1',
  },
  mapModalContent: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 21,
    backgroundColor: '#DCEBFF',
  },
  mapModalEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F1F7F5',
  },
  mapModalEmptyText: {
    color: '#6B7D78',
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
    textAlign: 'center',
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
  productivityCard: {
    marginHorizontal: 18,
    marginBottom: 26,
    padding: 16,
    borderRadius: 26,
    backgroundColor: '#F1FF72',
    shadowColor: '#6F7628',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 5,
  },
  productivityCardTablet: {
    marginHorizontal: 28,
    padding: 22,
    borderRadius: 32,
  },
  productivityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 13,
  },
  productivityEyebrow: {
    color: '#757A28',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 8,
    letterSpacing: 1.2,
  },
  productivityTitle: {
    color: '#171817',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 22,
    lineHeight: 27,
  },
  productivityTitleTablet: { fontSize: 28, lineHeight: 34 },
  productivityMonth: {
    color: '#383B1B',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10,
    textTransform: 'capitalize',
    minWidth: 90,
    textAlign: 'center',
  },
  productivityMonthControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  productivityMonthButton: {
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.48)',
  },
  productivityWeekdays: { flexDirection: 'row', marginBottom: 5 },
  productivityWeekday: {
    width: '14.28%',
    color: '#777B35',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 9,
    textAlign: 'center',
  },
  productivityGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  productivityDay: {
    width: '14.28%',
    height: 43,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productivityDayOutside: { opacity: 0.24 },
  productivityDayNumber: {
    color: '#4C4F25',
    fontFamily: 'Poppins_400Regular',
    fontSize: 8,
    lineHeight: 10,
  },
  productivityToday: {
    color: '#11120A',
    fontFamily: 'Poppins_700Bold',
    textDecorationLine: 'underline',
  },
  productivityMarks: {
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginTop: 2,
  },
  productivityMark: {
    width: 25,
    height: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2C2D22',
    backgroundColor: 'transparent',
  },
  productivityMarkActive: { backgroundColor: '#22231F' },
  productivityMarkEmpty: { borderColor: 'rgba(44,45,34,0.55)' },
  productivityExtra: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    color: '#4B4E22',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 6,
  },
  productivityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(45,47,27,0.17)',
  },
  productivityLegend: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  productivityLegendText: {
    color: '#5B5F2B',
    fontFamily: 'Poppins_400Regular',
    fontSize: 8,
  },
  productivityTotal: {
    color: '#252619',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 9,
  },
  monthlyReportSection: {
    marginBottom: 4,
  },
  monthlyReportSectionTablet: {
    width: '100%',
  },
  monthlyReportHeader: {
    marginHorizontal: 22,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  monthlySwipeHint: {
    color: '#75817B',
    fontFamily: 'Poppins_400Regular',
    fontSize: 9,
    marginBottom: 3,
  },
  monthlyCarouselContent: {
    paddingLeft: 22,
    paddingRight: 34,
    paddingTop: 2,
    paddingBottom: 18,
  },
  monthlyCard: {
    borderRadius: 25,
    shadowColor: '#284B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 15,
    elevation: 9,
  },
  monthlyCardGradient: {
    minHeight: 286,
    borderRadius: 25,
    padding: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  monthlyCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  monthlyCardEyebrow: {
    color: '#5C6730',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 8,
    letterSpacing: 1.2,
  },
  monthlyCardMonth: {
    color: '#17211A',
    fontFamily: 'Poppins_700Bold',
    fontSize: 24,
    lineHeight: 30,
    textTransform: 'capitalize',
  },
  monthlyCardYear: {
    color: '#435047',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.48)',
  },
  monthlyHeroRow: {
    marginTop: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthlyHeroValue: {
    color: '#17211A',
    fontFamily: 'Poppins_700Bold',
    fontSize: 38,
    lineHeight: 42,
  },
  monthlyHeroLabel: {
    color: '#566259',
    fontFamily: 'Poppins_400Regular',
    fontSize: 9,
  },
  monthlyHealthBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(35,139,87,0.22)',
  },
  monthlyHealthValue: {
    color: '#176D47',
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    lineHeight: 22,
  },
  monthlyHealthLabel: {
    color: '#4D6659',
    fontFamily: 'Poppins_400Regular',
    fontSize: 8,
  },
  monthlyStatsRow: {
    marginTop: 15,
    paddingVertical: 11,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.48)',
  },
  monthlyStat: {
    flex: 1,
    alignItems: 'center',
  },
  monthlyStatValue: {
    color: '#1D2921',
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
  },
  monthlyStatLabel: {
    color: '#5B665F',
    fontFamily: 'Poppins_400Regular',
    fontSize: 7,
    textAlign: 'center',
  },
  monthlyStatDivider: {
    width: 1,
    height: 27,
    backgroundColor: 'rgba(45,66,52,0.15)',
  },
  monthlyDistribution: {
    height: 8,
    marginTop: 15,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.64)',
  },
  monthlyDistributionHealthy: {
    backgroundColor: '#238B57',
  },
  monthlyDistributionAffected: {
    backgroundColor: '#F97316',
  },
  monthlyFindingRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthlyFindingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 9,
  },
  monthlyFindingCopy: {
    flex: 1,
  },
  monthlyFindingLabel: {
    color: '#6A756E',
    fontFamily: 'Poppins_400Regular',
    fontSize: 8,
  },
  monthlyFindingValue: {
    color: '#25332A',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
  },
  monthlyPagination: {
    height: 18,
    marginTop: -5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  monthlyPaginationDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#C6D1CA',
  },
  monthlyPaginationDotActive: {
    width: 15,
    backgroundColor: '#238B57',
  },
  monthlyPaginationText: {
    marginLeft: 4,
    color: '#75817B',
    fontFamily: 'Poppins_400Regular',
    fontSize: 8,
  },
  secTitleLocked: { color: '#94a3b8' },
});
