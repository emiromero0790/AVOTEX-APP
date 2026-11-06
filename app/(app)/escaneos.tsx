/**
 * Mis escaneos — exploración geoespacial de recorridos, fotos y hallazgos.
 *
 * Datos reales, nada inventado:
 * - Huertas: perímetro real (huertas.coordinates).
 * - Recorridos: ruta GPS (recorridos.ruta), puntos de captura (recorrido_fotos.lat/lng) y hallazgos
 *   (hallazgos.lat/lng). Sin coordenadas → solo en el historial, con "Ubicación no disponible".
 * - Fotos individuales (tabla scans): solo tienen ubicación/imagen si la migración 20261107 está aplicada.
 *
 * Mapa e historial están sincronizados: elegir en uno resalta y muestra el mismo escaneo en el otro.
 * Movimiento (animate-expo): panel inferior arrastrable con resorte (UI thread), vistas previas con
 * fundidos cortos, vibración ligera al elegir. "Reducir movimiento" quita desplazamientos.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  useWindowDimensions, type ImageSourcePropType,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Reanimated, { FadeIn, FadeInDown, FadeOut, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';
import {
  BarChart3, Bug, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, CloudUpload, Filter, Layers, Leaf, Lock,
  LocateFixed, MapPin, Maximize, Minus, Navigation, Plane, Plus, Route, Search, Video, X,
} from 'lucide-react-native';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { auth as firebaseAuth } from '../../firebaseConfig';
import { useGuest } from '../../context/GuestContext';
import { localizeDomainLabel, TranslationResource, useLanguage, useTranslations } from '../../context/LanguageContext';
import { listOrchards, Orchard } from '../../services/orchards';
import {
  Fuente, RecorridoLocal, RecorridoRemoto, listLocal, listRemote, recoverInterrupted, uploadPending,
} from '../../services/recorridos';
import {
  categoria, cleanRoute, durationMinutes, listRecorridoFotos, listSingleScans, listUserHallazgos, routeMeters, storageImage,
  validCoord, type CategoriaHallazgo, type FotoPunto, type HallazgoMapa, type LatLng, type SingleScan,
} from '../../services/escaneos';
import ScansMap, { type ScansMapEvent, type ScansMapHandle } from '../../components/ScansMap';
import { FINDING_COLOR, SCAN_STATUS_COLOR, type ScanStatus, type ScansMapData, type ScansMapDetail, type ScansMapLayer } from '../../components/scansMapHtml';
import BottomSheet from '../../components/escaneos/BottomSheet';
import SatThumb from '../../components/escaneos/SatThumb';
import { CSS_EASE_OUT, EASE_OUT, PressableScale } from '../../components/scan/motion';
import { SCAN } from '../../components/scan/theme';

const auth = firebaseAuth as Auth;

const T: TranslationResource = {
  title: { es: 'Mis escaneos', en: 'My scans' },
  subtitle: { es: 'Explora tus recorridos y diagnósticos', en: 'Explore your walks and diagnoses' },
  search: { es: 'Buscar por huerta, fruto o fecha', en: 'Search by orchard, fruit or date' },
  searchBtn: { es: 'Buscar', en: 'Search' },
  filters: { es: 'Filtros', en: 'Filters' },
  orchard: { es: 'Huerta', en: 'Orchard' },
  allOrchards: { es: 'Todas las huertas', en: 'All orchards' },
  noOrchard: { es: 'Sin huerta asignada', en: 'No orchard' },
  pickOrchard: { es: 'Elige una huerta', en: 'Choose an orchard' },
  nScans: { es: '{count} escaneos', en: '{count} scans' },
  nScans1: { es: '1 escaneo', en: '1 scan' },
  history: { es: 'Historial reciente', en: 'Recent history' },
  records: { es: '{count} registros', en: '{count} records' },
  records1: { es: '1 registro', en: '1 record' },
  all: { es: 'Todos', en: 'All' },
  walks: { es: 'Recorridos', en: 'Walks' },
  photos: { es: 'Fotos', en: 'Photos' },
  status: { es: 'Estado', en: 'Status' },
  stAll: { es: 'Todos los estados', en: 'All statuses' },
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
  tapHint: { es: 'Toca un escaneo en el mapa o desliza para ver tu historial.', en: 'Tap a scan on the map or swipe up for your history.' },
  details: { es: 'Ver detalle', en: 'View details' },
  detailTitle: { es: 'Detalle del recorrido', en: 'Walk details' },
  back: { es: 'Volver', en: 'Back' },
  findingsTitle: { es: 'Hallazgos detectados ({count})', en: 'Detected findings ({count})' },
  noFindings: { es: 'El análisis no encontró hallazgos en este recorrido.', en: 'The analysis found nothing in this walk.' },
  pendingFindings: { es: 'Los hallazgos aparecerán cuando termine el análisis.', en: 'Findings will appear when the analysis finishes.' },
  viewResults: { es: 'Ver resultados completos', en: 'View full results' },
  viewActivity: { es: 'Ver en Actividad', en: 'View in Activity' },
  uploadNow: { es: 'Subir ahora', en: 'Upload now' },
  legend: { es: 'Cómo leer el mapa', en: 'Map legend' },
  lgStart: { es: 'Inicio', en: 'Start' },
  lgEnd: { es: 'Fin', en: 'End' },
  lgPhoto: { es: 'Foto tomada', en: 'Photo taken' },
  lgHealthy: { es: 'Saludable', en: 'Healthy' },
  lgDisease: { es: 'Posible enfermedad', en: 'Possible disease' },
  lgReview: { es: 'Revisar (confianza baja)', en: 'Review (low confidence)' },
  lgOther: { es: 'No es fruto', en: 'Not a fruit' },
  photoN: { es: 'Foto {n} de {total}', en: 'Photo {n} of {total}' },
  photoGone: { es: 'La foto original no se conserva después del análisis.', en: 'The original photo is not kept after analysis.' },
  confidence: { es: 'Confianza {pct} %', en: 'Confidence {pct}%' },
  syncTitle: { es: '{count} en el celular sin subir', en: '{count} on this phone, not uploaded' },
  syncing: { es: 'Subiendo…', en: 'Uploading…' },
  offline: { es: 'Sin conexión: se subirán al recuperar la señal.', en: 'Offline: they will upload when back online.' },
  wifiRequired: { es: 'Se subirán con WiFi.', en: 'They will upload on WiFi.' },
  empty: { es: 'Aún no tienes escaneos. Inicia uno desde Escanear.', en: 'No scans yet. Start one from Scan.' },
  emptyFilter: { es: 'No hay escaneos con estos filtros.', en: 'No scans match these filters.' },
  loadError: { es: 'No pudimos cargar todo. Toca para reintentar.', en: 'Could not load everything. Tap to retry.' },
  layers: { es: 'Satélite / híbrido', en: 'Satellite / hybrid' },
  locate: { es: 'Mi ubicación', en: 'My location' },
  zoomIn: { es: 'Acercar', en: 'Zoom in' },
  zoomOut: { es: 'Alejar', en: 'Zoom out' },
  fit: { es: 'Centrar', en: 'Center' },
  layerSat: { es: 'Satélite', en: 'Satellite' },
  layerHybrid: { es: 'Híbrido', en: 'Hybrid' },
  locDenied: { es: 'Activa la ubicación para verte en el mapa.', en: 'Turn on location to see yourself on the map.' },
  close: { es: 'Cerrar', en: 'Close' },
  locked: { es: 'Crea una cuenta para ver tus escaneos en el mapa.', en: 'Create an account to see your scans on the map.' },
  signIn: { es: 'Crear cuenta / Iniciar sesión', en: 'Create account / Sign in' },
  inQueue: { es: 'En cola para análisis. Te avisaremos cuando esté listo.', en: 'Queued for analysis. We will notify you when ready.' },
  failed: { es: 'El análisis falló; se reintentará automáticamente.', en: 'The analysis failed; it will retry automatically.' },
};

type TypeFilter = 'all' | 'walk' | 'photo';
type StatusFilter = 'all' | 'listo' | 'progress' | 'local' | 'error';
type OrchardFilter = 'all' | 'none' | string;
type Kind = 'remoto' | 'local' | 'foto';

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
  /** Fotos con GPS conocidas sin consultar (solo recorridos guardados en el celular). */
  localPhotos: FotoPunto[];
  loc: LatLng | null;
  thumb: ImageSourcePropType | null;
  remoteId?: string;
  localId?: string;
  result?: { fruto: string | null; label: string | null; score: number | null };
};

type Point = { kind: 'photo' | 'finding'; id: string };

function remoteStatus(estado: RecorridoRemoto['estado']): ScanStatus {
  return estado === 'listo' ? 'listo' : estado === 'procesando' ? 'proceso' : estado === 'error' ? 'error' : 'cola';
}

const STATUS_TEXT_COLOR: Record<ScanStatus, string> = { listo: '#15803D', proceso: '#B45309', cola: '#B45309', local: '#0369A1', error: '#B91C1C' };
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
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const params = useLocalSearchParams<{ n?: string; focus?: string }>();
  const isTablet = width >= 768;

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const email = user?.email ?? '';
  const uid = user?.uid ?? '';
  const [orchards, setOrchards] = useState<Orchard[]>([]);
  const [remotes, setRemotes] = useState<RecorridoRemoto[]>([]);
  const [locals, setLocals] = useState<RecorridoLocal[]>([]);
  const [singles, setSingles] = useState<SingleScan[]>([]);
  const [hallazgos, setHallazgos] = useState<HallazgoMapa[]>([]);
  const [fotosCache, setFotosCache] = useState<Record<string, FotoPunto[]>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [point, setPoint] = useState<Point | null>(null);
  const [detailMode, setDetailMode] = useState(false);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [orchardFilter, setOrchardFilter] = useState<OrchardFilter>('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [picker, setPicker] = useState<'orchard' | 'status' | null>(null);
  const [layer, setLayer] = useState<ScansMapLayer>('satelite');
  const [me, setMe] = useState<LatLng | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cardH, setCardH] = useState(0);
  const [progress, setProgress] = useState<Record<string, { done: number; total: number }>>({});
  const [syncNote, setSyncNote] = useState<'offline' | 'wifi-required' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const mapRef = useRef<ScansMapHandle>(null);
  const listRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const rowY = useRef<Record<string, number>>({});

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useFocusEffect(useCallback(() => { setStatusBarStyle('dark'); }, []));

  // ───────── datos ─────────
  const load = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setLoadError(false);
    let failed = false;
    await recoverInterrupted(email).catch(() => {});
    const [o, r, l, sc, hz] = await Promise.all([
      listOrchards(email).catch(() => { failed = true; return [] as Orchard[]; }),
      listRemote(email, 80).catch(() => { failed = true; return [] as RecorridoRemoto[]; }),
      listLocal(email).catch(() => [] as RecorridoLocal[]),
      uid ? listSingleScans(uid).catch(() => { failed = true; return [] as SingleScan[]; }) : Promise.resolve([] as SingleScan[]),
      listUserHallazgos(email).catch(() => { failed = true; return [] as HallazgoMapa[]; }),
    ]);
    setOrchards(o);
    setRemotes(r);
    setLocals(l.filter(x => x.fotos.length > 0));
    setSingles(sc);
    setHallazgos(hz);
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
      const pts: FotoPunto[] = rec.fotos
        .filter(f => validCoord(f.lat, f.lng))
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
      const geoFinding = hs.find(h => validCoord(h.lat, h.lng));
      const thumbPath = hs.find(h => h.miniatura_path)?.miniatura_path;
      out.push({
        id: `remote:${r.id}`, kind: 'remoto', status: remoteStatus(r.estado), date: r.iniciado_at, endedAt: r.terminado_at, fuente: r.fuente ?? 'celular',
        photos: r.fotos_total, findings: r.estado === 'listo' ? r.hallazgos_total : null, orchardId: r.huerta_id, route, localPhotos: [],
        loc: route[0] ?? (geoFinding ? { lat: geoFinding.lat as number, lng: geoFinding.lng as number } : null),
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

  // ───────── geometría del panel y del mapa ─────────
  const peek = selected ? (selected.kind === 'foto' ? 150 : 178) : 100;
  const snaps = useMemo(() => {
    const full = Math.max(peek + 120, cardH - 10);
    const mid = Math.max(peek + 60, Math.round(cardH * (detailMode ? 0.6 : 0.52)));
    return [peek, Math.min(mid, full - 40), full];
  }, [peek, cardH, detailMode]);
  const sheetVisible = cardH ? snaps[Math.min(sheetIdx, 2)] : peek;

  const mapData = useMemo<ScansMapData>(() => ({
    orchards: orchards
      .filter(o => Array.isArray(o.coordinates) && o.coordinates.length >= 3)
      .map(o => ({ id: o.id, name: o.nombre, points: o.coordinates.filter(c => validCoord(c.latitude, c.longitude)).map(c => ({ lat: c.latitude, lng: c.longitude })) })),
    scans: visible.filter(it => it.loc).map(it => ({ id: it.id, kind: it.kind === 'foto' ? 'foto' : 'recorrido', status: it.status, lat: it.loc!.lat, lng: it.loc!.lng })),
    focusOrchard: orchardFilter !== 'all' && orchardFilter !== 'none' ? orchardFilter : null,
    fitKey: `${orchardFilter}|${typeFilter}|${statusFilter}|${orchards.length}|${items.length > 0}`,
    pad: { top: detailMode ? insets.top + 56 : 12, right: 58, bottom: Math.min(sheetVisible, cardH * 0.62) + 6, left: 12 },
    reduced,
  }), [orchards, visible, orchardFilter, typeFilter, statusFilter, items.length, detailMode, insets.top, sheetVisible, cardH, reduced]);

  const mapDetail = useMemo<ScansMapDetail | null>(() => {
    if (!selected || selected.kind === 'foto') return null;
    const photos = selectedPhotos.map((p, i) => ({ id: p.id, lat: p.lat, lng: p.lng, n: i + 1 }));
    const findings = selectedFindings.filter(h => validCoord(h.lat, h.lng)).map(h => ({ id: h.id, lat: h.lat as number, lng: h.lng as number, cat: categoria(h) }));
    if (selected.route.length < 2 && !photos.length && !findings.length) return null;
    return { id: selected.id, route: selected.route, photos, findings };
  }, [selected, selectedPhotos, selectedFindings]);

  // ───────── selección (sincronizada mapa ↔ historial) ─────────
  const select = useCallback((id: string | null, from: 'map' | 'list') => {
    setPoint(null);
    if (!id) { setSelectedId(null); setDetailMode(false); return; }
    tick();
    setSelectedId(id);
    // Desde el historial: se baja el panel para dejar ver el mapa que vuela al escaneo.
    if (from === 'list') setSheetIdx(0);
  }, []);

  // Al elegir desde el mapa con el historial abierto, la fila elegida se desplaza a la vista.
  useEffect(() => {
    if (!selectedId || sheetIdx === 0) return;
    const y = rowY.current[selectedId];
    if (y != null) listRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: !reduced });
  }, [selectedId, sheetIdx, reduced]);

  useEffect(() => {
    if (params.focus && items.some(i => i.id === params.focus)) select(params.focus, 'list');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.focus, items.length]);

  const onMapEvent = useCallback((e: ScansMapEvent) => {
    if (e.type === 'select') { select(e.id, 'map'); setSheetIdx(0); }
    else if (e.type === 'orchard') { if (!selectedId) { tick(); setOrchardFilter(e.id); } }
    else if (e.type === 'point') { tick(); setPoint({ kind: e.kind, id: e.id }); }
    else if (e.type === 'clear') {
      if (point) setPoint(null);
      else if (!detailMode) select(null, 'map');
    }
  }, [select, selectedId, point, detailMode]);

  const openDetail = () => {
    if (!selected || selected.kind === 'foto') return;
    tick();
    setDetailMode(true);
    setSheetIdx(1);
  };
  const closeDetail = () => { tick(); setPoint(null); setDetailMode(false); setSheetIdx(0); };

  const openResults = (it: ScanItem) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (it.kind === 'remoto' && it.remoteId) router.push({ pathname: '/(app)/recorrido', params: { id: it.remoteId, from: 'escaneos', n: String(Date.now()) } });
    else if (it.kind === 'foto') router.navigate('/(app)/results');
    else sync(true);
  };

  // ───────── ubicación y capas ─────────
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
  const toggleLayer = () => {
    tick();
    const next: ScansMapLayer = layer === 'satelite' ? 'hibrido' : 'satelite';
    setLayer(next);
    setNotice(next === 'satelite' ? t('layerSat') : t('layerHybrid'));
  };

  const statusText = (it: ScanItem) => {
    if (it.localId && progress[it.localId]) return t('stUploading', { done: progress[it.localId].done, total: progress[it.localId].total });
    return it.status === 'listo' ? t('stListo') : it.status === 'proceso' ? t('stProceso') : it.status === 'cola' ? t('stCola') : it.status === 'local' ? t('stLocal') : t('stError');
  };

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

  const tabClear = (isTablet ? 82 + 24 : 72 + 18) + 8;
  const orchardObj = orchardFilter !== 'all' && orchardFilter !== 'none' ? orchardById[orchardFilter] : null;
  const scansText = (n: number) => (n === 1 ? t('nScans1') : t('nScans', { count: n }));
  const countFor = (f: OrchardFilter) => items.filter(it => matchesOrchard(it, f)).length;
  const statusActive = statusFilter !== 'all';
  const fade = reduced ? undefined : FadeIn.duration(180).easing(EASE_OUT);

  const findingLabel = (h: HallazgoMapa) => {
    const c = categoria(h);
    if (c === 'otro') return t('lgOther');
    return localizeDomainLabel(h.estado, language) ?? h.estado;
  };

  // Tarjeta del punto activo (foto u hallazgo) sobre el mapa.
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
            <View style={st.rowCenter}>
              <View style={[st.dot, { backgroundColor: FINDING_COLOR[c] }]} />
              <Text style={st.pointTitle} numberOfLines={1}>{findingLabel(h)}</Text>
            </View>
            <Text style={st.pointMeta} numberOfLines={1}>
              {localizeDomainLabel(h.fruto, language)} · {t('confidence', { pct: Math.round(h.confianza * 100) })}
            </Text>
            <Text style={st.pointMeta}>{fmtTime(h.tomada_at)}{c === 'revisar' ? ` · ${t('lgReview')}` : ''}</Text>
          </View>
        </View>
      );
    }
    const idx = selectedPhotos.findIndex(p => p.id === point.id);
    const p = selectedPhotos[idx];
    if (!p) return null;
    return (
      <View style={st.pointRow}>
        <View style={st.pointThumb}>
          {p.uri ? <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Camera size={20} color={SCAN.brand} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.pointTitle}>{t('photoN', { n: idx + 1, total: selectedPhotos.length })}</Text>
          <Text style={st.pointMeta}>{fmtDate(p.tomada_at)} · {fmtTime(p.tomada_at)}</Text>
          {!p.uri && <Text style={st.pointMeta} numberOfLines={2}>{t('photoGone')}</Text>}
        </View>
      </View>
    );
  })();

  const statsFor = (it: ScanItem) => {
    const km = fmtDistance(routeMeters(it.route));
    return { km, mins: durationMinutes(it.date, it.endedAt) };
  };

  const header = !detailMode && (
    <View style={[st.header, { paddingTop: insets.top + 6 }]}>
      <View style={st.headRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.title} accessibilityRole="header" numberOfLines={1}>{t('title')}</Text>
          {!searchOpen && <Text style={st.subtitle} numberOfLines={1}>{t('subtitle')}</Text>}
        </View>
        <IconBtn label={t('searchBtn')} onPress={() => { tick(); setSearchOpen(o => !o); if (searchOpen) setQuery(''); }} active={searchOpen || !!query}>
          {searchOpen ? <X size={18} color={SCAN.ink} /> : <Search size={18} color={SCAN.ink} />}
        </IconBtn>
        <IconBtn label={t('filters')} onPress={() => { tick(); setPicker('status'); }} active={statusActive}>
          <Filter size={17} color={SCAN.ink} />
          {statusActive && <View style={st.badge} />}
        </IconBtn>
      </View>
      {searchOpen && (
        <Reanimated.View entering={fade} style={st.searchBox}>
          <Search size={15} color={SCAN.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('search')}
            placeholderTextColor="#94A3B8"
            style={st.searchInput}
            autoFocus
            returnKeyType="search"
            accessibilityLabel={t('search')}
          />
        </Reanimated.View>
      )}
      <Pressable onPress={() => { tick(); setPicker('orchard'); }} accessibilityRole="button" accessibilityLabel={`${t('orchard')}: ${orchardObj?.nombre ?? (orchardFilter === 'none' ? t('noOrchard') : t('allOrchards'))}`}
        style={({ pressed }) => [st.orchardPill, pressed && st.pressed]}>
        <View style={st.orchardIcon}>
          {orchardObj ? <OrchardMini orchard={orchardObj} size={26} /> : <Leaf size={16} color="#3F6212" />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.orchardName} numberOfLines={1}>
            {orchardObj ? `${t('orchard')}: ${orchardObj.nombre}` : orchardFilter === 'none' ? t('noOrchard') : t('allOrchards')}
          </Text>
          <Text style={st.orchardMeta} numberOfLines={1}>
            {orchardObj && orchardObj.area_m2 > 0 ? `${(orchardObj.area_m2 / 10000).toFixed(2)} ha · ` : ''}{scansText(countFor(orchardFilter))}
          </Text>
        </View>
        <ChevronDown size={18} color={SCAN.muted} />
      </Pressable>
    </View>
  );

  // Cabecera del panel (zona arrastrable).
  const sheetHeader = (() => {
    if (detailMode && selected) {
      const o = selected.orchardId ? orchardById[selected.orchardId] : null;
      return (
        <View style={st.sheetHead}>
          <Text style={st.detailTitle} numberOfLines={1}>{kindText(selected)}</Text>
          <Text style={st.detailOrchard} numberOfLines={1}>
            {orchardText(selected.orchardId)}{o && o.area_m2 > 0 ? ` · ${(o.area_m2 / 10000).toFixed(2)} ha` : ''}
          </Text>
          <View style={[st.rowCenter, { justifyContent: 'space-between', marginTop: 4 }]}>
            <View style={st.rowCenter}>
              <Clock size={13} color={SCAN.muted} />
              <Text style={st.meta}> {fmtDate(selected.date)} · {fmtTime(selected.date)}</Text>
            </View>
            <StatusChip status={selected.status} text={statusText(selected)} />
          </View>
        </View>
      );
    }
    if (selected) {
      const { km } = statsFor(selected);
      return (
        <Reanimated.View key={selected.id} entering={fade} style={st.sheetHead}>
          <Pressable
            onPress={selected.kind === 'foto' ? () => openResults(selected) : openDetail}
            accessibilityRole="button"
            accessibilityLabel={`${kindText(selected)}, ${t('details')}`}
            style={({ pressed }) => [st.previewRow, pressed && { opacity: 0.85 }]}
          >
            <ItemThumb item={selected} size={58} outline={selected.orchardId ? orchardById[selected.orchardId]?.coordinates : undefined} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={st.rowTitle} numberOfLines={1}>{kindText(selected)}</Text>
              <Text style={st.meta} numberOfLines={1}>{orchardText(selected.orchardId)} · {fmtDate(selected.date)}, {fmtTime(selected.date)}</Text>
              <View style={st.rowCenter}>
                <StatusChip status={selected.status} text={statusText(selected)} />
                {!selected.loc && <Text style={[st.meta, { marginLeft: 8 }]} numberOfLines={1}>{t('noLocation')}</Text>}
              </View>
            </View>
            <View style={st.chevBtn}><ChevronRight size={18} color={SCAN.ink} /></View>
          </Pressable>
          {selected.kind === 'foto' ? (
            selected.result?.label ? (
              <View style={[st.rowCenter, st.photoResult]}>
                <View style={[st.dot, { backgroundColor: isHealthyLabel(selected.result.label) ? FINDING_COLOR.sano : FINDING_COLOR.enfermo }]} />
                <Text style={st.photoResultText} numberOfLines={1}>
                  {localizeDomainLabel(selected.result.label, language)}
                  {selected.result.score != null ? ` · ${t('confidence', { pct: Math.round(selected.result.score * 100) })}` : ''}
                </Text>
              </View>
            ) : null
          ) : (
            <View style={st.statsRow}>
              <Stat icon={<Camera size={15} color={SCAN.brand} />} value={selected.photos != null ? String(selected.photos) : '—'} label={t('statPhotos')} />
              <View style={st.statSep} />
              <Stat icon={<Bug size={15} color={selected.findings ? FINDING_COLOR.enfermo : SCAN.muted} />} value={selected.findings != null ? String(selected.findings) : '—'} label={t('statFindings')} />
              <View style={st.statSep} />
              <Stat icon={<Route size={15} color={SCAN.brand} />} value={km ?? '—'} label={t('statRoute')} />
            </View>
          )}
        </Reanimated.View>
      );
    }
    return (
      <View style={st.sheetHead}>
        <View style={[st.rowCenter, { justifyContent: 'space-between' }]}>
          <Text style={st.sectionTitle}>{t('history')}</Text>
          <Text style={st.count}>{(visible.length === 1 ? t('records1') : t('records', { count: visible.length }))}</Text>
        </View>
        <Text style={st.hint} numberOfLines={2}>{t('tapHint')}</Text>
      </View>
    );
  })();

  const listBottom = cardH ? Math.max(24, snaps[2] - sheetVisible + 24) : 24;

  const historyBody = (
    <ScrollView key="history" ref={listRef} contentContainerStyle={{ paddingBottom: listBottom }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {selected && (
        <View style={[st.rowCenter, st.listHead]}>
          <Text style={st.sectionTitle}>{t('history')}</Text>
          <Text style={st.count}>{(visible.length === 1 ? t('records1') : t('records', { count: visible.length }))}</Text>
        </View>
      )}
      <View style={st.segment} accessibilityRole="tablist">
        {([['all', t('all'), null], ['walk', t('walks'), Route], ['photo', t('photos'), Camera]] as Array<[TypeFilter, string, typeof Route | null]>).map(([k, label, Icon]) => {
          const on = typeFilter === k;
          return (
            <Pressable key={k} onPress={() => { if (!on) { tick(); setTypeFilter(k); } }} accessibilityRole="tab" accessibilityState={{ selected: on }}
              style={[st.segBtn, on && st.segBtnOn, { transitionProperty: 'backgroundColor', transitionDuration: 160, transitionTimingFunction: CSS_EASE_OUT } as object]}>
              {Icon && <Icon size={14} color={on ? '#3F6212' : SCAN.muted} />}
              <Text style={[st.segText, on && st.segTextOn]} numberOfLines={1}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

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

      {loadError && (
        <Pressable onPress={() => load()} accessibilityRole="button"><Text style={st.error}>{t('loadError')}</Text></Pressable>
      )}
      {loading && !items.length ? <ActivityIndicator color={SCAN.brand} style={{ marginTop: 20 }} /> : null}
      {!loading && !items.length && <Text style={st.empty}>{t('empty')}</Text>}
      {!!items.length && !visible.length && <Text style={st.empty}>{t('emptyFilter')}</Text>}

      {visible.map((it, i) => {
        const on = it.id === selectedId;
        const { km } = statsFor(it);
        return (
          <Reanimated.View key={it.id} entering={reduced || i > 12 ? undefined : FadeIn.duration(200).delay(i * 25)}
            onLayout={e => { rowY.current[it.id] = e.nativeEvent.layout.y; }}>
            <Pressable
              onPress={() => select(it.id, 'list')}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${kindText(it)}, ${orchardText(it.orchardId)}, ${fmtDate(it.date)}, ${statusText(it)}`}
              style={({ pressed }) => [st.row, on && st.rowOn, pressed && { opacity: 0.85 }]}
            >
              <ItemThumb item={it} size={64} outline={it.orchardId ? orchardById[it.orchardId]?.coordinates : undefined} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={st.rowTitle} numberOfLines={1}>{kindText(it)}</Text>
                <Text style={st.meta} numberOfLines={1}>{orchardText(it.orchardId)} · {fmtDate(it.date)}</Text>
                <View style={[st.rowCenter, { gap: 8, flexWrap: 'wrap' }]}>
                  <StatusChip status={it.status} text={statusText(it)} small />
                  {it.kind !== 'foto' && it.photos != null && <Mini icon={<Camera size={12} color={SCAN.muted} />} text={String(it.photos)} />}
                  {it.findings != null && <Mini icon={<Bug size={12} color={it.findings ? FINDING_COLOR.enfermo : SCAN.muted} />} text={String(it.findings)} />}
                  {km && <Mini icon={<Route size={12} color={SCAN.muted} />} text={km} />}
                  {!it.loc && <Mini icon={<MapPin size={12} color={SCAN.muted} />} text={t('noLocation')} />}
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
              <Pressable
                onPress={() => openResults(it)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={it.kind === 'local' ? t('uploadNow') : it.kind === 'foto' ? t('viewActivity') : t('viewResults')}
                style={({ pressed }) => [st.rowAction, pressed && st.pressed]}
              >
                {it.kind === 'local' ? <CloudUpload size={16} color={SCAN.ink} /> : <ChevronRight size={18} color={SCAN.ink} />}
              </Pressable>
            </Pressable>
          </Reanimated.View>
        );
      })}
    </ScrollView>
  );

  const detailBody = selected && (() => {
    const { km, mins } = statsFor(selected);
    const cats = new Set(selectedFindings.map(categoria));
    return (
      <ScrollView key={`detail:${selected.id}`} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: listBottom }} showsVerticalScrollIndicator={false}>
        <View style={st.statsGrid}>
          <Stat icon={<Camera size={17} color={SCAN.brand} />} value={selected.photos != null ? String(selected.photos) : '—'} label={t('statPhotos')} big />
          <View style={st.statSep} />
          <Stat icon={<Bug size={17} color={selected.findings ? FINDING_COLOR.enfermo : SCAN.muted} />} value={selected.findings != null ? String(selected.findings) : '—'} label={t('statFindings')} big />
          <View style={st.statSep} />
          <Stat icon={<Route size={17} color={SCAN.brand} />} value={km ?? '—'} label={t('statRoute')} big />
          <View style={st.statSep} />
          <Stat icon={<Clock size={17} color={SCAN.brand} />} value={mins != null ? `${mins} min` : '—'} label={t('statTime')} big />
        </View>

        <Text style={[st.sectionTitle, { marginTop: 16 }]}>{t('findingsTitle', { count: selectedFindings.length })}</Text>
        {selectedFindings.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 10 }}>
            {selectedFindings.map(h => {
              const c = categoria(h);
              const on = point?.kind === 'finding' && point.id === h.id;
              return (
                <Pressable key={h.id} onPress={() => { tick(); if (validCoord(h.lat, h.lng)) { setPoint({ kind: 'finding', id: h.id }); setSheetIdx(0); } else setPoint({ kind: 'finding', id: h.id }); }}
                  accessibilityRole="button" accessibilityLabel={`${findingLabel(h)}, ${t('confidence', { pct: Math.round(h.confianza * 100) })}`}
                  style={({ pressed }) => [st.fCard, on && { borderColor: FINDING_COLOR[c] }, pressed && st.pressed]}>
                  {h.miniatura_path ? <Image source={storageImage(h.miniatura_path)} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    : <View style={[StyleSheet.absoluteFill, st.center]}><Bug size={26} color={FINDING_COLOR[c]} /></View>}
                  <View style={[st.fLabel, { backgroundColor: `${FINDING_COLOR[c]}E6` }]}>
                    {c === 'sano' ? <Leaf size={11} color="#fff" /> : <Bug size={11} color="#fff" />}
                    <Text style={st.fLabelText} numberOfLines={1}>{findingLabel(h)}</Text>
                  </View>
                  {!validCoord(h.lat, h.lng) && <View style={st.fNoGeo}><MapPin size={10} color="#fff" /></View>}
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={[st.meta, { marginTop: 6 }]}>
            {selected.status === 'listo' ? t('noFindings') : selected.status === 'error' ? t('failed') : selected.kind === 'local' ? '' : t('pendingFindings')}
          </Text>
        )}

        {/* Leyenda: solo lo que hay en el mapa para este recorrido. */}
        <Text style={[st.sectionTitle, { marginTop: 12, fontSize: 13 }]}>{t('legend')}</Text>
        <View style={st.legend}>
          {selected.route.length > 1 && <LegendItem swatch={<View style={[st.lgDot, { backgroundColor: '#0f766e' }]}><Navigation size={9} color="#fff" fill="#fff" /></View>} text={t('lgStart')} />}
          {selected.route.length > 1 && <LegendItem swatch={<View style={[st.lgDot, { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#111' }]} />} text={t('lgEnd')} />}
          {selectedPhotos.length > 0 && <LegendItem swatch={<View style={[st.lgDot, { backgroundColor: '#fff', borderWidth: 2, borderColor: '#14b8a6' }]} />} text={t('lgPhoto')} />}
          {cats.has('sano') && <LegendItem swatch={<View style={[st.lgDot, { backgroundColor: FINDING_COLOR.sano }]} />} text={t('lgHealthy')} />}
          {cats.has('enfermo') && <LegendItem swatch={<View style={[st.lgDot, { backgroundColor: FINDING_COLOR.enfermo }]} />} text={t('lgDisease')} />}
          {cats.has('revisar') && <LegendItem swatch={<View style={[st.lgDot, { backgroundColor: FINDING_COLOR.revisar }]} />} text={t('lgReview')} />}
          {cats.has('otro') && <LegendItem swatch={<View style={[st.lgDot, { backgroundColor: FINDING_COLOR.otro }]} />} text={t('lgOther')} />}
        </View>
        {!mapDetail && <Text style={[st.meta, { marginTop: 6 }]}>{t('noLocation')}</Text>}

        {selected.kind === 'remoto' && selected.status === 'listo' && (
          <Pressable onPress={() => openResults(selected)} accessibilityRole="button" style={({ pressed }) => [st.primary, pressed && st.pressed]}>
            <BarChart3 size={18} color="#fff" />
            <Text style={st.primaryText}>{t('viewResults')}</Text>
          </Pressable>
        )}
        {selected.kind === 'remoto' && (selected.status === 'cola' || selected.status === 'proceso') && (
          <Text style={[st.meta, { marginTop: 14, textAlign: 'center' }]}>{t('inQueue')}</Text>
        )}
        {selected.kind === 'local' && (
          <Pressable onPress={() => sync(true)} disabled={syncing} accessibilityRole="button" style={({ pressed }) => [st.primary, pressed && st.pressed]}>
            {syncing ? <ActivityIndicator color="#fff" /> : <CloudUpload size={18} color="#fff" />}
            <Text style={st.primaryText}>{t('uploadNow')}</Text>
          </Pressable>
        )}
      </ScrollView>
    );
  })();

  return (
    <GestureHandlerRootView style={st.screen}>
      {header}
      <View
        style={[
          st.card,
          { marginBottom: tabClear },
          detailMode ? st.cardFull : { marginHorizontal: isTablet ? 24 : 10 },
        ]}
        onLayout={e => setCardH(Math.round(e.nativeEvent.layout.height))}
      >
        <Reanimated.View entering={reduced ? undefined : FadeIn.duration(320)} style={StyleSheet.absoluteFill}>
          <ScansMap
            ref={mapRef}
            data={mapData}
            selectedId={selected?.loc || mapDetail ? selectedId : null}
            detail={mapDetail}
            point={point}
            user={me}
            layer={layer}
            onEvent={onMapEvent}
          />
        </Reanimated.View>

        {detailMode && (
          <Reanimated.View entering={fade} style={[st.detailBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            <Pressable onPress={closeDetail} accessibilityRole="button" accessibilityLabel={t('back')} hitSlop={8} style={({ pressed }) => [st.darkBtn, pressed && st.pressed]}>
              <ChevronLeft size={22} color="#fff" />
            </Pressable>
            <Text style={st.detailBarTitle} numberOfLines={1}>{t('detailTitle')}</Text>
            <View style={{ width: 40 }} />
          </Reanimated.View>
        )}

        {/* Controles agrupados */}
        <View style={[st.controls, { top: detailMode ? insets.top + 60 : 12 }]} pointerEvents="box-none">
          <View style={st.compass} accessibilityLabel="Norte"><Text style={st.compassN}>N</Text></View>
          <View style={st.ctrlGroup}>
            <CtrlBtn label={t('layers')} onPress={toggleLayer} active={layer === 'hibrido'}><Layers size={17} color={SCAN.ink} /></CtrlBtn>
            <View style={st.ctrlSep} />
            <CtrlBtn label={t('locate')} onPress={locate}><LocateFixed size={17} color={SCAN.ink} /></CtrlBtn>
          </View>
          <View style={st.ctrlGroup}>
            <CtrlBtn label={t('zoomIn')} onPress={() => mapRef.current?.zoom(1)}><Plus size={17} color={SCAN.ink} /></CtrlBtn>
            <View style={st.ctrlSep} />
            <CtrlBtn label={t('zoomOut')} onPress={() => mapRef.current?.zoom(-1)}><Minus size={17} color={SCAN.ink} /></CtrlBtn>
          </View>
          <View style={st.ctrlGroup}>
            <CtrlBtn label={t('fit')} onPress={() => { tick(); mapRef.current?.fit(); }}><Maximize size={16} color={SCAN.ink} /></CtrlBtn>
          </View>
        </View>

        {notice && (
          <Reanimated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={[st.notice, { bottom: sheetVisible + 14 }]} pointerEvents="none">
            <Text style={st.noticeText}>{notice}</Text>
          </Reanimated.View>
        )}

        {pointCard && (
          <Reanimated.View key={`${point?.kind}:${point?.id}`} entering={reduced ? FadeIn.duration(120) : FadeInDown.duration(220).easing(EASE_OUT)}
            exiting={reduced ? undefined : FadeOutDown.duration(150)} style={[st.pointCard, { bottom: sheetVisible + 10 }]}>
            {pointCard}
            <Pressable onPress={() => setPoint(null)} accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={10} style={st.pointClose}>
              <X size={14} color={SCAN.muted} />
            </Pressable>
          </Reanimated.View>
        )}

        {cardH > 0 && (
          <BottomSheet snaps={snaps} index={Math.min(sheetIdx, 2)} onIndexChange={setSheetIdx} reduced={reduced} header={sheetHeader}>
            {detailMode && selected ? detailBody : historyBody}
          </BottomSheet>
        )}
      </View>

      {/* Selectores */}
      <Modal visible={picker !== null} transparent animationType={reduced ? 'fade' : 'slide'} onRequestClose={() => setPicker(null)} statusBarTranslucent>
        <Pressable style={st.backdrop} onPress={() => setPicker(null)} accessibilityLabel={t('close')} />
        <View style={[st.modalSheet, { paddingBottom: insets.bottom + 16 }, isTablet && { left: '20%', right: '20%' }]}>
          <View style={st.handle} />
          <View style={[st.rowCenter, { justifyContent: 'space-between', marginBottom: 8 }]}>
            <Text style={st.sectionTitle}>{picker === 'orchard' ? t('pickOrchard') : t('status')}</Text>
            <Pressable onPress={() => setPicker(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')} style={st.modalClose}><X size={17} color={SCAN.muted} /></Pressable>
          </View>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 4 }}>
            {picker === 'orchard' ? (
              <>
                <PickRow on={orchardFilter === 'all'} title={t('allOrchards')} meta={scansText(countFor('all'))} icon={<Leaf size={18} color="#3F6212" />}
                  onPress={() => { tick(); setOrchardFilter('all'); setPicker(null); select(null, 'map'); }} />
                {orchards.map(o => (
                  <PickRow key={o.id} on={orchardFilter === o.id} title={o.nombre}
                    meta={`${o.area_m2 > 0 ? `${(o.area_m2 / 10000).toFixed(2)} ha · ` : ''}${scansText(countFor(o.id))}`}
                    icon={<OrchardMini orchard={o} size={30} />}
                    onPress={() => { tick(); setOrchardFilter(o.id); setPicker(null); select(null, 'map'); }} />
                ))}
                <PickRow on={orchardFilter === 'none'} title={t('noOrchard')} meta={scansText(countFor('none'))} icon={<MapPin size={18} color={SCAN.muted} />}
                  onPress={() => { tick(); setOrchardFilter('none'); setPicker(null); select(null, 'map'); }} />
              </>
            ) : (
              ([['all', t('stAll')], ['listo', t('fltDone')], ['progress', t('fltProgress')], ['local', t('fltLocal')], ['error', t('fltError')]] as Array<[StatusFilter, string]>).map(([k, label]) => (
                <PickRow key={k} on={statusFilter === k} title={label} meta={scansText(items.filter(it => matchesStatus(it, k)).length)}
                  icon={k === 'all' ? <Filter size={16} color={SCAN.muted} /> : <View style={[st.dot, { width: 10, height: 10, borderRadius: 5, backgroundColor: SCAN_STATUS_COLOR[k === 'progress' ? 'proceso' : k] }]} />}
                  onPress={() => { tick(); setStatusFilter(k); setPicker(null); }} />
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

// ───────── piezas ─────────

function isHealthyLabel(label: string) {
  return /sano|saludable|healthy|fresh|fresco/i.test(label);
}

function IconBtn({ label, onPress, children, active }: { label: string; onPress: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4}
      style={({ pressed }) => [st.iconBtn, active && st.iconBtnOn, pressed && st.pressed]}>
      {children}
    </Pressable>
  );
}

function CtrlBtn({ label, onPress, children, active }: { label: string; onPress: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={2}
      style={({ pressed }) => [st.ctrlBtn, active && { backgroundColor: '#ECFCCB' }, pressed && { backgroundColor: '#F1F5F9' }]}>
      {children}
    </Pressable>
  );
}

function StatusChip({ status, text, small }: { status: ScanStatus; text: string; small?: boolean }) {
  return (
    <View style={[st.chip, { backgroundColor: STATUS_BG[status] }, small && { paddingHorizontal: 7, paddingVertical: 1.5 }]}>
      <View style={[st.dot, { width: 6, height: 6, backgroundColor: SCAN_STATUS_COLOR[status] }]} />
      <Text style={[st.chipText, { color: STATUS_TEXT_COLOR[status] }, small && { fontSize: 10.5 }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function Mini({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <View style={st.rowCenter}>{icon}<Text style={st.miniText} numberOfLines={1}> {text}</Text></View>;
}

function Stat({ icon, value, label, big }: { icon: React.ReactNode; value: string; label: string; big?: boolean }) {
  return (
    <View style={st.stat}>
      {icon}
      <Text style={[st.statValue, big && { fontSize: 16 }]} numberOfLines={1}>{value}</Text>
      <Text style={st.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function LegendItem({ swatch, text }: { swatch: React.ReactNode; text: string }) {
  return <View style={st.lgItem}>{swatch}<Text style={st.lgText}>{text}</Text></View>;
}

function PickRow({ on, title, meta, icon, onPress }: { on: boolean; title: string; meta: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => [st.pickRow, on && st.pickRowOn, pressed && { opacity: 0.85 }]}>
      <View style={st.pickIcon}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.pickTitle} numberOfLines={1}>{title}</Text>
        <Text style={st.meta} numberOfLines={1}>{meta}</Text>
      </View>
      {on && <Check size={18} color="#3F6212" />}
    </Pressable>
  );
}

/** Contorno real de la huerta en miniatura. */
function OrchardMini({ orchard, size }: { orchard: Orchard; size: number }) {
  const pts = useMemo(() => {
    const c = (orchard.coordinates ?? []).filter(p => validCoord(p.latitude, p.longitude));
    if (c.length < 3) return null;
    const k = Math.cos((c[0].latitude * Math.PI) / 180);
    const xs = c.map(p => p.longitude * k), ys = c.map(p => p.latitude);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY) || 1, pad = 3, sc = (size - pad * 2) / span;
    const ox = (size - (maxX - minX) * sc) / 2, oy = (size - (maxY - minY) * sc) / 2;
    return c.map(p => `${(ox + (p.longitude * k - minX) * sc).toFixed(1)},${(oy + (maxY - p.latitude) * sc).toFixed(1)}`).join(' ');
  }, [orchard, size]);
  if (!pts) return <Leaf size={16} color="#3F6212" />;
  return <Svg width={size} height={size}><Polygon points={pts} fill="rgba(132,204,22,0.3)" stroke="#4D7C0F" strokeWidth={1.6} strokeLinejoin="round" /></Svg>;
}

/** Miniatura: vista satelital real del recorrido; si no hay geografía, la foto real; si tampoco, un icono. */
function ItemThumb({ item, size, outline }: { item: ScanItem; size: number; outline?: { latitude: number; longitude: number }[] }) {
  const [failed, setFailed] = useState(false);
  const geo = item.kind !== 'foto' && (item.route.length > 1 || item.localPhotos.length > 0);
  const outlinePts = useMemo(() => (outline ?? []).filter(p => validCoord(p.latitude, p.longitude)).map(p => ({ lat: p.latitude, lng: p.longitude })), [outline]);
  if (geo) return <SatThumb route={item.route} points={item.localPhotos} outline={outlinePts} size={size} radius={14} />;
  if (item.thumb && !failed) {
    return (
      <View style={[st.thumb, { width: size, height: size }]}>
        <Image source={item.thumb} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      </View>
    );
  }
  const Icon = item.kind === 'foto' ? Leaf : item.fuente === 'dron' ? Plane : item.fuente === 'camara' ? Video : Route;
  return (
    <View style={[st.thumb, st.center, { width: size, height: size, backgroundColor: item.kind === 'foto' ? '#ECFCCB' : '#F1F5F9' }]}>
      <Icon size={size * 0.36} color={item.kind === 'foto' ? '#4D7C0F' : SCAN.muted} />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  lockText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: SCAN.ink, textAlign: 'center', marginTop: 12 },
  lockBtn: { marginTop: 14, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, backgroundColor: SCAN.limeBright },
  lockBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: SCAN.limeInk },

  header: { paddingHorizontal: 16, paddingBottom: 10, gap: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 24, lineHeight: 30, letterSpacing: -0.6, color: SCAN.ink },
  subtitle: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: SCAN.muted },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  iconBtnOn: { backgroundColor: '#ECFCCB', borderColor: '#BEF264' },
  badge: { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: '#65A30D', borderWidth: 1.5, borderColor: '#fff' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 14, color: SCAN.ink, paddingVertical: 0 },
  orchardPill: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 8, paddingRight: 12, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  orchardIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFCCB' },
  orchardName: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: SCAN.ink },
  orchardMeta: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: SCAN.muted },

  card: { flex: 1, borderRadius: 26, overflow: 'hidden', backgroundColor: '#dfe7e1' },
  cardFull: { marginHorizontal: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  detailBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  darkBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.72)' },
  detailBarTitle: { flex: 1, textAlign: 'center', fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },

  controls: { position: 'absolute', right: 10, gap: 8, alignItems: 'center' },
  compass: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.78)' },
  compassN: { fontFamily: 'Poppins_700Bold', fontSize: 13, color: '#fff' },
  ctrlGroup: { borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.96)', overflow: 'hidden', shadowColor: '#0f172a', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  ctrlBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  ctrlSep: { height: 1, backgroundColor: '#E5E7EB', marginHorizontal: 8 },
  notice: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(15,23,42,0.82)' },
  noticeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#fff' },

  pointCard: { position: 'absolute', left: 10, right: 58, padding: 8, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.97)', shadowColor: '#0f172a', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 24 },
  pointThumb: { width: 52, height: 52, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  pointTitle: { flexShrink: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: SCAN.ink },
  pointMeta: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, lineHeight: 16, color: SCAN.muted },
  pointClose: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },

  sheetHead: { paddingHorizontal: 16, paddingBottom: 8 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chevBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  statsGrid: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: '#EEF2F7', marginTop: 4 },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statSep: { width: 1, alignSelf: 'stretch', backgroundColor: '#EEF2F7' },
  statValue: { fontFamily: 'Poppins_700Bold', fontSize: 14.5, color: SCAN.ink },
  statLabel: { fontFamily: 'Poppins_400Regular', fontSize: 10.5, color: SCAN.muted },
  photoResult: { marginTop: 10, gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  photoResultText: { flex: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: SCAN.ink },
  detailTitle: { fontFamily: 'Poppins_700Bold', fontSize: 20, lineHeight: 26, color: SCAN.ink, letterSpacing: -0.4 },
  detailOrchard: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: SCAN.brand },

  sectionTitle: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: SCAN.ink, letterSpacing: -0.2 },
  count: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: SCAN.muted },
  hint: { marginTop: 4, fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 17, color: SCAN.muted },
  listHead: { justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6 },
  segment: { flexDirection: 'row', gap: 6, marginHorizontal: 16, marginTop: 10, marginBottom: 8, padding: 4, borderRadius: 14, backgroundColor: '#F4F6F8' },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 36, borderRadius: 11 },
  segBtnOn: { backgroundColor: '#ECFCCB' },
  segText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: SCAN.muted },
  segTextOn: { color: '#3F6212' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 10, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 18 },
  rowOn: { backgroundColor: '#F7FEE7' },
  rowTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 14.5, color: SCAN.ink },
  rowAction: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8' },
  meta: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: SCAN.muted },
  miniText: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: SCAN.muted },
  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 999 },
  chipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  thumb: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#F1F5F9' },
  track: { height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', marginTop: 4, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2, backgroundColor: SCAN.sky },

  sync: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 6, padding: 10, borderRadius: 14, backgroundColor: '#F0F9FF' },
  syncTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: SCAN.ink },
  syncBtn: { paddingHorizontal: 12, minHeight: 34, justifyContent: 'center', borderRadius: 11, backgroundColor: SCAN.sky },
  syncBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#fff' },
  error: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: SCAN.red, paddingHorizontal: 18, marginVertical: 6 },
  empty: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 19, color: SCAN.muted, textAlign: 'center', paddingHorizontal: 28, marginTop: 16 },

  fCard: { width: 112, height: 112, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F1F5F9', borderWidth: 2, borderColor: 'transparent' },
  fLabel: { position: 'absolute', left: 6, right: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  fLabelText: { flex: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 10.5, color: '#fff' },
  fNoGeo: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.6)' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  lgItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lgDot: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  lgText: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: SCAN.inkSoft },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, marginTop: 16, borderRadius: 25, backgroundColor: '#166534' },
  primaryText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#fff' },

  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.45)' },
  modalSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 8, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#fff' },
  handle: { alignSelf: 'center', width: 38, height: 4.5, borderRadius: 3, backgroundColor: '#CBD5E1', marginBottom: 10 },
  modalClose: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16 },
  pickRowOn: { backgroundColor: '#F7FEE7' },
  pickIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8' },
  pickTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: SCAN.ink },
});
