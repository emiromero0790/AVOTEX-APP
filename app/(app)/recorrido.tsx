import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  CloudOff,
  CloudUpload,
  Footprints,
  Lock,
  MapPin,
  Pause,
  Play,
  Square,
  Trash2,
  WifiOff,
  Sparkles,
  Bell,
  Route,
} from 'lucide-react-native';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { auth as firebaseAuth } from '../../firebaseConfig';
import { useGuest } from '../../context/GuestContext';
import { localizeDomainLabel, TranslationResource, useLanguage, useTranslations } from '../../context/LanguageContext';
import { listOrchards, Orchard } from '../../services/orchards';
import {
  CAPTURE_EVERY_M,
  CAPTURE_EVERY_S_WITHOUT_GPS,
  MAX_PHOTOS,
  Hallazgo,
  RecorridoLocal,
  RecorridoRemoto,
  createLocal,
  deleteLocal,
  distanceMeters,
  getMobileDataAllowed,
  getRemote,
  isHealthy,
  listHallazgos,
  listLocal,
  listRemote,
  recoverInterrupted,
  routeDistanceMeters,
  saveLocal,
  setMobileDataAllowed,
  storePhoto,
  thumbnailSource,
  uploadRecorrido,
} from '../../services/recorridos';
import { registerForPush } from '../../services/push';
import RecorridoMap from '../../components/RecorridoMap';

const auth = firebaseAuth as Auth;

const translations: TranslationResource = {
  title: { es: 'Recorrido con IA', en: 'AI field walk' },
  back: { es: 'Volver', en: 'Back' },
  heroKicker: { es: 'Nuevo · Funciona sin internet', en: 'New · Works offline' },
  heroTitle: { es: 'Graba tu recorrido y la IA revisa cada fruto', en: 'Record your walk and AI checks every fruit' },
  heroBody: {
    es: 'Camina por tu huerta con la cámara del celular. AVOTEX guarda las imágenes con su ubicación aunque no tengas señal, y cuando tengas internet las analiza con inteligencia artificial.',
    en: 'Walk through your orchard with your phone camera. AVOTEX saves the images with their location even without signal, and analyzes them with AI once you are online.',
  },
  step1: { es: 'Graba sin internet', en: 'Record offline' },
  step1Body: { es: 'Una imagen cada 2–3 m, con GPS', en: 'One image every 2–3 m, with GPS' },
  step2: { es: 'Sube con WiFi', en: 'Upload on WiFi' },
  step2Body: { es: 'Puedes cerrar la app después', en: 'You can close the app after' },
  step3: { es: 'Recibe el análisis', en: 'Get the analysis' },
  step3Body: { es: 'Te avisamos con una notificación', en: 'We notify you when it is ready' },
  orchard: { es: 'Huerta', en: 'Orchard' },
  orchardAuto: { es: 'Detectar por GPS', en: 'Detect by GPS' },
  start: { es: 'Iniciar recorrido', en: 'Start walk' },
  tipsTitle: { es: 'Para mejores resultados', en: 'For better results' },
  tips: {
    es: 'Lleva el celular en el pecho o en la mano, camina despacio y apunta a los frutos a 30–50 cm.',
    en: 'Carry the phone on your chest or in your hand, walk slowly and point at the fruits from 30–50 cm.',
  },
  privacyNote: {
    es: 'Privacidad: después del análisis borramos las imágenes de la nube y del celular; solo guardamos una miniatura de cada hallazgo y su ubicación.',
    en: 'Privacy: after the analysis we delete the images from the cloud and the phone; we only keep a thumbnail of each finding and its location.',
  },
  pendingTitle: { es: 'Por subir', en: 'Waiting to upload' },
  pendingEmpty: { es: 'No tienes recorridos guardados en el celular.', en: 'No walks saved on this phone.' },
  photos: { es: '{count} imágenes', en: '{count} images' },
  upload: { es: 'Subir', en: 'Upload' },
  uploading: { es: 'Subiendo {done} de {total}', en: 'Uploading {done} of {total}' },
  waitingWifi: { es: 'Se subirá cuando tengas WiFi', en: 'Will upload when you are on WiFi' },
  offline: { es: 'Sin internet: se subirá después', en: 'Offline: it will upload later' },
  uploadError: { es: 'No se pudo subir. Intenta de nuevo.', en: 'Upload failed. Try again.' },
  mobileData: { es: 'Subir también con datos móviles', en: 'Also upload on mobile data' },
  mobileDataHint: { es: 'Cada recorrido puede pesar 100–300 MB.', en: 'Each walk can use 100–300 MB.' },
  deleteTitle: { es: '¿Borrar recorrido?', en: 'Delete walk?' },
  deleteBody: { es: 'Las imágenes de este recorrido se borrarán del celular y no se analizarán.', en: 'The images of this walk will be deleted from the phone and will not be analyzed.' },
  cancel: { es: 'Cancelar', en: 'Cancel' },
  delete: { es: 'Borrar', en: 'Delete' },
  resultsTitle: { es: 'Resultados', en: 'Results' },
  resultsEmpty: { es: 'Cuando subas un recorrido, aquí verás su análisis.', en: 'When you upload a walk, its analysis will appear here.' },
  statusPendiente: { es: 'En cola', en: 'Queued' },
  statusProcesando: { es: 'Analizando', en: 'Analyzing' },
  statusListo: { es: 'Listo', en: 'Ready' },
  statusError: { es: 'Con error', en: 'Error' },
  findings: { es: '{count} hallazgos', en: '{count} findings' },
  queuedHint: { es: 'El análisis empieza en unos minutos y te avisaremos al terminar.', en: 'Analysis starts within minutes and we will notify you when done.' },
  // grabación
  recording: { es: 'Grabando recorrido', en: 'Recording walk' },
  paused: { es: 'En pausa', en: 'Paused' },
  time: { es: 'Tiempo', en: 'Time' },
  distance: { es: 'Distancia', en: 'Distance' },
  images: { es: 'Imágenes', en: 'Images' },
  gpsOk: { es: 'GPS ±{m} m', en: 'GPS ±{m} m' },
  gpsSearching: { es: 'Buscando GPS…', en: 'Searching GPS…' },
  gpsLost: { es: 'Sin GPS: imágenes por tiempo', en: 'No GPS: images by time' },
  pause: { es: 'Pausar', en: 'Pause' },
  resume: { es: 'Seguir', en: 'Resume' },
  finish: { es: 'Terminar', en: 'Finish' },
  limitReached: { es: 'Llegaste al máximo de imágenes de un recorrido. Termina y empieza otro.', en: 'You reached the image limit for one walk. Finish and start another.' },
  noSpace: { es: 'Tu celular tiene poco espacio libre. Libera espacio antes de grabar.', en: 'Your phone is low on storage. Free some space before recording.' },
  permCamera: { es: 'Necesitamos la cámara para grabar el recorrido.', en: 'We need the camera to record the walk.' },
  permLocation: { es: 'Sin ubicación no podremos marcar dónde está cada hallazgo. ¿Grabar de todos modos?', en: 'Without location we cannot mark where each finding is. Record anyway?' },
  recordAnyway: { es: 'Grabar sin GPS', en: 'Record without GPS' },
  savedTitle: { es: 'Recorrido guardado', en: 'Walk saved' },
  savedBody: { es: '{count} imágenes guardadas en el celular.', en: '{count} images saved on the phone.' },
  emptyWalk: { es: 'No se tomó ninguna imagen; el recorrido no se guardó.', en: 'No images were taken; the walk was not saved.' },
  // detalle
  detailTitle: { es: 'Recorrido del {date}', en: 'Walk of {date}' },
  analyzed: { es: 'imágenes analizadas', en: 'images analyzed' },
  findingsLabel: { es: 'hallazgos', en: 'findings' },
  healthyLabel: { es: 'sanos', en: 'healthy' },
  issuesLabel: { es: 'con problema', en: 'with issues' },
  noFindings: { es: 'No encontramos frutos en las imágenes. En el próximo recorrido acércate a 30–50 cm de los frutos.', en: 'We found no fruits in the images. On your next walk, get within 30–50 cm of the fruits.' },
  confidence: { es: 'Confianza {pct}%', en: 'Confidence {pct}%' },
  groupOf: { es: 'visto en {count} imágenes', en: 'seen in {count} images' },
  noLocation: { es: 'Sin ubicación', en: 'No location' },
  stillProcessing: { es: 'Este recorrido todavía se está analizando.', en: 'This walk is still being analyzed.' },
  errorProcessing: { es: 'Hubo un problema al analizar este recorrido. Lo reintentaremos automáticamente.', en: 'There was a problem analyzing this walk. We will retry automatically.' },
  loadError: { es: 'No pudimos cargar la información. Revisa tu conexión.', en: 'We could not load the information. Check your connection.' },
  locked: { es: 'Crea una cuenta para usar el recorrido con IA.', en: 'Create an account to use the AI field walk.' },
  signIn: { es: 'Crear cuenta / Iniciar sesión', en: 'Create account / Sign in' },
  notifyOff: { es: 'Activa las notificaciones para saber cuándo está listo tu análisis.', en: 'Turn on notifications to know when your analysis is ready.' },
};

type Mode = 'home' | 'record' | 'detail';

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

/** Tamaño de foto cercano a 1280 px: suficiente para el modelo (usa 224 px) y ligero de subir. */
function choosePictureSize(sizes: string[]): string | undefined {
  const parsed = sizes
    .map(s => {
      const m = /^(\d+)x(\d+)$/.exec(s);
      return m ? { s, w: Math.max(Number(m[1]), Number(m[2])) } : null;
    })
    .filter((x): x is { s: string; w: number } => !!x);
  if (parsed.length) {
    const inRange = parsed.filter(p => p.w >= 960 && p.w <= 1920).sort((a, b) => Math.abs(a.w - 1280) - Math.abs(b.w - 1280));
    if (inRange.length) return inRange[0].s;
    return parsed.sort((a, b) => Math.abs(a.w - 1280) - Math.abs(b.w - 1280))[0].s;
  }
  // iOS devuelve calidades con nombre.
  return ['1280x720', 'Medium', 'High'].find(p => sizes.includes(p));
}

export default function RecorridoScreen() {
  const t = useTranslations(translations);
  const { language, locale } = useLanguage();
  const { isGuest } = useGuest();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const params = useLocalSearchParams<{ id?: string }>();
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const email = user?.email ?? '';
  const [mode, setMode] = useState<Mode>(params.id ? 'detail' : 'home');

  // ── inicio ──
  const [orchards, setOrchards] = useState<Orchard[]>([]);
  const [huertaId, setHuertaId] = useState<string | null>(null);
  const [locals, setLocals] = useState<RecorridoLocal[]>([]);
  const [remotes, setRemotes] = useState<RecorridoRemoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [mobileData, setMobileData] = useState(false);
  const [network, setNetwork] = useState<'wifi' | 'cellular' | 'offline' | 'unknown'>('unknown');
  const [progress, setProgress] = useState<Record<string, { done: number; total: number }>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, boolean>>({});
  const [pushState, setPushState] = useState<'ok' | 'denied' | 'unavailable' | null>(null);
  const uploadingRef = useRef(false);

  // ── grabación ──
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraReadyRef = useRef(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const recRef = useRef<RecorridoLocal | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);
  const pausedRef = useRef(false);
  const lastFixRef = useRef<{ lat: number; lng: number; acc: number | null; at: number } | null>(null);
  const lastShotRef = useRef<{ lat: number | null; lng: number | null; at: number } | null>(null);
  const useGpsRef = useRef(true);
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState({ elapsed: 0, distance: 0, photos: 0, accuracy: null as number | null, gps: 'searching' as 'ok' | 'searching' | 'lost' });
  const [limitHit, setLimitHit] = useState(false);
  const startedAtRef = useRef(0);
  const pausedMsRef = useRef(0);
  const pauseStartRef = useRef<number | null>(null);

  // ── detalle ──
  const [detail, setDetail] = useState<RecorridoRemoto | null>(null);
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const detailScrollRef = useRef<ScrollView>(null);
  const cardY = useRef<Record<string, number>>({});

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (params.id) {
      setMode('detail');
      openDetail(params.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, email]);

  // ───────────────────────── datos ─────────────────────────

  const refreshNetwork = useCallback(async () => {
    try {
      const st = await Network.getNetworkStateAsync();
      if (!st.isConnected || st.isInternetReachable === false) { setNetwork('offline'); return 'offline' as const; }
      const kind = st.type === Network.NetworkStateType.WIFI || st.type === Network.NetworkStateType.ETHERNET ? 'wifi' : 'cellular';
      setNetwork(kind);
      return kind;
    } catch {
      setNetwork('unknown');
      return 'unknown' as const;
    }
  }, []);

  const loadHome = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setLoadError(false);
    await recoverInterrupted(email);
    setLocals(await listLocal(email));
    setMobileData(await getMobileDataAllowed());
    try {
      const [o, r] = await Promise.all([listOrchards(email), listRemote(email)]);
      setOrchards(o);
      setRemotes(r);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [email]);

  const uploadAll = useCallback(async (opts?: { force?: boolean }) => {
    if (!email || uploadingRef.current) return;
    const net = await refreshNetwork();
    const allowCellular = opts?.force || (await getMobileDataAllowed());
    if (net === 'offline') return;
    if (net === 'cellular' && !allowCellular) return;
    const pending = (await listLocal(email)).filter(r => r.estado === 'guardado' && r.fotos.length > 0);
    if (!pending.length) return;
    uploadingRef.current = true;
    if (pushState === null) setPushState(await registerForPush(email));
    try {
      for (const rec of pending) {
        try {
          setUploadErrors(prev => ({ ...prev, [rec.localId]: false }));
          await uploadRecorrido(rec, (done, total) => setProgress(prev => ({ ...prev, [rec.localId]: { done, total } })));
        } catch {
          setUploadErrors(prev => ({ ...prev, [rec.localId]: true }));
        } finally {
          setProgress(prev => {
            const next = { ...prev };
            delete next[rec.localId];
            return next;
          });
          setLocals(await listLocal(email));
        }
      }
      try { setRemotes(await listRemote(email)); } catch { /* se verá al recargar */ }
    } finally {
      uploadingRef.current = false;
    }
  }, [email, pushState, refreshNetwork]);

  useFocusEffect(
    useCallback(() => {
      if (mode !== 'home' || !email || isGuest) return;
      loadHome().then(() => uploadAll());
    }, [mode, email, isGuest, loadHome, uploadAll]),
  );

  // Mientras haya recorridos en cola o analizándose, se revisa su estado cada 30 s.
  useEffect(() => {
    if (mode !== 'home' || !email) return;
    const busy = remotes.some(r => r.estado === 'pendiente' || r.estado === 'procesando');
    if (!busy) return;
    const id = setInterval(() => { listRemote(email).then(setRemotes).catch(() => {}); }, 30000);
    return () => clearInterval(id);
  }, [mode, email, remotes]);

  const openDetail = useCallback(async (id: string) => {
    if (!email) return;
    setMode('detail');
    setDetail(null);
    setHallazgos([]);
    setSelected(null);
    setDetailError(false);
    setDetailLoading(true);
    try {
      const rec = await getRemote(id, email);
      setDetail(rec);
      if (rec && rec.estado === 'listo') setHallazgos(await listHallazgos(id, email));
      if (rec?.huerta_id && !orchards.length) listOrchards(email).then(setOrchards).catch(() => {});
    } catch {
      setDetailError(true);
    } finally {
      setDetailLoading(false);
    }
  }, [email, orchards.length]);

  // ───────────────────────── grabación ─────────────────────────

  const stopSensors = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    deactivateKeepAwake('recorrido');
  }, []);

  const shoot = useCallback(async (coords: { lat: number; lng: number; precision: number | null } | null) => {
    const rec = recRef.current;
    const cam = cameraRef.current;
    if (!rec || !cam || !cameraReadyRef.current || busyRef.current || pausedRef.current) return;
    if (rec.fotos.length >= MAX_PHOTOS) { setLimitHit(true); return; }
    busyRef.current = true;
    try {
      const photo = await cam.takePictureAsync({ quality: 0.6, shutterSound: false });
      if (!photo?.uri || !recRef.current) return;
      const foto = await storePhoto(rec, photo.uri, coords);
      rec.fotos.push(foto);
      lastShotRef.current = { lat: coords?.lat ?? null, lng: coords?.lng ?? null, at: Date.now() };
      setStats(s => ({ ...s, photos: rec.fotos.length }));
      // Se guarda seguido: si la app se cierra, el recorrido no se pierde.
      if (rec.fotos.length % 5 === 0) await saveLocal(rec);
    } catch (e) {
      console.warn('[recorrido] no se pudo tomar la imagen', e);
    } finally {
      busyRef.current = false;
    }
  }, []);

  const onPosition = useCallback((loc: Location.LocationObject) => {
    const rec = recRef.current;
    if (!rec) return;
    const { latitude: lat, longitude: lng, accuracy } = loc.coords;
    const now = Date.now();
    const prev = lastFixRef.current;
    lastFixRef.current = { lat, lng, acc: accuracy ?? null, at: now };
    // Se ignoran saltos de GPS muy imprecisos (> 25 m) para la distancia y la ruta.
    if (accuracy == null || accuracy <= 25) {
      const lastPt = rec.ruta[rec.ruta.length - 1];
      const step = lastPt ? distanceMeters(lastPt.lat, lastPt.lng, lat, lng) : 0;
      if (!lastPt || step >= 1) {
        rec.ruta.push({ lat, lng, t: new Date(now).toISOString() });
        if (lastPt && !pausedRef.current) setStats(s => ({ ...s, distance: s.distance + step }));
      }
    }
    setStats(s => ({ ...s, accuracy: accuracy ?? null, gps: 'ok' }));
    if (pausedRef.current) return;
    const shot = lastShotRef.current;
    const far = !shot || shot.lat == null || shot.lng == null || distanceMeters(shot.lat, shot.lng, lat, lng) >= CAPTURE_EVERY_M;
    if (far && (!prev || accuracy == null || accuracy <= 30)) shoot({ lat, lng, precision: accuracy ?? null });
  }, [shoot]);

  const startRecording = useCallback(async () => {
    if (!email) return;
    if (Platform.OS !== 'web') {
      try {
        const free = await FileSystem.getFreeDiskStorageAsync();
        if (free < 300 * 1024 * 1024) { Alert.alert(t('title'), t('noSpace')); return; }
      } catch { /* sin dato de espacio */ }
    }
    const cam = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!cam.granted) { Alert.alert(t('title'), t('permCamera')); return; }

    const loc = await Location.requestForegroundPermissionsAsync().catch(() => ({ status: 'denied' as const }));
    const begin = async (withGps: boolean) => {
      useGpsRef.current = withGps;
      const rec = await createLocal(email, huertaId);
      recRef.current = rec;
      lastFixRef.current = null;
      lastShotRef.current = null;
      pausedRef.current = false;
      setPaused(false);
      setLimitHit(false);
      setCameraReady(false);
      cameraReadyRef.current = false;
      setStats({ elapsed: 0, distance: 0, photos: 0, accuracy: null, gps: withGps ? 'searching' : 'lost' });
      startedAtRef.current = Date.now();
      pausedMsRef.current = 0;
      pauseStartRef.current = null;
      setMode('record');
      activateKeepAwakeAsync('recorrido').catch(() => {});
      if (withGps) {
        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
          onPosition,
        );
      }
      tickRef.current = setInterval(() => {
        const now = Date.now();
        const pausedNow = pauseStartRef.current ? now - pauseStartRef.current : 0;
        const fix = lastFixRef.current;
        const gpsLost = !useGpsRef.current || !fix || now - fix.at > 5000;
        setStats(s => ({
          ...s,
          elapsed: now - startedAtRef.current - pausedMsRef.current - pausedNow,
          gps: !useGpsRef.current ? 'lost' : (!fix ? (now - startedAtRef.current > 8000 ? 'lost' : 'searching') : gpsLost ? 'lost' : 'ok'),
        }));
        // Sin GPS: una imagen cada pocos segundos para no perder el recorrido.
        const shot = lastShotRef.current;
        if (gpsLost && (now - startedAtRef.current > 8000 || !useGpsRef.current) && (!shot || now - shot.at >= CAPTURE_EVERY_S_WITHOUT_GPS * 1000)) {
          shoot(null);
        }
      }, 1000);
    };

    if (loc.status !== 'granted') {
      Alert.alert(t('title'), t('permLocation'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('recordAnyway'), onPress: () => { begin(false); } },
      ]);
      return;
    }
    await begin(true);
  }, [email, huertaId, cameraPermission, requestCameraPermission, onPosition, shoot, t]);

  const togglePause = useCallback(() => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    if (next) pauseStartRef.current = Date.now();
    else if (pauseStartRef.current) {
      pausedMsRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
  }, []);

  const finishRecording = useCallback(async () => {
    stopSensors();
    const rec = recRef.current;
    recRef.current = null;
    setMode('home');
    if (!rec) return;
    // Espera a que termine una captura en curso.
    for (let i = 0; i < 20 && busyRef.current; i++) await new Promise(r => setTimeout(r, 100));
    if (!rec.fotos.length) {
      await deleteLocal(rec);
      Alert.alert(t('title'), t('emptyWalk'));
    } else {
      rec.estado = 'guardado';
      rec.terminadoAt = new Date().toISOString();
      await saveLocal(rec);
      Alert.alert(t('savedTitle'), t('savedBody', { count: rec.fotos.length }));
    }
    await loadHome();
    uploadAll();
  }, [stopSensors, loadHome, uploadAll, t]);

  // Si se sale de la pantalla a medio recorrido, se guarda lo grabado.
  useEffect(() => () => {
    stopSensors();
    const rec = recRef.current;
    if (rec) {
      rec.estado = rec.fotos.length ? 'guardado' : 'grabando';
      rec.terminadoAt = new Date().toISOString();
      if (rec.fotos.length) saveLocal(rec); else deleteLocal(rec);
    }
  }, [stopSensors]);

  const onCameraReady = useCallback(async () => {
    setCameraReady(true);
    cameraReadyRef.current = true;
    try {
      const sizes = await cameraRef.current?.getAvailablePictureSizesAsync();
      if (sizes?.length) setPictureSize(choosePictureSize(sizes));
    } catch { /* se usa el tamaño por defecto */ }
  }, []);

  // ───────────────────────── acciones de la lista ─────────────────────────

  const confirmDelete = useCallback((rec: RecorridoLocal) => {
    Alert.alert(t('deleteTitle'), t('deleteBody'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => { await deleteLocal(rec); setLocals(await listLocal(email)); } },
    ]);
  }, [email, t]);

  const statusInfo = (estado: RecorridoRemoto['estado']) => {
    switch (estado) {
      case 'listo': return { label: t('statusListo'), color: '#15803d', bg: '#dcfce7' };
      case 'procesando': return { label: t('statusProcesando'), color: '#0369a1', bg: '#e0f2fe' };
      case 'error': return { label: t('statusError'), color: '#b91c1c', bg: '#fee2e2' };
      default: return { label: t('statusPendiente'), color: '#a16207', bg: '#fef3c7' };
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const orchardName = (id: string | null) => orchards.find(o => o.id === id)?.nombre ?? null;

  // ───────────────────────── detalle: datos del mapa ─────────────────────────

  const detailRoute = useMemo(() => (detail?.ruta ?? []).map(p => ({ lat: p.lat, lng: p.lng })), [detail]);
  const detailMarkers = useMemo(
    () => hallazgos
      .filter(h => h.lat != null && h.lng != null)
      .map(h => ({
        id: h.id,
        lat: h.lat as number,
        lng: h.lng as number,
        healthy: isHealthy(h.estado),
        label: localizeDomainLabel(h.estado, language),
      })),
    [hallazgos, language],
  );
  const detailPolygon = useMemo(() => {
    const o = orchards.find(x => x.id === detail?.huerta_id);
    return o ? o.coordinates.map(c => ({ lat: c.latitude, lng: c.longitude })) : [];
  }, [orchards, detail]);
  const onSelectMarker = useCallback((id: string) => {
    setSelected(id);
    const y = cardY.current[id];
    if (y != null) detailScrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  }, []);

  if (!fontsLoaded) return null;

  // ───────────────────────── vistas ─────────────────────────

  if (isGuest) {
    return (
      <View style={[st.screen, st.center, { paddingTop: insets.top }]}>
        <Lock size={40} color="#0f766e" />
        <Text style={[st.lockText]}>{t('locked')}</Text>
        <TouchableOpacity style={st.primaryBtn} onPress={() => router.replace('/(auth)')}>
          <Text style={st.primaryBtnText}>{t('signIn')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (mode === 'record') {
    const gpsText = stats.gps === 'ok' ? t('gpsOk', { m: Math.max(1, Math.round(stats.accuracy ?? 0)) }) : stats.gps === 'searching' ? t('gpsSearching') : t('gpsLost');
    return (
      <View style={st.recordScreen}>
        <StatusBar style="light" />
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          animateShutter={false}
          pictureSize={pictureSize}
          onCameraReady={onCameraReady}
        />
        <LinearGradient colors={['rgba(0,0,0,0.65)', 'transparent']} style={[st.recordTop, { paddingTop: insets.top + 10 }]}>
          <View style={st.recRow}>
            <View style={[st.recDot, paused && st.recDotPaused]} />
            <Text style={st.recTitle}>{paused ? t('paused') : t('recording')}</Text>
          </View>
          <View style={[st.gpsPill, stats.gps === 'ok' ? st.gpsOk : stats.gps === 'lost' ? st.gpsLost : st.gpsSearch]}>
            <MapPin size={14} color="#fff" />
            <Text style={st.gpsText}>{gpsText}</Text>
          </View>
        </LinearGradient>

        {!cameraReady && (
          <View style={st.cameraLoading}><ActivityIndicator color="#fff" size="large" /></View>
        )}

        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={[st.recordBottom, { paddingBottom: insets.bottom + 18 }]}>
          {limitHit && <Text style={st.limitText}>{t('limitReached')}</Text>}
          <View style={st.statsRow}>
            <View style={st.statBox}><Text style={st.statValue}>{formatDuration(stats.elapsed)}</Text><Text style={st.statLabel}>{t('time')}</Text></View>
            <View style={st.statBox}><Text style={st.statValue}>{formatDistance(stats.distance)}</Text><Text style={st.statLabel}>{t('distance')}</Text></View>
            <View style={st.statBox}><Text style={st.statValue}>{stats.photos}</Text><Text style={st.statLabel}>{t('images')}</Text></View>
          </View>
          <Text style={st.recordTip}>{t('tips')}</Text>
          <View style={st.recordActions}>
            <TouchableOpacity style={st.recSecondary} onPress={togglePause} accessibilityRole="button">
              {paused ? <Play size={22} color="#fff" /> : <Pause size={22} color="#fff" />}
              <Text style={st.recSecondaryText}>{paused ? t('resume') : t('pause')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.recStop} onPress={finishRecording} accessibilityRole="button">
              <Square size={20} color="#fff" fill="#fff" />
              <Text style={st.recStopText}>{t('finish')}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (mode === 'detail') {
    const info = detail ? statusInfo(detail.estado) : null;
    const healthy = hallazgos.filter(h => isHealthy(h.estado)).length;
    return (
      <View style={[st.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <View style={st.header}>
          <TouchableOpacity
            style={st.backBtn}
            onPress={() => { if (params.id) router.setParams({ id: undefined }); setMode('home'); }}
            accessibilityLabel={t('back')}
          >
            <ChevronLeft size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={st.headerTitle} numberOfLines={1}>
            {detail ? t('detailTitle', { date: fmtDate(detail.iniciado_at) }) : t('title')}
          </Text>
        </View>
        {detailLoading ? (
          <View style={st.center}><ActivityIndicator color="#0f766e" size="large" /></View>
        ) : detailError || !detail ? (
          <View style={st.center}><CloudOff size={36} color="#94a3b8" /><Text style={st.muted}>{t('loadError')}</Text></View>
        ) : (
          <ScrollView ref={detailScrollRef} contentContainerStyle={[st.scroll, isTablet && st.scrollTablet, { paddingBottom: insets.bottom + 40 }]}>
            <View style={st.card}>
              <View style={st.rowBetween}>
                <Text style={st.cardTitle}>{orchardName(detail.huerta_id) ?? t('title')}</Text>
                {info && <View style={[st.chip, { backgroundColor: info.bg }]}><Text style={[st.chipText, { color: info.color }]}>{info.label}</Text></View>}
              </View>
              {detail.estado === 'listo' ? (
                <View style={st.summaryRow}>
                  <View style={st.summaryBox}><Text style={st.summaryValue}>{detail.fotos_analizadas}</Text><Text style={st.summaryLabel}>{t('analyzed')}</Text></View>
                  <View style={st.summaryBox}><Text style={[st.summaryValue, { color: '#15803d' }]}>{healthy}</Text><Text style={st.summaryLabel}>{t('healthyLabel')}</Text></View>
                  <View style={st.summaryBox}><Text style={[st.summaryValue, { color: '#b91c1c' }]}>{hallazgos.length - healthy}</Text><Text style={st.summaryLabel}>{t('issuesLabel')}</Text></View>
                </View>
              ) : (
                <Text style={st.muted}>{detail.estado === 'error' ? t('errorProcessing') : t('stillProcessing')}</Text>
              )}
            </View>

            {(detailRoute.length > 1 || detailMarkers.length > 0) && (
              <View style={[st.mapCard, isTablet && st.mapCardTablet]}>
                <RecorridoMap route={detailRoute} markers={detailMarkers} polygon={detailPolygon} selectedId={selected} onSelect={onSelectMarker} />
              </View>
            )}

            {detail.estado === 'listo' && !hallazgos.length && <Text style={[st.muted, st.padded]}>{t('noFindings')}</Text>}

            {hallazgos.map(h => {
              const ok = isHealthy(h.estado);
              return (
                <TouchableOpacity
                  key={h.id}
                  activeOpacity={0.85}
                  onLayout={e => { cardY.current[h.id] = e.nativeEvent.layout.y; }}
                  onPress={() => setSelected(h.id)}
                  style={[st.findCard, selected === h.id && st.findCardSelected]}
                >
                  {h.miniatura_path ? (
                    <Image source={thumbnailSource(h.miniatura_path)} style={st.findThumb} />
                  ) : (
                    <View style={[st.findThumb, st.center]}><Sparkles size={20} color="#94a3b8" /></View>
                  )}
                  <View style={st.findBody}>
                    <View style={[st.chip, { backgroundColor: ok ? '#dcfce7' : '#fee2e2', alignSelf: 'flex-start' }]}>
                      <Text style={[st.chipText, { color: ok ? '#15803d' : '#b91c1c' }]}>{localizeDomainLabel(h.estado, language)}</Text>
                    </View>
                    <Text style={st.findTitle}>{localizeDomainLabel(h.fruto, language)}</Text>
                    <Text style={st.findMeta}>{t('confidence', { pct: Math.round(h.confianza * 100) })}{h.fotos_en_grupo > 1 ? ` · ${t('groupOf', { count: h.fotos_en_grupo })}` : ''}</Text>
                    <Text style={st.findMeta}>
                      {new Date(h.tomada_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                      {h.lat == null ? ` · ${t('noLocation')}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  }

  // Inicio
  const networkNote = network === 'offline' ? t('offline') : network === 'cellular' && !mobileData ? t('waitingWifi') : null;
  return (
    <View style={[st.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()} accessibilityLabel={t('back')}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>{t('title')}</Text>
      </View>
      <ScrollView
        contentContainerStyle={[st.scroll, isTablet && st.scrollTablet, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => loadHome().then(() => uploadAll())} tintColor="#0f766e" />}
      >
        <LinearGradient colors={['#0f766e', '#115e59', '#134e4a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.hero}>
          <View style={st.heroBadge}><WifiOff size={13} color="#a7f3d0" /><Text style={st.heroBadgeText}>{t('heroKicker')}</Text></View>
          <Text style={st.heroTitle}>{t('heroTitle')}</Text>
          <Text style={st.heroBody}>{t('heroBody')}</Text>
          <View style={st.steps}>
            {[
              { icon: <Footprints size={18} color="#0f766e" />, title: t('step1'), body: t('step1Body') },
              { icon: <CloudUpload size={18} color="#0f766e" />, title: t('step2'), body: t('step2Body') },
              { icon: <Bell size={18} color="#0f766e" />, title: t('step3'), body: t('step3Body') },
            ].map((s, i) => (
              <View key={i} style={st.step}>
                <View style={st.stepIcon}>{s.icon}</View>
                <Text style={st.stepTitle}>{s.title}</Text>
                <Text style={st.stepBody}>{s.body}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={st.card}>
          <Text style={st.sectionLabel}>{t('orchard')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipsRow}>
            {[{ id: null as string | null, nombre: t('orchardAuto') }, ...orchards.map(o => ({ id: o.id as string | null, nombre: o.nombre }))].map(o => (
              <TouchableOpacity
                key={o.id ?? 'auto'}
                onPress={() => setHuertaId(o.id)}
                style={[st.selChip, huertaId === o.id && st.selChipOn]}
              >
                <Text style={[st.selChipText, huertaId === o.id && st.selChipTextOn]}>{o.nombre}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={st.startBtn} onPress={startRecording} activeOpacity={0.88} accessibilityRole="button">
            <LinearGradient colors={['#34d399', '#0f766e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.startGrad}>
              <Route size={22} color="#fff" />
              <Text style={st.startText}>{t('start')}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <View style={st.tipBox}>
            <Text style={st.tipTitle}>{t('tipsTitle')}</Text>
            <Text style={st.tipText}>{t('tips')}</Text>
          </View>
          <Text style={st.privacyText}>{t('privacyNote')}</Text>
        </View>

        <Text style={st.sectionTitle}>{t('pendingTitle')}</Text>
        <View style={st.card}>
          {networkNote && locals.length > 0 && (
            <View style={st.netNote}><WifiOff size={14} color="#a16207" /><Text style={st.netNoteText}>{networkNote}</Text></View>
          )}
          {!locals.length && <Text style={st.muted}>{t('pendingEmpty')}</Text>}
          {locals.map(r => {
            const p = progress[r.localId];
            return (
              <View key={r.localId} style={st.listRow}>
                <View style={st.listIcon}><Footprints size={18} color="#0f766e" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.listTitle}>{fmtDate(r.iniciadoAt)}</Text>
                  <Text style={st.listMeta}>
                    {t('photos', { count: r.fotos.length })} · {formatDistance(routeDistanceMeters(r.ruta))}
                    {orchardName(r.huertaId) ? ` · ${orchardName(r.huertaId)}` : ''}
                  </Text>
                  {p && <Text style={st.listProgress}>{t('uploading', { done: p.done, total: p.total })}</Text>}
                  {p && <View style={st.progressTrack}><View style={[st.progressFill, { width: `${p.total ? (p.done / p.total) * 100 : 0}%` }]} /></View>}
                  {uploadErrors[r.localId] && !p && <Text style={st.errorText}>{t('uploadError')}</Text>}
                </View>
                {!p && (
                  <View style={st.listActions}>
                    <TouchableOpacity style={st.smallBtn} onPress={() => uploadAll({ force: true })} disabled={network === 'offline'}>
                      <CloudUpload size={16} color={network === 'offline' ? '#94a3b8' : '#0f766e'} />
                      <Text style={[st.smallBtnText, network === 'offline' && { color: '#94a3b8' }]}>{t('upload')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={st.iconBtn} onPress={() => confirmDelete(r)} accessibilityLabel={t('delete')}>
                      <Trash2 size={16} color="#b91c1c" />
                    </TouchableOpacity>
                  </View>
                )}
                {p && <ActivityIndicator color="#0f766e" />}
              </View>
            );
          })}
          <View style={st.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.toggleLabel}>{t('mobileData')}</Text>
              <Text style={st.toggleHint}>{t('mobileDataHint')}</Text>
            </View>
            <Switch
              value={mobileData}
              onValueChange={async v => { setMobileData(v); await setMobileDataAllowed(v); if (v) uploadAll(); }}
              trackColor={{ true: '#34d399', false: '#cbd5e1' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <Text style={st.sectionTitle}>{t('resultsTitle')}</Text>
        <View style={st.card}>
          {pushState === 'denied' && (
            <View style={st.netNote}><Bell size={14} color="#a16207" /><Text style={st.netNoteText}>{t('notifyOff')}</Text></View>
          )}
          {loadError && <Text style={st.errorText}>{t('loadError')}</Text>}
          {!loadError && !remotes.length && <Text style={st.muted}>{t('resultsEmpty')}</Text>}
          {remotes.map(r => {
            const info = statusInfo(r.estado);
            return (
              <TouchableOpacity key={r.id} style={st.listRow} onPress={() => openDetail(r.id)} activeOpacity={0.8}>
                <View style={[st.listIcon, { backgroundColor: info.bg }]}><Sparkles size={18} color={info.color} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.listTitle}>{orchardName(r.huerta_id) ?? fmtDate(r.iniciado_at)}</Text>
                  <Text style={st.listMeta}>
                    {fmtDate(r.iniciado_at)} · {r.estado === 'listo' ? t('findings', { count: r.hallazgos_total }) : t('photos', { count: r.fotos_total })}
                  </Text>
                  {(r.estado === 'pendiente' || r.estado === 'procesando') && <Text style={st.listHint}>{t('queuedHint')}</Text>}
                </View>
                <View style={[st.chip, { backgroundColor: info.bg }]}><Text style={[st.chipText, { color: info.color }]}>{info.label}</Text></View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0fdf4' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  backBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d1fae5' },
  headerTitle: { flex: 1, fontFamily: 'Poppins_700Bold', fontSize: 19, color: '#0f172a' },
  scroll: { padding: 16, gap: 14 },
  scrollTablet: { maxWidth: 760, width: '100%', alignSelf: 'center' },
  hero: { borderRadius: 24, padding: 20, gap: 10 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  heroBadgeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#d1fae5' },
  heroTitle: { fontFamily: 'Poppins_700Bold', fontSize: 22, lineHeight: 29, color: '#fff' },
  heroBody: { fontFamily: 'Poppins_400Regular', fontSize: 13.5, lineHeight: 20, color: 'rgba(236,253,245,0.9)' },
  steps: { flexDirection: 'row', gap: 8, marginTop: 6 },
  step: { flex: 1, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 10, gap: 4 },
  stepIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#0f172a' },
  stepBody: { fontFamily: 'Poppins_400Regular', fontSize: 10.5, lineHeight: 14, color: '#475569' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, gap: 12, borderWidth: 1, borderColor: '#dcfce7', shadowColor: '#0f766e', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardTitle: { fontFamily: 'Poppins_700Bold', fontSize: 17, color: '#0f172a', flex: 1 },
  sectionLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 },
  sectionTitle: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: '#0f172a', marginTop: 6, marginLeft: 4 },
  chipsRow: { gap: 8, paddingRight: 8 },
  selChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  selChipOn: { backgroundColor: '#ccfbf1', borderColor: '#14b8a6' },
  selChipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#475569' },
  selChipTextOn: { color: '#0f766e' },
  startBtn: { borderRadius: 18, overflow: 'hidden' },
  startGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  startText: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: '#fff' },
  tipBox: { backgroundColor: '#f0fdfa', borderRadius: 14, padding: 12, gap: 2 },
  tipTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#0f766e' },
  tipText: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 17, color: '#334155' },
  privacyText: { fontFamily: 'Poppins_400Regular', fontSize: 11, lineHeight: 16, color: '#64748b' },
  netNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef9c3', borderRadius: 12, padding: 10 },
  netNoteText: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#854d0e' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  listIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },
  listTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#0f172a' },
  listMeta: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#64748b' },
  listHint: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: '#0369a1', marginTop: 2 },
  listProgress: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#0f766e', marginTop: 2 },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: '#e2e8f0', marginTop: 4, overflow: 'hidden' },
  progressFill: { height: 5, backgroundColor: '#14b8a6' },
  listActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#ecfdf5' },
  smallBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#0f766e' },
  iconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  toggleLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#0f172a' },
  toggleHint: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: '#64748b' },
  muted: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 19, color: '#64748b', textAlign: 'center' },
  padded: { paddingHorizontal: 12 },
  errorText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#b91c1c' },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryBox: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 14, padding: 10, alignItems: 'center' },
  summaryValue: { fontFamily: 'Poppins_700Bold', fontSize: 22, color: '#0f172a' },
  summaryLabel: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: '#64748b', textAlign: 'center' },
  mapCard: { height: 300, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#dcfce7', backgroundColor: '#dbe9df' },
  mapCardTablet: { height: 420 },
  findCard: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 18, padding: 10, borderWidth: 2, borderColor: 'transparent' },
  findCardSelected: { borderColor: '#14b8a6' },
  findThumb: { width: 92, height: 92, borderRadius: 14, backgroundColor: '#f1f5f9' },
  findBody: { flex: 1, gap: 3, justifyContent: 'center' },
  findTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#0f172a' },
  findMeta: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#64748b' },
  lockText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#0f172a', textAlign: 'center' },
  primaryBtn: { backgroundColor: '#0f766e', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  primaryBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#fff' },
  // grabación
  recordScreen: { flex: 1, backgroundColor: '#000' },
  recordTop: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 18, paddingBottom: 28, gap: 10 },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444' },
  recDotPaused: { backgroundColor: '#facc15' },
  recTitle: { fontFamily: 'Poppins_700Bold', fontSize: 17, color: '#fff' },
  gpsPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  gpsOk: { backgroundColor: 'rgba(22,163,74,0.85)' },
  gpsSearch: { backgroundColor: 'rgba(100,116,139,0.85)' },
  gpsLost: { backgroundColor: 'rgba(202,138,4,0.9)' },
  gpsText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#fff' },
  cameraLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  recordBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 40, gap: 12 },
  limitText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#fde68a', textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: 16, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  statValue: { fontFamily: 'Poppins_700Bold', fontSize: 20, color: '#fff' },
  statLabel: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.75)' },
  recordTip: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  recordActions: { flexDirection: 'row', gap: 10 },
  recSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  recSecondaryText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#fff' },
  recStop: { flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 18, backgroundColor: '#dc2626' },
  recStopText: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: '#fff' },
});
