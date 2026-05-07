import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Image,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { Camera, Map, ChartLine as LineChart, Leaf, Sun, Droplets, AlertTriangle, LogOut, MapPin, MapPinOff, Lock, User as UserIcon } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import * as Location from 'expo-location';
import MapViewComponent from '../../components/MapViewComponent';
import { auth } from '../../firebaseConfig';
import Avatar from '../../components/Avatar';
import { onAuthStateChanged, User } from 'firebase/auth';
import axios from 'axios';
import { useAccessibility } from '../../context/AccessibilityContext';
import { signOut } from 'firebase/auth';
import { supabase } from '../../supabaseConfig';
import Reanimated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useGuest, GUEST_MAX_SCANS } from '../../context/GuestContext';

const OPENWEATHER_API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY!;

interface Scan { label: string; }

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
  if (temp < 5) return '❄️';
  if (temp < 15) return '🌧️';
  if (temp < 25) return '⛅';
  if (temp < 32) return '☀️';
  return '🌩️';
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
  const [dateTime, setDateTime]       = useState({ date: '', time: '' });
  const [municipio, setMunicipio]     = useState('');
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [user, setUser]               = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [scans, setScans]             = useState<Scan[]>([]);
  const [healthPct, setHealthPct]     = useState<number | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);

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

  const handleLocationToggle = async (value: boolean) => {
    setLocationEnabled(value);
    if (value) {
      await requestAndSetLocation();
    } else {
      setLocation(null);
      setMunicipio('');
      setTemperature(null);
      setHumidity(null);
      setErrorMsg(null);
    }
  };

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
    welcomeBorder: isColorblindMode ? '#FFC107' : '#14b8a6',
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
      <LinearGradient
        colors={colors.bg}
        locations={[0, 0.38, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={s.bgLayer} pointerEvents="none">
        {CROP_ORBS.map((orb) => <FloatingOrb key={orb.name} orb={orb} screenWidth={width} />)}
      </View>

      <View style={s.centerVignette} pointerEvents="none" />

      <TouchableOpacity
        style={[s.logoutBtn, isTablet && s.logoutBtnTablet]}
        onPress={handleLogout}
      >
        <LogOut color="#ef4444" size={isTablet ? 16 : 14} />
        <Text style={[s.logoutText, isTablet && s.logoutTextTablet]}>
          {isGuest ? 'Salir (invitado)' : 'Salir'}
        </Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={[s.scroll, isTablet && s.scrollTablet]} showsVerticalScrollIndicator={false}>
        <View style={[s.contentWrapper, { maxWidth: contentMaxWidth }]}>

          <View style={[s.header, isTablet && s.headerTablet]}>
            <Image
              source={require('../../assets/images/AvotexNuevoLogo.png')}
              style={[s.logo, isTablet && s.logoTablet]}
              resizeMode="contain"
            />

            <Reanimated.View entering={FadeInDown.delay(200).duration(700)}>
              <View style={[s.welcomeCard, { borderColor: colors.welcomeBorder }, isTablet && s.welcomeCardTablet]}>
                {isGuest ? (
                  <>
                    <View style={s.welcomeText}>
                      <Text style={[s.greetLabel, isTablet && s.greetLabelTablet]}>MODO INVITADO</Text>
                      <Text style={[s.userName, { color: colors.textPrimary }, isTablet && s.userNameTablet]}>
                        INVITADO
                      </Text>
                    </View>
                    <View style={[s.guestAvatarCircle, isTablet && s.guestAvatarCircleTablet]}>
                      <UserIcon size={isTablet ? 26 : 22} color="#0f766e" />
                    </View>
                  </>
                ) : user ? (
                  <>
                    <View style={s.welcomeText}>
                      <Text style={[s.greetLabel, isTablet && s.greetLabelTablet]}>BIENVENIDO</Text>
                      <Text style={[s.userName, { color: colors.textPrimary }, isTablet && s.userNameTablet]}>{user.displayName || user.email}</Text>
                    </View>
                    <Avatar user={user} />
                  </>
                ) : null}
              </View>
            </Reanimated.View>

            <Reanimated.View entering={FadeInDown.delay(260).duration(700)}>
              <View style={[s.locationToggleCard, isTablet && s.locationToggleCardTablet]}>
                <View style={s.locationToggleLeft}>
                  {locationEnabled
                    ? <MapPin size={isTablet ? 22 : 18} color="#0f766e" />
                    : <MapPinOff size={isTablet ? 22 : 18} color="#94a3b8" />
                  }
                  <View style={{ marginLeft: 10 }}>
                    <Text style={[s.locationToggleTitle, { color: locationEnabled ? '#0f766e' : '#64748b' }, isTablet && s.locationToggleTitleTablet]}>
                      Ubicación
                    </Text>
                    <Text style={[s.locationToggleSub, isTablet && s.locationToggleSubTablet]}>
                      {locationEnabled ? 'Activa — solo mientras usas la app' : 'Desactivada'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={locationEnabled}
                  onValueChange={handleLocationToggle}
                  trackColor={{ false: '#e2e8f0', true: '#a7f3d0' }}
                  thumbColor={locationEnabled ? '#0f766e' : '#94a3b8'}
                />
              </View>
            </Reanimated.View>

            <Reanimated.View entering={FadeInDown.delay(300).duration(700)} style={s.locRow}>
              {locationEnabled && municipio.length > 0 && (
                <View style={[s.locBadge, { backgroundColor: colors.cardBg }]}>
                  <Text style={[s.locText, { color: colors.textPrimary }, isTablet && s.locTextTablet]}>📍 {municipio}</Text>
                </View>
              )}
              <View style={[s.scanCountCard, isTablet && s.scanCountCardTablet, { flex: 1 }]}>
                <Camera size={isTablet ? 16 : 13} color="#0f766e" />
                <Text style={[s.scanCountText, isTablet && s.scanCountTextTablet]}>
                  {isGuest
                    ? `${guestScansLeft} / ${GUEST_MAX_SCANS} escaneos disponibles`
                    : userTokens !== null
                      ? `${userTokens} escaneos disponibles`
                      : 'Cargando escaneos...'}
                </Text>
              </View>
            </Reanimated.View>

            <Reanimated.View entering={FadeInDown.delay(420).duration(700)} style={[s.stats, isTablet && s.statsTablet]}>
              <View style={s.statItem}>
                <Sun color={colors.primary} size={isTablet ? 26 : 22} />
                <Text style={[s.statVal, { color: colors.textPrimary }, isTablet && s.statValTablet]}>
                  {temperature !== null ? `${getWeatherEmoji(temperature)} ${temperature.toFixed(1)}°C` : '—'}
                </Text>
                <Text style={[s.statLbl, isTablet && s.statLblTablet]}>Temperatura</Text>
              </View>
              <View style={s.statDiv} />
              <View style={s.statItem}>
                <Droplets color="#38bdf8" size={isTablet ? 26 : 22} />
                <Text style={[s.statVal, { color: colors.textPrimary }, isTablet && s.statValTablet]}>{humidity !== null ? `${humidity}%` : '—'}</Text>
                <Text style={[s.statLbl, isTablet && s.statLblTablet]}>Humedad</Text>
              </View>
              <View style={s.statDiv} />
              <View style={s.statItem}>
                <Leaf color={colors.accent} size={isTablet ? 26 : 22} />
                <Text style={[s.statVal, { color: colors.textPrimary }, isTablet && s.statValTablet]}>
                  {isGuest ? 'N/A' : (healthPct !== null ? `${healthPct.toFixed(0)}%` : 'N/A')}
                </Text>
                <Text style={[s.statLbl, isTablet && s.statLblTablet]}>Salud</Text>
              </View>
            </Reanimated.View>
          </View>

          <Reanimated.View entering={FadeInUp.delay(500).duration(700)} style={{ marginTop: -5, marginBottom: 12 }}>
            {!locationEnabled
              ? <View style={[s.mapPh, isTablet && s.mapPhTablet]}>
                  <MapPinOff color="#94a3b8" size={24} />
                  <Text style={{ color: '#94a3b8', fontSize: isTablet ? 15 : 13, marginTop: 8, textAlign: 'center' }}>
                    Activa la ubicación{'\n'}para ver el mapa
                  </Text>
                </View>
              : (!location || !location.coords)
                ? <View style={[s.mapPh, isTablet && s.mapPhTablet]}><Text style={{ color: '#94a3b8', fontSize: 14 }}>📍 Obteniendo ubicación…</Text></View>
                : <MapViewComponent location={location} errorMsg={errorMsg} />
            }
          </Reanimated.View>

          <Reanimated.View entering={FadeInUp.delay(620).duration(700)} style={[s.grid, isTablet && s.gridTablet]}>
            {/* Escanear — always accessible */}
            <TouchableOpacity style={[s.mainCard, isTablet && s.mainCardTablet]} onPress={() => router.push('/scan')}>
              <LinearGradient colors={['#6ee7b7', '#059669']} style={s.cardGrad}>
                <View style={[s.cardIcon, isTablet && s.cardIconTablet]}><Camera color="#fff" size={isTablet ? 32 : 26} /></View>
                <Text style={[s.cardTitle, isTablet && s.cardTitleTablet]}>Escanear</Text>
                <Text style={[s.cardSub, isTablet && s.cardSubTablet]}>Detecta enfermedades{'\n'}en tus cultivos</Text>
                {isGuest && (
                  <View style={s.guestScanBadge}>
                    <Text style={s.guestScanBadgeText}>{guestScansLeft} restantes</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={[s.secCards, isTablet && s.secCardsTablet]}>
              {/* Mapeo — locked for guest */}
              <TouchableOpacity
                style={[s.secCard, { marginBottom: isTablet ? 16 : 12 }]}
                onPress={() => isGuest ? null : router.push('/mapping')}
                disabled={isGuest}
              >
                <LinearGradient colors={isGuest ? ['#e2e8f0', '#cbd5e1'] : ['#fcd34d', '#f59e0b']} style={s.secGrad}>
                  <View style={[s.secIcon, isTablet && s.secIconTablet]}>
                    {isGuest ? <Lock color="#94a3b8" size={isTablet ? 24 : 20} /> : <Map color="#fff" size={isTablet ? 24 : 20} />}
                  </View>
                  <Text style={[s.secTitle, isTablet && s.secTitleTablet, isGuest && s.secTitleLocked]}>Mapeo</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Resultados — locked for guest */}
              <TouchableOpacity
                style={[s.secCard, { marginBottom: isTablet ? 16 : 12 }]}
                onPress={() => isGuest ? null : router.push('/results')}
                disabled={isGuest}
              >
                <LinearGradient colors={isGuest ? ['#e2e8f0', '#cbd5e1'] : ['#67e8f9', '#0891b2']} style={s.secGrad}>
                  <View style={[s.secIcon, isTablet && s.secIconTablet]}>
                    {isGuest ? <Lock color="#94a3b8" size={isTablet ? 24 : 20} /> : <LineChart color="#fff" size={isTablet ? 24 : 20} />}
                  </View>
                  <Text style={[s.secTitle, isTablet && s.secTitleTablet, isGuest && s.secTitleLocked]}>Resultados</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Medidas — locked for guest */}
              <TouchableOpacity
                style={s.secCard}
                onPress={() => isGuest ? null : router.push('/agenda')}
                disabled={isGuest}
              >
                <LinearGradient colors={isGuest ? ['#e2e8f0', '#cbd5e1'] : ['#86efac', '#16a34a']} style={s.secGrad}>
                  <View style={[s.secIcon, isTablet && s.secIconTablet]}>
                    {isGuest ? <Lock color="#94a3b8" size={isTablet ? 24 : 20} /> : <AlertTriangle color="#fff" size={isTablet ? 24 : 20} />}
                  </View>
                  <Text style={[s.secTitle, isTablet && s.secTitleTablet, isGuest && s.secTitleLocked]}>Medidas</Text>
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
  centerVignette: {
    position: 'absolute',
    top: '15%', left: '8%',
    width: '84%', height: '70%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
    zIndex: 1,
  },
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
  guestAvatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  guestAvatarCircleTablet: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },

  header: { paddingTop: 90, paddingHorizontal: 22, marginBottom: 18 },
  headerTablet: { paddingTop: 100, paddingHorizontal: 28 },

  logo: { width: '96%', height: 110, alignSelf: 'center', marginBottom: 12 },
  logoTablet: { width: '70%', height: 140, marginBottom: 18 },

  locationToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#0f766e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.12)',
  },
  locationToggleCardTablet: {
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 22,
    marginBottom: 14,
  },
  locationToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationToggleTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
  },
  locationToggleTitleTablet: { fontSize: 17 },
  locationToggleSub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  locationToggleSubTablet: { fontSize: 13 },

  welcomeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingVertical: 10, paddingLeft: 20, paddingRight: 10,
    borderWidth: 2,
    borderTopLeftRadius: 30, borderBottomLeftRadius: 30,
    borderTopRightRadius: 60, borderBottomRightRadius: 60,
    shadowColor: '#0f766e', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 5,
    marginBottom: 10,
  },
  welcomeCardTablet: {
    paddingVertical: 14, paddingLeft: 28, paddingRight: 14,
    marginBottom: 14,
  },
  welcomeText: { flex: 1, marginRight: 12 },
  greetLabel: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: '#5eead4', letterSpacing: 0.8 },
  greetLabelTablet: { fontSize: 13 },
  userName: { fontFamily: 'Poppins_600SemiBold', fontSize: 15 },
  userNameTablet: { fontSize: 18 },

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

  stats: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 20, padding: 16, marginTop: 12,
    shadowColor: '#0f766e', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09, shadowRadius: 10, elevation: 4,
  },
  statsTablet: {
    padding: 22, borderRadius: 24, marginTop: 16,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statDiv: { width: 1, height: 40, backgroundColor: '#ccfbf1', marginHorizontal: 4 },
  statVal: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', marginTop: 2 },
  statValTablet: { fontSize: 17 },
  statLbl: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: '#94a3b8', marginTop: 1 },
  statLblTablet: { fontSize: 13 },

  mapPh: {
    height: 160, marginHorizontal: 22, borderRadius: 16,
    backgroundColor: 'rgba(240,253,250,0.8)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#ccfbf1',
  },
  mapPhTablet: {
    height: 220, marginHorizontal: 28, borderRadius: 22,
  },

  grid: { flexDirection: 'row', paddingHorizontal: 22, gap: 14 },
  gridTablet: { paddingHorizontal: 28, gap: 18 },

  mainCard: { flex: 1, height: 290, borderRadius: 24, overflow: 'hidden', elevation: 8 },
  mainCardTablet: { height: 360, borderRadius: 28 },

  secCards: { flex: 1 },
  secCardsTablet: { flex: 1 },

  secCard: { flex: 1, height: 82, borderRadius: 20, overflow: 'hidden', elevation: 6 },

  cardGrad: { flex: 1, padding: 22, justifyContent: 'flex-end' },
  secGrad: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  cardIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  cardIconTablet: { width: 60, height: 60, borderRadius: 30, marginBottom: 14 },
  secIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'center', alignItems: 'center',
  },
  secIconTablet: { width: 44, height: 44, borderRadius: 22 },
  cardTitle: { fontSize: 22, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  cardTitleTablet: { fontSize: 28 },
  cardSub: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.82)', marginTop: 3 },
  cardSubTablet: { fontSize: 15, marginTop: 5 },
  secTitle: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  secTitleTablet: { fontSize: 18 },
  secTitleLocked: { color: '#94a3b8' },

  guestScanBadge: {
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  guestScanBadgeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: '#fff',
  },
});
