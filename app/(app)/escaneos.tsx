/**
 * Mis escaneos — AVOTEX Field Explorer.
 *
 * Datos reales, nada inventado:
 * - Huertas: perímetro real (huertas.coordinates). Capa "Zonas": subdivisión ilustrativa (satZones).
 * - Recorridos: ruta GPS (recorridos.ruta), puntos de captura (recorrido_fotos.lat/lng) y hallazgos
 *   (hallazgos.lat/lng/estado/confianza/miniatura_path). Distancia = suma geodésica de la ruta real.
 * - Fotos individuales (scans): ubicación e imagen solo si existen (migración 20261107).
 * Sin coordenadas → "Ubicación no disponible", nunca una posición inventada.
 *
 * Mapa e historial sincronizados: elegir en uno actualiza el otro. El WebView del mapa no se recrea.
 * Movimiento (animate-expo): panel arrastrable con resorte en el hilo de UI, indicador de pestañas con
 * transición, fundidos cortos en vistas previas, vibración ligera al elegir. Respeta "Reducir movimiento".
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  useWindowDimensions, type ImageSourcePropType,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Reanimated, { FadeIn, FadeInDown, FadeOut, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import Svg, { Path, Polygon } from 'react-native-svg';
import {
  BarChart3, Bug, Calendar, Camera, Check, ChevronDown, ChevronRight, Clock, CloudUpload, Crosshair, Filter, Layers,
  Leaf, Lock, Maximize2, MapPin, Minimize2, Minus, Navigation, Plane, Plus, Route, Search, Video, X,
} from 'lucide-react-native';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { auth as firebaseAuth } from '../../firebaseConfig';
import { supabase } from '../../supabaseConfig';
import { useGuest } from '../../context/GuestContext';
import { localizeDomainLabel, TranslationResource, useLanguage, useTranslations } from '../../context/LanguageContext';
import { listOrchards, Orchard } from '../../services/orchards';
import { Fuente, RecorridoLocal, RecorridoRemoto, listLocal, listRemote, recoverInterrupted, uploadPending } from '../../services/recorridos';
import {
  categoria, cleanRoute, durationMinutes, listRecorridoFotos, listSingleScans, listUserHallazgos, routeMeters, storageImage,
  validCoord, type CategoriaHallazgo, type FotoPunto, type HallazgoMapa, type LatLng, type SingleScan,
} from '../../services/escaneos';
import { buildOrchardGeometry } from '../../services/satZones';
import ScansMap, { type ScansMapEvent, type ScansMapHandle } from '../../components/ScansMap';
import {
  FINDING_COLOR, SCAN_STATUS_COLOR, type ScanStatus, type ScansMapData, type ScansMapDetail, type ScansMapLayer, type ScansMapRouteStyle, type ScansMapShow, SPEED_COLORS, TIME_COLORS,
  type ScansMapZone,
} from '../../components/scansMapHtml';
import BottomSheet from '../../components/escaneos/BottomSheet';
import SatThumb from '../../components/escaneos/SatThumb';
import MapStylePicker from '../../components/escaneos/MapStylePicker';
import TokenRing from '../../components/TokenRing';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CSS_EASE_OUT, EASE_OUT, PressableScale } from '../../components/scan/motion';
import { SCAN } from '../../components/scan/theme';

const auth = firebaseAuth as Auth;
const WORDMARK = require('../../assets/images/escanear/avotex-wordmark.png');

const TEAL = '#0F766E';
const LIME_INK = '#3F6212';
const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E8ECEF';
const PANEL = '#FFFFFF';

const MAP_STYLE_KEY = 'avx_mis_escaneos_mapa';

/** Rango de velocidad (km/h, percentiles 10–90) de una ruta con horas por punto; null si no alcanza. */
function speedRangeOf(route: LatLng[]): [number, number] | null {
  const v: number[] = [];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    if (!a.t || !b.t || b.t <= a.t) continue;
    const kmh = (Math.hypot((b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180), (b.lat - a.lat) * 111320) / ((b.t - a.t) / 1000)) * 3.6;
    if (kmh > 0.1 && kmh < 20) v.push(kmh);
  }
  if (v.length < 3) return null;
  v.sort((x, y) => x - y);
  const lo = Math.round(v[Math.floor(v.length * 0.1)] * 10) / 10;
  let hi = Math.round(v[Math.min(v.length - 1, Math.floor(v.length * 0.9))] * 10) / 10;
  if (hi - lo < 0.5) hi = Math.round((lo + 0.5) * 10) / 10;
  return [lo, hi];
}

const T: TranslationResource = {
  title: { es: 'Mis escaneos', en: 'My scans' },
  subtitle: { es: 'Explora tus recorridos y diagnósticos en el mapa', en: 'Explore your walks and diagnoses on the map' },
  search: { es: 'Buscar por huerta, fruto o fecha', en: 'Search by orchard, fruit or date' },
  searchBtn: { es: 'Buscar', en: 'Search' },
  filters: { es: 'Filtrar', en: 'Filter' },
  tokens: { es: 'Tokens: {value}', en: 'Tokens: {value}' },
  orchard: { es: 'Huerta', en: 'Orchard' },
  allOrchards: { es: 'Todas las huertas', en: 'All orchards' },
  noOrchard: { es: 'Sin huerta asignada', en: 'No orchard' },
  pickOrchard: { es: 'Elige una huerta', en: 'Choose an orchard' },
  nScans: { es: '{count} escaneos', en: '{count} scans' },
  nScans1: { es: '1 escaneo', en: '1 scan' },
  nOrchards: { es: '{count} huertas', en: '{count} orchards' },
  nOrchards1: { es: '1 huerta', en: '1 orchard' },
  history: { es: 'Historial', en: 'History' },
  findingsTab: { es: 'Hallazgos ({count})', en: 'Findings ({count})' },
  photosTab: { es: 'Fotos ({count})', en: 'Photos ({count})' },
  recent: { es: 'Historial reciente', en: 'Recent history' },
  records: { es: '{count} registros', en: '{count} records' },
  records1: { es: '1 registro', en: '1 record' },
  type: { es: 'TIPO', en: 'TYPE' },
  status: { es: 'ESTADO', en: 'STATUS' },
  all: { es: 'Todos', en: 'All' },
  walks: { es: 'Recorridos', en: 'Walks' },
  photosOnly: { es: 'Fotos individuales', en: 'Single photos' },
  stListo: { es: 'Completado', en: 'Completed' },
  stProceso: { es: 'Procesando', en: 'Processing' },
  stCola: { es: 'Pendiente', en: 'Pending' },
  stLocal: { es: 'En el celular', en: 'On phone' },
  stError: { es: 'Error', en: 'Error' },
  stUploading: { es: 'Subiendo {done}/{total}', en: 'Uploading {done}/{total}' },
  fltDone: { es: 'Completados', en: 'Completed' },
  fltProgress: { es: 'En proceso', en: 'In progress' },
  fltLocal: { es: 'En el celular', en: 'On phone' },
  fltError: { es: 'Con error', en: 'With error' },
  apply: { es: 'Listo', en: 'Done' },
  clear: { es: 'Limpiar', en: 'Clear' },
  kindWalk: { es: 'Recorrido inteligente', en: 'Smart walk' },
  kindDrone: { es: 'Vuelo de dron', en: 'Drone flight' },
  kindCam: { es: 'Cámara de acción', en: 'Action camera' },
  kindPhoto: { es: 'Escaneo de {fruit}', en: '{fruit} scan' },
  kindPhotoPlain: { es: 'Foto individual', en: 'Single photo' },
  statPhotos: { es: 'Fotos', en: 'Photos' },
  statFindings: { es: 'Hallazgos', en: 'Findings' },
  statRoute: { es: 'Recorrido', en: 'Route' },
  statTime: { es: 'Duración', en: 'Duration' },
  noLocation: { es: 'Ubicación no disponible', en: 'Location unavailable' },
  tapHint: { es: 'Toca un escaneo en el mapa o en el historial.', en: 'Tap a scan on the map or in the history.' },
  viewResults: { es: 'Ver resultados', en: 'View results' },
  viewFinding: { es: 'Ver hallazgo', en: 'View finding' },
  viewActivity: { es: 'Ver en Actividad', en: 'View in Activity' },
  uploadNow: { es: 'Subir ahora', en: 'Upload now' },
  inQueue: { es: 'En cola para análisis', en: 'Queued for analysis' },
  processingNote: { es: 'Analizando… te avisaremos al terminar', en: 'Analyzing… we will notify you' },
  failed: { es: 'El análisis falló; se reintentará', en: 'Analysis failed; it will retry' },
  noFindingsDone: { es: 'El análisis no encontró hallazgos en este recorrido.', en: 'No findings in this walk.' },
  noFindingsYet: { es: 'Los hallazgos aparecerán cuando termine el análisis.', en: 'Findings will appear when the analysis finishes.' },
  noFindingsAll: { es: 'Aún no hay hallazgos en esta selección.', en: 'No findings in this selection yet.' },
  pickWalk: { es: 'Elige un recorrido para ver dónde se tomó cada foto.', en: 'Pick a walk to see where each photo was taken.' },
  noPhotoPoints: { es: 'Este recorrido no guardó GPS en sus fotos.', en: 'This walk saved no GPS on its photos.' },
  photoN: { es: 'Foto {n} de {total}', en: 'Photo {n} of {total}' },
  photoGone: { es: 'La foto original no se conserva tras el análisis', en: 'The original photo is not kept after analysis' },
  confidence: { es: 'Confianza {pct} %', en: 'Confidence {pct}%' },
  catSano: { es: 'Saludable', en: 'Healthy' },
  catEnfermo: { es: 'Posible enfermedad', en: 'Possible disease' },
  catRevisar: { es: 'Revisar · confianza baja', en: 'Review · low confidence' },
  catOtro: { es: 'No es fruto', en: 'Not a fruit' },
  syncTitle: { es: '{count} en el celular sin subir', en: '{count} on this phone, not uploaded' },
  syncing: { es: 'Subiendo…', en: 'Uploading…' },
  offline: { es: 'Sin conexión: se subirán al recuperar la señal.', en: 'Offline: they will upload when back online.' },
  wifiRequired: { es: 'Se subirán con WiFi.', en: 'They will upload on WiFi.' },
  empty: { es: 'Aún no tienes escaneos', en: 'No scans yet' },
  emptyBody: { es: 'Haz un recorrido o una foto desde Escanear y aparecerá aquí, en su ubicación real.', en: 'Do a walk or photo from Scan and it will appear here, at its real location.' },
  goScan: { es: 'Ir a Escanear', en: 'Go to Scan' },
  emptyFilter: { es: 'No hay escaneos con estos filtros.', en: 'No scans match these filters.' },
  loadError: { es: 'No se pudo conectar con el servidor.', en: 'Could not reach the server.' },
  retry: { es: 'Reintentar', en: 'Retry' },
  layerSat: { es: 'Satélite', en: 'Satellite' },
  layerHybrid: { es: 'Híbrido', en: 'Hybrid' },
  layerZones: { es: 'Zonas', en: 'Zones' },
  zonesNote: { es: 'Zonas ilustrativas, no son mediciones', en: 'Illustrative zones, not measurements' },
  layers: { es: 'Capas del mapa', en: 'Map layers' },
  lyRoutes: { es: 'Rutas de recorridos', en: 'Walk routes' },
  lyLayers: { es: 'Capas', en: 'Layers' },
  lgSlow: { es: 'Lento', en: 'Slow' }, lgFast: { es: 'Rápido', en: 'Fast' },
  lgStart: { es: 'Inicio', en: 'Start' }, lgEnd: { es: 'Fin', en: 'End' },
  lgNoTimes: { es: 'Esta ruta no guardó la hora de cada punto', en: 'This route has no time per point' },
  lgHeat: { es: 'Más brillante donde más has caminado', en: 'Brighter where you walked most' },
  lyPhotos: { es: 'Puntos de foto', en: 'Photo points' },
  lyFindings: { es: 'Hallazgos', en: 'Findings' },
  lyOrchards: { es: 'Perímetros de huertas', en: 'Orchard outlines' },
  lyMe: { es: 'Mi ubicación', en: 'My location' },
  center: { es: 'Centrar', en: 'Center' },
  zoomIn: { es: 'Acercar', en: 'Zoom in' },
  zoomOut: { es: 'Alejar', en: 'Zoom out' },
  full: { es: 'Pantalla completa', en: 'Full screen' },
  exitFull: { es: 'Salir de pantalla completa', en: 'Exit full screen' },
  locDenied: { es: 'Activa la ubicación para verte en el mapa.', en: 'Turn on location to see yourself on the map.' },
  close: { es: 'Cerrar', en: 'Close' },
  locked: { es: 'Crea una cuenta para ver tus escaneos en el mapa.', en: 'Create an account to see your scans on the map.' },
  signIn: { es: 'Crear cuenta / Iniciar sesión', en: 'Create account / Sign in' },
};

type Tab = 'history' | 'findings' | 'photos';
type TypeFilter = 'all' | 'walk' | 'photo';
type StatusFilter = 'all' | 'listo' | 'progress' | 'local' | 'error';
type OrchardFilter = 'all' | 'none' | string;
type Kind = 'remoto' | 'local' | 'foto';
type Point = { kind: 'photo' | 'finding'; id: string };

type ScanItem = {
  id: string;
  kind: Kind;
  status: ScanStatus;
  date: string;
  endedAt: string | null;
  fuente: Fuente | 'foto';
  photos: number | null;
  findings: number | null;
  orchardId: string | null;
  route: LatLng[];
  localPhotos: FotoPunto[];
  loc: LatLng | null;
  thumb: ImageSourcePropType | null;
  remoteId?: string;
  localId?: string;
  result?: { fruto: string | null; label: string | null; score: number | null };
};

function remoteStatus(estado: RecorridoRemoto['estado']): ScanStatus {
  return estado === 'listo' ? 'listo' : estado === 'procesando' ? 'proceso' : estado === 'error' ? 'error' : 'cola';
}
const STATUS_INK: Record<ScanStatus, string> = { listo: '#15803D', proceso: '#B45309', cola: '#B45309', local: '#0369A1', error: '#B91C1C' };
const STATUS_BG: Record<ScanStatus, string> = { listo: '#ECFDF3', proceso: '#FFF7ED', cola: '#FFF7ED', local: '#F0F9FF', error: '#FEF2F2' };

const tick = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };
function fmtDistance(m: number): string | null {
  if (!(m > 0)) return null;
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export default function MisEscaneos() {
  const t = useTranslations(T);
  const { language, locale } = useLanguage();
  const { isGuest } = useGuest();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const params = useLocalSearchParams<{ n?: string; focus?: string; point?: string }>();
  const isTablet = width >= 768;

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const email = user?.email ?? '';
  const uid = user?.uid ?? '';
  const [tokens, setTokens] = useState<number | null>(null);
  const [orchards, setOrchards] = useState<Orchard[]>([]);
  const [remotes, setRemotes] = useState<RecorridoRemoto[]>([]);
  const [locals, setLocals] = useState<RecorridoLocal[]>([]);
  const [singles, setSingles] = useState<SingleScan[]>([]);
  const [hallazgos, setHallazgos] = useState<HallazgoMapa[]>([]);
  const [fotosCache, setFotosCache] = useState<Record<string, FotoPunto[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [point, setPoint] = useState<Point | null>(null);
  const [tab, setTab] = useState<Tab>('history');
  // Pantallas bajas: el panel inicia contraído para que el mapa tenga espacio.
  const short = height < 720;
  const [sheetIdx, setSheetIdx] = useState(short ? 0 : 1);
  const [fullscreen, setFullscreen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [orchardFilter, setOrchardFilter] = useState<OrchardFilter>('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [picker, setPicker] = useState<'orchard' | 'filters' | 'layers' | null>(null);
  const [layer, setLayer] = useState<ScansMapLayer>('satelite');
  const [routeStyle, setRouteStyle] = useState<ScansMapRouteStyle>('clasica');
  // Tipo de mapa y estilo de ruta se recuerdan entre visitas.
  const styleLoaded = useRef(false);
  useEffect(() => {
    AsyncStorage.getItem(MAP_STYLE_KEY).then(raw => {
      if (!raw) return;
      try {
        const v = JSON.parse(raw) as { layer?: ScansMapLayer; routeStyle?: ScansMapRouteStyle };
        if (v.layer && ['satelite', 'hibrido', 'estandar', 'topo', 'oscuro', 'zonas'].includes(v.layer)) setLayer(v.layer);
        if (v.routeStyle && ['clasica', 'velocidad', 'tiempo', 'calor'].includes(v.routeStyle)) setRouteStyle(v.routeStyle);
      } catch { /* preferencia dañada: se ignora */ }
    }).catch(() => {}).finally(() => { styleLoaded.current = true; });
  }, []);
  useEffect(() => {
    if (styleLoaded.current) AsyncStorage.setItem(MAP_STYLE_KEY, JSON.stringify({ layer, routeStyle })).catch(() => {});
  }, [layer, routeStyle]);
  const [show, setShow] = useState<ScansMapShow>({ routes: true, photos: true, findings: true, orchards: true });
  const [me, setMe] = useState<LatLng | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cardH, setCardH] = useState(0);
  const [progress, setProgress] = useState<Record<string, { done: number; total: number }>>({});
  const [syncNote, setSyncNote] = useState<'offline' | 'wifi-required' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const mapRef = useRef<ScansMapHandle>(null);
  const listRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const rowY = useRef<Record<string, number>>({});
  const autoScope = useRef<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useFocusEffect(useCallback(() => { setStatusBarStyle('dark'); }, []));

  // ───────── datos ─────────
  const load = useCallback(async () => {
    if (!email) { setLoading(false); return; }
    setLoading(true);
    setLoadError(false);
    let failed = false;
    await recoverInterrupted(email).catch(() => {});
    const [o, r, l, sc, hz, tk] = await Promise.all([
      listOrchards(email).catch(() => { failed = true; return [] as Orchard[]; }),
      listRemote(email, 80).catch(() => { failed = true; return [] as RecorridoRemoto[]; }),
      listLocal(email).catch(() => [] as RecorridoLocal[]),
      uid ? listSingleScans(uid).catch(() => { failed = true; return [] as SingleScan[]; }) : Promise.resolve([] as SingleScan[]),
      listUserHallazgos(email).catch(() => { failed = true; return [] as HallazgoMapa[]; }),
      Promise.resolve(supabase.from('users').select('tokens').eq('user_email', email).maybeSingle())
        .then(({ data }) => (data?.tokens ?? null) as number | null).catch(() => null),
    ]);
    setOrchards(o);
    setRemotes(r);
    setLocals(l.filter(x => x.fotos.length > 0));
    setSingles(sc);
    setHallazgos(hz);
    setTokens(tk);
    setLoadError(failed);
    setLoading(false);
  }, [email, uid]);

  const sync = useCallback(async (force = false) => {
    if (!email || syncing) return;
    setSyncing(true);
    const res = await uploadPending(email, {
      force,
      onProgress: (localId, done, total) => setProgress(p => ({ ...p, [localId]: { done, total } })),
    }).catch(() => 'partial' as const);
    setSyncing(false);
    setProgress({});
    setSyncNote(res === 'offline' || res === 'wifi-required' ? res : null);
    if (res === 'done' || res === 'partial') load();
  }, [email, syncing, load]);

  useFocusEffect(useCallback(() => {
    if (!email || isGuest) return;
    load().then(() => sync(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, isGuest, params.n]));

  // Mientras haya análisis en cola o en proceso, se revisa su estado cada 30 s.
  useEffect(() => {
    if (!email || !remotes.some(r => r.estado === 'pendiente' || r.estado === 'procesando')) return;
    const id = setInterval(() => {
      listRemote(email, 80).then(setRemotes).catch(() => {});
      listUserHallazgos(email).then(setHallazgos).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, [email, remotes]);

  // ───────── modelo unificado ─────────
  const orchardById = useMemo(() => Object.fromEntries(orchards.map(o => [o.id, o])), [orchards]);
  const findingsBy = useMemo(() => {
    const m: Record<string, HallazgoMapa[]> = {};
    for (const h of hallazgos) (m[h.recorrido_id] ??= []).push(h);
    return m;
  }, [hallazgos]);

  const items = useMemo<ScanItem[]>(() => {
    const out: ScanItem[] = [];
    for (const rec of locals) {
      const route = cleanRoute(rec.ruta);
      const pts: FotoPunto[] = rec.fotos.filter(f => validCoord(f.lat, f.lng))
        .map((f, i) => ({ id: f.id, lat: f.lat as number, lng: f.lng as number, orden: i, tomada_at: f.tomadaAt, uri: f.uri || null }));
      const first = rec.fotos.find(f => f.uri);
      out.push({
        id: `local:${rec.localId}`, kind: 'local', status: 'local', date: rec.iniciadoAt, endedAt: rec.terminadoAt, fuente: rec.fuente ?? 'celular',
        photos: rec.fotos.length, findings: null, orchardId: rec.huertaId, route, localPhotos: pts,
        loc: route[0] ?? (pts[0] ? { lat: pts[0].lat, lng: pts[0].lng } : null),
        thumb: first ? { uri: first.uri } : null, localId: rec.localId,
      });
    }
    for (const r of remotes) {
      const route = cleanRoute(r.ruta);
      const hs = findingsBy[r.id] ?? [];
      const geo = hs.find(h => validCoord(h.lat, h.lng));
      const thumbPath = hs.find(h => h.miniatura_path)?.miniatura_path;
      out.push({
        id: `remote:${r.id}`, kind: 'remoto', status: remoteStatus(r.estado), date: r.iniciado_at, endedAt: r.terminado_at, fuente: r.fuente ?? 'celular',
        photos: r.fotos_total, findings: r.estado === 'listo' ? r.hallazgos_total : null, orchardId: r.huerta_id, route, localPhotos: [],
        loc: route[0] ?? (geo ? { lat: geo.lat as number, lng: geo.lng as number } : null),
        thumb: thumbPath ? storageImage(thumbPath) : null, remoteId: r.id,
      });
    }
    singles.forEach((sc, i) => {
      out.push({
        id: `foto:${sc.id ?? `${sc.created_at}:${i}`}`, kind: 'foto', status: 'listo', date: sc.created_at, endedAt: null, fuente: 'foto', photos: 1, findings: null,
        orchardId: sc.huerta_id, route: [], localPhotos: [],
        loc: sc.lat != null && sc.lng != null ? { lat: sc.lat, lng: sc.lng } : null,
        thumb: sc.imagen_path ? storageImage(sc.imagen_path) : null,
        result: { fruto: sc.fruto, label: sc.label, score: sc.score },
      });
    });
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [locals, remotes, singles, findingsBy]);

  const kindText = useCallback((it: ScanItem) => {
    if (it.kind === 'foto') {
      const fruit = it.result?.fruto ? localizeDomainLabel(it.result.fruto, language) : null;
      return fruit ? t('kindPhoto', { fruit: language === 'es' ? fruit.toLowerCase() : fruit }) : t('kindPhotoPlain');
    }
    return it.fuente === 'dron' ? t('kindDrone') : it.fuente === 'camara' ? t('kindCam') : t('kindWalk');
  }, [language, t]);
  const orchardText = useCallback((id: string | null) => (id && orchardById[id]?.nombre) || t('noOrchard'), [orchardById, t]);
  const fmtDate = useCallback((iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }), [locale]);
  const fmtTime = useCallback((iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }), [locale]);
  const scansText = (n: number) => (n === 1 ? t('nScans1') : t('nScans', { count: n }));

  const matchesStatus = (it: ScanItem, f: StatusFilter) =>
    f === 'all' || (f === 'listo' && it.status === 'listo') || (f === 'progress' && (it.status === 'proceso' || it.status === 'cola'))
    || (f === 'local' && it.status === 'local') || (f === 'error' && it.status === 'error');
  const matchesOrchard = (it: ScanItem, f: OrchardFilter) => f === 'all' || (f === 'none' ? !it.orchardId : it.orchardId === f);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(it =>
      (typeFilter === 'all' || (typeFilter === 'photo' ? it.kind === 'foto' : it.kind !== 'foto'))
      && matchesStatus(it, statusFilter) && matchesOrchard(it, orchardFilter)
      && (!q || `${kindText(it)} ${orchardText(it.orchardId)} ${fmtDate(it.date)} ${it.result?.label ?? ''}`.toLowerCase().includes(q)));
  }, [items, typeFilter, statusFilter, orchardFilter, query, kindText, orchardText, fmtDate]);

  const selected = items.find(it => it.id === selectedId) ?? null;
  const selectedFindings = useMemo(() => (selected?.remoteId ? findingsBy[selected.remoteId] ?? [] : []), [selected, findingsBy]);
  const selectedPhotos = useMemo(() => {
    if (!selected) return [];
    return selected.kind === 'local' ? selected.localPhotos : selected.remoteId ? fotosCache[selected.remoteId] ?? [] : [];
  }, [selected, fotosCache]);

  // Puntos de captura del recorrido elegido (una consulta por recorrido, en caché).
  useEffect(() => {
    const rid = selected?.remoteId;
    if (!rid || fotosCache[rid]) return;
    listRecorridoFotos(rid).then(f => setFotosCache(c => ({ ...c, [rid]: f }))).catch(() => setFotosCache(c => ({ ...c, [rid]: [] })));
  }, [selected?.remoteId, fotosCache]);

  // Al abrir o cambiar de huerta/filtros: se elige el escaneo más reciente con ubicación, para que el
  // mapa muestre algo comprensible desde el inicio (como en el boceto). Si el elegido ya no está, se limpia.
  const scopeKey = `${orchardFilter}|${typeFilter}|${statusFilter}`;
  useEffect(() => {
    if (loading) return;
    if (selectedId && !visible.some(v => v.id === selectedId)) { setSelectedId(null); setPoint(null); }
    if (autoScope.current === scopeKey) return;
    autoScope.current = scopeKey;
    const first = visible.find(v => v.kind !== 'foto' && (v.route.length > 1 || v.loc)) ?? visible.find(v => v.loc);
    setSelectedId(first?.id ?? null);
    setPoint(null);
  }, [loading, scopeKey, visible, selectedId]);

  // ───────── geometría del panel y del mapa ─────────
  const peek = selected ? 112 : 100;
  const tabClear = (isTablet ? 82 + 24 : 72 + 18) + 8;
  const snaps = useMemo(() => {
    const full = Math.max(peek + 140, cardH - 8);
    // Intermedio: el mapa conserva ~45 % del área útil de la pantalla (boceto).
    const usable = height - insets.top - tabClear;
    // El mapa conserva ~40 % del área útil y nunca menos de 240 px (lo que ocupan sus controles).
    const mapKeep = Math.max(240, Math.round(usable * (fullscreen ? 0.6 : 0.4)));
    const mid = Math.max(peek + 56, cardH - mapKeep);
    return [peek, Math.min(mid, full - 30), full];
  }, [peek, cardH, height, insets.top, tabClear, fullscreen]);
  const sheetVisible = cardH ? snaps[Math.min(sheetIdx, 2)] : peek;
  const coverH = Math.min(sheetVisible, cardH * 0.72);

  const zones = useMemo<ScansMapZone[]>(() => {
    if (layer !== 'zonas') return [];
    const scope = orchards.filter(o => orchardFilter === 'all' || o.id === orchardFilter);
    return scope.flatMap(o => {
      const g = buildOrchardGeometry(o.coordinates, o.id);
      return g.ok ? g.zones.map(z => ({ key: `${o.id}:${z.id}`, label: `Zona ${z.id}`, color: z.color, ring: z.ring, at: z.label })) : [];
    });
  }, [layer, orchards, orchardFilter]);
  const zonesAvailable = useMemo(() => orchards.some(o => { const g = buildOrchardGeometry(o.coordinates, o.id); return g.ok && g.zones.length > 0; }), [orchards]);

  const mapData = useMemo<ScansMapData>(() => ({
    orchards: orchards
      .filter(o => Array.isArray(o.coordinates) && o.coordinates.length >= 3)
      .map(o => ({ id: o.id, name: o.nombre, points: o.coordinates.filter(c => validCoord(c.latitude, c.longitude)).map(c => ({ lat: c.latitude, lng: c.longitude })) })),
    scans: visible.filter(it => it.loc).map(it => ({ id: it.id, kind: it.kind === 'foto' ? 'foto' : 'recorrido', status: it.status, lat: it.loc!.lat, lng: it.loc!.lng })),
    routes: visible.filter(it => it.route.length > 1).map(it => ({ id: it.id, points: it.route })),
    zones,
    focusOrchard: orchardFilter !== 'all' && orchardFilter !== 'none' ? orchardFilter : null,
    fitKey: `${scopeKey}|${orchards.length}`,
    pad: { top: 52, right: 54, bottom: coverH + 6, left: 12 },
    show,
    reduced,
  }), [orchards, visible, zones, orchardFilter, scopeKey, coverH, show, reduced]);

  const mapDetail = useMemo<ScansMapDetail | null>(() => {
    if (!selected || selected.kind === 'foto') return null;
    const photos = selectedPhotos.map((p, i) => ({ id: p.id, lat: p.lat, lng: p.lng, n: i + 1 }));
    const findings = selectedFindings.filter(h => validCoord(h.lat, h.lng)).map(h => ({ id: h.id, lat: h.lat as number, lng: h.lng as number, cat: categoria(h) }));
    if (selected.route.length < 2 && !photos.length && !findings.length) return null;
    const o = selected.orchardId ? orchardById[selected.orchardId] : null;
    const orchard = (o?.coordinates ?? []).filter(c => validCoord(c.latitude, c.longitude)).map(c => ({ lat: c.latitude, lng: c.longitude }));
    return { id: selected.id, route: selected.route, photos, findings, orchard, speedRange: speedRangeOf(selected.route) };
  }, [selected, selectedPhotos, selectedFindings, orchardById]);

  // ───────── selección (mapa ↔ historial) ─────────
  const select = useCallback((id: string | null) => {
    setPoint(null);
    if (id) tick();
    setSelectedId(id);
    // Desde el historial completo se baja a intermedio para ver el mapa volar al escaneo.
    setSheetIdx(i => (i === 2 ? 1 : i));
  }, []);

  useEffect(() => {
    if (!selectedId || sheetIdx === 0 || tab !== 'history') return;
    const y = rowY.current[selectedId];
    if (y != null) listRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: !reduced });
  }, [selectedId, sheetIdx, tab, reduced]);

  // Abrir con un escaneo concreto y, opcionalmente, un hallazgo resaltado (desde Detalle del hallazgo).
  useEffect(() => {
    if (!params.focus || !items.some(i => i.id === params.focus)) return;
    autoScope.current = scopeKey;
    select(params.focus);
    if (params.point) { const pid = params.point; setTimeout(() => setPoint({ kind: 'finding', id: pid }), 0); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.focus, params.point, params.n, items.length]);

  const openFinding = (id: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/(app)/hallazgo', params: { id, n: String(Date.now()) } });
  };

  const onMapEvent = useCallback((e: ScansMapEvent) => {
    if (e.type === 'select') select(e.id);
    else if (e.type === 'orchard') { if (!selectedId) { tick(); setOrchardFilter(e.id); } }
    else if (e.type === 'point') { tick(); setPoint({ kind: e.kind, id: e.id }); }
    else if (e.type === 'clear') { if (point) setPoint(null); }
  }, [select, selectedId, point]);

  const openResults = (it: ScanItem) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (it.kind === 'remoto' && it.remoteId) router.push({ pathname: '/(app)/recorrido', params: { id: it.remoteId, from: 'escaneos', n: String(Date.now()) } });
    else if (it.kind === 'foto') router.navigate('/(app)/results');
    else sync(true);
  };

  // ───────── ubicación ─────────
  const locate = useCallback(async () => {
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) { setNotice(t('locDenied')); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setTimeout(() => mapRef.current?.flyToUser(), 60);
    } catch {
      setNotice(t('locDenied'));
    }
  }, [t]);
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(p => {
      if (p.granted) Location.getLastKnownPositionAsync().then(pos => { if (pos) setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }); }).catch(() => {});
    }).catch(() => {});
  }, []);
  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(null), 2400); return () => clearTimeout(id); }, [notice]);

  const statusText = (it: ScanItem) => {
    if (it.localId && progress[it.localId]) return t('stUploading', { done: progress[it.localId].done, total: progress[it.localId].total });
    return it.status === 'listo' ? t('stListo') : it.status === 'proceso' ? t('stProceso') : it.status === 'cola' ? t('stCola') : it.status === 'local' ? t('stLocal') : t('stError');
  };
  const catText = (c: CategoriaHallazgo) => (c === 'sano' ? t('catSano') : c === 'enfermo' ? t('catEnfermo') : c === 'revisar' ? t('catRevisar') : t('catOtro'));
  const findingLabel = (h: HallazgoMapa) => (categoria(h) === 'otro' ? t('catOtro') : localizeDomainLabel(h.estado, language) ?? h.estado);

  // ───────── vistas ─────────
  if (isGuest) {
    return (
      <View style={[st.screen, st.center, { paddingTop: insets.top }]}>
        <Lock size={36} color={SCAN.brand} />
        <Text style={st.lockText}>{t('locked')}</Text>
        <PressableScale style={st.lockBtn} onPress={() => router.replace('/(auth)')} accessibilityRole="button">
          <Text style={st.lockBtnText}>{t('signIn')}</Text>
        </PressableScale>
      </View>
    );
  }

  const orchardObj = orchardFilter !== 'all' && orchardFilter !== 'none' ? orchardById[orchardFilter] : null;
  const countFor = (f: OrchardFilter) => items.filter(it => matchesOrchard(it, f)).length;
  const filtersActive = statusFilter !== 'all' || typeFilter !== 'all';
  const fade = reduced ? undefined : FadeIn.duration(180).easing(EASE_OUT);

  // Hallazgos de la pestaña: los del recorrido elegido; sin selección, los de la vista actual.
  const tabFindings = selected?.remoteId ? selectedFindings : hallazgos.filter(h => visible.some(v => v.remoteId === h.recorrido_id));
  const tabPhotos = selected && selected.kind !== 'foto' ? selectedPhotos : [];
  const photoScans = visible.filter(v => v.kind === 'foto');
  const stats = (it: ScanItem) => ({ km: fmtDistance(routeMeters(it.route)), mins: durationMinutes(it.date, it.endedAt) });

  // ── Encabezado ──
  const header = !fullscreen && (
    <View style={[st.header, { paddingTop: insets.top + 4 }]}>
      {!short && <View style={st.brandRow}>
        <Image source={WORDMARK} style={st.wordmark} resizeMode="contain" accessibilityLabel="AVOTEX" />
        {tokens != null && <TokenRing remaining={tokens * 100} email={email} size={36} />}
      </View>}
      <View style={st.titleRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.title} accessibilityRole="header" numberOfLines={1}>{t('title')}</Text>
          <Text style={st.subtitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{t('subtitle')}</Text>
        </View>
        <RoundBtn label={t('searchBtn')} onPress={() => { tick(); if (searchOpen) setQuery(''); setSearchOpen(o => !o); }} active={searchOpen || !!query}>
          {searchOpen ? <X size={18} color={INK} /> : <Search size={18} color={INK} />}
        </RoundBtn>
        <RoundBtn label={t('filters')} onPress={() => { tick(); setPicker('filters'); }} active={filtersActive}>
          <Filter size={17} color={INK} />
          {filtersActive && <View style={st.badge} />}
        </RoundBtn>
      </View>
      {searchOpen && (
        <Reanimated.View entering={fade} style={st.searchBox}>
          <Search size={15} color={MUTED} />
          <TextInput value={query} onChangeText={setQuery} placeholder={t('search')} placeholderTextColor="#94A3B8" style={st.searchInput}
            autoFocus returnKeyType="search" accessibilityLabel={t('search')} />
        </Reanimated.View>
      )}
      <Pressable onPress={() => { tick(); setPicker('orchard'); }} accessibilityRole="button"
        accessibilityLabel={`${t('orchard')}: ${orchardObj?.nombre ?? (orchardFilter === 'none' ? t('noOrchard') : t('allOrchards'))}`}
        style={({ pressed }) => [st.orchardBar, pressed && { opacity: 0.85 }]}>
        <View style={st.leafDot}>{orchardObj ? <OrchardMini orchard={orchardObj} size={20} /> : <Leaf size={15} color={LIME_INK} />}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.orchardName} numberOfLines={1}>
            {orchardObj ? `${t('orchard')}: ${orchardObj.nombre}` : orchardFilter === 'none' ? t('noOrchard') : t('allOrchards')}
          </Text>
          <Text style={st.orchardMeta} numberOfLines={1}>
            {orchardObj && orchardObj.area_m2 > 0 ? `${(orchardObj.area_m2 / 10000).toFixed(2)} ha · `
              : orchardFilter === 'all' ? `${orchards.length === 1 ? t('nOrchards1') : t('nOrchards', { count: orchards.length })} · ` : ''}
            {scansText(countFor(orchardFilter))}
          </Text>
        </View>
        <ChevronDown size={18} color={MUTED} />
      </Pressable>
    </View>
  );

  // ── Cabecera del panel (zona arrastrable): escaneo elegido ──
  const sheetHeader = selected ? (
    <Reanimated.View key={selected.id} entering={fade} style={st.selCard}>
      <Pressable onPress={() => openResults(selected)} accessibilityRole="button"
        accessibilityLabel={`${kindText(selected)}, ${orchardText(selected.orchardId)}, ${t('viewResults')}`}
        style={({ pressed }) => [st.selRow, pressed && { opacity: 0.9 }]}>
        <ItemThumb item={selected} size={64} preferPhoto outline={selected.orchardId ? orchardById[selected.orchardId]?.coordinates : undefined} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <View style={[st.rowCenter, { justifyContent: 'space-between', gap: 6 }]}>
            <TypeChip item={selected} text={kindText(selected)} />
            <StatusChip status={selected.status} text={statusText(selected)} />
          </View>
          <Text style={st.selTitle} numberOfLines={1}>{orchardText(selected.orchardId)}</Text>
          <View style={st.rowCenter}><Calendar size={12} color={MUTED} /><Text style={st.meta} numberOfLines={1}> {fmtDate(selected.date)} · {fmtTime(selected.date)}</Text></View>
          <View style={[st.rowCenter, { gap: 12 }]}>
            {selected.kind !== 'foto' && <Mini icon={<Camera size={12} color={TEAL} />} text={selected.photos != null ? String(selected.photos) : '—'} />}
            {selected.kind !== 'foto' && <Mini icon={<Bug size={12} color={selected.findings ? FINDING_COLOR.enfermo : MUTED} />} text={selected.findings != null ? String(selected.findings) : '—'} />}
            {selected.kind === 'foto' && selected.result?.label && (
              <Mini icon={<View style={[st.dot, { backgroundColor: /sano|saludable|healthy/i.test(selected.result.label) ? FINDING_COLOR.sano : FINDING_COLOR.enfermo }]} />}
                text={`${localizeDomainLabel(selected.result.label, language)}${selected.result.score != null ? ` · ${Math.round(selected.result.score * 100)} %` : ''}`} />
            )}
            {!selected.loc && !mapDetail && <Mini icon={<MapPin size={12} color={MUTED} />} text={t('noLocation')} />}
          </View>
        </View>
        <ChevronRight size={20} color={MUTED} />
      </Pressable>
    </Reanimated.View>
  ) : (
    <View style={st.selCard}>
      <View style={[st.rowCenter, { justifyContent: 'space-between' }]}>
        <Text style={st.sectionTitle}>{items.length || loading ? t('recent') : loadError ? t('loadError') : t('empty')}</Text>
        {!!items.length && <Text style={st.count}>{visible.length === 1 ? t('records1') : t('records', { count: visible.length })}</Text>}
      </View>
      {(items.length > 0 || loading) && <Text style={st.hint} numberOfLines={2}>{t('tapHint')}</Text>}
    </View>
  );

  // ── Contenido del panel ──
  const tabs: { key: Tab; label: string }[] = [
    { key: 'history', label: t('history') },
    { key: 'findings', label: t('findingsTab', { count: tabFindings.length }) },
    { key: 'photos', label: t('photosTab', { count: selected && selected.kind !== 'foto' ? tabPhotos.length : photoScans.length }) },
  ];
  const tabIdx = tabs.findIndex(x => x.key === tab);
  const listBottom = cardH ? Math.max(24, snaps[2] - sheetVisible + 24) : 24;

  const statsBlock = selected && selected.kind !== 'foto' && (() => {
    const { km, mins } = stats(selected);
    return (
      <View style={st.statsBlock}>
        <View style={st.statsRow}>
          <Stat icon={<Camera size={16} color={TEAL} />} value={selected.photos != null ? String(selected.photos) : '—'} label={t('statPhotos')} />
          <View style={st.statSep} />
          <Stat icon={<Bug size={16} color={selected.findings ? FINDING_COLOR.enfermo : MUTED} />} value={selected.findings != null ? String(selected.findings) : '—'} label={t('statFindings')} />
          <View style={st.statSep} />
          <Stat icon={<Route size={16} color={TEAL} />} value={km ?? '—'} label={t('statRoute')} />
          <View style={st.statSep} />
          <Stat icon={<Clock size={16} color={TEAL} />} value={mins != null ? `${mins} min` : '—'} label={t('statTime')} />
        </View>
        {selected.kind === 'remoto' && selected.status === 'listo' ? (
          <Pressable onPress={() => openResults(selected)} accessibilityRole="button" style={({ pressed }) => [st.primary, pressed && st.pressed]}>
            <BarChart3 size={16} color="#fff" />
            <Text style={st.primaryText}>{t('viewResults')}</Text>
          </Pressable>
        ) : selected.kind === 'local' ? (
          <Pressable onPress={() => sync(true)} disabled={syncing} accessibilityRole="button" style={({ pressed }) => [st.primary, { backgroundColor: SCAN.sky }, pressed && st.pressed]}>
            {syncing ? <ActivityIndicator size="small" color="#fff" /> : <CloudUpload size={16} color="#fff" />}
            <Text style={st.primaryText}>{t('uploadNow')}</Text>
          </Pressable>
        ) : (
          <Text style={st.stateNote}>{selected.status === 'error' ? t('failed') : selected.status === 'proceso' ? t('processingNote') : t('inQueue')}</Text>
        )}
      </View>
    );
  })();

  const historyList = (
    <>
      {locals.length > 0 && (
        <View style={st.sync}>
          {syncing ? <ActivityIndicator size="small" color={SCAN.sky} /> : <CloudUpload size={18} color={SCAN.sky} />}
          <View style={{ flex: 1 }}>
            <Text style={st.syncTitle}>{t('syncTitle', { count: locals.length })}</Text>
            {(syncing || syncNote) && <Text style={st.meta}>{syncing ? t('syncing') : syncNote === 'offline' ? t('offline') : t('wifiRequired')}</Text>}
          </View>
          {!syncing && (
            <Pressable onPress={() => sync(true)} accessibilityRole="button" style={({ pressed }) => [st.syncBtn, pressed && st.pressed]}>
              <Text style={st.syncBtnText}>{t('uploadNow')}</Text>
            </Pressable>
          )}
        </View>
      )}
      {loading && !items.length ? <ActivityIndicator color={TEAL} style={{ marginTop: 20 }} /> : null}
      {!loading && !items.length && !loadError && (
        <View style={st.emptyBox}>
          <Text style={st.empty}>{t('emptyBody')}</Text>
          <Pressable onPress={() => router.navigate('/(app)/scan')} accessibilityRole="button" style={({ pressed }) => [st.primary, { alignSelf: 'center', paddingHorizontal: 22 }, pressed && st.pressed]}>
            <Camera size={16} color="#fff" /><Text style={st.primaryText}>{t('goScan')}</Text>
          </Pressable>
        </View>
      )}
      {!!items.length && !visible.length && <Text style={st.empty}>{t('emptyFilter')}</Text>}
      {visible.map((it, i) => {
        const on = it.id === selectedId;
        return (
          <Reanimated.View key={it.id} entering={reduced || i > 10 ? undefined : FadeIn.duration(200).delay(i * 25)}
            onLayout={e => { rowY.current[it.id] = e.nativeEvent.layout.y; }}>
            <Pressable onPress={() => select(it.id)} accessibilityRole="button" accessibilityState={{ selected: on }}
              accessibilityLabel={`${kindText(it)}, ${orchardText(it.orchardId)}, ${fmtDate(it.date)}, ${statusText(it)}`}
              style={({ pressed }) => [st.row, on && st.rowOn, pressed && { opacity: 0.85 }]}>
              <ItemThumb item={it} size={52} outline={it.orchardId ? orchardById[it.orchardId]?.coordinates : undefined} />
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <Text style={st.rowTitle} numberOfLines={1}>{kindText(it)}</Text>
                <Text style={st.meta} numberOfLines={1}>{orchardText(it.orchardId)} · {fmtDate(it.date)}</Text>
                <View style={[st.rowCenter, { gap: 8 }]}>
                  <StatusChip status={it.status} text={statusText(it)} small />
                  {!it.loc && <Text style={st.miniText} numberOfLines={1}>{t('noLocation')}</Text>}
                </View>
                {it.localId && progress[it.localId] && (
                  <View style={st.track}>
                    <Reanimated.View style={[st.fill, {
                      width: `${(progress[it.localId].done / Math.max(1, progress[it.localId].total)) * 100}%`,
                      transitionProperty: 'width', transitionDuration: 300, transitionTimingFunction: CSS_EASE_OUT,
                    } as object]} />
                  </View>
                )}
              </View>
              <View style={st.rowCounts}>
                {it.kind !== 'foto' && it.photos != null && <Mini icon={<Camera size={12} color={MUTED} />} text={String(it.photos)} />}
                {it.findings != null && <Mini icon={<Bug size={12} color={it.findings ? FINDING_COLOR.enfermo : MUTED} />} text={String(it.findings)} />}
              </View>
              <Pressable onPress={() => openResults(it)} hitSlop={8} accessibilityRole="button"
                accessibilityLabel={it.kind === 'local' ? t('uploadNow') : it.kind === 'foto' ? t('viewActivity') : t('viewResults')}
                style={({ pressed }) => [st.rowChevron, pressed && st.pressed]}>
                {it.kind === 'local' ? <CloudUpload size={16} color={INK} /> : <ChevronRight size={18} color={INK} />}
              </Pressable>
            </Pressable>
          </Reanimated.View>
        );
      })}
    </>
  );

  const findingsList = tabFindings.length ? tabFindings.map(h => {
    const c = categoria(h);
    const on = point?.kind === 'finding' && point.id === h.id;
    const geo = validCoord(h.lat, h.lng);
    const parent = items.find(v => v.remoteId === h.recorrido_id);
    return (
      <Pressable key={h.id}
        onPress={() => {
          tick();
          if (parent && parent.id !== selectedId) setSelectedId(parent.id);
          setPoint({ kind: 'finding', id: h.id });
          if (geo) setSheetIdx(i => (i === 2 ? 1 : i));
        }}
        accessibilityRole="button" accessibilityState={{ selected: on }}
        accessibilityLabel={`${findingLabel(h)}, ${catText(c)}, ${t('confidence', { pct: Math.round(h.confianza * 100) })}`}
        style={({ pressed }) => [st.row, on && st.rowOn, pressed && { opacity: 0.85 }]}>
        <View style={st.fThumb}>
          {h.miniatura_path ? <Image source={storageImage(h.miniatura_path)} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Bug size={20} color={FINDING_COLOR[c]} />}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <View style={[st.rowCenter, { gap: 6 }]}>
            <FindingGlyph cat={c} />
            <Text style={st.rowTitle} numberOfLines={1}>{findingLabel(h)}</Text>
          </View>
          <Text style={st.meta} numberOfLines={1}>{catText(c)} · {t('confidence', { pct: Math.round(h.confianza * 100) })}</Text>
          <Text style={st.miniText} numberOfLines={1}>
            {localizeDomainLabel(h.fruto, language)} · {fmtDate(h.tomada_at)} {fmtTime(h.tomada_at)}{geo ? '' : ` · ${t('noLocation')}`}
          </Text>
        </View>
        {parent?.kind === 'remoto' && (
          <Pressable onPress={() => openFinding(h.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('viewFinding')} style={({ pressed }) => [st.rowChevron, pressed && st.pressed]}>
            <ChevronRight size={18} color={INK} />
          </Pressable>
        )}
      </Pressable>
    );
  }) : (
    <Text style={st.empty}>{selected ? (selected.status === 'listo' ? t('noFindingsDone') : t('noFindingsYet')) : t('noFindingsAll')}</Text>
  );

  const photosList = selected && selected.kind !== 'foto' ? (
    tabPhotos.length ? (
      <>
        {!tabPhotos.some(p => p.uri) && <Text style={st.photoNote}>{t('photoGone')}.</Text>}
        {tabPhotos.map((p, i) => {
          const on = point?.kind === 'photo' && point.id === p.id;
          return (
            <Pressable key={p.id} onPress={() => { tick(); setPoint({ kind: 'photo', id: p.id }); setSheetIdx(x => (x === 2 ? 1 : x)); }}
              accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => [st.row, st.rowSlim, on && st.rowOn, pressed && { opacity: 0.85 }]}>
              <View style={st.pThumb}>{p.uri ? <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Camera size={16} color={TEAL} />}</View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.rowTitleSm}>{t('photoN', { n: i + 1, total: tabPhotos.length })}</Text>
                <Text style={st.miniText}>{fmtTime(p.tomada_at)} · {p.lat.toFixed(5)}, {p.lng.toFixed(5)}</Text>
              </View>
              <MapPin size={15} color={on ? TEAL : MUTED} />
            </Pressable>
          );
        })}
      </>
    ) : <Text style={st.empty}>{selected.remoteId && !fotosCache[selected.remoteId] ? '…' : t('noPhotoPoints')}</Text>
  ) : (
    photoScans.length ? photoScans.map(it => (
      <Pressable key={it.id} onPress={() => select(it.id)} accessibilityRole="button" style={({ pressed }) => [st.row, it.id === selectedId && st.rowOn, pressed && { opacity: 0.85 }]}>
        <ItemThumb item={it} size={52} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.rowTitle} numberOfLines={1}>{kindText(it)}</Text>
          <Text style={st.meta} numberOfLines={1}>{it.result?.label ? localizeDomainLabel(it.result.label, language) : ''}{it.result?.score != null ? ` · ${Math.round(it.result.score * 100)} %` : ''}</Text>
          <Text style={st.miniText} numberOfLines={1}>{fmtDate(it.date)} · {it.loc ? orchardText(it.orchardId) : t('noLocation')}</Text>
        </View>
      </Pressable>
    )) : <Text style={st.empty}>{t('pickWalk')}</Text>
  );

  const body = (
    <View style={{ flex: 1 }}>
      {statsBlock}
      <View style={st.tabs} accessibilityRole="tablist">
        {tabs.map(x => (
          <Pressable key={x.key} onPress={() => { if (tab !== x.key) { tick(); setTab(x.key); } }} accessibilityRole="tab" accessibilityState={{ selected: tab === x.key }} style={st.tabBtn}>
            <Text style={[st.tabText, tab === x.key && st.tabTextOn]} numberOfLines={1}>{x.label}</Text>
          </Pressable>
        ))}
        <Reanimated.View style={[st.tabBar, {
          left: `${(tabIdx * 100) / 3}%`,
          transitionProperty: reduced ? 'none' : 'left', transitionDuration: 220, transitionTimingFunction: CSS_EASE_OUT,
        } as object]} />
      </View>
      <ScrollView key={tab} ref={listRef} contentContainerStyle={{ paddingTop: 6, paddingBottom: listBottom }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Reanimated.View entering={fade}>
          {loadError && (
            <View style={st.errorBox}>
              <Text style={st.errorText}>{t('loadError')}</Text>
              <Pressable onPress={() => load()} accessibilityRole="button" style={({ pressed }) => [st.retry, pressed && st.pressed]}><Text style={st.retryText}>{t('retry')}</Text></Pressable>
            </View>
          )}
          {tab === 'history' ? historyList : tab === 'findings' ? findingsList : photosList}
        </Reanimated.View>
      </ScrollView>
    </View>
  );

  // Vista previa del punto (foto u hallazgo) sobre el mapa.
  const pointCard = (() => {
    if (!point || !selected) return null;
    if (point.kind === 'finding') {
      const h = selectedFindings.find(x => x.id === point.id);
      if (!h) return null;
      const c = categoria(h);
      return (
        <View style={st.pointRow}>
          <View style={st.pointThumb}>
            {h.miniatura_path ? <Image source={storageImage(h.miniatura_path)} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Bug size={20} color={FINDING_COLOR[c]} />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={[st.rowCenter, { gap: 6 }]}><FindingGlyph cat={c} /><Text style={st.pointTitle} numberOfLines={1}>{findingLabel(h)}</Text></View>
            <Text style={st.pointMeta} numberOfLines={1}>{catText(c)} · {t('confidence', { pct: Math.round(h.confianza * 100) })}</Text>
            <Text style={st.pointMeta}>{localizeDomainLabel(h.fruto, language)} · {fmtTime(h.tomada_at)}</Text>
          </View>
          {selected.kind === 'remoto' && (
            <Pressable onPress={() => openFinding(h.id)} accessibilityRole="button" accessibilityLabel={t('viewFinding')} hitSlop={6} style={({ pressed }) => [st.pointGo, pressed && st.pressed]}>
              <ChevronRight size={18} color="#fff" />
            </Pressable>
          )}
        </View>
      );
    }
    const idx = selectedPhotos.findIndex(p => p.id === point.id);
    const p = selectedPhotos[idx];
    if (!p) return null;
    return (
      <View style={st.pointRow}>
        <View style={st.pointThumb}>{p.uri ? <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Camera size={20} color={TEAL} />}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.pointTitle}>{t('photoN', { n: idx + 1, total: selectedPhotos.length })}</Text>
          <Text style={st.pointMeta}>{fmtDate(p.tomada_at)} · {fmtTime(p.tomada_at)}</Text>
          {!p.uri && <Text style={st.pointMeta} numberOfLines={2}>{t('photoGone')}</Text>}
        </View>
      </View>
    );
  })();

  // Centro para las miniaturas de estilos: el recorrido elegido, el primero visible o una huerta.
  const styleCenter = useMemo(() => {
    const first = selected?.loc ?? visible.find(v => v.loc)?.loc;
    if (first) return first;
    const o = orchards.find(x => x.coordinates?.length);
    return o ? { lat: o.coordinates[0].latitude, lng: o.coordinates[0].longitude } : { lat: 19.415, lng: -102.06 };
  }, [selected, visible, orchards]);

  // Leyenda del estilo de ruta (solo cuando hay un recorrido con ruta en el mapa, o el mapa de calor).
  const legend = (() => {
    if (routeStyle === 'calor') return <Text style={st.legendText}>{t('lgHeat')}</Text>;
    if (!mapDetail || mapDetail.route.length < 2 || routeStyle === 'clasica') return null;
    if (routeStyle === 'velocidad' && !mapDetail.speedRange) return <Text style={st.legendText}>{t('lgNoTimes')}</Text>;
    const colors = routeStyle === 'velocidad' ? SPEED_COLORS : TIME_COLORS;
    const left = routeStyle === 'velocidad' ? `${t('lgSlow')} ${mapDetail.speedRange![0].toFixed(1)}` : t('lgStart');
    const right = routeStyle === 'velocidad' ? `${mapDetail.speedRange![1].toFixed(1)} km/h ${t('lgFast')}` : t('lgEnd');
    return (
      <>
        <Text style={st.legendText}>{left}</Text>
        <LinearGradient colors={[...colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.legendBar} />
        <Text style={st.legendText}>{right}</Text>
      </>
    );
  })();

  const layerOptions: { key: ScansMapLayer; label: string }[] = [
    { key: 'satelite', label: t('layerSat') },
    { key: 'hibrido', label: t('layerHybrid') },
    ...(zonesAvailable ? [{ key: 'zonas' as const, label: t('layerZones') }] : []),
  ];
  const layerFound = layerOptions.findIndex(l => l.key === layer);
  const layerIdx = Math.max(0, layerFound);
  const SEG_ITEM = 70;

  return (
    <GestureHandlerRootView style={st.screen}>
      {header}
      <View style={[st.card, { marginBottom: tabClear, marginTop: fullscreen ? insets.top + 6 : 0, marginHorizontal: isTablet ? 24 : 10 }]}
        onLayout={e => setCardH(Math.round(e.nativeEvent.layout.height))}>
        <Reanimated.View entering={reduced ? undefined : FadeIn.duration(320)} style={StyleSheet.absoluteFill}>
          <ScansMap ref={mapRef} data={mapData} selectedId={selected?.loc || mapDetail ? selectedId : null} detail={mapDetail}
            point={point} user={me} layer={layer} routeStyle={routeStyle} onEvent={onMapEvent} />
        </Reanimated.View>

        {legend && (
          <Reanimated.View key={routeStyle} entering={reduced ? undefined : FadeIn.duration(180)} style={st.legend} pointerEvents="none" accessibilityRole="text">
            {legend}
          </Reanimated.View>
        )}

        <View style={st.compass} accessibilityLabel="Norte" pointerEvents="none">
          <Svg width={10} height={8} viewBox="0 0 10 8"><Path d="M5 0 L10 8 L5 6 L0 8 Z" fill="#fff" /></Svg>
          <Text style={st.compassN}>N</Text>
        </View>

        <View style={[st.segment, { width: SEG_ITEM * layerOptions.length + 8 }]} accessibilityRole="tablist">
          <Reanimated.View style={[st.segPill, { opacity: layerFound < 0 ? 0 : 1, width: SEG_ITEM, left: 4 + layerIdx * SEG_ITEM, transitionProperty: reduced ? 'none' : 'left', transitionDuration: 200, transitionTimingFunction: CSS_EASE_OUT } as object]} />
          {layerOptions.map(l => (
            <Pressable key={l.key} onPress={() => { if (layer !== l.key) { tick(); setLayer(l.key); } }} accessibilityRole="tab" accessibilityState={{ selected: layer === l.key }} style={[st.segBtn, { width: SEG_ITEM }]}>
              <Text style={[st.segText, layer === l.key && st.segTextOn]} numberOfLines={1}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
        {layer === 'zonas' && (
          <Reanimated.View entering={fade} style={st.zonesNote} pointerEvents="none"><Text style={st.zonesNoteText}>{t('zonesNote')}</Text></Reanimated.View>
        )}

        <View style={st.ctrlTop}>
          <CtrlBtn label={t('layers')} onPress={() => { tick(); setPicker('layers'); }} solo><Layers size={17} color={INK} /></CtrlBtn>
        </View>
        <View style={[st.ctrlCol, short && { gap: 6, top: 52 }]}>
          <CtrlBtn small={short} label={t('center')} onPress={() => { tick(); mapRef.current?.fit(); }} solo><Crosshair size={17} color={INK} /></CtrlBtn>
          <View style={st.ctrlGroup}>
            <CtrlBtn small={short} label={t('zoomIn')} onPress={() => mapRef.current?.zoom(1)}><Plus size={17} color={INK} /></CtrlBtn>
            <View style={st.ctrlSep} />
            <CtrlBtn small={short} label={t('zoomOut')} onPress={() => mapRef.current?.zoom(-1)}><Minus size={17} color={INK} /></CtrlBtn>
          </View>
          <CtrlBtn small={short} label={fullscreen ? t('exitFull') : t('full')} onPress={() => { tick(); setFullscreen(f => !f); setSheetIdx(0); }} solo>
            {fullscreen ? <Minimize2 size={16} color={INK} /> : <Maximize2 size={16} color={INK} />}
          </CtrlBtn>
        </View>

        {notice && (
          <Reanimated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={[st.notice, { bottom: coverH + 14 }]} pointerEvents="none">
            <Text style={st.noticeText}>{notice}</Text>
          </Reanimated.View>
        )}

        {pointCard && (
          <Reanimated.View key={`${point?.kind}:${point?.id}`} entering={reduced ? FadeIn.duration(120) : FadeInDown.duration(220).easing(EASE_OUT)}
            exiting={reduced ? undefined : FadeOutDown.duration(150)} style={[st.pointCard, { bottom: coverH + 10 }]}>
            {pointCard}
            <Pressable onPress={() => setPoint(null)} accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={10} style={st.pointClose}>
              <X size={13} color={MUTED} />
            </Pressable>
          </Reanimated.View>
        )}

        {cardH > 0 && (
          <BottomSheet snaps={snaps} index={Math.min(sheetIdx, 2)} onIndexChange={setSheetIdx} reduced={reduced} header={sheetHeader}>
            {body}
          </BottomSheet>
        )}
      </View>

      <Modal visible={picker !== null} transparent animationType={reduced ? 'fade' : 'slide'} onRequestClose={() => setPicker(null)} statusBarTranslucent>
        <Pressable style={st.backdrop} onPress={() => setPicker(null)} accessibilityLabel={t('close')} />
        <View style={[st.modalSheet, { paddingBottom: insets.bottom + 16 }, isTablet && { left: '20%', right: '20%' }]}>
          <View style={st.handle} />
          <View style={[st.rowCenter, { justifyContent: 'space-between', marginBottom: 8 }]}>
            <Text style={st.sectionTitle}>{picker === 'orchard' ? t('pickOrchard') : picker === 'layers' ? t('layers') : t('filters')}</Text>
            <Pressable onPress={() => setPicker(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')} style={st.modalClose}><X size={17} color={MUTED} /></Pressable>
          </View>
          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 4 }}>
            {picker === 'orchard' && (
              <>
                <PickRow on={orchardFilter === 'all'} title={t('allOrchards')} meta={scansText(countFor('all'))} icon={<Leaf size={18} color={LIME_INK} />}
                  onPress={() => { tick(); setOrchardFilter('all'); setPicker(null); }} />
                {orchards.map(o => (
                  <PickRow key={o.id} on={orchardFilter === o.id} title={o.nombre}
                    meta={`${o.area_m2 > 0 ? `${(o.area_m2 / 10000).toFixed(2)} ha · ` : ''}${scansText(countFor(o.id))}`}
                    icon={<OrchardMini orchard={o} size={30} />} onPress={() => { tick(); setOrchardFilter(o.id); setPicker(null); }} />
                ))}
                <PickRow on={orchardFilter === 'none'} title={t('noOrchard')} meta={scansText(countFor('none'))} icon={<MapPin size={18} color={MUTED} />}
                  onPress={() => { tick(); setOrchardFilter('none'); setPicker(null); }} />
              </>
            )}
            {picker === 'filters' && (
              <>
                <Text style={st.groupLabel}>{t('type')}</Text>
                <View style={st.chips}>
                  {([['all', t('all')], ['walk', t('walks')], ['photo', t('photosOnly')]] as Array<[TypeFilter, string]>).map(([k, label]) => (
                    <FilterChip key={k} on={typeFilter === k} label={label} onPress={() => { tick(); setTypeFilter(k); }} />
                  ))}
                </View>
                <Text style={st.groupLabel}>{t('status')}</Text>
                <View style={st.chips}>
                  {([['all', t('all')], ['listo', t('fltDone')], ['progress', t('fltProgress')], ['local', t('fltLocal')], ['error', t('fltError')]] as Array<[StatusFilter, string]>).map(([k, label]) => (
                    <FilterChip key={k} on={statusFilter === k} label={`${label} · ${items.filter(it => matchesStatus(it, k)).length}`}
                      dot={k === 'all' ? undefined : SCAN_STATUS_COLOR[k === 'progress' ? 'proceso' : k]} onPress={() => { tick(); setStatusFilter(k); }} />
                  ))}
                </View>
                <View style={[st.rowCenter, { gap: 10, marginTop: 14 }]}>
                  <Pressable onPress={() => { tick(); setTypeFilter('all'); setStatusFilter('all'); }} accessibilityRole="button" style={({ pressed }) => [st.ghostBtn, pressed && st.pressed]}>
                    <Text style={st.ghostText}>{t('clear')}</Text>
                  </Pressable>
                  <Pressable onPress={() => setPicker(null)} accessibilityRole="button" style={({ pressed }) => [st.primary, { flex: 1, marginTop: 0 }, pressed && st.pressed]}>
                    <Text style={st.primaryText}>{t('apply')}</Text>
                  </Pressable>
                </View>
              </>
            )}
            {picker === 'layers' && (
              <>
                <MapStylePicker
                  layer={layer}
                  routeStyle={routeStyle}
                  zonesAvailable={zonesAvailable}
                  center={styleCenter}
                  width={(isTablet ? width * 0.6 : width) - 32 - 8}
                  onLayer={setLayer}
                  onRouteStyle={setRouteStyle}
                />
                <Text style={[st.sectionTitle, { marginTop: 18, marginBottom: 2 }]}>{t('lyLayers')}</Text>
                {([['routes', t('lyRoutes'), <Route key="r" size={17} color={TEAL} />], ['photos', t('lyPhotos'), <Camera key="c" size={17} color={TEAL} />],
                  ['findings', t('lyFindings'), <Bug key="b" size={17} color={FINDING_COLOR.enfermo} />], ['orchards', t('lyOrchards'), <Leaf key="l" size={17} color={LIME_INK} />]] as Array<[keyof ScansMapShow, string, React.ReactNode]>)
                  .map(([k, label, icon]) => (
                    <View key={k} style={st.toggleRow}>
                      <View style={st.pickIcon}>{icon}</View>
                      <Text style={[st.pickTitle, { flex: 1 }]}>{label}</Text>
                      <Switch value={show[k]} onValueChange={v => { tick(); setShow(s => ({ ...s, [k]: v })); }}
                        trackColor={{ true: '#99F6E4', false: '#E2E8F0' }} thumbColor={show[k] ? TEAL : '#fff'} accessibilityLabel={label} />
                    </View>
                  ))}
                <Pressable onPress={() => { setPicker(null); locate(); }} accessibilityRole="button" style={({ pressed }) => [st.toggleRow, pressed && { opacity: 0.85 }]}>
                  <View style={st.pickIcon}><Navigation size={16} color={SCAN.sky} /></View>
                  <Text style={[st.pickTitle, { flex: 1 }]}>{t('lyMe')}</Text>
                  <ChevronRight size={18} color={MUTED} />
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

// ───────── piezas ─────────

function RoundBtn({ label, onPress, children, active }: { label: string; onPress: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4}
      style={({ pressed }) => [st.roundBtn, active && st.roundBtnOn, pressed && st.pressed]}>{children}</Pressable>
  );
}

function CtrlBtn({ label, onPress, children, solo, small }: { label: string; onPress: () => void; children: React.ReactNode; solo?: boolean; small?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4}
      style={({ pressed }) => [st.ctrlBtn, small && { width: 34, height: 34 }, solo && st.ctrlSolo, pressed && { backgroundColor: '#F1F5F9' }]}>{children}</Pressable>
  );
}

function StatusChip({ status, text, small }: { status: ScanStatus; text: string; small?: boolean }) {
  return (
    <View style={[st.chip, { backgroundColor: STATUS_BG[status] }, small && { paddingHorizontal: 7, paddingVertical: 1 }]}>
      {status === 'listo' ? <Check size={small ? 10 : 11} color={STATUS_INK[status]} strokeWidth={3} /> : <View style={[st.dot, { width: 6, height: 6, marginRight: 0, backgroundColor: SCAN_STATUS_COLOR[status] }]} />}
      <Text style={[st.chipText, { color: STATUS_INK[status] }, small && { fontSize: 10.5 }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function TypeChip({ item, text }: { item: ScanItem; text: string }) {
  const Icon = item.kind === 'foto' ? Camera : item.fuente === 'dron' ? Plane : item.fuente === 'camara' ? Video : Route;
  return (
    <View style={st.typeChip}>
      <Icon size={11} color={LIME_INK} />
      <Text style={st.typeChipText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

/** Forma y color de cada categoría (igual que en el mapa): círculo, rombo, cuadro, punto. */
function FindingGlyph({ cat }: { cat: CategoriaHallazgo }) {
  const c = FINDING_COLOR[cat];
  if (cat === 'revisar') return <View style={{ width: 9, height: 9, backgroundColor: c, transform: [{ rotate: '45deg' }], borderRadius: 2 }} />;
  if (cat === 'sano') return <View style={{ width: 10, height: 10, backgroundColor: c, borderRadius: 3 }} />;
  return <View style={{ width: cat === 'otro' ? 8 : 10, height: cat === 'otro' ? 8 : 10, backgroundColor: c, borderRadius: 5 }} />;
}

function Mini({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <View style={st.rowCenter}>{icon}<Text style={st.miniText} numberOfLines={1}> {text}</Text></View>;
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <View style={st.stat}>
      {icon}
      <Text style={st.statValue} numberOfLines={1}>{value}</Text>
      <Text style={st.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function FilterChip({ on, label, onPress, dot }: { on: boolean; label: string; onPress: () => void; dot?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={[st.fChip, on && st.fChipOn, { transitionProperty: ['backgroundColor', 'borderColor'], transitionDuration: 150, transitionTimingFunction: CSS_EASE_OUT } as object]}>
      {dot && <View style={[st.dot, { width: 7, height: 7, backgroundColor: dot }]} />}
      <Text style={[st.fChipText, on && { color: LIME_INK }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function PickRow({ on, title, meta, icon, onPress }: { on: boolean; title: string; meta: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => [st.pickRow, on && st.pickRowOn, pressed && { opacity: 0.85 }]}>
      <View style={st.pickIcon}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.pickTitle} numberOfLines={1}>{title}</Text>
        <Text style={st.meta} numberOfLines={1}>{meta}</Text>
      </View>
      {on && <Check size={18} color={LIME_INK} />}
    </Pressable>
  );
}

function OrchardMini({ orchard, size }: { orchard: Orchard; size: number }) {
  const pts = useMemo(() => {
    const c = (orchard.coordinates ?? []).filter(p => validCoord(p.latitude, p.longitude));
    if (c.length < 3) return null;
    const k = Math.cos((c[0].latitude * Math.PI) / 180);
    const xs = c.map(p => p.longitude * k), ys = c.map(p => p.latitude);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY) || 1, pad = 2, sc = (size - pad * 2) / span;
    const ox = (size - (maxX - minX) * sc) / 2, oy = (size - (maxY - minY) * sc) / 2;
    return c.map(p => `${(ox + (p.longitude * k - minX) * sc).toFixed(1)},${(oy + (maxY - p.latitude) * sc).toFixed(1)}`).join(' ');
  }, [orchard, size]);
  if (!pts) return <Leaf size={15} color={LIME_INK} />;
  return <Svg width={size} height={size}><Polygon points={pts} fill="rgba(132,204,22,0.35)" stroke="#4D7C0F" strokeWidth={1.5} strokeLinejoin="round" /></Svg>;
}

/**
 * Miniatura: con `preferPhoto`, foto real (hallazgo o foto local) si existe; si no, vista satelital real del
 * recorrido; si tampoco hay geografía, un icono.
 */
function ItemThumb({ item, size, outline, preferPhoto }: { item: ScanItem; size: number; outline?: { latitude: number; longitude: number }[]; preferPhoto?: boolean }) {
  const [failed, setFailed] = useState(false);
  const geo = item.kind !== 'foto' && (item.route.length > 1 || item.localPhotos.length > 0);
  const outlinePts = useMemo(() => (outline ?? []).filter(p => validCoord(p.latitude, p.longitude)).map(p => ({ lat: p.latitude, lng: p.longitude })), [outline]);
  const photo = item.thumb && !failed ? (
    <Reanimated.View entering={FadeIn.duration(200)} style={[st.thumb, { width: size, height: size }]}>
      <Image source={item.thumb} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
    </Reanimated.View>
  ) : null;
  if (preferPhoto && photo) return photo;
  if (geo) return <SatThumb route={item.route} points={item.localPhotos} outline={outlinePts} size={size} radius={12} />;
  if (photo) return photo;
  const Icon = item.kind === 'foto' ? Leaf : item.fuente === 'dron' ? Plane : item.fuente === 'camara' ? Video : Route;
  return (
    <View style={[st.thumb, st.center, { width: size, height: size, backgroundColor: item.kind === 'foto' ? '#ECFCCB' : '#F1F5F9' }]}>
      <Icon size={size * 0.38} color={item.kind === 'foto' ? '#4D7C0F' : MUTED} />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  lockText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: INK, textAlign: 'center', marginTop: 12 },
  lockBtn: { marginTop: 14, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, backgroundColor: SCAN.limeBright },
  lockBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: SCAN.limeInk },

  header: { paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 32 },
  wordmark: { width: 96, height: 22 },
  tokens: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 11, borderRadius: 15, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  tokensText: { fontFamily: 'Poppins_700Bold', fontSize: 12.5, color: '#78350F', fontVariant: ['tabular-nums'] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 25, lineHeight: 31, letterSpacing: -0.7, color: INK },
  subtitle: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: MUTED },
  roundBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: LINE },
  roundBtnOn: { backgroundColor: '#ECFCCB', borderColor: '#BEF264' },
  badge: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#65A30D', borderWidth: 1.5, borderColor: '#fff' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: LINE },
  searchInput: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 14, color: INK, paddingVertical: 0 },
  orchardBar: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, paddingLeft: 8, paddingRight: 12, borderRadius: 14, backgroundColor: '#FBFCF8', borderWidth: 1, borderColor: LINE },
  leafDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFCCB' },
  orchardName: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, lineHeight: 18, color: INK },
  orchardMeta: { fontFamily: 'Poppins_400Regular', fontSize: 11, lineHeight: 15, color: MUTED },

  card: { flex: 1, borderRadius: 22, overflow: 'hidden', backgroundColor: '#dfe7e1' },
  compass: { position: 'absolute', top: 10, left: 10, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.78)' },
  compassN: { fontFamily: 'Poppins_700Bold', fontSize: 10.5, lineHeight: 12, color: '#fff' },
  segment: { position: 'absolute', top: 10, alignSelf: 'center', height: 34, flexDirection: 'row', padding: 4, borderRadius: 17, backgroundColor: 'rgba(15,23,42,0.72)' },
  segPill: { position: 'absolute', top: 4, bottom: 4, borderRadius: 13, backgroundColor: '#FFFFFF' },
  segBtn: { alignItems: 'center', justifyContent: 'center' },
  segText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11.5, color: '#E2E8F0' },
  segTextOn: { color: TEAL },
  zonesNote: { position: 'absolute', top: 50, alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(15,23,42,0.7)' },
  zonesNoteText: { fontFamily: 'Poppins_400Regular', fontSize: 10.5, color: '#fff' },
  ctrlTop: { position: 'absolute', top: 10, right: 10 },
  ctrlCol: { position: 'absolute', top: 56, right: 10, gap: 8, alignItems: 'center' },
  ctrlGroup: { borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.97)', overflow: 'hidden', shadowColor: '#0f172a', shadowOpacity: 0.14, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  ctrlBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  ctrlSolo: { borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.97)', shadowColor: '#0f172a', shadowOpacity: 0.14, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  ctrlSep: { height: 1, backgroundColor: LINE, marginHorizontal: 7 },
  notice: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(15,23,42,0.82)' },
  noticeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#fff' },

  pointCard: { position: 'absolute', left: 10, right: 10, padding: 8, borderRadius: 16, backgroundColor: PANEL, shadowColor: '#0f172a', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 22 },
  pointThumb: { width: 50, height: 50, borderRadius: 11, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  pointTitle: { flexShrink: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: INK },
  pointMeta: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, lineHeight: 16, color: MUTED },
  pointGo: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: TEAL },
  pointClose: { position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },

  selCard: { paddingHorizontal: 14, paddingBottom: 8 },
  selRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  selTitle: { fontFamily: 'Poppins_700Bold', fontSize: 16.5, lineHeight: 21, color: INK, letterSpacing: -0.2 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: '#F2FBE3' },
  typeChipText: { flexShrink: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 10.5, color: LIME_INK },
  statsBlock: { paddingHorizontal: 14, paddingTop: 2, paddingBottom: 6 },
  statsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: LINE, backgroundColor: '#FCFDFB' },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statSep: { width: 1, alignSelf: 'stretch', backgroundColor: LINE },
  statValue: { fontFamily: 'Poppins_700Bold', fontSize: 14.5, color: INK },
  statLabel: { fontFamily: 'Poppins_400Regular', fontSize: 10.5, color: MUTED },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 38, marginTop: 7, borderRadius: 19, backgroundColor: TEAL },
  primaryText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: '#fff' },
  stateNote: { marginTop: 8, textAlign: 'center', fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#B45309' },

  tabs: { flexDirection: 'row', marginHorizontal: 14, marginTop: 6, borderBottomWidth: 1, borderBottomColor: LINE },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 38 },
  tabText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: MUTED },
  tabTextOn: { color: TEAL },
  tabBar: { position: 'absolute', bottom: -1, width: '33.333%', height: 2.5, borderRadius: 2, backgroundColor: TEAL },

  sectionTitle: { fontFamily: 'Poppins_700Bold', fontSize: 15.5, color: INK, letterSpacing: -0.2 },
  count: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: MUTED },
  hint: { marginTop: 3, fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 17, color: MUTED },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 10, marginVertical: 3, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: '#F1F4F2', backgroundColor: PANEL },
  rowSlim: { paddingVertical: 5 },
  rowOn: { backgroundColor: '#F6FDE9', borderColor: '#D9F99D' },
  rowTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: INK },
  rowTitleSm: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: INK },
  rowCounts: { alignItems: 'flex-end', gap: 3 },
  rowChevron: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8' },
  meta: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: MUTED },
  miniText: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: MUTED },
  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  chipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  thumb: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#F1F5F9' },
  fThumb: { width: 52, height: 52, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  pThumb: { width: 36, height: 36, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0FDFA' },
  photoNote: { marginHorizontal: 18, marginBottom: 4, fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: MUTED },
  track: { height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', marginTop: 4, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2, backgroundColor: SCAN.sky },

  sync: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginBottom: 4, padding: 10, borderRadius: 14, backgroundColor: '#F0F9FF' },
  syncTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: INK },
  syncBtn: { paddingHorizontal: 12, minHeight: 32, justifyContent: 'center', borderRadius: 10, backgroundColor: SCAN.sky },
  syncBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#fff' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginBottom: 6, padding: 10, borderRadius: 14, backgroundColor: '#FEF2F2' },
  errorText: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: '#B91C1C' },
  retry: { paddingHorizontal: 12, minHeight: 32, justifyContent: 'center', borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#FECACA' },
  retryText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#B91C1C' },
  emptyBox: { paddingHorizontal: 20, paddingTop: 10, gap: 4 },
  empty: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, lineHeight: 19, color: MUTED, textAlign: 'center', paddingHorizontal: 24, marginTop: 14 },

  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.45)' },
  legend: { position: 'absolute', top: 52, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 28, borderRadius: 14, backgroundColor: 'rgba(15,23,42,0.78)' },
  legendText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#F8FAFC' },
  legendBar: { width: 64, height: 6, borderRadius: 3 },
  modalSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 8, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#fff' },
  handle: { alignSelf: 'center', width: 38, height: 4.5, borderRadius: 3, backgroundColor: '#CBD5E1', marginBottom: 10 },
  modalClose: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14 },
  pickRowOn: { backgroundColor: '#F6FDE9' },
  pickIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8' },
  pickTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: INK },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 6 },
  groupLabel: { marginTop: 8, marginBottom: 6, fontFamily: 'Poppins_600SemiBold', fontSize: 11.5, color: MUTED, letterSpacing: 0.6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fChip: { flexDirection: 'row', alignItems: 'center', minHeight: 36, paddingHorizontal: 13, borderRadius: 18, borderWidth: 1, borderColor: LINE, backgroundColor: '#fff' },
  fChipOn: { backgroundColor: '#ECFCCB', borderColor: '#BEF264' },
  fChipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: '#475569' },
  ghostBtn: { minHeight: 42, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 21, borderWidth: 1, borderColor: LINE },
  ghostText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: '#475569' },
});
