/**
 * Inicio — mismo lenguaje visual que Escanear: héroe fotográfico inmersivo, verdes profundos y acentos lima.
 *
 * 1. Héroe (huerto de aguacates al amanecer) bajo la barra de estado: logo, anillo de tokens (sin cambios), Ajustes,
 *    título, lema y subtítulo; abajo, la tarjeta de la huerta seleccionada (miniatura satelital real).
 * 2. Estado del cultivo: temperatura, humedad, salud y viento (mismos servicios y umbrales que antes).
 * 3. Mis huertas: carrusel con imagen satelital real y polígono de cada huerta.
 * 4. Acciones rápidas: cuatro tarjetas fotográficas (Escanear, Mapeo, Actividad, Satélite).
 * 5. Banner de índices satelitales → Datos satelitales.
 *
 * Datos (sin cambios de lógica): ubicación + OpenWeather; salud = % de escaneos saludables; tokens de users;
 * huertas de public.huertas. La huerta seleccionada es la última abierta desde Inicio (guardada en el celular)
 * o, si no hay, la primera de la lista.
 *
 * Movimiento (animate-expo): entrada corta del héroe y la tarjeta de huerta (FadeInDown/Up, 320–420 ms, salida
 * fuerte), tarjetas del carrusel escalonadas solo al montar, escala 0.97 al tocar (PressableScale) y aparición
 * del banner. Con «Reducir movimiento» no hay desplazamientos.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ArrowRight, BarChart3, Camera, ChartLine as LineChart, ChevronRight, Droplets, Leaf, Lock, Map as MapIcon, Satellite, Settings, Sprout, Sun, Wind } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Polygon as SvgPolygon } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import * as Location from 'expo-location';
import { onAuthStateChanged, User } from 'firebase/auth';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Reanimated, { FadeIn, FadeInDown, FadeInRight, FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { auth } from '../../firebaseConfig';
import { supabase } from '../../supabaseConfig';
import TokenRing from '../../components/TokenRing';
import { PressableScale, EASE_OUT } from '../../components/scan/motion';
import { useGuest } from '../../context/GuestContext';
import { TranslationResource, useLanguage, useTranslations } from '../../context/LanguageContext';
import { listOrchards, Orchard } from '../../services/orchards';

const OPENWEATHER_API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY!;
/** Huerta seleccionada en Inicio (la última que se abrió desde aquí). */
const SELECTED_KEY = 'avotex_home_orchard';

// Fotografías proporcionadas por AVOTEX para Inicio (assets/images/inicio).
const IMG = {
  hero: require('../../assets/images/inicio/hero-aguacates-amanecer.jpg'),
  logo: require('../../assets/images/inicio/avotex-logo-blanco.png'),
  scan: require('../../assets/images/inicio/accion-escanear-hoja.jpg'),
  mapping: require('../../assets/images/inicio/accion-mapeo-terrazas.jpg'),
  activity: require('../../assets/images/inicio/accion-actividad-hileras.jpg'),
  satellite: require('../../assets/images/inicio/accion-satelite.jpg'),
  banner: require('../../assets/images/inicio/banner-campos-geometricos.jpg'),
} as const;

const C = {
  deep: '#063F32', lime: '#B8F542', bright: '#8AE414', teal: '#14B8A6', white: '#FFFFFF', bg: '#F8FAF8',
  ink: '#0F241B', muted: '#5E6E66', line: '#E6ECE7', soft: '#EEF8E4', limeInk: '#1F3A0A',
} as const;

const translations: TranslationResource = {
  loading: { es: 'Cargando…', en: 'Loading…' },
  settings: { es: 'Ajustes', en: 'Settings' },
  title: { es: 'Inicio', en: 'Home' },
  claim1: { es: 'Tu huerta, más clara,', en: 'Your orchard, clearer,' },
  claim2: { es: 'más inteligente.', en: 'smarter.' },
  subtitle: { es: 'Monitorea tus cultivos con inteligencia artificial y toma mejores decisiones.', en: 'Monitor your crops with artificial intelligence and make better decisions.' },
  selected: { es: 'HUERTA SELECCIONADA', en: 'SELECTED ORCHARD' },
  seeMap: { es: 'Ver mapa', en: 'See map' },
  noOrchardsTitle: { es: 'Registra tu primera huerta', en: 'Register your first orchard' },
  noOrchardsText: { es: 'Dibuja su contorno en Mapeo para ver aquí su estado.', en: 'Draw its outline in Mapping to see its status here.' },
  register: { es: 'Registrar', en: 'Register' },
  guestTitle: { es: 'Modo invitado', en: 'Guest mode' },
  guestText: { es: 'Crea una cuenta para registrar tus huertas.', en: 'Create an account to register your orchards.' },
  createAccount: { es: 'Crear cuenta', en: 'Sign up' },
  cropStatus: { es: 'Estado del cultivo', en: 'Crop status' },
  temperature: { es: 'Temperatura', en: 'Temperature' }, humidity: { es: 'Humedad', en: 'Humidity' },
  health: { es: 'Salud', en: 'Health' }, wind: { es: 'Viento', en: 'Wind' },
  noLocation: { es: 'Sin ubicación', en: 'No location' }, noScans: { es: 'Sin escaneos', en: 'No scans' },
  critical: { es: 'Crítica', en: 'Critical' }, attention: { es: 'Atención', en: 'Attention' }, healthy: { es: 'Saludable', en: 'Healthy' },
  stableWind: { es: 'Viento estable', en: 'Stable wind' }, strongWind: { es: 'Viento fuerte', en: 'Strong wind' },
  myOrchards: { es: 'Mis huertas', en: 'My orchards' }, seeAll: { es: 'Ver todas', en: 'See all' },
  openOrchard: { es: 'Abrir huerta {name}', en: 'Open {name} orchard' },
  quickActions: { es: 'Acciones rápidas', en: 'Quick actions' },
  scan: { es: 'Escanear', en: 'Scan' }, mapping: { es: 'Mapeo', en: 'Mapping' }, activity: { es: 'Actividad', en: 'Activity' }, satellite: { es: 'Satélite', en: 'Satellite' },
  needsAccount: { es: 'requiere cuenta', en: 'requires an account' },
  bannerA: { es: 'Explora más detalles', en: 'Explore more details' },
  bannerB: { es: 'de tu ', en: 'of your ' },
  bannerC: { es: 'huerta virtual', en: 'virtual orchard' },
  bannerSub: { es: 'NDVI, NDRE, humedad, precipitación y temperatura.', en: 'NDVI, NDRE, humidity, precipitation and temperature.' },
  indices: { es: 'ÍNDICES AVOTEX', en: 'AVOTEX INDICES' },
  indices1: { es: 'NDVI · NDRE · Humedad', en: 'NDVI · NDRE · Humidity' },
  indices2: { es: 'Precipitación · Temperatura', en: 'Precipitation · Temperature' },
};

interface Scan { label: string; created_at?: string }

// ───────── piezas ─────────

/** Escala vertical compacta con marcas y un indicador (temperatura y humedad). */
function VerticalGauge({ value, min, max, labels }: { value: number | null; min: number; max: number; labels: { value: number; text: string }[] }) {
  const pct = value === null ? null : Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <View style={s.gauge}>
      <View style={s.gaugeTicks}>
        {Array.from({ length: 9 }).map((_, i) => <View key={i} style={[s.gaugeTick, i % 4 === 0 && s.gaugeTickMajor]} />)}
        {pct !== null && <View style={[s.gaugeIndicator, { bottom: `${pct}%` as `${number}%` }]} />}
      </View>
      <View style={s.gaugeLabels}>
        {labels.map(l => (
          <Text key={l.value} style={[s.gaugeLabel, { bottom: `${Math.max(0, Math.min(100, ((l.value - min) / (max - min)) * 100))}%` as `${number}%` }]}>{l.text}</Text>
        ))}
      </View>
    </View>
  );
}

/** Recorte satelital (Esri) y polígono de la huerta, a partir de sus coordenadas reales. */
const orchardPreview = (orchard: Orchard, ratio = 1.48) => {
  const points = orchard.coordinates;
  if (!points || points.length < 3) return null;
  let minLat = Math.min(...points.map(p => p.latitude));
  let maxLat = Math.max(...points.map(p => p.latitude));
  let minLng = Math.min(...points.map(p => p.longitude));
  let maxLng = Math.max(...points.map(p => p.longitude));
  const cLat = (minLat + maxLat) / 2, cLng = (minLng + maxLng) / 2;
  let latSpan = Math.max(maxLat - minLat, 0.00035) * 1.34;
  let lngSpan = Math.max(maxLng - minLng, 0.00035) * 1.34;
  if (lngSpan / latSpan < ratio) lngSpan = latSpan * ratio; else latSpan = lngSpan / ratio;
  minLat = cLat - latSpan / 2; maxLat = cLat + latSpan / 2; minLng = cLng - lngSpan / 2; maxLng = cLng + lngSpan / 2;
  const vh = 100 / ratio;
  const polygonPoints = points.map(p => `${(((p.longitude - minLng) / lngSpan) * 100).toFixed(2)},${(((maxLat - p.latitude) / latSpan) * vh).toFixed(2)}`).join(' ');
  const bbox = [minLng, minLat, maxLng, maxLat].join(',');
  const pxW = 520, pxH = Math.round(pxW / ratio);
  return {
    polygonPoints, viewBox: `0 0 100 ${vh.toFixed(2)}`,
    imageUrl: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=${pxW},${pxH}&format=jpg&f=image`,
  };
};

function OrchardThumb({ orchard, ratio, stroke = 2 }: { orchard: Orchard; ratio: number; stroke?: number }) {
  const preview = useMemo(() => orchardPreview(orchard, ratio), [orchard, ratio]);
  if (!preview) return <LinearGradient colors={['#6E9A4F', '#2F5A33']} style={StyleSheet.absoluteFill} />;
  return (
    <>
      {/* Anclada a los cuatro bordes (como el Inicio anterior): con ancho/alto en % no se dibujaba en Android. */}
      <Image source={{ uri: preview.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      <Svg width="100%" height="100%" viewBox={preview.viewBox} preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
        <SvgPolygon points={preview.polygonPoints} fill="rgba(160,214,90,0.42)" stroke="#FFFFFF" strokeWidth={stroke} strokeLinejoin="round" />
      </Svg>
    </>
  );
}

const haText = (m2: number, locale: string) =>
  `${(m2 / 10000).toLocaleString(locale, { minimumFractionDigits: m2 < 100000 ? 1 : 0, maximumFractionDigits: m2 < 10000 ? 2 : 1 })} ha`;

/** Tarjeta blanca de Estado del cultivo. */
function StatCard({ icon, label, children, style }: { icon: React.ReactNode; label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[s.stat, style]}>
      <View style={s.statIcon}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.statLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

// ───────── pantalla ─────────

export default function Home() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const isTablet = width >= 768;
  const contentW = Math.min(width, isTablet ? 760 : width);
  const pad = 18;
  const innerW = contentW - pad * 2;

  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });
  const { isGuest, guestScansLeft } = useGuest();
  const { locale, language } = useLanguage();
  const t = useTranslations(translations);

  const [userTokens, setUserTokens] = useState<number | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [windSpeed, setWindSpeed] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [scans, setScans] = useState<Scan[]>([]);
  const [orchards, setOrchards] = useState<Orchard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Héroe bajo la barra de estado: texto claro mientras Inicio está visible.
  useFocusEffect(useCallback(() => { setStatusBarStyle('light'); return () => setStatusBarStyle('dark'); }, []));

  const requestAndSetLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      setLocation(await Location.getCurrentPositionAsync({}));
    } catch { /* sin ubicación: se muestran estados vacíos */ }
  };

  useFocusEffect(useCallback(() => {
    let active = true;
    AsyncStorage.getItem('avotex_share_location').then(saved => {
      if (!active) return;
      if (saved !== 'false') requestAndSetLocation();
      else { setLocation(null); setTemperature(null); setHumidity(null); setWindSpeed(null); }
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!user?.email || isGuest) { setOrchards([]); return () => { active = false; }; }
    Promise.all([listOrchards(user.email).catch(() => [] as Orchard[]), AsyncStorage.getItem(SELECTED_KEY).catch(() => null)])
      .then(([data, saved]) => { if (active) { setOrchards(data); setSelectedId(saved); } });
    return () => { active = false; };
  }, [user?.email, isGuest]));

  useEffect(() => {
    if (!location) return;
    (async () => {
      try {
        const { latitude, longitude } = location.coords;
        const r = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&lang=${language}&appid=${OPENWEATHER_API_KEY}`);
        setTemperature(r.data.main.temp);
        setHumidity(r.data.main.humidity);
        setWindSpeed(r.data.wind?.speed ?? null);
      } catch { /* sin clima */ }
    })();
  }, [location, language]);

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setLoadingUser(false); }), []);

  useEffect(() => {
    if (isGuest) { setLoadingUser(false); return; }
    if (!user) { setScans([]); return; }
    supabase.from('scans').select('label, created_at').eq('user_id', user.uid).then(({ data }) => { if (data) setScans(data); });
  }, [user, isGuest]);

  const loadTokens = useCallback(() => {
    if (!user?.email || isGuest) return;
    supabase.from('users').select('tokens').eq('user_email', user.email).maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.warn('[tokens] error:', error.message); setUserTokens(0); return; }
        setUserTokens(data?.tokens ?? 0);
      });
  }, [user?.email, isGuest]);
  useFocusEffect(loadTokens);

  // Salud: % de escaneos con diagnóstico saludable (misma regla que antes).
  const healthPct = useMemo(() => {
    if (!scans.length) return null;
    const ok = scans.filter(sc => { const l = (sc.label ?? '').toLowerCase(); return l.includes('saludable') || l.includes('healthy'); }).length;
    return (ok / scans.length) * 100;
  }, [scans]);

  const selected = orchards.find(o => o.id === selectedId) ?? orchards[0] ?? null;
  const openOrchard = (o: Orchard) => {
    setSelectedId(o.id);
    AsyncStorage.setItem(SELECTED_KEY, o.id).catch(() => {});
    router.push({ pathname: '/(app)/mapping', params: { orchardId: o.id } });
  };

  if (!fontsLoaded || loadingUser) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator size="large" color={C.teal} />
        <Text style={{ marginTop: 16, fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: C.deep }}>{t('loading')}</Text>
      </View>
    );
  }

  // Medidas del héroe: contenido + la mitad de la tarjeta de huerta encima del fundido a blanco.
  const heroTextH = insets.top + 8 + 50 + 14 + 54 + 76 + 48;
  const cardH = 112;
  const heroH = heroTextH + cardH * 0.62;
  const bottomSpace = (isTablet ? 82 + 24 : 72 + 18) + 28 + insets.bottom;
  const enter = (d: number) => (reduced ? FadeIn.duration(160) : FadeInDown.duration(380).delay(d).easing(EASE_OUT));

  const orchardCardW = Math.round(Math.max(150, Math.min(220, (innerW - 12) / 2)));
  const actionW = Math.max(82, Math.floor((innerW - 3 * 8) / 4));
  // Banner: lado a lado en cualquier celular; solo se apila en pantallas muy angostas.
  const narrowBanner = innerW < 290;
  const compactStats = innerW < 340;

  const actions = [
    { key: 'scan', label: t('scan'), img: IMG.scan, Icon: Camera, locked: false, go: () => router.push('/scan') },
    { key: 'mapping', label: t('mapping'), img: IMG.mapping, Icon: MapIcon, locked: isGuest, go: () => router.push('/mapping') },
    { key: 'activity', label: t('activity'), img: IMG.activity, Icon: LineChart, locked: isGuest, go: () => router.push('/results') },
    { key: 'satellite', label: t('satellite'), img: IMG.satellite, Icon: Satellite, locked: isGuest, go: () => router.push('/(app)/satelite') },
  ];

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomSpace }} showsVerticalScrollIndicator={false}>
        {/* ── Héroe ── */}
        <View style={[s.hero, { height: heroH }]}>
          <Image source={IMG.hero} style={s.fill} resizeMode="cover" accessibilityIgnoresInvertColors />
          {/* Lectura del texto: oscuro a la izquierda y arriba; abajo se funde con el fondo claro. */}
          <LinearGradient colors={['rgba(4,40,26,0.86)', 'rgba(4,40,26,0.55)', 'rgba(4,40,26,0.05)']} locations={[0, 0.5, 0.95]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)']} locations={[0, 0.3]} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(248,250,248,0)', 'rgba(248,250,248,0.85)', C.bg]}
            locations={[(heroTextH - 40) / heroH, (heroH - 24) / heroH, 1]} style={StyleSheet.absoluteFill} />
        </View>

        <View style={[s.content, { width: contentW, paddingHorizontal: pad, paddingTop: insets.top + 8 }]}>
          <Reanimated.View entering={enter(0)} style={s.topRow}>
            <Image source={IMG.logo} style={s.logo} resizeMode="contain" accessibilityRole="image" accessibilityLabel="AVOTEX" />
            <View style={s.topRight}>
              {/* Anillo de uso de tokens (components/TokenRing.tsx): sin cambios. */}
              <TokenRing remaining={isGuest ? guestScansLeft * 100 : userTokens !== null ? userTokens * 100 : null}
                isGuest={isGuest} email={user?.email ?? null} size={44} />
              <PressableScale style={s.gear} onPress={() => router.navigate('/(app)/settings')} accessibilityRole="button" accessibilityLabel={t('settings')} hitSlop={6}>
                <Settings size={20} color={C.ink} />
              </PressableScale>
            </View>
          </Reanimated.View>

          <Reanimated.View entering={enter(70)}>
            <Text style={[s.title, isTablet && s.titleTablet]} accessibilityRole="header" maxFontSizeMultiplier={1.1}>{t('title')}</Text>
            <Text style={s.claim} maxFontSizeMultiplier={1.1}>{t('claim1')}</Text>
            <Text style={s.claim} maxFontSizeMultiplier={1.1}>{t('claim2')}</Text>
            <Text style={s.subtitle} maxFontSizeMultiplier={1.2}>{t('subtitle')}</Text>
          </Reanimated.View>

          {/* ── Huerta seleccionada ── */}
          <Reanimated.View entering={reduced ? FadeIn.duration(160) : FadeInUp.duration(420).delay(160).easing(EASE_OUT)} style={{ marginTop: 16 }}>
            {isGuest ? (
              <View style={[s.selCard, { minHeight: cardH }]}>
                <View style={[s.selThumb, s.selThumbEmpty]}><Lock size={26} color={C.lime} /></View>
                <View style={s.selDivider} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.selName} numberOfLines={1}>{t('guestTitle')}</Text>
                  <Text style={s.selMeta} numberOfLines={2}>{t('guestText')}</Text>
                </View>
                <PressableScale onPress={() => router.replace('/(auth)')} accessibilityRole="button" style={s.selBtn}>
                  <Text style={s.selBtnText} numberOfLines={1}>{t('createAccount')}</Text>
                </PressableScale>
              </View>
            ) : selected ? (
              <PressableScale onPress={() => openOrchard(selected)} accessibilityRole="button" accessibilityLabel={`${t('selected')}: ${selected.nombre}, ${haText(selected.area_m2, locale)}. ${t('seeMap')}`}
                style={[s.selCard, { minHeight: cardH }]}>
                <View style={s.selThumb}><OrchardThumb orchard={selected} ratio={1.45} /></View>
                <View style={s.selDivider} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.selLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('selected')}</Text>
                  <Text style={s.selName} numberOfLines={2} maxFontSizeMultiplier={1.15}>{selected.nombre}</Text>
                  <Text style={s.selMeta}>{haText(selected.area_m2, locale)}</Text>
                </View>
                <View style={s.selBtn}>
                  <MapIcon size={16} color={C.limeInk} />
                  <Text style={s.selBtnText}>{t('seeMap')}</Text>
                  {innerW >= 380 && <ChevronRight size={16} color={C.limeInk} />}
                </View>
              </PressableScale>
            ) : (
              <View style={[s.selCard, { minHeight: cardH }]}>
                <View style={[s.selThumb, s.selThumbEmpty]}><Sprout size={28} color={C.lime} /></View>
                <View style={s.selDivider} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.selName, { fontSize: 16, lineHeight: 20 }]} numberOfLines={2}>{t('noOrchardsTitle')}</Text>
                  <Text style={[s.selMeta, { fontSize: 12, lineHeight: 15 }]} numberOfLines={3}>{t('noOrchardsText')}</Text>
                </View>
                <PressableScale onPress={() => router.push('/mapping')} accessibilityRole="button" style={s.selBtn}>
                  <Text style={s.selBtnText}>{t('register')}</Text>
                </PressableScale>
              </View>
            )}
          </Reanimated.View>

          {/* ── Estado del cultivo ── */}
          <Text style={s.section} accessibilityRole="header">{t('cropStatus')}</Text>
          <View style={s.grid}>
            <StatCard icon={<Sun size={21} color={C.bright} />} label={t('temperature')}>
              <View style={s.statRow}>
                <Text style={[s.statValue, compactStats && s.statValueCompact]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.1}>
                  {temperature !== null ? `${temperature.toFixed(1)}°C` : '—'}
                </Text>
                <VerticalGauge value={temperature} min={0} max={45} labels={[{ value: 20, text: '20°' }, { value: 30, text: '30°' }, { value: 35, text: '35°' }]} />
              </View>
              {temperature === null && <Text style={s.statEmpty}>{t('noLocation')}</Text>}
            </StatCard>
            <StatCard icon={<Droplets size={21} color={C.bright} />} label={t('humidity')}>
              <View style={s.statRow}>
                <Text style={[s.statValue, compactStats && s.statValueCompact]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.1}>
                  {humidity !== null ? `${humidity}%` : '—'}
                </Text>
                <VerticalGauge value={humidity} min={0} max={100} labels={[{ value: 30, text: '30%' }, { value: 60, text: '60%' }, { value: 90, text: '90%' }]} />
              </View>
              {humidity === null && <Text style={s.statEmpty}>{t('noLocation')}</Text>}
            </StatCard>
            <StatCard icon={<Leaf size={21} color={C.bright} />} label={t('health')}>
              <Text style={[s.statValue, compactStats && s.statValueCompact]} numberOfLines={1} maxFontSizeMultiplier={1.1}>{isGuest || healthPct === null ? '—' : `${healthPct.toFixed(0)}%`}</Text>
              <View style={s.healthTrack}>
                <LinearGradient colors={['#EF4444', '#F97316', '#FACC15', '#84CC16', '#22C55E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                {!isGuest && healthPct !== null && <View style={[s.healthMarker, { left: `${Math.max(2, Math.min(98, healthPct))}%` as `${number}%` }]} />}
              </View>
              {isGuest || healthPct === null ? <Text style={s.statEmpty}>{t('noScans')}</Text> : (
                <View style={s.legend}>
                  {([['#EF4444', t('critical')], ['#F97316', t('attention')], ['#22C55E', t('healthy')]] as const).map(([c, l]) => (
                    <View key={l} style={s.legendItem}><View style={[s.legendDot, { backgroundColor: c }]} /><Text style={s.legendText} numberOfLines={1}>{l}</Text></View>
                  ))}
                </View>
              )}
            </StatCard>
            <StatCard icon={<Wind size={21} color={C.bright} />} label={t('wind')}>
              <Text style={[s.statValue, compactStats && s.statValueCompact]} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                {windSpeed !== null ? windSpeed.toFixed(1) : '—'}{windSpeed !== null && <Text style={s.statUnit}> m/s</Text>}
              </Text>
              {windSpeed === null ? <Text style={s.statEmpty}>{t('noLocation')}</Text> : (
                <View style={[s.pill, windSpeed > 8 && s.pillWarn]}>
                  <Text style={[s.pillText, windSpeed > 8 && s.pillTextWarn]} numberOfLines={1}>{windSpeed <= 8 ? t('stableWind') : t('strongWind')}</Text>
                </View>
              )}
            </StatCard>
          </View>

          {/* ── Mis huertas ── */}
          {!isGuest && orchards.length > 0 && (
            <>
              <View style={s.sectionRow}>
                <Text style={[s.section, { marginTop: 0 }]} accessibilityRole="header">{t('myOrchards')}</Text>
                <PressableScale onPress={() => router.push('/mapping')} accessibilityRole="button" hitSlop={8} style={s.seeAll}>
                  <Text style={s.seeAllText}>{t('seeAll')}</Text>
                  <ArrowRight size={16} color={C.deep} />
                </PressableScale>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={orchardCardW + 12} decelerationRate="fast"
                style={{ marginHorizontal: -pad }} contentContainerStyle={{ paddingHorizontal: pad, gap: 12 }}>
                {orchards.map((o, i) => (
                  <Reanimated.View key={o.id} entering={reduced ? undefined : FadeInRight.duration(360).delay(60 + Math.min(i, 4) * 60).easing(EASE_OUT)}>
                    <PressableScale onPress={() => openOrchard(o)} accessibilityRole="button" accessibilityLabel={t('openOrchard', { name: o.nombre })}
                      style={[s.orchard, { width: orchardCardW, height: Math.round(orchardCardW * 0.6) }]}>
                      <OrchardThumb orchard={o} ratio={1 / 0.6} stroke={2.4} />
                      <LinearGradient colors={['rgba(6,40,26,0)', 'rgba(6,40,26,0.88)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
                      <View style={s.orchardFoot}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.orchardName} numberOfLines={1}>{o.nombre}</Text>
                          <Text style={s.orchardArea}>{haText(o.area_m2, locale)}</Text>
                        </View>
                        <View style={s.orchardGo}><ArrowRight size={18} color={C.limeInk} strokeWidth={2.4} /></View>
                      </View>
                    </PressableScale>
                  </Reanimated.View>
                ))}
              </ScrollView>
            </>
          )}

          {/* ── Acciones rápidas ── */}
          <Text style={s.section} accessibilityRole="header">{t('quickActions')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={4 * actionW + 24 > innerW + 1}
            style={{ marginHorizontal: -pad }} contentContainerStyle={{ paddingHorizontal: pad, gap: 8 }}>
            {actions.map(a => (
              <PressableScale key={a.key} onPress={a.locked ? undefined : a.go} disabled={a.locked} accessibilityRole="button"
                accessibilityLabel={a.locked ? `${a.label}, ${t('needsAccount')}` : a.label} accessibilityState={{ disabled: a.locked }}
                style={[s.action, { width: actionW }]}>
                <Image source={a.img} style={s.fill} resizeMode="cover" accessibilityIgnoresInvertColors />
                <LinearGradient colors={['rgba(6,63,50,0.15)', 'rgba(6,63,50,0.55)', 'rgba(4,40,26,0.92)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
                {/* El relleno va en esta capa (no en la tarjeta): así la foto cubre la tarjeta completa en Android. */}
                <View style={s.actionBody}>
                  <View style={[s.actionIcon, a.locked && s.actionIconLocked]}>
                    {a.locked ? <Lock size={15} color={C.white} /> : <a.Icon size={17} color={C.limeInk} strokeWidth={2.3} />}
                  </View>
                  <Text style={[s.actionLabel, a.locked && { opacity: 0.75 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.15}>{a.label}</Text>
                </View>
              </PressableScale>
            ))}
          </ScrollView>

          {/* ── Banner: índices satelitales ── */}
          <Reanimated.View entering={reduced ? undefined : FadeInUp.duration(420).delay(260).easing(EASE_OUT)} style={{ marginTop: 18 }}>
            <PressableScale onPress={isGuest ? undefined : () => router.push('/(app)/satelite')} disabled={isGuest} accessibilityRole="button"
              accessibilityLabel={`${t('bannerA')} ${t('bannerB')}${t('bannerC')}. ${t('bannerSub')}${isGuest ? `, ${t('needsAccount')}` : ''}`}
              style={[s.banner, narrowBanner && { minHeight: 196 }]}>
              <Image source={IMG.banner} style={s.fill} resizeMode="cover" accessibilityIgnoresInvertColors />
              <LinearGradient colors={['rgba(4,40,26,0.92)', 'rgba(4,40,26,0.72)', 'rgba(4,40,26,0.1)']} locations={[0, 0.45, 0.9]}
                start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
              <View style={[s.bannerBody, narrowBanner && { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <View style={narrowBanner ? { alignSelf: 'stretch' } : { flex: 1.15, minWidth: 0 }}>
                  <Text style={s.bannerTitle} maxFontSizeMultiplier={1.15}>{t('bannerA')}</Text>
                  <Text style={s.bannerTitle} maxFontSizeMultiplier={1.15}>{t('bannerB')}<Text style={{ color: C.lime }}>{t('bannerC')}</Text></Text>
                  <Text style={s.bannerSub} maxFontSizeMultiplier={1.2}>{t('bannerSub')}</Text>
                </View>
                <View style={[s.glass, narrowBanner && { alignSelf: 'stretch', marginTop: 10 }]}>
                  <BarChart3 size={20} color={C.lime} />
                  <View style={{ flexShrink: 1 }}>
                    <Text style={s.glassLabel} numberOfLines={1}>{t('indices')}</Text>
                    <Text style={s.glassMain} numberOfLines={2}>{t('indices1')}</Text>
                    <Text style={s.glassSub} numberOfLines={2}>{t('indices2')}</Text>
                  </View>
                </View>
              </View>
              {isGuest && <View style={s.bannerLock}><Lock size={13} color={C.white} /></View>}
            </PressableScale>
          </Reanimated.View>
        </View>
      </ScrollView>
    </View>
  );
}

const shadow = { shadowColor: '#1D3B2A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 } as const;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', backgroundColor: C.deep },
  content: { alignSelf: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, height: 50 },
  logo: { width: 150, height: 50 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gear: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)' },
  title: { marginTop: 14, fontFamily: 'Poppins_700Bold', fontStyle: 'italic', fontSize: 44, lineHeight: 52, letterSpacing: -1.2, color: C.white },
  titleTablet: { fontSize: 54, lineHeight: 62 },
  claim: { fontFamily: 'Poppins_700Bold', fontStyle: 'italic', fontSize: 25, lineHeight: 30, letterSpacing: -0.6, color: C.lime, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 8 },
  subtitle: { marginTop: 10, maxWidth: 360, fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.94)', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6 },

  selCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 24,
    backgroundColor: 'rgba(6,63,50,0.9)', borderWidth: 1.5, borderColor: C.lime,
    shadowColor: '#063F32', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  selThumb: { width: 88, height: 64, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1D4A33' },
  selThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  selDivider: { width: 1, alignSelf: 'stretch', marginVertical: 8, backgroundColor: 'rgba(184,245,66,0.35)' },
  selLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 9, letterSpacing: 0.6, color: 'rgba(255,255,255,0.8)' },
  selName: { fontFamily: 'Poppins_700Bold', fontSize: 18, lineHeight: 23, color: C.white },
  selMeta: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 17, color: 'rgba(255,255,255,0.82)' },
  selBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 38, paddingHorizontal: 11, borderRadius: 20, backgroundColor: C.lime },
  selBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: C.limeInk },

  section: { marginTop: 24, marginBottom: 10, fontFamily: 'Poppins_700Bold', fontSize: 20, letterSpacing: -0.3, color: C.ink },
  sectionRow: { marginTop: 24, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: C.deep },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    flexGrow: 1, flexBasis: '45%', minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 22,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.line, ...shadow,
  },
  statIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.soft },
  statLabel: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: C.muted },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  statValue: { flexShrink: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 21, lineHeight: 27, letterSpacing: -0.6, color: C.ink },
  statValueCompact: { fontSize: 18.5, lineHeight: 24, letterSpacing: -0.8 },
  statUnit: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: C.muted },
  statEmpty: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: C.muted },
  gauge: { flexDirection: 'row', height: 44, width: 30 },
  gaugeTicks: { width: 12, height: '100%', justifyContent: 'space-between' },
  gaugeTick: { width: 6, height: 1.2, backgroundColor: '#9AA7A0' },
  gaugeTickMajor: { width: 10 },
  gaugeIndicator: { position: 'absolute', left: -2, width: 15, height: 4, marginBottom: -2, borderRadius: 2, backgroundColor: C.bright },
  gaugeLabels: { flex: 1, height: '100%' },
  gaugeLabel: { position: 'absolute', left: 2, marginBottom: -6, fontFamily: 'Poppins_400Regular', fontSize: 8.5, color: C.muted },
  healthTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  healthMarker: { position: 'absolute', top: -3, width: 6, height: 14, marginLeft: -3, borderRadius: 3, backgroundColor: C.white, borderWidth: 1.5, borderColor: '#334155' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 5, rowGap: 0, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontFamily: 'Poppins_400Regular', fontSize: 8.5, color: C.muted },
  pill: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: '#E5F8C8' },
  pillWarn: { backgroundColor: '#FFF1DB' },
  pillText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#2F5A0A' },
  pillTextWarn: { color: '#9A4F07' },

  orchard: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#1D4A33', ...shadow },
  orchardFoot: { position: 'absolute', left: 12, right: 10, bottom: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  orchardName: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: C.white },
  orchardArea: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.88)' },
  orchardGo: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: C.lime },

  action: { height: 78, borderRadius: 18, overflow: 'hidden', backgroundColor: C.deep, ...shadow },
  actionBody: { flex: 1, padding: 8, justifyContent: 'space-between' },
  actionIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: C.lime },
  actionIconLocked: { backgroundColor: 'rgba(0,0,0,0.45)' },
  actionLabel: { fontFamily: 'Poppins_700Bold', fontSize: 12.5, letterSpacing: -0.2, color: C.white },

  banner: { minHeight: 140, borderRadius: 24, overflow: 'hidden', backgroundColor: C.deep, ...shadow },
  bannerBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  bannerTitle: { fontFamily: 'Poppins_700Bold', fontStyle: 'italic', fontSize: 19, lineHeight: 23, letterSpacing: -0.4, color: C.white },
  bannerSub: { marginTop: 6, fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,0.9)' },
  glass: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 16,
    backgroundColor: 'rgba(6,40,26,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  glassLabel: { fontFamily: 'Poppins_400Regular', fontSize: 9, letterSpacing: 0.6, color: 'rgba(255,255,255,0.75)' },
  glassMain: { fontFamily: 'Poppins_600SemiBold', fontSize: 11.5, lineHeight: 15, color: C.white },
  glassSub: { fontFamily: 'Poppins_400Regular', fontSize: 10.5, lineHeight: 14, color: 'rgba(255,255,255,0.85)' },
  bannerLock: { position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
});
