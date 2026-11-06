/**
 * Satélite — Datos satelitales por huerta.
 *
 * - Selector con las huertas reales del usuario (tabla huertas).
 * - Mapa satelital con el perímetro real y zonas ILUSTRATIVAS estables (services/satZones.ts).
 * - Reportes de la huerta elegida (reportes.huerta_id), su historial y sus índices.
 * Las zonas no llevan índices: los reportes se calculan para toda la huerta.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, ImageBackground, Modal, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { setStatusBarStyle } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Reanimated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';
import {
  Check, ChevronDown, Info, Leaf, Map as MapIcon, Maximize2, Minus, Plus, RefreshCw, Satellite, Sprout, X, Gauge, History,
} from 'lucide-react-native';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { auth } from '../../firebaseConfig';
import { TranslationResource, useLanguage, useTranslations } from '../../context/LanguageContext';
import { listOrchards, type Orchard } from '../../services/orchards';
import {
  countUnassignedReports, listSatelliteReports, MissingHuertaColumnError, type SatelliteReport,
} from '../../services/reports';
import { buildOrchardGeometry, type ZoneId } from '../../services/satZones';
import { INDEX_SPECS, formatIndex, readIndex } from '../../services/indices';
import SatMap from '../../components/SatMap';
import type { SatMapHandle } from '../../components/SatMap.types';
import { ZONE_PALETTE, type SatLayer, type SatMapData } from '../../components/satMapHtml';
import LayerPanel from '../../components/sat/LayerPanel';
import { ClimateGrid, IndexCard, NdviDial, SAT } from '../../components/sat/IndexViews';
import { CSS_EASE_OUT } from '../../components/scan/motion';

const STORE_KEY = 'avotex.satelite.huerta';
const SEG_W = 222;
const SEG_ITEM = (SEG_W - 8) / 3;

const translations: TranslationResource = {
  brand: { es: 'AVOTEX / DATOS SATELITALES', en: 'AVOTEX / SATELLITE DATA' },
  hero: { es: 'Lectura del campo', en: 'Field reading' },
  heroBody: { es: 'La salud de tu cultivo, vista desde el espacio.', en: 'Your crop health, seen from space.' },
  refresh: { es: 'Actualizar datos', en: 'Refresh data' },
  orchard: { es: 'Huerta', en: 'Orchard' },
  change: { es: 'Cambiar huerta', en: 'Change orchard' },
  pickTitle: { es: 'Tus huertas', en: 'Your orchards' },
  close: { es: 'Cerrar', en: 'Close' },
  reportsN: { es: '{count} reportes', en: '{count} reports' },
  report1: { es: '1 reporte', en: '1 report' },
  noReportsShort: { es: 'Sin reportes', en: 'No reports' },
  layerSat: { es: 'Satélite', en: 'Satellite' },
  layerZones: { es: 'Zonas', en: 'Zones' },
  layerHybrid: { es: 'Híbrido', en: 'Hybrid' },
  panelTitle: { es: 'CAPAS', en: 'LAYERS' },
  panelOutline: { es: 'Contorno', en: 'Outline' },
  panelRelief: { es: 'Relieve', en: 'Relief' },
  panelTexture: { es: 'Textura ilustrativa', en: 'Illustrative texture' },
  panelHide: { es: 'Ocultar panel de capas', en: 'Hide layer panel' },
  panelShow: { es: 'Mostrar panel de capas', en: 'Show layer panel' },
  zoomIn: { es: 'Acercar', en: 'Zoom in' },
  zoomOut: { es: 'Alejar', en: 'Zoom out' },
  fit: { es: 'Ver huerta completa', en: 'Fit orchard' },
  illustrative: { es: 'Zonas ilustrativas', en: 'Illustrative zones' },
  zonesHelp: { es: 'Subdivisión visual del terreno para explorar tu huerta. No son mediciones: los índices de cada reporte corresponden a toda la huerta.', en: 'A visual subdivision to explore your orchard. They are not measurements: report indices cover the whole orchard.' },
  zone: { es: 'Zona {id}', en: 'Zone {id}' },
  zoneTag: { es: 'Zona ilustrativa', en: 'Illustrative zone' },
  zoneShare: { es: '{pct} % de la huerta', en: '{pct}% of the orchard' },
  zoneBody: { es: 'Esta zona no tiene datos analíticos propios. Úsala como referencia visual para ubicarte en el terreno.', en: 'This zone has no analytics of its own. Use it as a visual reference on the ground.' },
  zonesSelfIntersect: { es: 'El contorno de esta huerta se cruza consigo mismo, así que no se trazaron zonas. Puedes corregirlo en Mapeo.', en: 'This orchard outline crosses itself, so no zones were drawn. You can fix it in Mapping.' },
  zonesTooSmall: { es: 'La huerta es demasiado pequeña para dividirla en zonas.', en: 'The orchard is too small to split into zones.' },
  noOutline: { es: 'Esta huerta no tiene un contorno válido guardado.', en: 'This orchard has no valid saved outline.' },
  mapError: { es: 'No se pudo cargar el mapa. Revisa tu conexión.', en: 'The map could not load. Check your connection.' },
  analysis: { es: 'Análisis satelital', en: 'Satellite analysis' },
  latest: { es: 'Último análisis', en: 'Latest analysis' },
  pastAnalysis: { es: 'Análisis anterior', en: 'Previous analysis' },
  newest: { es: 'MÁS RECIENTE', en: 'LATEST' },
  historic: { es: 'HISTÓRICO', en: 'PAST' },
  vegetation: { es: 'Estado del cultivo', en: 'Crop condition' },
  climate: { es: 'Variables ambientales', en: 'Environmental variables' },
  history: { es: 'Historial de la huerta', en: 'Orchard history' },
  showAll: { es: 'Ver los {count} reportes', en: 'Show all {count} reports' },
  showLess: { es: 'Ver menos', en: 'Show less' },
  scaleNote: { es: 'Los colores son rangos de interpretación generales; varían según el cultivo, su etapa y la temporada.', en: 'Colors are general interpretation ranges; they vary by crop, stage and season.' },
  precipitation: { es: 'Precipitación', en: 'Precipitation' },
  humidity: { es: 'Humedad', en: 'Humidity' },
  clouds: { es: 'Nubosidad', en: 'Cloud cover' },
  wind: { es: 'Viento', en: 'Wind' },
  tempMax: { es: 'Temp. máxima', en: 'Max. temp.' },
  tempMin: { es: 'Temp. mínima', en: 'Min. temp.' },
  emptyTitle: { es: 'Tu huerta está lista para analizarse', en: 'Your orchard is ready to be analyzed' },
  emptyBody: { es: 'Ya puedes explorar su terreno y sus zonas. Los indicadores satelitales aparecerán cuando se genere el primer reporte.', en: 'You can already explore its land and zones. Satellite indicators will appear once the first report is generated.' },
  unassigned: { es: '{count} reportes anteriores todavía no están asociados a una huerta, por eso no aparecen aquí.', en: '{count} older reports are not linked to an orchard yet, so they are not shown here.' },
  unassigned1: { es: '1 reporte anterior todavía no está asociado a una huerta, por eso no aparece aquí.', en: '1 older report is not linked to an orchard yet, so it is not shown here.' },
  reportsError: { es: 'No pudimos cargar los reportes', en: 'We could not load the reports' },
  missingColumnTitle: { es: 'Falta conectar los reportes con las huertas', en: 'Reports are not linked to orchards yet' },
  missingColumnBody: { es: 'Ejecuta la migración 20261106_reportes_huerta.sql en Supabase para ver los reportes de cada huerta.', en: 'Run the 20261106_reportes_huerta.sql migration in Supabase to see each orchard’s reports.' },
  retry: { es: 'Intentar de nuevo', en: 'Try again' },
  orchardsError: { es: 'No pudimos cargar tus huertas', en: 'We could not load your orchards' },
  noOrchardsTitle: { es: 'Registra tu primera huerta', en: 'Register your first orchard' },
  noOrchardsBody: { es: 'Dibuja el contorno de tu huerta en Mapeo y aquí verás su lectura satelital, sus zonas y sus reportes.', en: 'Draw your orchard outline in Mapping to see its satellite reading, zones and reports here.' },
  goMapping: { es: 'Ir a Mapeo', en: 'Go to Mapping' },
  signIn: { es: 'Inicia sesión para ver tus huertas.', en: 'Sign in to see your orchards.' },
  noData: { es: 'Sin dato', en: 'No data' },
};

type OrchardState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; list: Orchard[] };
type ReportState =
  | { huertaId: string; status: 'loading' }
  | { huertaId: string; status: 'error'; message: string; missingColumn: boolean }
  | { huertaId: string; status: 'ready'; list: SatelliteReport[] };

const tick = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };

function formatArea(m2: number, lang: 'es' | 'en') {
  if (!Number.isFinite(m2) || m2 <= 0) return '—';
  if (m2 < 1000) return `${Math.round(m2).toLocaleString(lang === 'en' ? 'en-US' : 'es-MX')} m²`;
  return `${(m2 / 10000).toFixed(2)} ha`;
}

/** Contorno real de la huerta en miniatura. */
function MiniShape({ coordinates, size, id }: { coordinates: unknown; size: number; id: string }) {
  const pts = useMemo(() => {
    const g = buildOrchardGeometry(coordinates, id);
    if (!g.ok) return null;
    const o = g.outline;
    const k = Math.cos((o[0].lat * Math.PI) / 180);
    const xs = o.map(p => p.lng * k), ys = o.map(p => p.lat);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY) || 1;
    const pad = 6, sc = (size - pad * 2) / span;
    const ox = (size - (maxX - minX) * sc) / 2, oy = (size - (maxY - minY) * sc) / 2;
    return o.map(p => `${(ox + (p.lng * k - minX) * sc).toFixed(1)},${(oy + (maxY - p.lat) * sc).toFixed(1)}`).join(' ');
  }, [coordinates, size, id]);
  return (
    <View style={[s.mini, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {pts ? <Polygon points={pts} fill="rgba(163,230,53,0.3)" stroke="#D8F36B" strokeWidth={1.6} strokeLinejoin="round" /> : null}
      </Svg>
    </View>
  );
}

function StateCard({ icon, title, body, action }: { icon: React.ReactNode; title: string; body?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={s.stateCard}>
      <View style={s.stateIcon}>{icon}</View>
      <Text style={s.stateTitle}>{title}</Text>
      {body ? <Text style={s.stateBody}>{body}</Text> : null}
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" style={({ pressed }) => [s.stateBtn, pressed && s.pressed]}>
          <Text style={s.stateBtnText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Skeleton({ h, w = '100%', r = 14, style }: { h: number; w?: number | `${number}%`; r?: number; style?: object }) {
  return <View style={[{ height: h, width: w, borderRadius: r, backgroundColor: 'rgba(206,232,171,0.1)' }, style]} />;
}

export default function SateliteScreen() {
  const t = useTranslations(translations);
  const { language, locale } = useLanguage();
  const lang = language === 'en' ? 'en' : 'es';
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const isTablet = width >= 768;
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });

  const email = auth.currentUser?.email ?? null;
  const [orchards, setOrchards] = useState<OrchardState>({ status: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportState | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [unassigned, setUnassigned] = useState<number | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [layer, setLayer] = useState<SatLayer>('zonas');
  const [zone, setZone] = useState<ZoneId | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [allHistory, setAllHistory] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const mapRef = useRef<SatMapHandle>(null);
  const reportReq = useRef(0);

  useFocusEffect(useCallback(() => {
    setStatusBarStyle('light');
    return () => setStatusBarStyle('dark');
  }, []));

  // ── Huertas ──
  const loadOrchards = useCallback(async (silent: boolean) => {
    if (!email) { setOrchards({ status: 'error', message: 'auth' }); return; }
    if (!silent) setOrchards({ status: 'loading' });
    try {
      const list = await listOrchards(email);
      setOrchards({ status: 'ready', list });
      const stored = await AsyncStorage.getItem(STORE_KEY).catch(() => null);
      setSelectedId(prev => {
        if (prev && list.some(o => o.id === prev)) return prev;
        if (stored && list.some(o => o.id === stored)) return stored;
        return list[0]?.id ?? null;
      });
    } catch (e: any) {
      if (!silent) setOrchards({ status: 'error', message: e?.message ?? '' });
    }
  }, [email]);

  const firstFocus = useRef(true);
  useFocusEffect(useCallback(() => {
    // Al volver a la pestaña se actualiza en segundo plano, sin vaciar la pantalla.
    void loadOrchards(!firstFocus.current);
    firstFocus.current = false;
  }, [loadOrchards]));

  const orchard = orchards.status === 'ready' ? orchards.list.find(o => o.id === selectedId) ?? null : null;

  // ── Reportes de la huerta elegida ──
  useEffect(() => {
    if (!email || !selectedId) return;
    const req = ++reportReq.current;
    setReports(prev => (prev && prev.huertaId === selectedId && prev.status === 'ready' && reloadTick > 0 ? prev : { huertaId: selectedId, status: 'loading' }));
    listSatelliteReports(email, selectedId)
      .then(list => {
        if (req !== reportReq.current) return;
        setReports({ huertaId: selectedId, status: 'ready', list });
        setSelectedReportId(prev => (prev && list.some(r => r.id === prev) ? prev : list[0]?.id ?? null));
      })
      .catch((e: unknown) => {
        if (req !== reportReq.current) return;
        const missingColumn = e instanceof MissingHuertaColumnError;
        setReports({ huertaId: selectedId, status: 'error', missingColumn, message: missingColumn ? '' : String((e as { message?: string })?.message ?? '') });
      })
      .finally(() => { if (req === reportReq.current) setRefreshing(false); });
  }, [email, selectedId, reloadTick]);

  useEffect(() => {
    if (!email) return;
    countUnassignedReports(email).then(setUnassigned).catch(() => setUnassigned(null));
  }, [email, reloadTick]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void loadOrchards(true);
    setReloadTick(n => n + 1);
    if (!selectedId) setRefreshing(false);
  }, [loadOrchards, selectedId]);

  const chooseOrchard = useCallback((id: string) => {
    tick();
    setPickerOpen(false);
    if (id === selectedId) return;
    setZone(null);
    setAllHistory(false);
    setSelectedReportId(null);
    setReports({ huertaId: id, status: 'loading' });
    setSelectedId(id);
    AsyncStorage.setItem(STORE_KEY, id).catch(() => {});
  }, [selectedId]);

  // ── Geometría y mapa ──
  const geometry = useMemo(() => (orchard ? buildOrchardGeometry(orchard.coordinates, orchard.id) : null), [orchard]);
  const areaM2 = orchard && orchard.area_m2 > 0 ? orchard.area_m2 : geometry && geometry.ok ? geometry.areaM2 : 0;
  const zones = geometry && geometry.ok ? geometry.zones : [];

  const mapH = isTablet ? 600 : Math.round(Math.min(600, Math.max(470, width * 1.32)));
  // Panel de capas en columna a la izquierda, como la referencia.
  const panelWidth = isTablet ? 168 : 112;
  const mapPad = { top: 52, right: 50, bottom: 14, left: panelOpen ? panelWidth + 14 : 14 };
  const mapData = useMemo<SatMapData | null>(() => {
    if (!orchard || !geometry || !geometry.ok) return null;
    return {
      key: orchard.id,
      outline: geometry.outline,
      zones: geometry.zones.map(z => ({ id: z.id, color: z.color, ring: z.ring, label: z.label, rows: z.rows, areaText: formatArea((z.share / 100) * areaM2, lang) })),
      marks: geometry.marks,
      pad: mapPad,
      reduced,
    };
  }, [orchard, geometry, areaM2, lang, mapPad.top, mapPad.right, mapPad.bottom, mapPad.left, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeLayer = useCallback((l: SatLayer) => {
    if (l === layer) return;
    tick();
    setLayer(l);
    if (l === 'satelite') setZone(null);
  }, [layer]);

  const selectZone = useCallback((id: ZoneId | null) => {
    const next = zone === id ? null : id;
    if (next) tick();
    setZone(next);
    if (next) setLayer(l => (l === 'satelite' ? 'zonas' : l));
  }, [zone]);
  const clearZoneFromMap = useCallback((id: ZoneId | null) => { if (id === null) setZone(null); else selectZone(id); }, [selectZone]);

  if (!fontsLoaded) return null;

  const ready = orchards.status === 'ready';
  const reportList = reports && reports.huertaId === selectedId && reports.status === 'ready' ? reports.list : null;
  const report = reportList?.find(r => r.id === selectedReportId) ?? reportList?.[0] ?? null;
  const reportIdx = report && reportList ? reportList.indexOf(report) : -1;
  const zoneObj = zones.find(z => z.id === zone) ?? null;
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' });
  const shortFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
  const enter = (delay = 0) => (reduced ? undefined : FadeInDown.duration(260).delay(delay));
  const bottomPad = (isTablet ? 82 + 24 : 72 + 18) + insets.bottom + 28;
  const layers: { key: SatLayer; label: string }[] = [
    { key: 'satelite', label: t('layerSat') },
    { key: 'zonas', label: t('layerZones') },
    { key: 'hibrido', label: t('layerHybrid') },
  ];
  const layerIdx = layers.findIndex(l => l.key === layer);
  const historyShown = reportList ? (allHistory ? reportList : reportList.slice(0, 5)) : [];

  return (
    <View style={s.root}>
      <ImageBackground source={require('../../assets/images/satellite-fields.jpg')} style={StyleSheet.absoluteFill} resizeMode="cover">
        <LinearGradient colors={['rgba(7,27,20,0.88)', 'rgba(9,36,26,0.8)', 'rgba(7,24,18,0.97)']} locations={[0, 0.35, 0.75]} style={StyleSheet.absoluteFill} />
      </ImageBackground>

      <ScrollView
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[{ paddingBottom: bottomPad }, isTablet && { alignItems: 'center' }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={SAT.lime} colors={['#65A30D']} />}
      >
        <View style={[s.content, isTablet && s.contentTablet]}>
          {/* Encabezado */}
          <View style={[s.topbar, { paddingTop: insets.top + 10 }]}>
            <View style={s.brand}>
              <Satellite size={17} color={SAT.lime} />
              <Text style={s.brandText} numberOfLines={1}>{t('brand')}</Text>
            </View>
            <Pressable
              onPress={refresh}
              disabled={refreshing}
              accessibilityRole="button"
              accessibilityLabel={t('refresh')}
              hitSlop={6}
              style={({ pressed }) => [s.iconBtn, pressed && s.pressed]}
            >
              {refreshing ? <ActivityIndicator size="small" color={SAT.lime} /> : <RefreshCw size={17} color={SAT.lime} />}
            </Pressable>
          </View>
          <View style={s.hero}>
            <Text style={[s.heroTitle, isTablet && { fontSize: 40, lineHeight: 48 }]}>{t('hero')}</Text>
            <Text style={s.heroBody}>{t('heroBody')}</Text>
          </View>

          {/* Estados de huertas */}
          {orchards.status === 'loading' && (
            <View style={s.pad}>
              <Skeleton h={64} r={18} />
              <Skeleton h={mapH} r={24} style={{ marginTop: 14 }} />
            </View>
          )}
          {orchards.status === 'error' && (
            <View style={s.pad}>
              {orchards.message === 'auth'
                ? <StateCard icon={<Satellite size={24} color={SAT.lime} />} title={t('signIn')} />
                : <StateCard icon={<Satellite size={24} color={SAT.lime} />} title={t('orchardsError')} body={orchards.message} action={{ label: t('retry'), onPress: () => void loadOrchards(false) }} />}
            </View>
          )}
          {ready && orchards.list.length === 0 && (
            <View style={s.pad}>
              <StateCard
                icon={<MapIcon size={24} color={SAT.lime} />}
                title={t('noOrchardsTitle')}
                body={t('noOrchardsBody')}
                action={{ label: t('goMapping'), onPress: () => router.push('/(app)/mapping') }}
              />
            </View>
          )}

          {ready && orchard && (
            <>
              {/* Selector de huerta */}
              <View style={s.pad}>
                <Pressable
                  onPress={() => setPickerOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('change')}: ${orchard.nombre}`}
                  style={({ pressed }) => [s.selector, pressed && s.pressed]}
                >
                  <MiniShape coordinates={orchard.coordinates} size={44} id={orchard.id} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.selectorKicker}>{t('orchard').toUpperCase()}</Text>
                    <Text style={s.selectorName} numberOfLines={1}>{orchard.nombre}</Text>
                    <Text style={s.selectorMeta} numberOfLines={1}>
                      {formatArea(areaM2, lang)}
                      {reportList ? `  ·  ${reportList.length === 0 ? t('noReportsShort') : reportList.length === 1 ? t('report1') : t('reportsN', { count: reportList.length })}` : ''}
                    </Text>
                  </View>
                  <View style={s.selectorChevron}><ChevronDown size={18} color="#0B1F17" /></View>
                </Pressable>
              </View>

              {/* Mapa */}
              <View style={s.pad}>
                <View
                  style={[s.mapCard, { height: mapH }]}
                  onTouchStart={() => setScrollEnabled(false)}
                  onTouchEnd={() => setScrollEnabled(true)}
                  onTouchCancel={() => setScrollEnabled(true)}
                >
                  {mapData && !mapFailed ? (
                    <SatMap ref={mapRef} data={mapData} layer={layer} selectedZone={zone} onSelectZone={clearZoneFromMap} onError={() => setMapFailed(true)} />
                  ) : (
                    <View style={s.mapFallback}>
                      <MapIcon size={26} color={SAT.muted} />
                      <Text style={s.mapFallbackText}>{mapFailed ? t('mapError') : t('noOutline')}</Text>
                    </View>
                  )}

                  {mapData && !mapFailed && (
                    <>
                      {/* Capas */}
                      <View style={s.segment} accessibilityRole="tablist">
                        <Reanimated.View
                          style={[s.segmentPill, {
                            left: 3 + layerIdx * SEG_ITEM,
                            transitionProperty: reduced ? 'none' : 'left',
                            transitionDuration: 200,
                            transitionTimingFunction: CSS_EASE_OUT,
                          } as object]}
                        />
                        {layers.map(l => (
                          <Pressable
                            key={l.key}
                            onPress={() => changeLayer(l.key)}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: layer === l.key }}
                            style={s.segmentBtn}
                            hitSlop={{ top: 6, bottom: 6 }}
                          >
                            <Text style={[s.segmentText, layer === l.key && s.segmentTextOn]} numberOfLines={1}>{l.label}</Text>
                          </Pressable>
                        ))}
                      </View>

                      <View style={s.panelSlot}>
                        <LayerPanel
                          open={panelOpen}
                          onToggle={() => { tick(); setPanelOpen(o => !o); }}
                          layer={layer}
                          onLayer={changeLayer}
                          outline={geometry && geometry.ok ? geometry.outline : []}
                          zones={zones}
                          seed={orchard.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)}
                          reduced={reduced}
                          width={panelWidth}
                          labels={{ zones: t('layerZones'), outline: t('panelOutline'), relief: t('panelRelief'), texture: t('panelTexture'), hide: t('panelHide'), show: t('panelShow') }}
                        />
                      </View>

                      <View style={s.zoomCol}>
                        <Pressable onPress={() => mapRef.current?.zoom(1)} accessibilityRole="button" accessibilityLabel={t('zoomIn')} style={({ pressed }) => [s.zoomBtn, pressed && s.pressed]}><Plus size={17} color="#0B1F17" /></Pressable>
                        <Pressable onPress={() => mapRef.current?.zoom(-1)} accessibilityRole="button" accessibilityLabel={t('zoomOut')} style={({ pressed }) => [s.zoomBtn, pressed && s.pressed]}><Minus size={17} color="#0B1F17" /></Pressable>
                        <Pressable onPress={() => mapRef.current?.fit()} accessibilityRole="button" accessibilityLabel={t('fit')} style={({ pressed }) => [s.zoomBtn, pressed && s.pressed]}><Maximize2 size={15} color="#0B1F17" /></Pressable>
                      </View>

                      {isTablet && layer !== 'satelite' && zones.length > 0 && (
                        <View style={s.mapNote} pointerEvents="none">
                          <Info size={11} color="#E8F5D0" />
                          <Text style={s.mapNoteText}>{t('illustrative')}</Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
              </View>

              {/* Zonas */}
              <View style={s.pad}>
                {geometry && geometry.ok && geometry.zonesNote ? (
                  <View style={s.notice}>
                    <Info size={14} color={SAT.soft} />
                    <Text style={s.noticeText}>{geometry.zonesNote === 'self-intersecting' ? t('zonesSelfIntersect') : t('zonesTooSmall')}</Text>
                  </View>
                ) : zones.length > 0 ? (
                  <>
                    <View style={s.zonesHead}>
                      <Info size={13} color={SAT.soft} />
                      <Text style={s.zonesHeadText}>{t('illustrative')}</Text>
                    </View>
                    <View style={s.zoneChips}>
                      {zones.map(z => {
                        const on = zone === z.id;
                        const pal = ZONE_PALETTE[z.color];
                        return (
                          <Pressable
                            key={z.id}
                            onPress={() => selectZone(z.id)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on }}
                            accessibilityLabel={`${t('zone', { id: z.id })}, ${formatArea((z.share / 100) * areaM2, lang)}`}
                            style={({ pressed }) => [s.zoneChip, on && { borderColor: pal.line, backgroundColor: 'rgba(255,255,255,0.08)' }, pressed && s.pressed]}
                          >
                            <View style={[s.zoneSwatch, { backgroundColor: pal.label }]} />
                            <View style={{ minWidth: 0 }}>
                              <Text style={s.zoneChipName} numberOfLines={1}>{t('zone', { id: z.id })}</Text>
                              <Text style={s.zoneChipArea} numberOfLines={1}>{formatArea((z.share / 100) * areaM2, lang)}</Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                    {zoneObj ? (
                      <Reanimated.View key={zoneObj.id} entering={reduced ? undefined : FadeIn.duration(180)} exiting={reduced ? undefined : FadeOut.duration(120)} style={[s.zoneCard, { borderColor: ZONE_PALETTE[zoneObj.color].line }]}>
                        <View style={s.zoneCardTop}>
                          <View style={[s.zoneBadge, { backgroundColor: ZONE_PALETTE[zoneObj.color].label }]}>
                            <Text style={[s.zoneBadgeText, { color: ZONE_PALETTE[zoneObj.color].ink }]}>{t('zone', { id: zoneObj.id })}</Text>
                          </View>
                          <Text style={s.zoneTag}>{t('zoneTag')}</Text>
                          <Pressable onPress={() => setZone(null)} accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={10} style={s.zoneClose}>
                            <X size={15} color={SAT.soft} />
                          </Pressable>
                        </View>
                        <View style={s.zoneStats}>
                          <Text style={s.zoneArea}>{formatArea((zoneObj.share / 100) * areaM2, lang)}</Text>
                          <Text style={s.zoneShare}>{t('zoneShare', { pct: zoneObj.share.toFixed(0) })}</Text>
                        </View>
                        <Text style={s.zoneBody}>{t('zoneBody')}</Text>
                      </Reanimated.View>
                    ) : (
                      <Text style={s.zonesHelp}>{t('zonesHelp')}</Text>
                    )}
                  </>
                ) : null}
              </View>

              {/* Análisis */}
              <View style={[s.pad, { marginTop: 8 }]}>
                <View style={s.sectionRow}>
                  <Gauge size={15} color={SAT.lime} />
                  <Text style={s.sectionTitle}>{t('analysis')}</Text>
                  <View style={s.sectionLine} />
                </View>

                {(!reports || reports.huertaId !== selectedId || reports.status === 'loading') && (
                  <View style={s.card}>
                    <Skeleton h={18} w={160} r={6} />
                    <Skeleton h={160} r={16} style={{ marginTop: 14 }} />
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <Skeleton h={110} w="48%" /><Skeleton h={110} w="48%" />
                    </View>
                  </View>
                )}

                {reports && reports.huertaId === selectedId && reports.status === 'error' && (
                  reports.missingColumn
                    ? <StateCard icon={<Info size={24} color={SAT.amber} />} title={t('missingColumnTitle')} body={t('missingColumnBody')} action={{ label: t('retry'), onPress: refresh }} />
                    : <StateCard icon={<Satellite size={24} color={SAT.lime} />} title={t('reportsError')} body={reports.message} action={{ label: t('retry'), onPress: refresh }} />
                )}

                {reportList && reportList.length === 0 && (
                  <Reanimated.View entering={enter()} style={s.emptyCard}>
                    <View style={s.emptyIcon}><Sprout size={26} color={SAT.lime} /></View>
                    <Text style={s.emptyTitle}>{t('emptyTitle')}</Text>
                    <Text style={s.emptyBody}>{t('emptyBody')}</Text>
                  </Reanimated.View>
                )}

                {report && reportList && (
                  <Reanimated.View key={`${selectedId}:${report.id}`} entering={enter()} style={s.card}>
                    <View style={s.reportHead}>
                      <View style={s.reportIcon}><Satellite size={18} color={SAT.lime} /></View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.reportTitle}>{reportIdx === 0 ? t('latest') : t('pastAnalysis')}</Text>
                        <Text style={s.reportDate}>{dateFmt.format(new Date(report.created_at))}</Text>
                      </View>
                      <View style={[s.badge, reportIdx !== 0 && s.badgePast]}>
                        <Text style={[s.badgeText, reportIdx !== 0 && { color: SAT.soft }]}>{reportIdx === 0 ? t('newest') : t('historic')}</Text>
                      </View>
                    </View>

                    <View style={s.subRow}><Leaf size={13} color={SAT.lime} /><Text style={s.subTitle}>{t('vegetation')}</Text><View style={s.sectionLine} /></View>
                    <Reanimated.View entering={enter(40)}><NdviDial value={report.ndvi} lang={lang} /></Reanimated.View>
                    <View style={s.indexGrid}>
                      {(['ndre', 'msavi', 'reci', 'ndmi'] as const).map((k, i) => (
                        <Reanimated.View key={k} entering={enter(80 + i * 40)} style={s.indexCell}>
                          <IndexCard k={k} value={report[k]} lang={lang} reduced={reduced} />
                        </Reanimated.View>
                      ))}
                    </View>
                    <Text style={s.scaleNote}>{t('scaleNote')}</Text>

                    <View style={s.subRow}><Gauge size={13} color={SAT.soft} /><Text style={s.subTitle}>{t('climate')}</Text><View style={s.sectionLine} /></View>
                    <ClimateGrid report={report} lang={lang} labels={{ precipitation: t('precipitation'), humidity: t('humidity'), clouds: t('clouds'), wind: t('wind'), tempMax: t('tempMax'), tempMin: t('tempMin') }} />
                  </Reanimated.View>
                )}

                {reportList && reportList.length > 0 && (
                  <View style={[s.card, { marginTop: 12 }]}>
                    <View style={[s.subRow, { marginTop: 0 }]}><History size={13} color={SAT.lime} /><Text style={s.subTitle}>{t('history')}</Text><View style={s.sectionLine} /></View>
                    {historyShown.map((r, i) => {
                      const on = r.id === report?.id;
                      const nd = readIndex(INDEX_SPECS.ndvi, r.ndvi);
                      return (
                        <Pressable
                          key={r.id}
                          onPress={() => { if (!on) { tick(); setSelectedReportId(r.id); } }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          style={({ pressed }) => [s.histRow, i > 0 && s.histSep, on && s.histOn, pressed && s.pressed]}
                        >
                          <View style={[s.histDot, on && { backgroundColor: SAT.lime }]} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={s.histDate} numberOfLines={1}>{shortFmt.format(new Date(r.created_at))}</Text>
                            <Text style={s.histTime}>{timeFmt.format(new Date(r.created_at))}{i === 0 ? `  ·  ${t('newest')}` : ''}</Text>
                          </View>
                          <View style={s.histVal}>
                            <Text style={s.histValLabel}>NDVI</Text>
                            <Text style={[s.histValText, nd.kind === 'invalid' && { color: SAT.amber }, nd.kind === 'missing' && { color: SAT.muted, fontSize: 11 }]}>
                              {nd.kind === 'missing' ? t('noData') : formatIndex(INDEX_SPECS.ndvi, nd.value)}
                            </Text>
                          </View>
                          {on ? <Check size={15} color={SAT.lime} /> : <View style={{ width: 15 }} />}
                        </Pressable>
                      );
                    })}
                    {reportList.length > 5 && (
                      <Pressable onPress={() => setAllHistory(v => !v)} accessibilityRole="button" style={({ pressed }) => [s.moreBtn, pressed && s.pressed]}>
                        <Text style={s.moreText}>{allHistory ? t('showLess') : t('showAll', { count: reportList.length })}</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {unassigned !== null && unassigned > 0 && reports?.status !== 'error' && (
                  <View style={[s.notice, { marginTop: 12 }]}>
                    <Info size={14} color={SAT.soft} />
                    <Text style={s.noticeText}>{unassigned === 1 ? t('unassigned1') : t('unassigned', { count: unassigned })}</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Selector de huertas */}
      <Modal visible={pickerOpen} transparent animationType={reduced ? 'fade' : 'slide'} onRequestClose={() => setPickerOpen(false)} statusBarTranslucent>
        <Pressable style={s.backdrop} onPress={() => setPickerOpen(false)} accessibilityLabel={t('close')} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 18 }, isTablet && s.sheetTablet]}>
          <View style={s.grabber} />
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{t('pickTitle')}</Text>
            <Pressable onPress={() => setPickerOpen(false)} accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={10} style={s.sheetClose}>
              <X size={18} color={SAT.soft} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 8 }}>
            {orchards.status === 'ready' && orchards.list.map(o => {
              const on = o.id === selectedId;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => chooseOrchard(o.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [s.pickRow, on && s.pickRowOn, pressed && s.pressed]}
                >
                  <MiniShape coordinates={o.coordinates} size={46} id={o.id} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.pickName} numberOfLines={1}>{o.nombre}</Text>
                    <Text style={s.pickMeta}>{formatArea(o.area_m2, lang)}</Text>
                  </View>
                  {on && <View style={s.pickCheck}><Check size={14} color="#0B1F17" strokeWidth={3} /></View>}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1F17' },
  content: { width: '100%' },
  contentTablet: { maxWidth: 920, paddingHorizontal: 12 },
  pad: { paddingHorizontal: 16 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },

  topbar: { paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  brandText: { flexShrink: 1, color: SAT.lime, fontFamily: 'Poppins_700Bold', fontSize: 10, letterSpacing: 1.4 },
  iconBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,28,22,0.72)', borderWidth: 1, borderColor: 'rgba(216,243,107,0.25)' },
  hero: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18 },
  heroTitle: { color: '#F4F7E8', fontFamily: 'Poppins_700Bold', fontSize: 32, lineHeight: 39, letterSpacing: -1 },
  heroBody: { marginTop: 4, color: '#C0D0BD', fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 19 },

  selector: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 12, borderRadius: 20, backgroundColor: SAT.card, borderWidth: 1, borderColor: 'rgba(216,243,107,0.28)' },
  mini: { borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  selectorKicker: { color: SAT.muted, fontFamily: 'Poppins_600SemiBold', fontSize: 9, letterSpacing: 1.2 },
  selectorName: { color: SAT.ink, fontFamily: 'Poppins_700Bold', fontSize: 16, lineHeight: 21 },
  selectorMeta: { color: SAT.soft, fontFamily: 'Poppins_400Regular', fontSize: 11 },
  selectorChevron: { width: 34, height: 34, borderRadius: 11, backgroundColor: SAT.lime, alignItems: 'center', justifyContent: 'center' },

  mapCard: { marginTop: 14, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0b1f17', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  mapFallbackText: { color: SAT.soft, fontFamily: 'Poppins_400Regular', fontSize: 12, textAlign: 'center' },
  segment: { position: 'absolute', top: 10, right: 10, width: SEG_W, height: 36, flexDirection: 'row', padding: 3, borderRadius: 999, backgroundColor: 'rgba(10,22,17,0.86)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  segmentPill: { position: 'absolute', top: 3, bottom: 3, width: SEG_ITEM, borderRadius: 999, backgroundColor: '#FFFFFF' },
  segmentBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segmentText: { color: '#E2EBE4', fontFamily: 'Poppins_600SemiBold', fontSize: 11 },
  segmentTextOn: { color: '#0B1F17' },
  panelSlot: { position: 'absolute', left: 8, top: 52 },
  panelSlotRow: { position: 'absolute', left: 10, bottom: 10 },
  zoomCol: { position: 'absolute', right: 10, bottom: 10, gap: 6 },
  zoomBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.94)' },
  mapNote: { position: 'absolute', left: 10, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(10,22,17,0.78)' },
  mapNoteText: { color: '#E8F5D0', fontFamily: 'Poppins_600SemiBold', fontSize: 10 },

  zonesHead: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  zonesHeadText: { color: SAT.soft, fontFamily: 'Poppins_600SemiBold', fontSize: 12 },
  zoneChips: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  zoneChip: { flexBasis: '22%', flexGrow: 1, minWidth: 74, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: SAT.card, borderWidth: 1, borderColor: SAT.line },
  zoneSwatch: { width: 12, height: 12, borderRadius: 4 },
  zoneChipName: { color: SAT.ink, fontFamily: 'Poppins_600SemiBold', fontSize: 12 },
  zoneChipArea: { color: SAT.muted, fontFamily: 'Poppins_400Regular', fontSize: 10 },
  zonesHelp: { marginTop: 10, color: SAT.muted, fontFamily: 'Poppins_400Regular', fontSize: 11, lineHeight: 16 },
  zoneCard: { marginTop: 10, padding: 14, borderRadius: 18, backgroundColor: SAT.card, borderWidth: 1 },
  zoneCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoneBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7 },
  zoneBadgeText: { fontFamily: 'Poppins_700Bold', fontSize: 12 },
  zoneTag: { flex: 1, color: SAT.soft, fontFamily: 'Poppins_600SemiBold', fontSize: 11 },
  zoneClose: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  zoneStats: { marginTop: 10, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  zoneArea: { color: SAT.ink, fontFamily: 'Poppins_700Bold', fontSize: 22 },
  zoneShare: { color: SAT.soft, fontFamily: 'Poppins_400Regular', fontSize: 12 },
  zoneBody: { marginTop: 4, color: SAT.muted, fontFamily: 'Poppins_400Regular', fontSize: 11, lineHeight: 16 },

  sectionRow: { marginTop: 18, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: SAT.ink, fontFamily: 'Poppins_700Bold', fontSize: 15 },
  sectionLine: { flex: 1, height: 1, backgroundColor: SAT.line },
  card: { padding: 14, borderRadius: 22, backgroundColor: SAT.card, borderWidth: 1, borderColor: SAT.line },
  reportHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reportIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(216,243,107,0.14)' },
  reportTitle: { color: SAT.ink, fontFamily: 'Poppins_700Bold', fontSize: 15 },
  reportDate: { color: SAT.muted, fontFamily: 'Poppins_400Regular', fontSize: 11 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(216,243,107,0.15)' },
  badgePast: { backgroundColor: 'rgba(255,255,255,0.07)' },
  badgeText: { color: SAT.lime, fontFamily: 'Poppins_700Bold', fontSize: 9, letterSpacing: 0.8 },
  subRow: { marginTop: 18, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  subTitle: { color: SAT.soft, fontFamily: 'Poppins_600SemiBold', fontSize: 12 },
  indexGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  indexCell: { flexBasis: '47%', flexGrow: 1, minWidth: 140 },
  scaleNote: { marginTop: 10, color: SAT.muted, fontFamily: 'Poppins_400Regular', fontSize: 10, lineHeight: 14 },

  histRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: 'transparent' },
  histSep: { marginTop: 4 },
  histOn: { borderColor: 'rgba(216,243,107,0.45)', backgroundColor: 'rgba(216,243,107,0.06)' },
  histDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(206,232,171,0.35)' },
  histDate: { color: SAT.ink, fontFamily: 'Poppins_600SemiBold', fontSize: 13 },
  histTime: { color: SAT.muted, fontFamily: 'Poppins_400Regular', fontSize: 10 },
  histVal: { alignItems: 'flex-end' },
  histValLabel: { color: SAT.muted, fontFamily: 'Poppins_400Regular', fontSize: 9 },
  histValText: { color: SAT.ink, fontFamily: 'Poppins_700Bold', fontSize: 14 },
  moreBtn: { marginTop: 8, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  moreText: { color: SAT.lime, fontFamily: 'Poppins_600SemiBold', fontSize: 12 },

  emptyCard: { padding: 24, borderRadius: 22, alignItems: 'center', backgroundColor: SAT.card, borderWidth: 1, borderColor: 'rgba(216,243,107,0.22)' },
  emptyIcon: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(216,243,107,0.14)', marginBottom: 12 },
  emptyTitle: { color: SAT.ink, fontFamily: 'Poppins_700Bold', fontSize: 17, lineHeight: 23, textAlign: 'center' },
  emptyBody: { marginTop: 6, maxWidth: 380, color: SAT.soft, fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  notice: { marginTop: 12, flexDirection: 'row', gap: 8, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: SAT.line },
  noticeText: { flex: 1, color: SAT.soft, fontFamily: 'Poppins_400Regular', fontSize: 11, lineHeight: 16 },

  stateCard: { minHeight: 220, padding: 24, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: SAT.card, borderWidth: 1, borderColor: SAT.line },
  stateIcon: { width: 56, height: 56, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 12, backgroundColor: 'rgba(216,243,107,0.14)' },
  stateTitle: { color: SAT.ink, fontFamily: 'Poppins_700Bold', fontSize: 16, textAlign: 'center' },
  stateBody: { maxWidth: 360, marginTop: 6, color: SAT.soft, fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  stateBtn: { minHeight: 44, marginTop: 16, paddingHorizontal: 20, borderRadius: 13, justifyContent: 'center', backgroundColor: SAT.lime },
  stateBtnText: { color: '#173525', fontFamily: 'Poppins_700Bold', fontSize: 13 },

  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 8, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: '#0F2A20', borderWidth: 1, borderColor: SAT.line },
  sheetTablet: { left: '20%', right: '20%' },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: SAT.ink, fontFamily: 'Poppins_700Bold', fontSize: 17 },
  sheetClose: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'transparent' },
  pickRowOn: { borderColor: 'rgba(216,243,107,0.5)', backgroundColor: 'rgba(216,243,107,0.07)' },
  pickName: { color: SAT.ink, fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
  pickMeta: { color: SAT.muted, fontFamily: 'Poppins_400Regular', fontSize: 11 },
  pickCheck: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: SAT.lime },
});
