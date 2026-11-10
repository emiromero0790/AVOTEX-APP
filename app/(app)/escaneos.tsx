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
import Reanimated, { FadeIn, FadeInDown, FadeOut, FadeOutDown, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';
import {
  ArrowLeft, ArrowRight, ArrowUpDown, Bug, Calendar, Camera, Check, ChevronDown, ChevronRight, ChevronUp, CloudUpload, Layers, LayoutGrid,
  Leaf, Lock, Map as MapIcon, Maximize2, MapPin, Minimize2, Minus, Moon, Navigation, Plane, Plus, Route, Search, SlidersHorizontal, Video, X,
} from 'lucide-react-native';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { auth as firebaseAuth } from '../../firebaseConfig';
import { supabase } from '../../supabaseConfig';
import { useGuest } from '../../context/GuestContext';
import { localizeDomainLabel, TranslationResource, useLanguage, useTranslations } from '../../context/LanguageContext';
import { listOrchards, Orchard } from '../../services/orchards';
import { Fuente, RecorridoLocal, RecorridoRemoto, listLocal, listRemote, recoverInterrupted, uploadPending } from '../../services/recorridos';
import {
  categoria, cleanRoute, listRecorridoFotos, listSingleScans, listUserHallazgos, routeMeters, storageImage,
  validCoord, type CategoriaHallazgo, type FotoPunto, type HallazgoMapa, type LatLng, type SingleScan,
} from '../../services/escaneos';
import { buildOrchardGeometry } from '../../services/satZones';
import ScansMap, { type ScansMapEvent, type ScansMapHandle } from '../../components/ScansMap';
import {
  FINDING_COLOR, SCAN_STATUS_COLOR, type ScanStatus, type ScansMapData, type ScansMapDetail, type ScansMapLayer, type ScansMapRouteStyle, type ScansMapShow, SPEED_COLORS, TIME_COLORS,
  type ScansMapZone,
} from '../../components/scansMapHtml';
import HistorySheet, { sheetJustDragged, type HistorySheetHandle } from '../../components/escaneos/HistorySheet';
import SatThumb from '../../components/escaneos/SatThumb';
import MapStylePicker, { prefetchStyleThumbs } from '../../components/escaneos/MapStylePicker';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CSS_EASE_OUT, EASE_OUT, PressableScale } from '../../components/scan/motion';

const auth = firebaseAuth as Auth;

/** Paleta Dark Agritech de Mis escaneos. */
const D = {
  bg: '#080D10',
  surface: '#12191D',
  card: '#151E23',
  glass: 'rgba(16,23,27,0.82)',
  border: 'rgba(255,255,255,0.12)',
  neon: '#8BF52B',
  lime: '#A3E635',
  teal: '#14B8A6',
  mint: '#A7F3D0',
  coral: '#FF625B',
  text: '#FFFFFF',
  muted: '#AAB5BF',
  ink: '#0B1A12',
} as const;
/** Arreglo vacío estable: cambiar de capa ya no crea datos «nuevos» que obligan a redibujar el mapa. */
const NO_ZONES: ScansMapZone[] = [];
const normCrop = (v: string | null | undefined) => (v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').trim();

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
  subtitle: { es: 'Explora tus recorridos y diagnósticos', en: 'Explore your walks and diagnoses' },
  back: { es: 'Regresar', en: 'Back' },
  layerDark: { es: 'Oscuro', en: 'Dark' },
  seeHistory: { es: 'Ver historial', en: 'See history' },
  expand: { es: 'Expandir historial', en: 'Expand history' },
  collapse: { es: 'Bajar el panel', en: 'Lower the panel' },
  panel: { es: 'Panel del historial', en: 'History panel' },
  scanHistory: { es: 'Historial de escaneos', en: 'Scan history' },
  seeAll: { es: 'Ver todos', en: 'See all' },
  sortNew: { es: 'Más recientes', en: 'Newest' },
  sortOld: { es: 'Más antiguos', en: 'Oldest' },
  crop: { es: 'CULTIVO', en: 'CROP' },
  periodLbl: { es: 'FECHA', en: 'DATE' },
  days: { es: 'Últimos {n} días', en: 'Last {n} days' },
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
  kpiScans: { es: 'Escaneos', en: 'Scans' },
  kpiFindings: { es: 'Hallazgos', en: 'Findings' },
  kpiDistance: { es: 'Recorrido', en: 'Walked' },
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
type Period = 'all' | 7 | 30 | 90;

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

type Row =
  | { k: 'scan'; key: string; it: ScanItem }
  | { k: 'finding'; key: string; h: HallazgoMapa }
  | { k: 'photo'; key: string; p: FotoPunto; i: number; total: number };

function remoteStatus(estado: RecorridoRemoto['estado']): ScanStatus {
  return estado === 'listo' ? 'listo' : estado === 'procesando' ? 'proceso' : estado === 'error' ? 'error' : 'cola';
}

/** Ignora el toque si en realidad fue el final de un arrastre del panel. */
const guard = (fn: () => void) => () => { if (!sheetJustDragged()) fn(); };
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
  const [sheetIdx, setSheetIdx] = useState<0 | 1 | 2>(short ? 0 : 1);
  const [fullscreen, setFullscreen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [orchardFilter, setOrchardFilter] = useState<OrchardFilter>('all');
  const [query, setQuery] = useState('');
  // Filtros del historial completo (además de tipo y estado).
  const [cropFilter, setCropFilter] = useState<string>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [sortAsc, setSortAsc] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [picker, setPicker] = useState<'orchard' | 'filters' | 'layers' | null>(null);
  // Al cerrar, el panel conserva su contenido mientras se desvanece (si no, se vaciaba a media animación).
  const [lastPicker, setLastPicker] = useState<'orchard' | 'filters' | 'layers'>('filters');
  useEffect(() => { if (picker) setLastPicker(picker); }, [picker]);
  const sheetKind = picker ?? lastPicker;
  // Mapa oscuro por defecto; la elección del usuario se guarda en el celular (AsyncStorage).
  const [layer, setLayer] = useState<ScansMapLayer>('oscuro');
  const [routeStyle, setRouteStyle] = useState<ScansMapRouteStyle>('velocidad');
  // Tipo de mapa y estilo de ruta se recuerdan entre visitas.
  const styleLoaded = useRef(false);
  useEffect(() => {
    AsyncStorage.getItem(MAP_STYLE_KEY).then(raw => {
      if (!raw) return;
      try {
        const v = JSON.parse(raw) as { layer?: ScansMapLayer; routeStyle?: ScansMapRouteStyle };
        if (v.layer && ['satelite', 'hibrido', 'estandar', 'topo', 'oscuro', 'zonas'].includes(v.layer)) setLayer(v.layer);
        if (v.routeStyle && ['clasica', 'velocidad', 'tiempo'].includes(v.routeStyle)) setRouteStyle(v.routeStyle);
      } catch { /* preferencia dañada: se ignora */ }
    }).catch(() => {}).finally(() => { styleLoaded.current = true; });
  }, []);
  useEffect(() => {
    if (styleLoaded.current) AsyncStorage.setItem(MAP_STYLE_KEY, JSON.stringify({ layer, routeStyle })).catch(() => {});
  }, [layer, routeStyle]);
  const [show, setShow] = useState<ScansMapShow>({ routes: true, photos: true, findings: true, orchards: true });
  const [me, setMe] = useState<LatLng | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, { done: number; total: number }>>({});
  const [syncNote, setSyncNote] = useState<'offline' | 'wifi-required' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const mapRef = useRef<ScansMapHandle>(null);
  const sheetRef = useRef<HistorySheetHandle>(null);
  const searchRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const autoScope = useRef<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  // Pantalla oscura: barra de estado clara (salvo invitado, que va sobre fondo oscuro igual).
  const lightBar = true;
  useFocusEffect(useCallback(() => { setStatusBarStyle(lightBar ? 'light' : 'dark'); return () => setStatusBarStyle('dark'); }, [lightBar]));

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

  // Cultivos reales: fruto de las fotos individuales y de los hallazgos de cada recorrido.
  const cropsOf = useCallback((it: ScanItem): string[] => {
    if (it.kind === 'foto') return it.result?.fruto ? [normCrop(it.result.fruto)] : [];
    return it.remoteId ? (findingsBy[it.remoteId] ?? []).map(h => normCrop(h.fruto)) : [];
  }, [findingsBy]);
  const cropOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach(it => cropsOf(it).forEach(c => { if (c && c !== 'nofruta') set.add(c); }));
    return Array.from(set).sort();
  }, [items, cropsOf]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const since = period === 'all' ? 0 : Date.now() - period * 86400000;
    const out = items.filter(it =>
      (typeFilter === 'all' || (typeFilter === 'photo' ? it.kind === 'foto' : it.kind !== 'foto'))
      && matchesStatus(it, statusFilter) && matchesOrchard(it, orchardFilter)
      && (!since || new Date(it.date).getTime() >= since)
      && (cropFilter === 'all' || cropsOf(it).includes(cropFilter))
      && (!q || `${kindText(it)} ${orchardText(it.orchardId)} ${fmtDate(it.date)} ${it.result?.label ?? ''}`.toLowerCase().includes(q)));
    return sortAsc ? out.slice().reverse() : out;
  }, [items, typeFilter, statusFilter, orchardFilter, query, kindText, orchardText, fmtDate, period, cropFilter, cropsOf, sortAsc]);

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

  // ───────── geometría del panel ─────────
  // El panel vive a nivel de pantalla (no dentro del mapa): expandido llega hasta debajo de la barra de
  // estado. La barra de pestañas flotante se respeta con el relleno inferior de la lista y sumando su
  // alto a las alturas contraída e intermedia (se ven por encima de ella).
  const tabClear = (isTablet ? 82 + 24 : 72 + 18) + 8;
  const HANDLE_H = 40;
  // Alto real de la cabecera del panel (selector, métricas y resumen del escaneo elegido).
  const [headH, setHeadH] = useState(0);
  const hasSel = !!selectedId;
  const snaps = useMemo<[number, number, number]>(() => {
    const full = Math.round(height - insets.top - 4);
    const head = headH || (hasSel ? 140 : 70);
    const compact = Math.min(full - 200, tabClear + HANDLE_H + head + 6);
    const usable = height - insets.top - tabClear;
    const mid = Math.min(full - 90, Math.max(compact + 150, tabClear + Math.round(usable * 0.52)));
    return [compact, mid, full];
  }, [height, insets.top, tabClear, headH, hasSel]);
  const sheetY = useSharedValue(snaps[2] - snaps[sheetIdx]);
  // Lo que tapa el panel abajo (para encuadrar el mapa); expandido, el mapa no se ve: se usa el intermedio.
  const coverH = snaps[Math.min(sheetIdx, 1)];

  const zones = useMemo<ScansMapZone[]>(() => {
    if (layer !== 'zonas') return NO_ZONES;
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
    show,
    reduced,
  }), [orchards, visible, zones, orchardFilter, scopeKey, show, reduced]);
  // Encuadre: lo que tapan encabezado y panel. Se manda aparte, sin redibujar el mapa.
  const mapPad = useMemo(() => ({ top: fullscreen ? insets.top + 12 : insets.top + 128, right: 68, bottom: coverH + 8, left: 12 }), [fullscreen, insets.top, coverH]);

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
  const orchardObj = orchardFilter !== 'all' && orchardFilter !== 'none' ? orchardById[orchardFilter] : null;
  const countFor = (f: OrchardFilter) => items.filter(it => matchesOrchard(it, f)).length;
  const filtersActive = statusFilter !== 'all' || typeFilter !== 'all' || cropFilter !== 'all' || period !== 'all';
  const fade = reduced ? undefined : FadeIn.duration(180).easing(EASE_OUT);

  // Hallazgos de la pestaña: los del recorrido elegido; sin selección, los de la vista actual.
  const tabFindings = selected?.remoteId ? selectedFindings : hallazgos.filter(h => visible.some(v => v.remoteId === h.recorrido_id));
  const tabPhotos = selected && selected.kind !== 'foto' ? selectedPhotos : [];
  const photoScans = visible.filter(v => v.kind === 'foto');

  // Métricas de la vista: cada escaneo cuenta una vez; hallazgos y metros solo de recorridos.
  const kpis = useMemo(() => ({
    scans: visible.length,
    findings: visible.reduce((n, v) => n + (v.findings ?? 0), 0),
    meters: visible.reduce((n, v) => n + (v.route.length > 1 ? routeMeters(v.route) : 0), 0),
  }), [visible]);

  // Centro para las miniaturas de estilos: el recorrido elegido, el primero visible o una huerta.
  const styleCenter = useMemo(() => {
    const first = selected?.loc ?? visible.find(v => v.loc)?.loc;
    if (first) return first;
    const o = orchards.find(x => x.coordinates?.length);
    return o ? { lat: o.coordinates[0].latitude, lng: o.coordinates[0].longitude } : { lat: 19.415, lng: -102.06 };
  }, [selected, visible, orchards]);
  // Las miniaturas del panel de capas se bajan por adelantado (una vez por zona).
  const thumbKey = `${styleCenter.lat.toFixed(2)},${styleCenter.lng.toFixed(2)}`;
  useEffect(() => { prefetchStyleThumbs(styleCenter); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [thumbKey]);

  // Filas de la lista según la pestaña (un solo FlatList virtualizado).
  const rows = useMemo<Row[]>(() => {
    if (tab === 'history') return visible.map(it => ({ k: 'scan' as const, key: it.id, it }));
    if (tab === 'findings') return tabFindings.map(h => ({ k: 'finding' as const, key: h.id, h }));
    if (selected && selected.kind !== 'foto') return tabPhotos.map((p, i) => ({ k: 'photo' as const, key: p.id, p, i, total: tabPhotos.length }));
    return photoScans.map(it => ({ k: 'scan' as const, key: it.id, it }));
  }, [tab, visible, tabFindings, tabPhotos, photoScans, selected]);

  // El botón de ubicación sigue el borde superior del panel y se oculta al expandirlo.
  const fabStyle = useAnimatedStyle(() => {
    const visibleH = snaps[2] - sheetY.get();
    const fadeOut = Math.min(1, Math.max(0, (snaps[2] - 40 - visibleH) / Math.max(1, snaps[2] - snaps[1] - 40)));
    return { opacity: fadeOut, transform: [{ translateY: -(visibleH + 14) }] };
  });

  const expand = () => { tick(); setSheetIdx(2); };
  const collapse = () => { tick(); setSheetIdx(0); };
  const openSearch = () => {
    tick();
    setSheetIdx(2);
    setTimeout(() => searchRef.current?.focus(), reduced ? 50 : 360);
  };

  if (isGuest) {
    return (
      <View style={[st.screen, st.center, { paddingTop: insets.top }]}>
        <Lock size={36} color={D.mint} />
        <Text style={st.lockText}>{t('locked')}</Text>
        <PressableScale style={st.lockBtn} onPress={() => router.replace('/(auth)')} accessibilityRole="button">
          <Text style={st.lockBtnText}>{t('signIn')}</Text>
        </PressableScale>
      </View>
    );
  }

  // ── Leyenda del estilo de ruta ──
  const legend = (() => {
    if (!mapDetail || mapDetail.route.length < 2 || routeStyle === 'clasica' || routeStyle === 'calor') return null;
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

  // ── Selector de capas (Satélite · Híbrido · Oscuro · Zonas) ──
  const layerOptions: { key: ScansMapLayer; label: string; Icon: typeof Layers }[] = [
    { key: 'satelite', label: t('layerSat'), Icon: Layers },
    { key: 'hibrido', label: t('layerHybrid'), Icon: MapIcon },
    { key: 'oscuro', label: t('layerDark'), Icon: Moon },
    ...(zonesAvailable ? [{ key: 'zonas' as const, label: t('layerZones'), Icon: LayoutGrid }] : []),
  ];
  const segW = Math.min(width, 560) - 32;
  const segItem = (segW - 8) / layerOptions.length;
  const layerFound = layerOptions.findIndex(l => l.key === layer);

  // ── Encabezado flotante ──
  const top = !fullscreen && (
    <View style={[st.top, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
      <LinearGradient colors={['rgba(8,13,16,0.94)', 'rgba(8,13,16,0.62)', 'rgba(8,13,16,0)']} locations={[0, 0.62, 1]} style={st.topShade} pointerEvents="none" />
      <View style={st.titleRow}>
        <GlassBtn label={t('back')} onPress={() => { tick(); if (router.canGoBack()) router.back(); else router.navigate('/(app)/scan'); }}>
          <ArrowLeft size={20} color={D.text} />
        </GlassBtn>
        <View style={st.leafIcon}><Leaf size={17} color="#0B1A0F" fill={D.neon} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.title} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('title')}</Text>
          <Text style={st.subtitle} numberOfLines={1}>{t('subtitle')}</Text>
        </View>
        <GlassBtn label={t('searchBtn')} onPress={openSearch} active={!!query}><Search size={19} color={D.text} /></GlassBtn>
        <GlassBtn label={t('filters')} onPress={() => { tick(); setPicker('filters'); }} active={filtersActive}>
          <SlidersHorizontal size={18} color={D.text} />
          {filtersActive && <View style={st.badge} />}
        </GlassBtn>
      </View>
      <View style={[st.segment, { width: segW }]} accessibilityRole="tablist">
        <Reanimated.View pointerEvents="none" style={[st.segPill, {
          width: segItem, opacity: layerFound < 0 ? 0 : 1, transform: [{ translateX: 4 + Math.max(0, layerFound) * segItem }],
          transitionProperty: reduced ? 'none' : ['transform', 'opacity'], transitionDuration: 220, transitionTimingFunction: CSS_EASE_OUT,
        } as object]} />
        {layerOptions.map(({ key, label, Icon }) => {
          const on = layer === key;
          return (
            <Pressable key={key} onPress={() => { if (!on) { tick(); setLayer(key); } }} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label}
              style={[st.segBtn, { width: segItem }]}>
              <Icon size={17} color={on ? D.ink : D.text} />
              <Text style={[st.segText, on && st.segTextOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {legend && (
        <Reanimated.View key={routeStyle} entering={fade} style={st.legend} pointerEvents="none" accessibilityRole="text">{legend}</Reanimated.View>
      )}
      {layer === 'zonas' && (
        <Reanimated.View entering={fade} style={st.legend} pointerEvents="none"><Text style={st.legendText}>{t('zonesNote')}</Text></Reanimated.View>
      )}
    </View>
  );

  // ── Cabecera del panel: huerta + métricas + escaneo elegido (siempre visible, también contraído) ──
  const sheetHeader = (
    <View style={st.sheetHead} onLayout={e => { const h = Math.round(e.nativeEvent.layout.height); if (Math.abs(h - headH) > 2) setHeadH(h); }}>
      <View style={st.headRow}>
        <Pressable onPress={guard(() => { tick(); setPicker('orchard'); })} accessibilityRole="button"
          accessibilityLabel={`${t('orchard')}: ${orchardObj?.nombre ?? (orchardFilter === 'none' ? t('noOrchard') : t('allOrchards'))}`}
          style={({ pressed }) => [st.orchardBar, pressed && st.pressed]}>
          <View style={st.leafTile}>{orchardObj ? <OrchardMini orchard={orchardObj} size={26} /> : <Leaf size={20} color="#0B1A0F" fill={D.neon} />}</View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.orchardName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{orchardObj ? orchardObj.nombre : orchardFilter === 'none' ? t('noOrchard') : t('allOrchards')}</Text>
            <Text style={st.orchardMeta} numberOfLines={1}>
              {orchardObj ? (orchardObj.area_m2 > 0 ? `${(orchardObj.area_m2 / 10000).toFixed(2)} ha` : t('orchard'))
                : orchardFilter === 'all' ? (orchards.length === 1 ? t('nOrchards1') : t('nOrchards', { count: orchards.length })) : scansText(countFor(orchardFilter))}
            </Text>
          </View>
          <ChevronDown size={18} color={D.muted} />
        </Pressable>
        <View style={st.kpiRow}>
          <Kpi icon={<Camera size={15} color={D.teal} />} tint="rgba(20,184,166,0.16)" value={String(kpis.scans)} label={t('kpiScans')} />
          <View style={st.kpiSep} />
          <Kpi icon={<Bug size={15} color={D.coral} />} tint="rgba(255,98,91,0.16)" value={String(kpis.findings)} label={t('kpiFindings')} />
          <View style={st.kpiSep} />
          <Kpi icon={<Route size={15} color={D.teal} />} tint="rgba(20,184,166,0.16)" value={fmtDistance(kpis.meters) ?? '—'} label={t('kpiDistance')} />
        </View>
      </View>
      {selected && (
        <Reanimated.View key={selected.id} entering={fade}>
          <ScanCard it={selected} on compact
            title={orchardText(selected.orchardId)} kind={kindText(selected)} date={`${fmtDate(selected.date)} · ${fmtTime(selected.date)}`}
            status={statusText(selected)} noOrchard={!selected.orchardId} noOrchardText={t('noOrchard')}
            resultText={selected.result?.label ? localizeDomainLabel(selected.result.label, language) : null}
            outline={selected.orchardId ? orchardById[selected.orchardId]?.coordinates : undefined}
            onPress={guard(() => openResults(selected))} onAction={guard(() => openResults(selected))}
            actionLabel={selected.kind === 'local' ? t('uploadNow') : selected.kind === 'foto' ? t('viewActivity') : t('viewResults')} />
        </Reanimated.View>
      )}
    </View>
  );

  // Botón explícito: contraído → «Ver historial»; intermedio → expandir; expandido → bajar.
  const sheetToggle = sheetIdx === 0 ? (
    <Pressable onPress={guard(expand)} accessibilityRole="button" accessibilityLabel={t('seeHistory')} hitSlop={8} style={({ pressed }) => [st.togglePill, pressed && st.pressed]}>
      <Text style={st.toggleText}>{t('seeHistory')}</Text>
      <ChevronUp size={15} color={D.ink} />
    </Pressable>
  ) : (
    <Pressable onPress={guard(sheetIdx === 2 ? collapse : expand)} accessibilityRole="button" accessibilityLabel={sheetIdx === 2 ? t('collapse') : t('expand')} hitSlop={10}
      style={({ pressed }) => [st.toggleRound, pressed && st.pressed]}>
      {sheetIdx === 2 ? <ChevronDown size={20} color={D.text} /> : <ChevronUp size={20} color={D.text} />}
    </Pressable>
  );

  // ── Encabezado de la lista ──
  const tabs: { key: Tab; label: string }[] = [
    { key: 'history', label: t('history') },
    { key: 'findings', label: t('findingsTab', { count: tabFindings.length }) },
    { key: 'photos', label: t('photosTab', { count: selected && selected.kind !== 'foto' ? tabPhotos.length : photoScans.length }) },
  ];
  const tabIdx = tabs.findIndex(x => x.key === tab);
  const listHeader = (
    <View style={st.listHead}>
      {loadError && (
        <View style={st.errorBox}>
          <Text style={st.errorText}>{t('loadError')}</Text>
          <Pressable onPress={() => load()} accessibilityRole="button" style={({ pressed }) => [st.retry, pressed && st.pressed]}><Text style={st.retryText}>{t('retry')}</Text></Pressable>
        </View>
      )}
      {locals.length > 0 && (
        <View style={st.sync}>
          {syncing ? <ActivityIndicator size="small" color={D.teal} /> : <CloudUpload size={18} color={D.teal} />}
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
      <View style={st.histHead}>
        <Text style={st.histTitle} accessibilityRole="header">{t('scanHistory')}</Text>
        {sheetIdx < 2 ? (
          <Pressable onPress={guard(expand)} accessibilityRole="button" hitSlop={8} style={({ pressed }) => [st.seeAll, pressed && st.pressed]}>
            <Text style={st.seeAllText}>{t('seeAll')}</Text>
            <ArrowRight size={16} color={D.neon} />
          </Pressable>
        ) : (
          <Text style={st.count}>{visible.length === 1 ? t('records1') : t('records', { count: visible.length })}</Text>
        )}
      </View>
      {sheetIdx === 2 && (
        <Reanimated.View entering={fade} style={st.tools}>
          <View style={st.searchBox}>
            <Search size={16} color={D.muted} />
            <TextInput ref={searchRef} value={query} onChangeText={setQuery} placeholder={t('search')} placeholderTextColor="rgba(170,181,191,0.7)"
              style={st.searchInput} returnKeyType="search" accessibilityLabel={t('search')} selectionColor={D.mint} />
            {!!query && <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('close')}><X size={15} color={D.muted} /></Pressable>}
          </View>
          <View style={st.toolRow}>
            <Pressable onPress={() => { tick(); setPicker('filters'); }} accessibilityRole="button" style={({ pressed }) => [st.toolChip, filtersActive && st.toolChipOn, pressed && st.pressed]}>
              <SlidersHorizontal size={14} color={filtersActive ? D.ink : D.text} />
              <Text style={[st.toolChipText, filtersActive && { color: D.ink }]}>{t('filters')}</Text>
            </Pressable>
            <Pressable onPress={() => { tick(); setSortAsc(v => !v); }} accessibilityRole="button" accessibilityLabel={sortAsc ? t('sortOld') : t('sortNew')}
              style={({ pressed }) => [st.toolChip, pressed && st.pressed]}>
              <ArrowUpDown size={14} color={D.text} />
              <Text style={st.toolChipText}>{sortAsc ? t('sortOld') : t('sortNew')}</Text>
            </Pressable>
          </View>
        </Reanimated.View>
      )}
      <View style={st.tabs} accessibilityRole="tablist">
        <Reanimated.View pointerEvents="none" style={[st.tabPillWrap, {
          left: `${(tabIdx * 100) / 3}%`, transitionProperty: reduced ? 'none' : 'left', transitionDuration: 220, transitionTimingFunction: CSS_EASE_OUT,
        } as object]}><View style={st.tabPill} /></Reanimated.View>
        {tabs.map(x => (
          <Pressable key={x.key} onPress={guard(() => { if (tab !== x.key) { tick(); setTab(x.key); } })} accessibilityRole="tab" accessibilityState={{ selected: tab === x.key }} style={st.tabBtn}>
            <Text style={[st.tabText, tab === x.key && st.tabTextOn]} numberOfLines={1}>{x.label}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'photos' && selected && selected.kind !== 'foto' && tabPhotos.length > 0 && !tabPhotos.some(p => p.uri) && <Text style={st.photoNote}>{t('photoGone')}.</Text>}
    </View>
  );

  const listEmpty = (
    <View style={st.emptyBox}>
      {loading && !items.length ? <ActivityIndicator color={D.teal} />
        : tab === 'history' ? (
          !items.length && !loadError ? (
            <>
              <Text style={st.emptyTitle}>{t('empty')}</Text>
              <Text style={st.empty}>{t('emptyBody')}</Text>
              <Pressable onPress={() => router.navigate('/(app)/scan')} accessibilityRole="button" style={({ pressed }) => [st.primary, pressed && st.pressed]}>
                <Camera size={16} color={D.ink} /><Text style={st.primaryText}>{t('goScan')}</Text>
              </Pressable>
            </>
          ) : <Text style={st.empty}>{t('emptyFilter')}</Text>
        ) : tab === 'findings' ? (
          <Text style={st.empty}>{selected ? (selected.status === 'listo' ? t('noFindingsDone') : t('noFindingsYet')) : t('noFindingsAll')}</Text>
        ) : (
          <Text style={st.empty}>{selected && selected.kind !== 'foto' ? (selected.remoteId && !fotosCache[selected.remoteId] ? '…' : t('noPhotoPoints')) : t('pickWalk')}</Text>
        )}
    </View>
  );

  const renderRow = ({ item, index }: { item: Row; index: number }) => {
    const enter = reduced || index > 8 ? undefined : FadeInDown.duration(220).delay(index * 30).easing(EASE_OUT);
    if (item.k === 'scan') {
      const it = item.it;
      return (
        <Reanimated.View entering={enter} style={st.rowWrap}>
          <ScanCard it={it} on={it.id === selectedId}
            title={orchardText(it.orchardId)} kind={kindText(it)} date={`${fmtDate(it.date)} · ${fmtTime(it.date)}`}
            status={statusText(it)} noOrchard={!it.orchardId} noOrchardText={t('noOrchard')}
            resultText={it.result?.label ? localizeDomainLabel(it.result.label, language) : null}
            outline={it.orchardId ? orchardById[it.orchardId]?.coordinates : undefined}
            progress={it.localId ? progress[it.localId] : undefined}
            onPress={guard(() => select(it.id))} onAction={guard(() => openResults(it))}
            actionLabel={it.kind === 'local' ? t('uploadNow') : it.kind === 'foto' ? t('viewActivity') : t('viewResults')} />
        </Reanimated.View>
      );
    }
    if (item.k === 'finding') {
      const h = item.h;
      const c = categoria(h);
      const on = point?.kind === 'finding' && point.id === h.id;
      const geo = validCoord(h.lat, h.lng);
      const parent = items.find(v => v.remoteId === h.recorrido_id);
      return (
        <Reanimated.View entering={enter} style={st.rowWrap}>
          <Pressable onPress={guard(() => { tick(); if (parent && parent.id !== selectedId) setSelectedId(parent.id); setPoint({ kind: 'finding', id: h.id }); if (geo) setSheetIdx(i => (i === 2 ? 1 : i)); })}
            accessibilityRole="button" accessibilityState={{ selected: on }}
            accessibilityLabel={`${findingLabel(h)}, ${catText(c)}, ${t('confidence', { pct: Math.round(h.confianza * 100) })}`}
            style={({ pressed }) => [st.card, on && st.cardOn, pressed && st.pressed]}>
            <View style={st.fThumb}>
              {h.miniatura_path ? <Image source={storageImage(h.miniatura_path)} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Bug size={22} color={FINDING_COLOR[c]} />}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <View style={[st.rowCenter, { gap: 6 }]}><FindingGlyph cat={c} /><Text style={st.cardTitle} numberOfLines={1}>{findingLabel(h)}</Text></View>
              <Text style={st.meta} numberOfLines={1}>{catText(c)} · {t('confidence', { pct: Math.round(h.confianza * 100) })}</Text>
              <Text style={st.metaSm} numberOfLines={1}>{localizeDomainLabel(h.fruto, language)} · {fmtDate(h.tomada_at)} {fmtTime(h.tomada_at)}{geo ? '' : ` · ${t('noLocation')}`}</Text>
            </View>
            {parent?.kind === 'remoto' && (
              <Pressable onPress={guard(() => openFinding(h.id))} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('viewFinding')} style={({ pressed }) => [st.go, pressed && st.pressed]}>
                <ChevronRight size={18} color={D.text} />
              </Pressable>
            )}
          </Pressable>
        </Reanimated.View>
      );
    }
    const p = item.p;
    const on = point?.kind === 'photo' && point.id === p.id;
    return (
      <Reanimated.View entering={enter} style={st.rowWrap}>
        <Pressable onPress={guard(() => { tick(); setPoint({ kind: 'photo', id: p.id }); setSheetIdx(x => (x === 2 ? 1 : x)); })}
          accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => [st.card, st.cardSlim, on && st.cardOn, pressed && st.pressed]}>
          <View style={st.pThumb}>{p.uri ? <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Camera size={16} color={D.teal} />}</View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.cardTitleSm}>{t('photoN', { n: item.i + 1, total: item.total })}</Text>
            <Text style={st.metaSm}>{fmtTime(p.tomada_at)} · {p.lat.toFixed(5)}, {p.lng.toFixed(5)}</Text>
          </View>
          <MapPin size={15} color={on ? D.mint : D.muted} />
        </Pressable>
      </Reanimated.View>
    );
  };

  // Vista previa del punto (foto u hallazgo) sobre el mapa.
  const pointCard = (() => {
    if (!point || !selected || sheetIdx === 2) return null;
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
              <ChevronRight size={18} color={D.ink} />
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
        <View style={st.pointThumb}>{p.uri ? <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Camera size={20} color={D.teal} />}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.pointTitle}>{t('photoN', { n: idx + 1, total: selectedPhotos.length })}</Text>
          <Text style={st.pointMeta}>{fmtDate(p.tomada_at)} · {fmtTime(p.tomada_at)}</Text>
          {!p.uri && <Text style={st.pointMeta} numberOfLines={2}>{t('photoGone')}</Text>}
        </View>
      </View>
    );
  })();

  const ctrlTop = (fullscreen ? insets.top + 12 : insets.top + 128);

  return (
    <GestureHandlerRootView style={st.screen}>
      {/* Mapa a pantalla completa: Leaflet se monta una sola vez; todo lo demás flota encima. */}
      <View style={StyleSheet.absoluteFill}>
        <ScansMap ref={mapRef} data={mapData} selectedId={selected?.loc || mapDetail ? selectedId : null} detail={mapDetail}
          point={point} user={me} layer={layer} pad={mapPad} routeStyle={routeStyle} onEvent={onMapEvent} />
      </View>

      {top}

      {/* Controles laterales */}
      <View style={[st.ctrlCol, { top: ctrlTop }]} pointerEvents="box-none">
        <CtrlBtn label={t('layers')} onPress={() => { tick(); setPicker('layers'); }}><Layers size={19} color={D.text} /></CtrlBtn>
        <View style={st.ctrlGroup}>
          <CtrlBtn grouped label={t('zoomIn')} onPress={() => mapRef.current?.zoom(1)}><Plus size={20} color={D.text} /></CtrlBtn>
          <View style={st.ctrlSep} />
          <CtrlBtn grouped label={t('zoomOut')} onPress={() => mapRef.current?.zoom(-1)}><Minus size={20} color={D.text} /></CtrlBtn>
        </View>
        <CtrlBtn label={fullscreen ? t('exitFull') : t('full')} onPress={() => { tick(); setFullscreen(f => !f); setSheetIdx(0); }}>
          {fullscreen ? <Minimize2 size={18} color={D.text} /> : <Maximize2 size={18} color={D.text} />}
        </CtrlBtn>
      </View>

      {/* Ubicación: sigue al panel y se oculta al expandirlo */}
      <Reanimated.View style={[st.fabWrap, fabStyle]} pointerEvents={sheetIdx === 2 ? 'none' : 'box-none'}>
        <Pressable onPress={() => { tick(); locate(); }} accessibilityRole="button" accessibilityLabel={t('lyMe')} hitSlop={6} style={({ pressed }) => [st.fab, pressed && st.pressed]}>
          <Navigation size={24} color="#FFFFFF" fill="#FFFFFF" />
        </Pressable>
      </Reanimated.View>

      {notice && sheetIdx < 2 && (
        <Reanimated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={[st.notice, { bottom: coverH + 84 }]} pointerEvents="none">
          <Text style={st.noticeText}>{notice}</Text>
        </Reanimated.View>
      )}

      {pointCard && (
        <Reanimated.View key={`${point?.kind}:${point?.id}`} entering={reduced ? FadeIn.duration(120) : FadeInDown.duration(220).easing(EASE_OUT)}
          exiting={reduced ? undefined : FadeOutDown.duration(150)} style={[st.pointCard, { bottom: coverH + 84 }]}>
          {pointCard}
          <Pressable onPress={() => setPoint(null)} accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={10} style={st.pointClose}>
            <X size={13} color={D.muted} />
          </Pressable>
        </Reanimated.View>
      )}

      <HistorySheet
        ref={sheetRef}
        snaps={snaps}
        index={sheetIdx}
        onIndexChange={setSheetIdx}
        reduced={reduced}
        y={sheetY}
        header={sheetHeader}
        accessory={sheetToggle}
        bottomPad={tabClear + 16}
        data={rows}
        renderItem={renderRow}
        keyExtractor={r => r.key}
        extraData={`${selectedId}|${point?.id}|${tab}|${language}|${Object.keys(progress).length}`}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        a11yLabel={t('panel')}
        a11yExpand={t('expand')}
        a11yCollapse={t('collapse')}
      />

      {/* Panel de huerta, filtros y capas: independiente del historial (Modal: no compiten por gestos). */}
      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)} statusBarTranslucent>
        <Pressable style={st.backdrop} onPress={() => setPicker(null)} accessibilityLabel={t('close')} />
        <SheetIn reduced={reduced} style={[st.modalSheet, { paddingBottom: insets.bottom + 16, maxHeight: height - insets.top - 24 }, isTablet && { left: '20%', right: '20%' }]}>
          <View style={st.modalHandle} />
          <View style={[st.rowCenter, { justifyContent: 'space-between', marginBottom: 8 }]}>
            <Text style={st.modalTitle}>{sheetKind === 'orchard' ? t('pickOrchard') : sheetKind === 'layers' ? t('layers') : t('filters')}</Text>
            <Pressable onPress={() => setPicker(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')} style={st.modalClose}><X size={17} color={D.text} /></Pressable>
          </View>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
            {sheetKind === 'orchard' && (
              <>
                <PickRow on={orchardFilter === 'all'} title={t('allOrchards')} meta={scansText(countFor('all'))} icon={<Leaf size={18} color="#0B1A0F" fill={D.neon} />}
                  onPress={() => { tick(); setOrchardFilter('all'); setPicker(null); }} />
                {orchards.map(o => (
                  <PickRow key={o.id} on={orchardFilter === o.id} title={o.nombre}
                    meta={`${o.area_m2 > 0 ? `${(o.area_m2 / 10000).toFixed(2)} ha · ` : ''}${scansText(countFor(o.id))}`}
                    icon={<OrchardMini orchard={o} size={30} />} onPress={() => { tick(); setOrchardFilter(o.id); setPicker(null); }} />
                ))}
                <PickRow on={orchardFilter === 'none'} title={t('noOrchard')} meta={scansText(countFor('none'))} icon={<MapPin size={18} color={D.muted} />}
                  onPress={() => { tick(); setOrchardFilter('none'); setPicker(null); }} />
              </>
            )}
            {sheetKind === 'filters' && (
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
                {cropOptions.length > 0 && (
                  <>
                    <Text style={st.groupLabel}>{t('crop')}</Text>
                    <View style={st.chips}>
                      <FilterChip on={cropFilter === 'all'} label={t('all')} onPress={() => { tick(); setCropFilter('all'); }} />
                      {cropOptions.map(c => (
                        <FilterChip key={c} on={cropFilter === c} label={localizeDomainLabel(c, language) ?? c} onPress={() => { tick(); setCropFilter(c); }} />
                      ))}
                    </View>
                  </>
                )}
                <Text style={st.groupLabel}>{t('periodLbl')}</Text>
                <View style={st.chips}>
                  {([['all', t('all')], [7, t('days', { n: 7 })], [30, t('days', { n: 30 })], [90, t('days', { n: 90 })]] as Array<[Period, string]>).map(([k, label]) => (
                    <FilterChip key={String(k)} on={period === k} label={label} onPress={() => { tick(); setPeriod(k); }} />
                  ))}
                </View>
                <View style={[st.rowCenter, { gap: 10, marginTop: 16 }]}>
                  <Pressable onPress={() => { tick(); setTypeFilter('all'); setStatusFilter('all'); setCropFilter('all'); setPeriod('all'); }} accessibilityRole="button" style={({ pressed }) => [st.ghostBtn, pressed && st.pressed]}>
                    <Text style={st.ghostText}>{t('clear')}</Text>
                  </Pressable>
                  <Pressable onPress={() => setPicker(null)} accessibilityRole="button" style={({ pressed }) => [st.primary, { flex: 1, marginTop: 0 }, pressed && st.pressed]}>
                    <Text style={st.primaryText}>{t('apply')}</Text>
                  </Pressable>
                </View>
              </>
            )}
            {sheetKind === 'layers' && (
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
                <Text style={[st.modalTitle, { fontSize: 16, marginTop: 18, marginBottom: 2 }]}>{t('lyLayers')}</Text>
                {([['routes', t('lyRoutes'), <Route key="r" size={17} color={D.teal} />], ['photos', t('lyPhotos'), <Camera key="c" size={17} color={D.teal} />],
                  ['findings', t('lyFindings'), <Bug key="b" size={17} color={D.coral} />], ['orchards', t('lyOrchards'), <Leaf key="l" size={17} color={D.neon} />]] as Array<[keyof ScansMapShow, string, React.ReactNode]>)
                  .map(([k, label, icon]) => (
                    <View key={k} style={st.toggleRow}>
                      <View style={st.pickIcon}>{icon}</View>
                      <Text style={[st.pickTitle, { flex: 1 }]}>{label}</Text>
                      <Switch value={show[k]} onValueChange={v => { tick(); setShow(s => ({ ...s, [k]: v })); }}
                        trackColor={{ true: 'rgba(20,184,166,0.55)', false: 'rgba(255,255,255,0.15)' }} thumbColor={show[k] ? D.mint : '#E2E8F0'} accessibilityLabel={label} />
                    </View>
                  ))}
              </>
            )}
          </ScrollView>
        </SheetIn>
      </Modal>
    </GestureHandlerRootView>
  );
}

// ───────── piezas ─────────

/**
 * Panel del modal: sube desde abajo. Arranca ya fuera de pantalla (valor compartido), así el primer
 * cuadro nunca lo muestra en su sitio antes de animar.
 */
function SheetIn({ reduced, style, children }: { reduced: boolean; style: object; children: React.ReactNode }) {
  const p = useSharedValue(reduced ? 0 : 1);
  useEffect(() => { p.set(withTiming(0, { duration: reduced ? 0 : 300, easing: EASE_OUT })); }, [p, reduced]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: p.get() * 640 }] }));
  return <Reanimated.View style={[style, anim]}>{children}</Reanimated.View>;
}

function Kpi({ icon, tint, value, label }: { icon: React.ReactNode; tint: string; value: string; label: string }) {
  return (
    <View style={st.kpi} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={[st.kpiIcon, { backgroundColor: tint }]}>{icon}</View>
      <Text style={st.kpiValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
      <Text style={st.kpiLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Text>
    </View>
  );
}

/** Botón redondo de cristal oscuro (encabezado). */
function GlassBtn({ label, onPress, children, active }: { label: string; onPress: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4}
      style={({ pressed }) => [st.glassBtn, active && st.glassBtnOn, pressed && st.pressed]}>{children}</Pressable>
  );
}

function CtrlBtn({ label, onPress, children, grouped }: { label: string; onPress: () => void; children: React.ReactNode; grouped?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4}
      style={({ pressed }) => [st.ctrlBtn, !grouped && st.ctrlSolo, pressed && { backgroundColor: 'rgba(255,255,255,0.12)', transform: [{ scale: 0.95 }] }]}>{children}</Pressable>
  );
}

/** Tarjeta oscura de un escaneo del historial (y resumen del elegido en la cabecera del panel). */
function ScanCard({ it, on, compact, title, kind, date, status, noOrchard, noOrchardText, resultText, outline, progress, onPress, onAction, actionLabel }: {
  it: ScanItem; on: boolean; compact?: boolean; title: string; kind: string; date: string; status: string; noOrchard: boolean; noOrchardText: string;
  resultText: string | null; outline?: { latitude: number; longitude: number }[]; progress?: { done: number; total: number };
  onPress: () => void; onAction: () => void; actionLabel: string;
}) {
  const TypeIcon = it.kind === 'foto' ? Camera : it.fuente === 'dron' ? Plane : it.fuente === 'camara' ? Video : Route;
  const healthy = !!resultText && /sano|saludable|healthy/i.test(it.result?.label ?? '');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      accessibilityLabel={`${kind}, ${title}, ${date}, ${status}`}
      style={({ pressed }) => [st.card, on && st.cardOn, compact && st.cardCompact, pressed && st.pressed]}>
      <ItemThumb item={it} size={compact ? 48 : 66} outline={outline} preferPhoto={it.kind === 'foto'} />
      <View style={{ flex: 1, minWidth: 0, gap: compact ? 2 : 4 }}>
        <View style={st.typeChip}>
          <TypeIcon size={12} color={D.lime} />
          <Text style={st.typeChipText} numberOfLines={1}>{kind}</Text>
        </View>
        <Text style={[st.cardTitle, compact && { fontSize: 14.5, lineHeight: 18 }, noOrchard && st.cardTitleMuted]} numberOfLines={1}>{noOrchard ? noOrchardText : title}</Text>
        <View style={st.rowCenter}>
          <Calendar size={12} color={D.muted} />
          <Text style={st.meta} numberOfLines={1}> {date}</Text>
          {it.status !== 'listo' && (
            <View style={[st.statusDot, { backgroundColor: SCAN_STATUS_COLOR[it.status] }]} />
          )}
          {it.status !== 'listo' && <Text style={[st.metaSm, { color: SCAN_STATUS_COLOR[it.status] }]} numberOfLines={1}>{status}</Text>}
        </View>
        {progress && (
          <View style={st.track}>
            <Reanimated.View style={[st.fill, { width: `${(progress.done / Math.max(1, progress.total)) * 100}%`, transitionProperty: 'width', transitionDuration: 300, transitionTimingFunction: CSS_EASE_OUT } as object]} />
          </View>
        )}
      </View>
      <View style={st.cardRight}>
        {it.kind === 'foto' ? (
          resultText ? (
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <View style={[st.resultChip, { backgroundColor: healthy ? 'rgba(139,245,43,0.14)' : 'rgba(255,98,91,0.16)' }]}>
                {healthy ? <Leaf size={11} color={D.neon} /> : <Bug size={11} color={D.coral} />}
                <Text style={[st.resultText, { color: healthy ? D.lime : D.coral }]} numberOfLines={1}>{resultText}</Text>
              </View>
              {it.result?.score != null && <Text style={st.scoreText}>{Math.round(it.result.score * 100)}%</Text>}
            </View>
          ) : null
        ) : (
          <View style={st.counts}>
            <View style={[st.countPill, { backgroundColor: 'rgba(20,184,166,0.16)' }]}><Camera size={12} color={D.teal} /><Text style={st.countText}>{it.photos ?? '—'}</Text></View>
            <View style={[st.countPill, { backgroundColor: 'rgba(255,98,91,0.16)' }]}><Bug size={12} color={D.coral} /><Text style={st.countText}>{it.findings ?? '—'}</Text></View>
          </View>
        )}
      </View>
      <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button" accessibilityLabel={actionLabel} style={({ pressed }) => [st.go, pressed && st.pressed]}>
        {it.kind === 'local' ? <CloudUpload size={17} color={D.teal} /> : <ChevronRight size={19} color={D.text} />}
      </Pressable>
    </Pressable>
  );
}

/** Forma y color de cada categoría (igual que en el mapa): círculo, rombo, cuadro, punto. */
function FindingGlyph({ cat }: { cat: CategoriaHallazgo }) {
  const c = FINDING_COLOR[cat];
  if (cat === 'revisar') return <View style={{ width: 9, height: 9, backgroundColor: c, transform: [{ rotate: '45deg' }], borderRadius: 2 }} />;
  if (cat === 'sano') return <View style={{ width: 10, height: 10, backgroundColor: c, borderRadius: 3 }} />;
  return <View style={{ width: cat === 'otro' ? 8 : 10, height: cat === 'otro' ? 8 : 10, backgroundColor: c, borderRadius: 5 }} />;
}

function FilterChip({ on, label, onPress, dot }: { on: boolean; label: string; onPress: () => void; dot?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={({ pressed }) => [st.fChip, on && st.fChipOn, pressed && st.pressed]}>
      {dot && <View style={[st.statusDot, { marginLeft: 0, backgroundColor: dot }]} />}
      <Text style={[st.fChipText, on && { color: D.ink }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function PickRow({ on, title, meta, icon, onPress }: { on: boolean; title: string; meta: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => [st.pickRow, on && st.pickRowOn, pressed && st.pressed]}>
      <View style={st.pickIcon}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.pickTitle} numberOfLines={1}>{title}</Text>
        <Text style={st.meta} numberOfLines={1}>{meta}</Text>
      </View>
      {on && <Check size={18} color={D.mint} />}
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
  if (!pts) return <Leaf size={15} color={D.neon} />;
  return <Svg width={size} height={size}><Polygon points={pts} fill="rgba(139,245,43,0.28)" stroke={D.neon} strokeWidth={1.5} strokeLinejoin="round" /></Svg>;
}

/**
 * Miniatura: con `preferPhoto`, foto real (hallazgo o foto) si existe; si no, vista satelital real del
 * recorrido; si tampoco hay geografía, un icono (nunca una foto inventada).
 */
function ItemThumb({ item, size, outline, preferPhoto }: { item: ScanItem; size: number; outline?: { latitude: number; longitude: number }[]; preferPhoto?: boolean }) {
  const [failed, setFailed] = useState(false);
  const geo = item.kind !== 'foto' && (item.route.length > 1 || item.localPhotos.length > 0);
  const outlinePts = useMemo(() => (outline ?? []).filter(p => validCoord(p.latitude, p.longitude)).map(p => ({ lat: p.latitude, lng: p.longitude })), [outline]);
  const photo = item.thumb && !failed ? (
    <View style={[st.thumb, { width: size, height: size }]}>
      <Image source={item.thumb} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
    </View>
  ) : null;
  if (preferPhoto && photo) return photo;
  if (geo) return <SatThumb route={item.route} points={item.localPhotos} outline={outlinePts} size={size} radius={14} />;
  if (photo) return photo;
  const Icon = item.kind === 'foto' ? Leaf : item.fuente === 'dron' ? Plane : item.fuente === 'camara' ? Video : Route;
  return (
    <View style={[st.thumb, st.center, { width: size, height: size, backgroundColor: '#1A252B' }]}>
      <Icon size={size * 0.36} color={item.kind === 'foto' ? D.lime : D.muted} />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: D.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.88 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  lockText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: D.text, textAlign: 'center', marginTop: 12, paddingHorizontal: 32 },
  lockBtn: { marginTop: 16, paddingHorizontal: 22, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: D.mint },
  lockBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: D.ink },

  // Encabezado flotante
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 26, alignItems: 'center' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: -18 },
  titleRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 560 },
  leafIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: D.neon, transform: [{ rotate: '-8deg' }] },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 21, lineHeight: 27, color: D.text, letterSpacing: -0.5 },
  subtitle: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: D.muted, marginTop: -2 },
  glassBtn: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: D.glass, borderWidth: 1, borderColor: D.border },
  glassBtnOn: { borderColor: D.mint },
  badge: { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: D.mint },
  segment: { marginTop: 12, height: 50, flexDirection: 'row', padding: 4, borderRadius: 25, backgroundColor: D.glass, borderWidth: 1, borderColor: D.border },
  segPill: { position: 'absolute', top: 4, bottom: 4, left: 0, borderRadius: 21, backgroundColor: D.mint },
  segBtn: { height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4 },
  segText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: D.text },
  segTextOn: { color: D.ink },
  legend: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 28, borderRadius: 14, backgroundColor: D.glass, borderWidth: 1, borderColor: D.border },
  legendText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: D.text },
  legendBar: { width: 64, height: 6, borderRadius: 3 },

  // Controles del mapa
  ctrlCol: { position: 'absolute', right: 14, gap: 10, alignItems: 'center' },
  ctrlGroup: { borderRadius: 18, overflow: 'hidden', backgroundColor: D.glass, borderWidth: 1, borderColor: D.border },
  ctrlSep: { height: 1, marginHorizontal: 10, backgroundColor: D.border },
  ctrlBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  ctrlSolo: { borderRadius: 18, backgroundColor: D.glass, borderWidth: 1, borderColor: D.border },
  fabWrap: { position: 'absolute', right: 16, bottom: 0 },
  fab: {
    width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F766E',
    borderWidth: 1.5, borderColor: 'rgba(167,243,208,0.45)', shadowColor: D.teal, shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 10,
  },
  notice: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: D.glass, borderWidth: 1, borderColor: D.border },
  noticeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: D.text },
  pointCard: { position: 'absolute', left: 14, right: 84, padding: 10, borderRadius: 18, backgroundColor: 'rgba(16,23,27,0.94)', borderWidth: 1, borderColor: D.border },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointThumb: { width: 50, height: 50, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A252B' },
  pointTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: D.text, flexShrink: 1 },
  pointMeta: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: D.muted },
  pointGo: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: D.mint },
  pointClose: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },

  // Panel
  sheetHead: { paddingHorizontal: 16, paddingBottom: 4, gap: 8 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orchardBar: { flex: 1.15, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingLeft: 8, paddingRight: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: D.border },
  leafTile: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(139,245,43,0.18)' },
  orchardName: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: D.text },
  orchardMeta: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: D.muted },
  kpiRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  kpi: { flex: 1, alignItems: 'center', gap: 1 },
  kpiIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  kpiValue: { fontFamily: 'Poppins_700Bold', fontSize: 16, lineHeight: 20, color: D.text },
  kpiLabel: { fontFamily: 'Poppins_400Regular', fontSize: 9.5, color: D.muted },
  kpiSep: { width: 1, height: 44, backgroundColor: D.border },
  togglePill: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: D.mint },
  toggleText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: D.ink },
  toggleRound: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: D.border },

  listHead: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  histHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: D.border, paddingTop: 14 },
  histTitle: { fontFamily: 'Poppins_700Bold', fontSize: 18, color: D.text, letterSpacing: -0.3 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: D.neon },
  count: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: D.muted },
  tools: { gap: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: D.border },
  searchInput: { flex: 1, minWidth: 0, fontFamily: 'Poppins_400Regular', fontSize: 14, color: D.text, paddingVertical: 8 },
  toolRow: { flexDirection: 'row', gap: 8 },
  toolChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: D.border },
  toolChipOn: { backgroundColor: D.mint, borderColor: D.mint },
  toolChipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: D.text },
  tabs: { flexDirection: 'row', height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: D.border, marginBottom: 4 },
  tabPillWrap: { position: 'absolute', top: 0, bottom: 0, width: '33.333%', padding: 3 },
  tabPill: { flex: 1, borderRadius: 16, backgroundColor: 'rgba(167,243,208,0.16)', borderWidth: 1, borderColor: 'rgba(167,243,208,0.45)' },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: D.muted },
  tabTextOn: { color: D.mint },
  photoNote: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: D.muted },

  rowWrap: { paddingHorizontal: 16, paddingTop: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 20,
    backgroundColor: D.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  cardOn: { borderColor: D.mint, borderWidth: 1.5, backgroundColor: 'rgba(167,243,208,0.07)' },
  cardCompact: { padding: 7, gap: 10, borderRadius: 18 },
  cardSlim: { paddingVertical: 8 },
  cardTitle: { fontFamily: 'Poppins_700Bold', fontSize: 16, lineHeight: 20, color: D.text },
  cardTitleMuted: { color: D.muted, fontFamily: 'Poppins_600SemiBold' },
  cardTitleSm: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: D.text },
  cardRight: { alignItems: 'flex-end', justifyContent: 'center' },
  typeChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(139,245,43,0.12)' },
  typeChipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: D.lime, flexShrink: 1 },
  meta: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: D.muted, flexShrink: 1 },
  metaSm: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: D.muted, flexShrink: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 8, marginRight: 4 },
  counts: { flexDirection: 'row', gap: 6 },
  countPill: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 8, borderRadius: 13 },
  countText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: D.text },
  resultChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, maxWidth: 110 },
  resultText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11.5, flexShrink: 1 },
  scoreText: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: D.text },
  go: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  thumb: { borderRadius: 14, overflow: 'hidden' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: 2 },
  fill: { height: 4, borderRadius: 2, backgroundColor: D.teal },
  fThumb: { width: 58, height: 58, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A252B' },
  pThumb: { width: 42, height: 42, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A252B' },

  sync: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: 'rgba(20,184,166,0.1)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.3)' },
  syncTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: D.text },
  syncBtn: { paddingHorizontal: 12, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: D.mint },
  syncBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: D.ink },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,98,91,0.12)', borderWidth: 1, borderColor: 'rgba(255,98,91,0.35)' },
  errorText: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: '#FECACA' },
  retry: { paddingHorizontal: 12, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  retryText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: D.text },
  emptyBox: { alignItems: 'center', gap: 10, paddingVertical: 24, paddingHorizontal: 24 },
  emptyTitle: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: D.text },
  empty: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 19, color: D.muted, textAlign: 'center' },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, paddingHorizontal: 20, borderRadius: 23, backgroundColor: D.mint, marginTop: 6 },
  primaryText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: D.ink },

  // Modal (huerta, filtros, capas)
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 8, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: D.surface, borderWidth: 1, borderBottomWidth: 0, borderColor: D.border },
  modalHandle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 10 },
  modalTitle: { fontFamily: 'Poppins_700Bold', fontSize: 18, color: D.text },
  modalClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  groupLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: D.muted, letterSpacing: 0.6, marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 13, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: D.border },
  fChipOn: { backgroundColor: D.mint, borderColor: D.mint },
  fChipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: D.text },
  ghostBtn: { height: 46, paddingHorizontal: 18, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: D.border },
  ghostText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: D.text },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: 'transparent' },
  pickRowOn: { borderColor: 'rgba(167,243,208,0.5)', backgroundColor: 'rgba(167,243,208,0.07)' },
  pickIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  pickTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: D.text },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
});
