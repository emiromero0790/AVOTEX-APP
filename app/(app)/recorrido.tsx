import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AppState,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
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
import * as Haptics from 'expo-haptics';
import Reanimated, { FadeIn, FadeOut, LinearTransition, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import {
  ChevronLeft,
  CloudOff,
  CloudUpload,
  Footprints,
  Lock,
  Pause,
  Play,
  Square,
  Trash2,
  WifiOff,
  Sparkles,
  Bell,
  Route,
  CheckCircle2,
  AlertTriangle,
  Info,
  HardDrive,
  Wifi,
  Signal,
  Smartphone,
  RotateCcw,
  X,
  Camera as CameraIcon,
} from 'lucide-react-native';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { auth as firebaseAuth } from '../../firebaseConfig';
import { useGuest } from '../../context/GuestContext';
import { localizeDomainLabel, TranslationResource, useLanguage, useTranslations } from '../../context/LanguageContext';
import { listOrchards, Orchard } from '../../services/orchards';
import {
  CAPTURE_EVERY_M,
  CAPTURE_EVERY_S_WITHOUT_GPS,
  FotoLocal,
  IDLE_CAPTURE_S,
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
  isUploading,
  listHallazgos,
  listLocal,
  listRemote,
  recoverInterrupted,
  saveLocal,
  setMobileDataAllowed,
  storePhoto,
  thumbnailSource,
  uploadRecorrido,
} from '../../services/recorridos';
import { registerForPush } from '../../services/push';
import { withTimeout } from '../../services/timeout';
import { GpsTrack } from '../../services/gpsFilter';
import { FieldMotion } from '../../services/fieldMotion';
import FieldTracking3D, { FieldTrackingGuard } from '../../components/fieldTracking/FieldTracking3D';
import { cleanRoute, routeMeters } from '../../services/escaneos';
import RecorridoMap from '../../components/RecorridoMap';
// Fotos reales de montaje (Flickr, CC BY 2.0 y CC BY-SA 2.0). Ver assets/images/escanear/CREDITOS.md
// (La foto del arnés de pecho se usa en la importación de GoPro; cada foto aparece en una sola pantalla.)
const IMG_MOUNT_HELMET = require('../../assets/images/escanear/montaje-casco.jpg');
import { CSS_EASE_OUT, EASE_IN_OUT, EASE_OUT, PressableScale, PulseRing } from '../../components/scan/motion';
import WalkPrepare from '../../components/scan/WalkPrepare';
import WalkReview from '../../components/scan/WalkReview';
import OrchardPickerSheet from '../../components/scan/OrchardPickerSheet';
import { resolveScanHuerta, type HuertaResolution } from '../../services/huertaResolver';

// Duración de "mantén presionado para terminar": evita cortar un recorrido por un toque accidental.
const HOLD_TO_FINISH_MS = 900;
const HUD_FADE_IN = FadeIn.duration(250).easing(EASE_OUT);
const PAUSE_IN = FadeIn.duration(200).easing(EASE_OUT);
const PAUSE_OUT = FadeOut.duration(160);
// Lista "Mis recorridos": al subirse un recorrido sale con un fundido y el resto se acomoda (no se ve un salto).
const ITEM_OUT = FadeOut.duration(200);
const ITEM_IN = FadeIn.duration(220).easing(EASE_OUT);
const LIST_REFLOW = LinearTransition.duration(260).easing(EASE_IN_OUT);
// El número de fotos "late" una vez cada vez que se guarda una imagen nueva.
const COUNT_POP = { from: { transform: [{ scale: 1.18 }] }, to: { transform: [{ scale: 1 }] } };
const ROTATE_HINT_MS = 10000;
const ROTATE_IN = FadeIn.duration(220).easing(EASE_OUT);

const auth = firebaseAuth as Auth;

/**
 * Diagnóstico GPS en la consola (Metro, `adb logcat -s ReactNativeJS`, o Consola de macOS en iOS):
 * una línea por lectura con lo que recibe el filtro de distancia (services/gpsFilter.ts) y su decisión.
 * Buscar «[gps]». Ejemplo:
 *   [gps] #12 ±6m v=0.00(no confiable) desp 3.1/7.5m → rechazada(puerta) · pasos 2 · rech prec 0 puerta 9 salto 0 idavuelta 0 · total 11.4m
 */
function logGps(track: GpsTrack, f: { lat: number; lng: number; acc: number | null; speed: number | null; step: number; accepted: boolean }) {
  const d = track.debug;
  const n = (v: number | null | undefined, k = 1) => (v == null ? '—' : v.toFixed(k));
  const speedTxt = f.speed == null || f.speed < 0 ? 'sin dato' : `${n(f.speed, 2)}${d.speedTrusted ? '' : '(no confiable)'}`;
  const verdict = f.accepted ? (f.step > 0 ? `+${n(f.step)}m` : 'inicio') : `rechazada(${d.lastReason})`;
  console.log(
    `[gps] #${d.fixes} ±${n(f.acc, 0)}m v=${speedTxt}${d.still ? ' quieto' : ''} desp ${n(d.lastDist)}/${n(d.lastGate)}m → ${verdict}`
    + ` · pasos ${d.accepted} · rech prec ${d.rejectedAccuracy} puerta ${d.rejectedGate} salto ${d.rejectedSpike} idavuelta ${d.rejectedReversal}`
    + ` · total ${n(track.distance)}m · ${f.lat.toFixed(6)},${f.lng.toFixed(6)}`,
  );
}

const translations: TranslationResource = {
  title: { es: 'Recorrido inteligente', en: 'Smart field walk' },
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
  checkingOrchard: { es: 'Verificando tu ubicación…', en: 'Checking your location…' },
  startingWalk: { es: 'Preparando el recorrido…', en: 'Preparing the walk…' },
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
  homeTitle: { es: 'Mis recorridos', en: 'My walks' },
  syncPending: { es: '{walks} por subir · {photos} fotos', en: '{walks} to upload · {photos} photos' },
  syncUploading: { es: 'Subiendo al servidor…', en: 'Uploading to the server…' },
  syncReady: { es: 'Con conexión: se suben solos al abrir esta pantalla.', en: 'Online: they upload automatically when you open this screen.' },
  syncClear: { es: 'Todo está subido.', en: 'Everything is uploaded.' },
  newWalk: { es: 'Nuevo recorrido', en: 'New walk' },
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
  // preparación
  prepTitle: { es: 'Antes de empezar', en: 'Before you start' },
  prepIntro: { es: 'Revisa estos puntos para que el recorrido salga bien.', en: 'Check these points so your walk goes well.' },
  prepChecked: { es: 'Lo que revisamos en tu celular', en: 'What we checked on your phone' },
  prepRecommend: { es: 'Recomendaciones', en: 'Recommendations' },
  prepRecommendHint: { es: 'No podemos comprobarlas automáticamente; revísalas tú.', en: 'We cannot check these automatically; please check them yourself.' },
  prepOrchard: { es: 'Huerta', en: 'Orchard' },
  prepOrchardAuto: { es: 'Se detectará por GPS', en: 'Will be detected by GPS' },
  prepChange: { es: 'Cambiar', en: 'Change' },
  prepCamera: { es: 'Cámara', en: 'Camera' },
  prepLocation: { es: 'Ubicación (GPS)', en: 'Location (GPS)' },
  prepGranted: { es: 'Permiso concedido', en: 'Permission granted' },
  prepWillAsk: { es: 'Te pediremos permiso al comenzar', en: 'We will ask for permission when you start' },
  prepDenied: { es: 'Permiso negado: actívalo en Ajustes del teléfono', en: 'Permission denied: enable it in phone Settings' },
  prepLocationDenied: { es: 'Sin GPS no se podrá ubicar cada hallazgo', en: 'Without GPS findings cannot be located' },
  prepStorage: { es: 'Almacenamiento', en: 'Storage' },
  prepStorageOk: { es: '{gb} GB libres', en: '{gb} GB free' },
  prepStorageLow: { es: 'Poco espacio ({gb} GB). Libera espacio antes de grabar.', en: 'Low space ({gb} GB). Free up space before recording.' },
  prepConnection: { es: 'Conexión', en: 'Connection' },
  prepOffline: { es: 'Sin internet: puedes grabar igual. Se subirá cuando tengas conexión.', en: 'Offline: you can still record. It will upload when you are online.' },
  prepWifi: { es: 'WiFi: se subirá al terminar el recorrido.', en: 'WiFi: it will upload when the walk ends.' },
  prepMobileOn: { es: 'Datos móviles: se subirá al terminar el recorrido.', en: 'Mobile data: it will upload when the walk ends.' },
  prepCellular: { es: 'Datos móviles: se subirá cuando tengas WiFi (o activa “Subir también con datos móviles”).', en: 'Mobile data: it will upload on WiFi (or enable “Also upload on mobile data”).' },
  prepChecking: { es: 'Revisando…', en: 'Checking…' },
  rec1: { es: 'Sujeta bien el teléfono al pecho o casco, con la cámara hacia los árboles.', en: 'Attach the phone firmly to your chest or helmet, camera facing the trees.' },
  rec2: { es: 'Que ninguna correa, ropa o rama tape la cámara.', en: 'Make sure no strap, clothing or branch covers the camera.' },
  rec3: { es: 'Limpia la lente con un paño suave.', en: 'Clean the lens with a soft cloth.' },
  rotateTitle: { es: 'Gira tu celular', en: 'Turn your phone' },
  rotateBody: { es: 'Rota el dispositivo para una mejor experiencia.', en: 'Rotate your device for a better experience.' },
  close: { es: 'Cerrar', en: 'Close' },
  rotateSkip: { es: 'Continuar en vertical', en: 'Continue in portrait' },
  rec4: { es: 'Lleva batería suficiente: la cámara y el GPS gastan más de lo normal.', en: 'Bring enough battery: camera and GPS use more power than usual.' },
  prepStart: { es: 'Comenzar recorrido', en: 'Start walk' },
  prepReady: { es: 'Todo listo para grabar', en: 'Ready to record' },
  mountTag: { es: 'En el pecho o en el casco, cámara al frente', en: 'On your chest or helmet, camera forward' },
  mountHelmetShort: { es: 'o en el casco', en: 'or on a helmet' },
  prepWarnings: { es: '{count} punto(s) por revisar', en: '{count} item(s) to check' },
  prepBack: { es: 'Regresar', en: 'Go back' },
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
  holdToFinish: { es: 'Mantén presionado para terminar', en: 'Press and hold to finish' },
  pausedHint: { es: 'La captura está detenida. Toca “Seguir” para continuar.', en: 'Capture is stopped. Tap “Resume” to continue.' },
  savedOnPhone: { es: 'Se guarda en el celular', en: 'Saving on this phone' },
  netOffline: { es: 'Sin señal · se sube después', en: 'No signal · uploads later' },
  netWifi: { es: 'WiFi · se sube al terminar', en: 'WiFi · uploads when done' },
  netCellular: { es: 'Datos · se sube con WiFi', en: 'Mobile data · uploads on WiFi' },
  netCellularOn: { es: 'Datos · se sube al terminar', en: 'Mobile data · uploads when done' },
  autoCapture: { es: 'Captura automática', en: 'Automatic capture' },
  limitReached: { es: 'Llegaste al máximo de imágenes de un recorrido. Termina y empieza otro.', en: 'You reached the image limit for one walk. Finish and start another.' },
  noSpace: { es: 'Tu celular tiene poco espacio libre. Libera espacio antes de grabar.', en: 'Your phone is low on storage. Free some space before recording.' },
  permCamera: { es: 'Necesitamos la cámara para grabar el recorrido.', en: 'We need the camera to record the walk.' },
  permLocation: { es: 'Sin ubicación no podremos marcar dónde está cada hallazgo. ¿Grabar de todos modos?', en: 'Without location we cannot mark where each finding is. Record anyway?' },
  recordAnyway: { es: 'Grabar sin GPS', en: 'Record without GPS' },
  savedTitle: { es: 'Recorrido guardado', en: 'Walk saved' },
  savedBody: { es: '{count} imágenes guardadas en el celular.', en: '{count} images saved on the phone.' },
  takePhoto: { es: 'Tomar foto', en: 'Take photo' },
  photoTaken: { es: 'Foto guardada', en: 'Photo saved' },
  discardTitle: { es: '¿Descartar el recorrido?', en: 'Discard the walk?' },
  discardBody: { es: 'Se borrarán todas sus fotos del celular y no se procesará.', en: 'All its photos will be deleted from the phone and it will not be processed.' },
  discardYes: { es: 'Descartar', en: 'Discard' },
  discarded: { es: 'Recorrido descartado.', en: 'Walk discarded.' },
  distWaitGps: { es: 'Esperando señal GPS', en: 'Waiting for GPS signal' },
  distEvery: { es: 'Suma cada ~{m} m', en: 'Adds every ~{m} m' },
  distLeft: { es: 'Avanza ~{m} m más para sumar', en: 'Walk ~{m} m more to add' },
  emptyWalk: { es: 'No se tomó ninguna imagen; el recorrido no se guardó.', en: 'No images were taken; the walk was not saved.' },
  processTitle: { es: '¿Procesar este recorrido?', en: 'Process this walk?' },
  processBody: {
    es: '{count} imágenes. Si lo procesas, se sube y la IA analiza las imágenes. Si lo borras, se elimina del celular y no se analiza.',
    en: '{count} images. If you process it, it is uploaded and AI analyzes the images. If you delete it, it is removed from the phone and not analyzed.',
  },
  processYes: { es: 'Procesar', en: 'Process' },
  processDelete: { es: 'Borrar', en: 'Delete' },
  deletedWalk: { es: 'Recorrido borrado. No se subió ni se analizó.', en: 'Walk deleted. It was not uploaded or analyzed.' },
  // detalle
  detailTitle: { es: 'Recorrido del {date}', en: 'Walk of {date}' },
  analyzed: { es: 'imágenes analizadas', en: 'images analyzed' },
  capturedLabel: { es: 'capturadas', en: 'captured' },
  analyzedShort: { es: 'analizadas', en: 'analyzed' },
  discardedLabel: { es: 'descartadas', en: 'discarded' },
  discardedHint: { es: 'Las descartadas son fotos movidas o borrosas que no se enviaron al modelo.', en: 'Discarded photos were blurry or shaky and were not sent to the model.' },
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
  locked: { es: 'Crea una cuenta para usar el recorrido inteligente.', en: 'Create an account to use the smart field walk.' },
  signIn: { es: 'Crear cuenta / Iniciar sesión', en: 'Create account / Sign in' },
  notifyOff: { es: 'Activa las notificaciones para saber cuándo está listo tu análisis.', en: 'Turn on notifications to know when your analysis is ready.' },
};

type Mode = 'home' | 'prepare' | 'record' | 'review' | 'detail';
type PermState = 'granted' | 'ask' | 'denied' | null;

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Leyenda bajo la distancia: el contador sube por tramos (el filtro solo suma cuando el avance supera el ruido
 * del GPS). Muestra cuánto falta para el siguiente tramo, con el mínimo real del filtro, no un número fijo.
 */
function distanceHint(
  s: { gps: 'ok' | 'searching' | 'lost'; gate: number; pending: number },
  paused: boolean,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (paused) return t('savedOnPhone');
  if (s.gps !== 'ok' || s.gate <= 0) return t('distWaitGps');
  const left = Math.ceil(s.gate - s.pending);
  // Con algo de avance acumulado (≥ 1 m) se dice cuánto falta; quieto, cada cuánto suma.
  if (s.pending >= 1 && left >= 1) return t('distLeft', { m: left });
  return t('distEvery', { m: Math.max(1, Math.round(s.gate)) });
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
  const { width, height: winH } = useWindowDimensions();
  const isTablet = width >= 768;
  const params = useLocalSearchParams<{ id?: string; open?: 'prepare' | 'home'; n?: string; from?: string; modo?: string }>();
  // Modo elegido en Escanear: solo cambia la animación (Dron: lanza un dron que lo sigue; GoPro: casco con GoPro).
  const [companion, setCompanion] = useState<'none' | 'dron' | 'gopro'>(params.modo === 'dron' ? 'dron' : params.modo === 'gopro' ? 'gopro' : 'none');
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const email = user?.email ?? '';
  const [mode, setMode] = useState<Mode>(params.id ? 'detail' : params.open === 'prepare' ? 'prepare' : 'home');
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  // Se llegó desde el botón «Iniciar recorrido» de Escanear: «Regresar» vuelve allí.
  const fromScan = params.open === 'prepare';

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
  const trackRef = useRef<GpsTrack | null>(null);
  const lastFixRef = useRef<{ lat: number; lng: number; acc: number | null; at: number } | null>(null);
  const lastShotRef = useRef<{ lat: number | null; lng: number | null; at: number } | null>(null);
  // Recorrido terminado, esperando a que se elijan las fotos.
  const reviewRef = useRef<RecorridoLocal | null>(null);
  const [reviewFotos, setReviewFotos] = useState<FotoLocal[]>([]);
  const useGpsRef = useRef(true);
  // Field Tracking 3D: solo visualización. Recibe las mismas lecturas GPS (no hay otro observador).
  const fieldMotionRef = useRef<FieldMotion | null>(null);
  const [fieldMotion, setFieldMotion] = useState<FieldMotion | null>(null);
  // Tamaño del panel del agricultor (se mide: depende de la pantalla y la orientación).
  const [vizSize, setVizSize] = useState({ w: 0, h: 0 });
  // Aviso «Gira tu celular» al iniciar el recorrido: se va solo al girar a horizontal, con el botón o a los 10 s.
  const [rotateHint, setRotateHint] = useState(false);
  // Orientación medida con el diseño real de la pantalla (onLayout). useWindowDimensions a veces llega tarde al
  // girar en Android: el aviso «Gira tu celular» se quedaba aunque el teléfono ya estuviera horizontal.
  const [screenBox, setScreenBox] = useState<{ w: number; h: number } | null>(null);
  const isLandscape = screenBox ? screenBox.w > screenBox.h : width > winH;
  useEffect(() => { if (isLandscape) setRotateHint(false); }, [isLandscape]);
  useEffect(() => {
    if (!rotateHint) return;
    const id = setTimeout(() => setRotateHint(false), ROTATE_HINT_MS);
    return () => clearTimeout(id);
  }, [rotateHint]);
  const [paused, setPaused] = useState(false);
  // gate/pending: mínimo para sumar el siguiente tramo y lo avanzado hacia él (del filtro GpsTrack, en metros).
  const [stats, setStats] = useState({ elapsed: 0, distance: 0, photos: 0, accuracy: null as number | null, gps: 'searching' as 'ok' | 'searching' | 'lost', gate: 0, pending: 0 });
  const [limitHit, setLimitHit] = useState(false);
  const startedAtRef = useRef(0);
  const pausedMsRef = useRef(0);
  const pauseStartRef = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();
  const [holding, setHolding] = useState(false);
  const [holdHint, setHoldHint] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── detalle ──
  const [detail, setDetail] = useState<RecorridoRemoto | null>(null);
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const detailScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const cardY = useRef<Record<string, number>>({});

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (params.id) {
      setMode('detail');
      openDetail(params.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, params.n, email]);

  // La pantalla sigue montada entre visitas (vive dentro de las pestañas): cada pulsación de
  // «Iniciar recorrido» o «Mis recorridos» en Escanear trae un `n` nuevo y abre la vista pedida.
  // Nunca interrumpe una grabación en curso.
  useEffect(() => {
    if (!params.n || params.id || modeRef.current === 'record') return;
    if (params.open === 'prepare') {
      setCompanion(params.modo === 'dron' ? 'dron' : params.modo === 'gopro' ? 'gopro' : 'none');
      setPrep({ camera: null, location: null, freeBytes: null, networkChecked: false });
      setMode('prepare');
    } else if (params.open === 'home') {
      setMode('home');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.open, params.n]);

  // ───────────────────────── datos ─────────────────────────

  const refreshNetwork = useCallback(async () => {
    try {
      // En algunos Android esta llamada no responde: a los 4 s se da por desconocida.
      const st = await withTimeout(Network.getNetworkStateAsync(), 4000, null);
      if (!st) { setNetwork('unknown'); return 'unknown' as const; }
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
    // Se omiten los que otra pantalla (Mis escaneos) ya está subiendo.
    const pending = (await listLocal(email)).filter(r => r.estado === 'guardado' && r.fotos.length > 0 && !isUploading(r.localId));
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

  // Conexión en vivo (inicio y grabación). En el inicio, al recuperar la señal se intenta subir lo pendiente
  // con la misma regla de siempre (WiFi, o datos móviles si el usuario lo permitió).
  const networkRef = useRef(network);
  useEffect(() => {
    if ((mode !== 'home' && mode !== 'record') || !email || isGuest) return;
    const sub = Network.addNetworkStateListener(st => {
      const kind = !st.isConnected || st.isInternetReachable === false ? 'offline'
        : st.type === Network.NetworkStateType.WIFI || st.type === Network.NetworkStateType.ETHERNET ? 'wifi' : 'cellular';
      const was = networkRef.current;
      networkRef.current = kind;
      setNetwork(kind);
      if (mode === 'home' && was === 'offline' && kind !== 'offline') uploadAll();
    });
    return () => sub.remove();
  }, [mode, email, isGuest, uploadAll]);
  useEffect(() => { networkRef.current = network; }, [network]);

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

  // ───────────────────────── preparación ─────────────────────────

  // Cada revisión se muestra en cuanto termina y tiene un límite de tiempo: si una llamada nativa no
  // responde, se marca «no disponible» / «se pedirá al empezar» en vez de quedarse cargando.
  type Prep = { camera: PermState; location: PermState; freeBytes: number | null | 'na'; networkChecked: boolean };
  const [prep, setPrep] = useState<Prep>({ camera: null, location: null, freeBytes: null, networkChecked: false });
  // Al volver a la app (p. ej. desde Ajustes, tras dar un permiso) se revisa todo otra vez.
  const [prepNonce, setPrepNonce] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st === 'active' && modeRef.current === 'prepare') setPrepNonce(n => n + 1); });
    return () => sub.remove();
  }, []);

  // Revisa de verdad lo que el teléfono permite comprobar (permisos, espacio y conexión).
  useEffect(() => {
    if (mode !== 'prepare') return;
    let alive = true;
    const patch = (p: Partial<Prep>) => { if (alive) setPrep(prev => ({ ...prev, ...p })); };
    const toState = (p: { granted: boolean; canAskAgain?: boolean } | null | undefined): PermState =>
      !p ? 'ask' : p.granted ? 'granted' : p.canAskAgain === false ? 'denied' : 'ask';
    // Cámara: el hook ya la conoce; sin dato todavía, se pedirá al empezar.
    patch({ camera: toState(cameraPermission) });
    withTimeout(Location.getForegroundPermissionsAsync(), 4000, null).then(p => patch({ location: toState(p) }));
    if (Platform.OS === 'web') patch({ freeBytes: 'na' });
    else withTimeout<number | 'na'>(FileSystem.getFreeDiskStorageAsync(), 4000, 'na').then(v => patch({ freeBytes: typeof v === 'number' && v >= 0 ? v : 'na' }));
    patch({ networkChecked: false });
    refreshNetwork().then(() => patch({ networkChecked: true }));
    // Si se entró directo a la preparación (desde Escanear), aún no se cargaron las huertas.
    if (email) {
      getMobileDataAllowed().then(v => { if (alive) setMobileData(v); }).catch(() => {});
      if (!orchards.length) listOrchards(email).then(o => { if (alive) setOrchards(o); }).catch(() => {});
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- las huertas solo se cargan una vez al entrar
  }, [mode, cameraPermission, refreshNetwork, email, prepNonce]);

  // ───────────────────────── grabación ─────────────────────────

  const stopSensors = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    fieldMotionRef.current = null;
    setFieldMotion(null);
    Promise.resolve(deactivateKeepAwake('recorrido')).catch(() => {});
  }, []);

  /** manual: botón «Tomar foto» (también en pausa; espera a que termine una captura en curso). */
  const shoot = useCallback(async (coords: { lat: number; lng: number; precision: number | null } | null, manual = false): Promise<boolean> => {
    if (manual) for (let i = 0; i < 25 && busyRef.current; i++) await new Promise(r => setTimeout(r, 60));
    const rec = recRef.current;
    const cam = cameraRef.current;
    if (!rec || !cam || !cameraReadyRef.current || busyRef.current || (pausedRef.current && !manual)) return false;
    if (rec.fotos.length >= MAX_PHOTOS) { setLimitHit(true); return false; }
    busyRef.current = true;
    try {
      const photo = await cam.takePictureAsync({ quality: 0.6, shutterSound: false });
      if (!photo?.uri || !recRef.current) return false;
      const foto = await storePhoto(rec, photo.uri, coords);
      rec.fotos.push(foto);
      lastShotRef.current = { lat: coords?.lat ?? null, lng: coords?.lng ?? null, at: Date.now() };
      setStats(s => ({ ...s, photos: rec.fotos.length }));
      // Se guarda seguido: si la app se cierra, el recorrido no se pierde.
      if (rec.fotos.length % 5 === 0) await saveLocal(rec);
      return true;
    } catch (e) {
      console.warn('[recorrido] no se pudo tomar la imagen', e);
      return false;
    } finally {
      busyRef.current = false;
    }
  }, []);

  const onPosition = useCallback((loc: Location.LocationObject) => {
    const rec = recRef.current;
    if (!rec) return;
    const { latitude: lat, longitude: lng, accuracy, speed } = loc.coords;
    const now = Date.now();
    const prev = lastFixRef.current;
    lastFixRef.current = { lat, lng, acc: accuracy ?? null, at: now };
    // Filtro de la traza (services/gpsFilter.ts): el «baile» del GPS estando quieto ya no suma metros
    // ni dispara fotos. Solo los pasos de movimiento real entran a la ruta y a la distancia.
    const track = trackRef.current ?? (trackRef.current = new GpsTrack());
    const step = track.push({ lat, lng, acc: accuracy ?? null, speed: speed ?? null, t: now });
    logGps(track, { lat, lng, acc: accuracy ?? null, speed: speed ?? null, step: step.step, accepted: step.accepted });
    if (step.accepted && step.point) {
      rec.ruta.push({ lat: step.point.lat, lng: step.point.lng, t: new Date(now).toISOString(), f: 1 });
      if (step.step > 0 && !pausedRef.current) setStats(s => ({ ...s, distance: s.distance + step.step }));
    }
    // Al arrancar, el teléfono puede repetir la última posición conocida: hasta que haya lecturas frescas
    // se muestra «Buscando GPS…» (todavía no se puede medir distancia).
    const warming = track.frozen && track.debug.accepted === 0;
    // Tras sumar un tramo, lo pendiente vuelve a 0 (el filtro deja el ancla en el punto aceptado).
    const pending = step.accepted ? 0 : track.debug.lastDist;
    const gate = track.debug.lastGate;
    setStats(s => ({ ...s, accuracy: accuracy ?? null, gps: warming ? 'searching' : 'ok', gate: gate > 0 ? gate : s.gate, pending }));
    const fm = fieldMotionRef.current;
    if (fm) {
      try {
        fm.pushFix({
          t: now, lat, lng, acc: accuracy ?? null, speed: track.lastSpeed, heading: loc.coords.heading ?? null,
          accepted: step.accepted, step: step.step, trackMoving: track.isMoving(now),
        });
      } catch (e) { console.warn('[recorrido] field tracking', e); }
    }
    if (pausedRef.current) return;
    // Fotos por distancia solo si de verdad te estás moviendo; la posición es la suavizada.
    const pos = track.position() ?? { lat, lng };
    const shot = lastShotRef.current;
    const far = !shot || shot.lat == null || shot.lng == null || distanceMeters(shot.lat, shot.lng, pos.lat, pos.lng) >= CAPTURE_EVERY_M;
    if (far && (!shot || track.isMoving(now)) && (!prev || accuracy == null || accuracy <= 30)) shoot({ lat: pos.lat, lng: pos.lng, precision: accuracy ?? null });
  }, [shoot]);

  // La huerta del recorrido se decide antes de empezar y viaja con él (archivo local → recorridos.huerta_id).
  const startRecording = useCallback(async (walkHuertaId: string | null) => {
    if (!email) return;
    if (Platform.OS !== 'web') {
      try {
        const free = await withTimeout(FileSystem.getFreeDiskStorageAsync(), 4000, Infinity);
        if (free < 300 * 1024 * 1024) { Alert.alert(t('title'), t('noSpace')); return; }
      } catch { /* sin dato de espacio */ }
    }
    // Permisos con límite de tiempo: si el sistema nunca responde, se avisa en vez de quedarse esperando.
    // El diálogo de permiso tiene 30 s (el usuario puede tardar en leerlo).
    const cam = cameraPermission?.granted ? cameraPermission : await withTimeout(requestCameraPermission(), 30000, null);
    if (!cam?.granted) { Alert.alert(t('title'), t('permCamera')); return; }

    const current = await withTimeout(Location.getForegroundPermissionsAsync(), 4000, null);
    const loc = current?.granted
      ? current
      : await withTimeout<{ status: string } | null>(Location.requestForegroundPermissionsAsync(), 30000, null);
    const begin = async (withGps: boolean) => {
      useGpsRef.current = withGps;
      const rec = await createLocal(email, walkHuertaId);
      recRef.current = rec;
      lastFixRef.current = null;
      trackRef.current = new GpsTrack();
      const fm = new FieldMotion();
      fm.setGpsEnabled(withGps);
      fieldMotionRef.current = fm;
      setFieldMotion(fm);
      lastShotRef.current = null;
      pausedRef.current = false;
      setPaused(false);
      setLimitHit(false);
      setHoldHint(false);
      setCameraReady(false);
      cameraReadyRef.current = false;
      setStats({ elapsed: 0, distance: 0, photos: 0, accuracy: null, gps: withGps ? 'searching' : 'lost', gate: 0, pending: 0 });
      startedAtRef.current = Date.now();
      pausedMsRef.current = 0;
      pauseStartRef.current = null;
      setMode('record');
      { const d = Dimensions.get('window'); setRotateHint(d.height >= d.width); }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      refreshNetwork();
      activateKeepAwakeAsync('recorrido').catch(() => {});
      // El GPS no se espera: si tarda o nunca responde, el reloj y la captura por tiempo ya corren
      // (tras 8 s sin lectura se marca «Sin GPS» y se toma una imagen cada pocos segundos).
      if (withGps) {
        Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
          onPosition,
        ).then(sub => {
          // Si el recorrido ya terminó o cambió mientras esperaba, se suelta el observador.
          if (recRef.current?.localId === rec.localId && !watchRef.current) watchRef.current = sub;
          else sub.remove();
        }).catch(() => { useGpsRef.current = false; });
      }
      tickRef.current = setInterval(() => {
        const now = Date.now();
        const pausedNow = pauseStartRef.current ? now - pauseStartRef.current : 0;
        const fix = lastFixRef.current;
        const gpsLost = !useGpsRef.current || !fix || now - fix.at > 5000;
        try { fieldMotionRef.current?.tick(now); } catch { /* solo visualización */ }
        setStats(s => ({
          ...s,
          elapsed: now - startedAtRef.current - pausedMsRef.current - pausedNow,
          gps: !useGpsRef.current ? 'lost' : (!fix ? (now - startedAtRef.current > 8000 ? 'lost' : 'searching') : gpsLost ? 'lost'
            : trackRef.current?.frozen && trackRef.current.debug.accepted === 0 ? 'searching' : 'ok'),
        }));
        // Sin GPS: una imagen cada pocos segundos para no perder el recorrido.
        const shot = lastShotRef.current;
        // Con GPS pero sin avanzar: si en IDLE_CAPTURE_S no hubo foto por distancia, se toma una donde estás.
        if (!gpsLost && !pausedRef.current && fix && now - (shot?.at ?? startedAtRef.current) >= IDLE_CAPTURE_S * 1000) {
          const pos = trackRef.current?.position() ?? { lat: fix.lat, lng: fix.lng };
          shoot({ lat: pos.lat, lng: pos.lng, precision: fix.acc });
        }
        if (gpsLost && (now - startedAtRef.current > 8000 || !useGpsRef.current) && (!shot || now - shot.at >= CAPTURE_EVERY_S_WITHOUT_GPS * 1000)) {
          shoot(null);
        }
      }, 1000);
    };

    if (loc?.status !== 'granted') {
      Alert.alert(t('title'), t('permLocation'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('recordAnyway'), onPress: () => { begin(false); } },
      ]);
      return;
    }
    await begin(true);
  }, [email, cameraPermission, requestCameraPermission, onPosition, shoot, refreshNetwork, t]);

  // «Comenzar recorrido»: si el usuario ya eligió una huerta en la preparación, se usa esa.
  // Con «Detectar por GPS» se resuelve aquí, una sola vez: dentro de una huerta → se asigna sola;
  // si no, se pregunta con la hoja de selección y el recorrido empieza al pulsar «Continuar».
  const [checkingOrchard, setCheckingOrchard] = useState(false);
  // Mientras se piden permisos y se arranca la grabación, el botón lo dice (y no se puede pulsar dos veces).
  const [starting, setStarting] = useState(false);
  const startWalk = useCallback(async (id: string | null) => {
    setStarting(true);
    try { await startRecording(id); } finally { setStarting(false); }
  }, [startRecording]);
  const [orchardPick, setOrchardPick] = useState<Extract<HuertaResolution, { kind: 'manual' }> | null>(null);
  const beginWalk = useCallback(async () => {
    if (!email || checkingOrchard || orchardPick || starting) return;
    if (huertaId) { await startWalk(huertaId); return; }
    setCheckingOrchard(true);
    const res = await resolveScanHuerta(email, orchards.length ? orchards : undefined);
    setCheckingOrchard(false);
    if (res.kind === 'auto') await startWalk(res.huerta.id);
    else setOrchardPick(res);
  }, [email, checkingOrchard, orchardPick, starting, huertaId, orchards, startWalk]);

  const togglePause = useCallback(() => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
    // La pantalla de grabación se queda hasta decidir: si se mostrara la lista, su carga recuperaría el
    // recorrido («grabando» → guardado) y lo subiría antes de que el usuario elija.
    if (!rec) { setMode('home'); return; }
    // Espera a que termine una captura en curso.
    for (let i = 0; i < 20 && busyRef.current; i++) await new Promise(r => setTimeout(r, 100));
    if (!rec.fotos.length) {
      setMode('home');
      await deleteLocal(rec);
      Alert.alert(t('title'), t('emptyWalk'));
      await loadHome();
      uploadAll();
      return;
    }
    // Se guarda ya (si la app se cierra aquí, no se pierde nada). Queda «grabando» mientras se decide y se
    // eligen fotos: así nada lo sube antes de tiempo. Si la app se cierra aquí, recoverInterrupted lo guarda
    // con todas sus fotos.
    rec.terminadoAt = new Date().toISOString();
    await saveLocal(rec);
    // Antes de subir (y gastar en el análisis) se pregunta si se procesa o se borra.
    const choice = await new Promise<'process' | 'delete'>(resolve => {
      Alert.alert(
        t('processTitle'),
        t('processBody', { count: rec.fotos.length }),
        [
          { text: t('processDelete'), style: 'destructive', onPress: () => resolve('delete') },
          { text: t('processYes'), onPress: () => resolve('process') },
        ],
        { cancelable: false },
      );
    });
    if (choice === 'delete') {
      await deleteLocal(rec);
      setMode('home');
      await loadHome();
      Alert.alert(t('title'), t('deletedWalk'));
      return;
    }
    // «Procesar»: se eligen las fotos que se analizan (todas marcadas al inicio).
    reviewRef.current = rec;
    setReviewFotos(rec.fotos.slice());
    setMode('review');
  }, [stopSensors, loadHome, uploadAll, t]);

  // Elegir fotos: solo las marcadas se quedan y se suben; las demás se borran del celular.
  const confirmReview = useCallback(async (keep: string[]) => {
    const rec = reviewRef.current;
    reviewRef.current = null;
    setMode('home');
    setReviewFotos([]);
    if (!rec) return;
    const keepSet = new Set(keep);
    const drop = rec.fotos.filter(f => !keepSet.has(f.id));
    rec.fotos = rec.fotos.filter(f => keepSet.has(f.id));
    await Promise.all(drop.map(f => FileSystem.deleteAsync(f.uri, { idempotent: true }).catch(() => {})));
    rec.estado = 'guardado';
    await saveLocal(rec);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(t('savedTitle'), t('savedBody', { count: rec.fotos.length }));
    await loadHome();
    uploadAll();
  }, [loadHome, uploadAll, t]);
  const discardReview = useCallback(() => {
    Alert.alert(t('discardTitle'), t('discardBody'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('discardYes'), style: 'destructive', onPress: async () => {
          const rec = reviewRef.current;
          reviewRef.current = null;
          setMode('home');
          setReviewFotos([]);
          if (rec) await deleteLocal(rec);
          await loadHome();
        },
      },
    ]);
  }, [loadHome, t]);

  // «Tomar foto»: foto manual en la posición actual; entra a las fotos del recorrido.
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(0), 1300);
    return () => clearTimeout(id);
  }, [flash]);
  const takePhotoNow = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const fix = lastFixRef.current;
    const pos = trackRef.current?.position() ?? (fix ? { lat: fix.lat, lng: fix.lng } : null);
    const ok = await shoot(pos ? { lat: pos.lat, lng: pos.lng, precision: fix?.acc ?? null } : null, true);
    if (ok) setFlash(n => n + 1);
  }, [shoot]);

  // Terminar: se mantiene presionado; soltar antes cancela. Lectores de pantalla usan la acción directa.
  const cancelHold = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    setHolding(false);
  }, []);
  const startHold = useCallback(() => {
    setHoldHint(false);
    setHolding(true);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      setHolding(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      finishRecording();
    }, HOLD_TO_FINISH_MS);
  }, [finishRecording]);
  useEffect(() => () => { if (holdTimerRef.current) clearTimeout(holdTimerRef.current); }, []);

  // Si se sale de la pantalla a medio recorrido, se guarda lo grabado.
  useEffect(() => () => {
    stopSensors();
    const rec = recRef.current;
    if (rec) {
      rec.estado = rec.fotos.length ? 'guardado' : 'grabando';
      rec.terminadoAt = new Date().toISOString();
      if (rec.fotos.length) saveLocal(rec); else deleteLocal(rec);
    }
    // Si se sale mientras elegía fotos: se guarda con todas (nada se pierde).
    const pending = reviewRef.current;
    if (pending) { pending.estado = 'guardado'; saveLocal(pending); }
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

  if (mode === 'prepare') {
    const goBack = () => { if (fromScan && router.canGoBack()) router.back(); else setMode('home'); };
    return (
      <Reanimated.View entering={reducedMotion ? undefined : HUD_FADE_IN} style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <WalkPrepare
          topInset={insets.top}
          bottomInset={insets.bottom}
          email={email}
          orchards={orchards}
          huertaId={huertaId}
          onChangeOrchard={setHuertaId}
          camera={prep.camera}
          location={prep.location}
          freeBytes={prep.freeBytes}
          network={network}
          networkChecked={prep.networkChecked}
          isWeb={Platform.OS === 'web'}
          tips={[t('rec1'), t('rec2'), t('rec3'), t('rec4')]}
          onBack={goBack}
          onStart={beginWalk}
          busyLabel={checkingOrchard ? t('checkingOrchard') : starting ? t('startingWalk') : null}
        />
        <OrchardPickerSheet
          visible={!!orchardPick}
          reason={orchardPick?.reason ?? null}
          accuracyM={orchardPick?.accuracyM}
          orchards={orchardPick?.orchards ?? []}
          candidates={orchardPick?.candidates}
          onCancel={() => setOrchardPick(null)}
          onRegister={() => { setOrchardPick(null); router.navigate('/(app)/mapping'); }}
          onConfirm={id => { setOrchardPick(null); startWalk(id); }}
        />
      </Reanimated.View>
    );
  }

  if (mode === 'review') {
    return (
      <>
        <StatusBar style="dark" />
        <WalkReview fotos={reviewFotos} onConfirm={confirmReview} onDiscard={discardReview} />
      </>
    );
  }

  if (mode === 'record') {
    const gpsText = stats.gps === 'ok' ? t('gpsOk', { m: Math.max(1, Math.round(stats.accuracy ?? 0)) }) : stats.gps === 'searching' ? t('gpsSearching') : t('gpsLost');
    const netText = network === 'offline' ? t('netOffline')
      : network === 'wifi' ? t('netWifi')
      : network === 'cellular' ? (mobileData ? t('netCellularOn') : t('netCellular'))
      : t('savedOnPhone');
    const NetIcon = network === 'offline' ? WifiOff : network === 'wifi' ? Wifi : network === 'cellular' ? Signal : Smartphone;
    const landscape = isLandscape;
    const gpsDot = stats.gps === 'ok' ? '#22a06b' : stats.gps === 'lost' ? '#e8a317' : '#9aa1ab';
    // Diseño tipo Tesla: la cámara es el «mapa» (panel grande con tarjetas blancas) y el agricultor 3D es el
    // «auto» (panel claro con los datos grandes y los botones). Vertical: cámara arriba; horizontal: lado a lado.
    const cameraPane = (bottom: React.ReactNode) => (
      <View style={[st.camPane, landscape ? st.camPaneLand : null, Platform.OS === 'android' ? st.camPaneNoClip : null]}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          animateShutter={false}
          pictureSize={pictureSize}
          onCameraReady={onCameraReady}
        />
        {!cameraReady && (
          <View style={st.cameraLoading}><ActivityIndicator color="#fff" size="large" /></View>
        )}
        {/* En Android la vista previa se pone negra si su contenedor recorta (overflow + borderRadius):
            las esquinas redondeadas se pintan encima con el color del fondo. */}
        {Platform.OS === 'android' && <View style={st.camCornerMask} pointerEvents="none" />}
        <Reanimated.View entering={HUD_FADE_IN} style={st.camTop} pointerEvents="none">
          <View style={st.tCard} accessibilityLabel={`${paused ? t('paused') : t('recording')} · ${t('time')} ${formatDuration(stats.elapsed)}`}>
            <View style={st.recDotWrap}>
              {/* Único bucle de la pantalla: late mientras se graba y se detiene en pausa. */}
              <PulseRing size={18} color={paused ? '#e8a317' : '#e82127'} paused={paused} />
              <View style={[st.recDot, paused && st.recDotPaused]} />
            </View>
            <Text style={st.tCardTitle}>{paused ? t('paused') : t('recording')}</Text>
            <View style={st.tSep} />
            <Text style={st.tTimer}>{formatDuration(stats.elapsed)}</Text>
          </View>
          <View style={st.tChips}>
            <View style={st.tChip}>
              <View style={[st.tDot, { backgroundColor: gpsDot }]} />
              <Text style={st.tChipText}>{gpsText}</Text>
            </View>
            {landscape && (
              <View style={st.tChip}>
                <NetIcon size={13} color="#171a20" />
                <Text style={st.tChipText}>{netText}</Text>
              </View>
            )}
          </View>
        </Reanimated.View>
        {/* Aviso al tomar una foto manual */}
        {flash > 0 && (
          <Reanimated.View key={flash} entering={FadeIn.duration(60)} exiting={FadeOut.duration(200)} pointerEvents="none" style={st.shotToast}>
            <CheckCircle2 size={16} color="#4ADE80" />
            <Text style={st.shotToastText}>{t('photoTaken')}</Text>
          </Reanimated.View>
        )}
        {bottom}
        {paused && (
          <Reanimated.View entering={PAUSE_IN} exiting={PAUSE_OUT} style={st.pauseOverlay} pointerEvents="none">
            <View style={st.pauseCard}>
              <View style={st.pauseIcon}><Pause size={22} color="#171a20" fill="#171a20" /></View>
              <Text style={st.pauseTitle}>{t('paused')}</Text>
              <Text style={st.pauseBody}>{t('pausedHint')}</Text>
            </View>
          </Reanimated.View>
        )}
      </View>
    );

    const dataPane = (
      <View style={[st.dataCol, landscape && st.dataColLand]} pointerEvents="none">
        <View style={landscape ? st.dataItemLand : null}>
          <Text style={st.dLabel}>{t('distance')}</Text>
          <Text style={st.dBig} numberOfLines={1} adjustsFontSizeToFit>{formatDistance(stats.distance)}</Text>
          <Text style={st.dHint}>{distanceHint(stats, paused, t)}</Text>
        </View>
        {!landscape && <View style={st.dDivider} />}
        <View style={landscape ? st.dataItemLandSmall : null}>
          <Text style={st.dLabel}>{t('images')}</Text>
          <Reanimated.Text
            key={stats.photos}
            style={[
              st.dMid,
              stats.photos > 0 && !reducedMotion
                ? { animationName: COUNT_POP, animationDuration: 180, animationTimingFunction: CSS_EASE_OUT }
                : null,
            ]}
          >
            {stats.photos}
          </Reanimated.Text>
          <Text style={st.dHint}>{t('autoCapture')}</Text>
        </View>
      </View>
    );

    const actions = (
      <View style={st.recordActions}>
        <PressableScale style={st.recSecondary} onPress={togglePause} accessibilityRole="button" accessibilityLabel={paused ? t('resume') : t('pause')}>
          {paused ? <Play size={18} color="#171a20" fill="#171a20" /> : <Pause size={18} color="#171a20" fill="#171a20" />}
          <Text style={st.recSecondaryText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{paused ? t('resume') : t('pause')}</Text>
        </PressableScale>
        {/* Foto manual en la posición actual: entra a las fotos que se procesan. */}
        <PressableScale style={st.recShot} onPress={takePhotoNow} disabled={!cameraReady} accessibilityRole="button" accessibilityLabel={t('takePhoto')}>
          <CameraIcon size={19} color="#ffffff" />
          <Text style={st.recShotText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('takePhoto')}</Text>
        </PressableScale>
        <PressableScale
          style={st.recStop}
          onPressIn={startHold}
          onPressOut={cancelHold}
          onPress={() => { if (!holdTimerRef.current) setHoldHint(true); }}
          accessibilityRole="button"
          accessibilityLabel={t('finish')}
          accessibilityHint={t('holdToFinish')}
          accessibilityActions={[{ name: 'activate' }]}
          onAccessibilityAction={e => { if (e.nativeEvent.actionName === 'activate') finishRecording(); }}
        >
          {/* Relleno que avanza mientras se mantiene presionado; al soltar antes, regresa rápido. */}
          <Reanimated.View
            pointerEvents="none"
            style={[
              st.holdFill,
              {
                transform: [{ scaleX: holding ? 1 : 0 }],
                transitionProperty: 'transform',
                transitionDuration: holding ? HOLD_TO_FINISH_MS : 200,
                transitionTimingFunction: holding ? 'linear' : CSS_EASE_OUT,
              },
            ]}
          />
          <Square size={15} color="#e82127" fill="#e82127" />
          <Text style={st.recStopText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('finish')}</Text>
        </PressableScale>
      </View>
    );

    // Agricultor 3D. Vertical: tamaño compacto (el mismo del panel flotante anterior, ~124 × 170 dp) junto a los
    // datos. Horizontal: como el Tesla, todo el alto y el 40 % del ancho, con datos y botones encima.
    const compactW = Math.round(Math.min(136, Math.max(112, width * 0.31)) * (winH < 680 ? 0.9 : 1));
    const compactH = Math.round(compactW * 1.375);
    const viz = (w: number, h: number, focus?: number) => (
      <FieldTrackingGuard>
        <FieldTracking3D motion={fieldMotion} paused={paused} distanceLabel={formatDistance(stats.distance)} width={w} height={h} focus={focus} companion={companion} />
      </FieldTrackingGuard>
    );
    const tip = (
      <>
        {limitHit && <Text style={st.limitText}>{t('limitReached')}</Text>}
        <Text style={st.recordTip}>{holdHint ? t('holdToFinish') : t('tips')}</Text>
      </>
    );
    // Claves distintas por orientación: al girar se monta de nuevo y su onLayout mide el tamaño nuevo (si se
    // reutilizara el mismo contenedor, el evento no llega y el agricultor no aparecía tras girar).
    const vehiclePane = landscape ? (
      <View
        key="veh-land"
        style={st.vehPaneLand}
        onLayout={e => {
          const { width: w, height: h } = e.nativeEvent.layout;
          setVizSize(prev => (Math.abs(prev.w - w) < 1 && Math.abs(prev.h - h) < 1 ? prev : { w: Math.round(w), h: Math.round(h) }));
        }}
      >
        {vizSize.w > 0 && viz(vizSize.w, vizSize.h, 0.64)}
        <LinearGradient
          colors={['rgba(242,243,245,0.96)', 'rgba(242,243,245,0.82)', 'rgba(242,243,245,0)']}
          locations={[0, 0.6, 1]}
          style={st.landOverlay}
          pointerEvents="none"
        >
          {dataPane}
        </LinearGradient>
      </View>
    ) : (
      <View key="veh-port" style={st.vehPane}>
        <View style={st.vizRow}>
          <View style={{ width: compactW, height: compactH }}>{viz(compactW, compactH)}</View>
          {dataPane}
        </View>
        {tip}
        {actions}
      </View>
    );

    return (
      <View
        style={[st.recordScreen, landscape && st.recordScreenLand, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12, paddingLeft: insets.left + 10, paddingRight: insets.right + 10 }]}
        onLayout={e => {
          const { width: w, height: h } = e.nativeEvent.layout;
          setScreenBox(prev => (prev && prev.w === Math.round(w) && prev.h === Math.round(h) ? prev : { w: Math.round(w), h: Math.round(h) }));
        }}
      >
        <StatusBar style="dark" />
        {/* La cámara va siempre primero (no se vuelve a montar al girar); en horizontal la fila va invertida
            para que el agricultor quede a la izquierda, como en el Tesla. */}
        {cameraPane(landscape
          ? <View style={st.camActions}><View style={st.tipCard}>{tip}</View>{actions}</View>
          : (
            <Reanimated.View entering={HUD_FADE_IN} style={st.camBottom} pointerEvents="none">
              <View style={st.tChip}>
                <NetIcon size={13} color="#171a20" />
                <Text style={st.tChipText}>{netText}</Text>
              </View>
            </Reanimated.View>
          ))}
        {vehiclePane}
        {rotateHint && !landscape && (
          <Reanimated.View entering={ROTATE_IN} style={st.rotateOverlay}>
            <View style={st.rotateCard}>
              {/* Cerrar: a veces el celular tarda unos segundos en detectar que ya está en horizontal. */}
              <PressableScale style={st.rotateClose} onPress={() => setRotateHint(false)} accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={10}>
                <X size={18} color="#171a20" strokeWidth={2.4} />
              </PressableScale>
              <View style={st.rotateIconWrap}>
                <RotatingPhone reduced={reducedMotion} />
                <View style={st.rotateArrow}><RotateCcw size={18} color="#3e6ae1" strokeWidth={2.2} /></View>
              </View>
              <Text style={st.rotateTitle}>{t('rotateTitle')}</Text>
              <Text style={st.rotateBody}>{t('rotateBody')}</Text>
              <PressableScale style={st.rotateBtn} onPress={() => setRotateHint(false)} accessibilityRole="button">
                <Text style={st.rotateBtnText}>{t('rotateSkip')}</Text>
              </PressableScale>
            </View>
          </Reanimated.View>
        )}
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
            onPress={() => {
              // Abierto desde Mis escaneos: se regresa al mapa.
              if (params.from === 'escaneos' && router.canGoBack()) { router.setParams({ id: undefined, from: undefined }); router.back(); return; }
              if (params.id) router.setParams({ id: undefined });
              setMode('home');
            }}
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
                <>
                  <View style={st.summaryRow}>
                    <View style={st.summaryBox}><Text style={st.summaryValue}>{detail.fotos_total}</Text><Text style={st.summaryLabel}>{t('capturedLabel')}</Text></View>
                    <View style={st.summaryBox}><Text style={[st.summaryValue, { color: '#0f766e' }]}>{detail.fotos_analizadas}</Text><Text style={st.summaryLabel}>{t('analyzedShort')}</Text></View>
                    <View style={st.summaryBox}><Text style={[st.summaryValue, { color: '#64748b' }]}>{Math.max(0, detail.fotos_total - detail.fotos_analizadas)}</Text><Text style={st.summaryLabel}>{t('discardedLabel')}</Text></View>
                  </View>
                  {detail.fotos_total > detail.fotos_analizadas && <Text style={st.summaryHint}>{t('discardedHint')}</Text>}
                  <View style={st.summaryRow}>
                    <View style={[st.summaryBox, st.summaryOk]}><Text style={[st.summaryValue, { color: '#15803d' }]}>{healthy}</Text><Text style={st.summaryLabel}>{t('healthyLabel')}</Text></View>
                    <View style={[st.summaryBox, st.summaryBad]}><Text style={[st.summaryValue, { color: '#b91c1c' }]}>{hallazgos.length - healthy}</Text><Text style={st.summaryLabel}>{t('issuesLabel')}</Text></View>
                  </View>
                </>
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
                  onPress={() => { setSelected(h.id); router.push({ pathname: '/(app)/hallazgo', params: { id: h.id, n: String(Date.now()) } }); }}
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

  // Inicio: lo que está guardado en el celular, su sincronización y los resultados.
  const uploading = Object.keys(progress).length > 0;
  const syncState = uploading ? 'uploading' : !locals.length ? 'clear' : network === 'offline' ? 'offline' : network === 'cellular' && !mobileData ? 'wifi' : 'ready';
  const syncText = {
    uploading: t('syncUploading'),
    clear: t('syncClear'),
    offline: t('offline'),
    wifi: t('waitingWifi'),
    ready: t('syncReady'),
  }[syncState];
  const pendingPhotos = locals.reduce((n, r) => n + r.fotos.length, 0);
  return (
    <View style={[hm.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={pp.header}>
        <PressableScale style={pp.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.navigate('/(app)/scan'))} accessibilityRole="button" accessibilityLabel={t('back')}>
          <ChevronLeft size={24} color="#0f172a" />
        </PressableScale>
        <Text style={pp.headerKicker}>{t('title')}</Text>
      </View>
      <ScrollView
        contentContainerStyle={[pp.scroll, isTablet && st.scrollTablet, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => loadHome().then(() => uploadAll())} tintColor="#0f766e" />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={hm.title}>{t('homeTitle')}</Text>

        {/* Estado de sincronización: conexión + lo pendiente en el celular */}
        <Reanimated.View
          key={`sync-${syncState}`}
          entering={reducedMotion ? undefined : ITEM_IN}
          style={[hm.sync, syncState === 'clear' ? hm.syncClear : syncState === 'uploading' || syncState === 'ready' ? hm.syncActive : hm.syncWait]}
        >
          <View style={hm.syncIcon}>
            {syncState === 'uploading' ? <ActivityIndicator size="small" color="#16a34a" />
              : syncState === 'clear' ? <CheckCircle2 size={20} color="#16a34a" />
              : syncState === 'offline' ? <WifiOff size={20} color="#b45309" />
              : syncState === 'wifi' ? <Wifi size={20} color="#b45309" />
              : <CloudUpload size={20} color="#16a34a" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={hm.syncTitle}>
              {locals.length ? t('syncPending', { walks: locals.length, photos: pendingPhotos.toLocaleString(locale) }) : t('pendingEmpty')}
            </Text>
            <Text style={hm.syncText}>{syncText}</Text>
          </View>
        </Reanimated.View>

        {/* Por subir */}
        {locals.length > 0 && (
          <View style={pp.card}>
            {locals.map((r, i) => {
              const p = progress[r.localId];
              const pctDone = p && p.total ? (p.done / p.total) * 100 : 0;
              return (
                <Reanimated.View
                  key={r.localId}
                  exiting={reducedMotion ? undefined : ITEM_OUT}
                  layout={reducedMotion ? undefined : LIST_REFLOW}
                  style={[hm.item, i > 0 && pp.rowBorder]}
                >
                  <View style={hm.itemIcon}><Footprints size={18} color="#0f766e" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={hm.itemTitle}>{fmtDate(r.iniciadoAt)}</Text>
                    <Text style={hm.itemMeta}>
                      {t('photos', { count: r.fotos.length })} · {formatDistance(routeMeters(cleanRoute(r.ruta)))}
                      {orchardName(r.huertaId) ? ` · ${orchardName(r.huertaId)}` : ''}
                    </Text>
                    {p && <Text style={hm.itemProgress}>{t('uploading', { done: p.done, total: p.total })}</Text>}
                    {p && (
                      <View style={hm.track}>
                        {/* relleno absoluto sin hijos: puede animar su ancho sin recalcular el resto */}
                        <Reanimated.View style={[hm.fill, { width: `${pctDone}%`, transitionProperty: 'width', transitionDuration: 300, transitionTimingFunction: CSS_EASE_OUT }]} />
                      </View>
                    )}
                    {uploadErrors[r.localId] && !p && <Text style={hm.error}>{t('uploadError')}</Text>}
                  </View>
                  {!p ? (
                    <View style={st.listActions}>
                      <PressableScale style={[hm.smallBtn, network === 'offline' && { opacity: 0.45 }]} onPress={() => uploadAll({ force: true })} disabled={network === 'offline'} accessibilityRole="button" accessibilityLabel={t('upload')}>
                        <CloudUpload size={16} color="#ffffff" />
                        <Text style={hm.smallBtnText}>{t('upload')}</Text>
                      </PressableScale>
                      <PressableScale style={hm.iconBtn} onPress={() => confirmDelete(r)} accessibilityRole="button" accessibilityLabel={t('delete')}>
                        <Trash2 size={16} color="#b91c1c" />
                      </PressableScale>
                    </View>
                  ) : null}
                </Reanimated.View>
              );
            })}
          </View>
        )}

        <View style={[pp.card, hm.toggle]}>
          <View style={{ flex: 1 }}>
            <Text style={pp.rowLabel}>{t('mobileData')}</Text>
            <Text style={pp.rowValue}>{t('mobileDataHint')}</Text>
          </View>
          <Switch
            value={mobileData}
            onValueChange={async v => { setMobileData(v); await setMobileDataAllowed(v); if (v) uploadAll(); }}
            trackColor={{ true: '#34d399', false: '#cbd5e1' }}
            thumbColor="#fff"
          />
        </View>

        {/* Resultados del análisis */}
        <Text style={pp.section}>{t('resultsTitle')}</Text>
        <View style={pp.card}>
          {pushState === 'denied' && (
            <View style={hm.note}><Bell size={14} color="#b45309" /><Text style={hm.noteText}>{t('notifyOff')}</Text></View>
          )}
          {loadError && <Text style={hm.error}>{t('loadError')}</Text>}
          {!loadError && !remotes.length && <Text style={hm.empty}>{t('resultsEmpty')}</Text>}
          {remotes.map((r, i) => {
            const info = statusInfo(r.estado);
            return (
              <Reanimated.View key={r.id} entering={reducedMotion ? undefined : ITEM_IN} layout={reducedMotion ? undefined : LIST_REFLOW}>
              <PressableScale style={[hm.item, i > 0 && pp.rowBorder]} onPress={() => openDetail(r.id)} accessibilityRole="button">
                <View style={[hm.itemIcon, { backgroundColor: info.bg }]}><Sparkles size={18} color={info.color} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={hm.itemTitle}>{orchardName(r.huerta_id) ?? fmtDate(r.iniciado_at)}</Text>
                  <Text style={hm.itemMeta}>
                    {fmtDate(r.iniciado_at)} · {r.estado === 'listo' ? t('findings', { count: r.hallazgos_total }) : t('photos', { count: r.fotos_total })}
                  </Text>
                  {(r.estado === 'pendiente' || r.estado === 'procesando') && <Text style={hm.itemHint}>{t('queuedHint')}</Text>}
                </View>
                <View style={[st.chip, { backgroundColor: info.bg }]}><Text style={[st.chipText, { color: info.color }]}>{info.label}</Text></View>
              </PressableScale>
              </Reanimated.View>
            );
          })}
        </View>

        <PressableScale
          style={hm.newBtn}
          onPress={() => { setPrep({ camera: null, location: null, freeBytes: null, networkChecked: false }); setMode('prepare'); }}
          accessibilityRole="button"
        >
          <LinearGradient colors={['#34d399', '#0f766e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={pp.footStartGrad}>
            <Route size={20} color="#fff" />
            <Text style={st.startText}>{t('newWalk')}</Text>
          </LinearGradient>
        </PressableScale>
        <Text style={hm.privacy}>{t('privacyNote')}</Text>
      </ScrollView>
    </View>
  );
}

/**
 * Teléfono que gira a horizontal, se sostiene y regresa (bucle) para el aviso «Gira tu celular».
 * Es la explicación misma del aviso, así que se anima aunque el sistema pida reducir movimiento (p. ej. con
 * ahorro de batería en Android): en ese caso, en vez de girar, cruza suavemente entre vertical y horizontal.
 */
function RotatingPhone({ reduced }: { reduced: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    const cfg = { duration: 650, easing: EASE_IN_OUT, reduceMotion: ReduceMotion.Never };
    p.set(withRepeat(withSequence(withDelay(350, withTiming(1, cfg)), withDelay(700, withTiming(0, cfg))), -1, false));
  }, [p]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${-90 * p.get()}deg` }] }));
  const portrait = useAnimatedStyle(() => ({ opacity: 1 - p.get() }));
  const land = useAnimatedStyle(() => ({ opacity: p.get() }));
  if (!reduced) {
    return <Reanimated.View style={spin}><Smartphone size={54} color="#171a20" strokeWidth={1.6} /></Reanimated.View>;
  }
  return (
    <View style={{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center' }}>
      <Reanimated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, portrait]}>
        <Smartphone size={54} color="#171a20" strokeWidth={1.6} />
      </Reanimated.View>
      <Reanimated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-90deg' }] }, land]}>
        <Smartphone size={54} color="#171a20" strokeWidth={1.6} />
      </Reanimated.View>
    </View>
  );
}

const st = StyleSheet.create({
  // ── Grabación (diseño tipo Tesla: superficies claras, tarjetas blancas, tipografía Inter) ──
  recordScreen: { flex: 1, backgroundColor: '#f2f3f5', gap: 10 },
  recordScreenLand: { flexDirection: 'row-reverse' },
  camPane: { flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0b0d10' },
  camPaneLand: { flex: 1 },
  camPaneNoClip: { overflow: 'visible', borderRadius: 0 },
  // Marco con borde grueso: su borde interior tiene el radio de las esquinas (2R − R = R) y tapa lo que sobra.
  camCornerMask: { position: 'absolute', top: -24, left: -24, right: -24, bottom: -24, borderRadius: 48, borderWidth: 24, borderColor: '#f2f3f5' },
  camTop: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  camBottom: { position: 'absolute', left: 10, bottom: 10, right: 10, flexDirection: 'row' },
  tCard: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingLeft: 12, paddingRight: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  tCardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5, color: '#171a20' },
  tSep: { width: 1, height: 14, backgroundColor: '#d0d1d2' },
  tTimer: { fontFamily: 'Inter_500Medium', fontSize: 13.5, color: '#5c5e62', fontVariant: ['tabular-nums'] },
  tChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3, flexShrink: 1 },
  tChipText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#171a20', flexShrink: 1 },
  tDot: { width: 8, height: 8, borderRadius: 4 },
  recDotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e82127' },
  recDotPaused: { backgroundColor: '#e8a317' },
  cameraLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pauseOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(23,26,32,0.35)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  pauseCard: { alignItems: 'center', gap: 6, paddingVertical: 18, paddingHorizontal: 22, borderRadius: 20, backgroundColor: '#ffffff', maxWidth: 320 },
  pauseIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f2f3f5', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  pauseTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: '#171a20' },
  pauseBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: '#5c5e62', textAlign: 'center' },
  vehPane: { gap: 10 },
  vehPaneLand: { width: '40%', borderRadius: 24, overflow: 'hidden', backgroundColor: '#e9ecef' },
  landOverlay: { position: 'absolute', top: 0, left: 0, right: 0, padding: 16, paddingBottom: 44 },
  camActions: { position: 'absolute', left: 12, right: 12, bottom: 12, gap: 8 },
  tChips: { alignItems: 'flex-end', gap: 6, flexShrink: 1 },
  tipCard: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.92)' },
  rotateOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(242,243,245,0.92)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  rotateCard: { alignItems: 'center', gap: 8, paddingVertical: 26, paddingHorizontal: 24, borderRadius: 24, backgroundColor: '#ffffff', maxWidth: 340, width: '100%', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  rotateIconWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  rotateArrow: { position: 'absolute', right: 4, top: 6 },
  rotateTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 19, color: '#171a20' },
  rotateBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: '#5c5e62', textAlign: 'center' },
  rotateClose: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f3f5', zIndex: 1 },
  rotateBtn: { marginTop: 10, alignSelf: 'stretch', minHeight: 50, borderRadius: 14, backgroundColor: '#f2f3f5', alignItems: 'center', justifyContent: 'center' },
  rotateBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#171a20' },
  vizRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  dataCol: { flex: 1, justifyContent: 'center', gap: 12, paddingVertical: 4 },
  dataColLand: { flex: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-start', gap: 16 },
  dataItemLand: { flex: 1.5, minWidth: 0 },
  dataItemLandSmall: { flex: 1, minWidth: 0 },
  dLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: '#8e8e93' },
  dBig: { fontFamily: 'Inter_300Light', fontSize: 50, lineHeight: 58, color: '#171a20', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  dMid: { fontFamily: 'Inter_400Regular', fontSize: 30, lineHeight: 36, color: '#171a20', fontVariant: ['tabular-nums'], alignSelf: 'flex-start' },
  dHint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: '#5c5e62' },
  dDivider: { height: 1, backgroundColor: '#dfe1e4' },
  limitText: { fontFamily: 'Inter_500Medium', fontSize: 12.5, color: '#b45309', textAlign: 'center' },
  recordTip: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, color: '#5c5e62', textAlign: 'center' },
  recordActions: { flexDirection: 'row', gap: 8 },
  // Tres botones del mismo tamaño (más chicos): icono arriba y texto abajo, para que quepan en pantallas angostas.
  recSecondary: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 52, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 16, backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  recSecondaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#171a20' },
  recShot: { flex: 1.15, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 52, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 16, backgroundColor: '#3e6ae1', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  recShotText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#ffffff' },
  shotToast: { position: 'absolute', alignSelf: 'center', top: '44%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: 'rgba(23,26,32,0.85)' },
  shotToastText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#ffffff' },
  recStop: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 52, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 16, backgroundColor: '#ffffff', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  holdFill: { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(232,33,39,0.14)', transformOrigin: 'left' },
  recStopText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#e82127' },
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
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
  // Relleno absoluto y sin hijos: puede animar su ancho sin recalcular el resto del layout.
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#14b8a6', borderRadius: 3 },
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
  // preparación
  prepHero: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#d1fae5' },
  prepHeroTitle: { fontFamily: 'Poppins_700Bold', fontSize: 18, color: '#0f172a' },
  prepHeroBody: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 19, color: '#475569' },
  prepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  prepRowBorder: { borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  prepIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },
  prepLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: '#0f172a' },
  prepValue: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 17, color: '#64748b' },
  prepChange: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#ecfdf5' },
  prepChangeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#0f766e' },
  prepHint: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#64748b' },
  recRowItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  recBullet: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#ccfbf1', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  recBulletText: { fontFamily: 'Poppins_700Bold', fontSize: 11, color: '#0f766e' },
  recText: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 19, color: '#334155' },
  prepFooter: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(240,253,244,0.97)', borderTopWidth: 1, borderTopColor: '#d1fae5',
  },
  prepBackBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d1fae5' },
  prepBackText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#0f766e' },
  prepStartBtn: { flex: 2, borderRadius: 18, overflow: 'hidden' },
  // grabación
  summaryHint: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, lineHeight: 16, color: '#64748b' },
  summaryOk: { backgroundColor: '#f0fdf4' },
  summaryBad: { backgroundColor: '#fef2f2' },
});

// Preparación: fondo blanco, como el selector de Escanear, para que el paso se sienta continuo.
const pp = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  headerKicker: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: '#0f766e' },
  scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  hero: { gap: 12 },
  heroMedia: { aspectRatio: 1.7, borderRadius: 24, overflow: 'hidden', backgroundColor: '#E2E8F0' },
  heroImg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  heroTag: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#FFFFFF' },
  heroTagText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#0f172a' },
  heroThumb: { position: 'absolute', right: 12, top: 12, width: 96, height: 72, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#E2E8F0' },
  heroThumbLabel: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingVertical: 2, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  heroThumbText: { fontFamily: 'Poppins_600SemiBold', fontSize: 10, color: '#FFFFFF' },
  heroArt: { borderRadius: 999, overflow: 'hidden' },
  heroTitle: { fontFamily: 'Poppins_700Bold', fontSize: 26, lineHeight: 31, letterSpacing: -0.7, color: '#0A0A0A' },
  heroBody: { fontFamily: 'Poppins_400Regular', fontSize: 13.5, lineHeight: 20, color: '#52606D' },
  ready: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, marginTop: 2 },
  readyChecking: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
  readyOk: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  readyWarn: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D' },
  readyText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#0f172a' },
  section: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: '#64748B', marginTop: 8, marginLeft: 4 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  chipOn: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  chipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: '#334155' },
  chipTextOn: { color: '#FFFFFF' },
  card: { borderRadius: 22, padding: 14, gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFDF5' },
  rowLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#0f172a' },
  rowValue: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, lineHeight: 18, color: '#64748B' },
  hint: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#64748B' },
  recRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  recBullet: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#CCFBF1', marginTop: 1 },
  recBulletText: { fontFamily: 'Poppins_700Bold', fontSize: 11.5, color: '#0f766e' },
  recText: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 13.5, lineHeight: 20, color: '#334155' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 36 },
  footBack: { flex: 1, minHeight: 60, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  footBackText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#0f766e' },
  footStart: { flex: 2, borderRadius: 20, overflow: 'hidden', shadowColor: '#0f766e', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  footStartGrad: { flex: 1, minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
});

// Mis recorridos (lista y sincronización), mismo fondo blanco.
const hm = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 30, lineHeight: 36, letterSpacing: -0.8, color: '#0A0A0A', marginBottom: 2 },
  sync: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22, borderWidth: 1 },
  syncClear: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  syncActive: { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' },
  syncWait: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  syncIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  syncTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 14.5, color: '#0f172a' },
  syncText: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, lineHeight: 18, color: '#475569' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  itemIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFDF5' },
  itemTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#0f172a' },
  itemMeta: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#64748B' },
  itemHint: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: '#0369a1', marginTop: 2 },
  itemProgress: { fontFamily: 'Poppins_600SemiBold', fontSize: 11.5, color: '#0f766e', marginTop: 3 },
  track: { height: 6, borderRadius: 3, backgroundColor: '#E2E8F0', marginTop: 5, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3, backgroundColor: '#14b8a6' },
  error: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#b91c1c' },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 40, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#0f766e' },
  smallBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: '#FFFFFF' },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, backgroundColor: '#FFFBEB' },
  noteText: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#92400E' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  empty: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 19, color: '#64748B', textAlign: 'center', paddingVertical: 6 },
  newBtn: { borderRadius: 20, overflow: 'hidden', marginTop: 6 },
  privacy: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, lineHeight: 17, color: '#94A3B8', paddingHorizontal: 4 },
});
