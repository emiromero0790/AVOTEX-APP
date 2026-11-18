/**
 * Subir grabación → Ubica tus fotos (video sin GPS → fotos asignadas a zonas de la huerta).
 *
 * Entrada: igual que Recorrido inteligente, la huerta se sugiere con la ubicación del teléfono
 * (services/huertaResolver.ts → resolveScanHuerta) y, si hay duda, se elige en el mismo modal
 * (components/scan/OrchardPickerSheet.tsx), con «No asignar a ninguna huerta». La ubicación SOLO sugiere
 * la huerta: los fotogramas no llevan GPS y su zona se asigna a mano.
 *
 * Paso 1 · Subir grabación: portada, tarjeta de huerta (se puede cambiar) y selector de video.
 * Paso 2 · Ubica tus fotos: mapa semi‑3D de zonas (components/grabacion/ZoneMap3D.tsx) + tira de fotos.
 *   Arrastre (pulsación sostenida) o toque foto → zona. Sin huerta: «Revisa tus fotos» (sin zonas).
 *   Huerta sin zonas: se sube con la huerta y sin zona.
 * Guardado y subida: services/grabacion.ts → services/recorridos.ts (misma cola que los recorridos).
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView as RNScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import Reanimated, { FadeIn, FadeInDown, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as Network from 'expo-network';
import { onAuthStateChanged, type Auth, type User } from 'firebase/auth';
import { ArrowLeft, Check, ChevronRight, CloudUpload, Film, ImageIcon, Play, Satellite, Trash2, Unlink } from 'lucide-react-native';
import { auth as firebaseAuth } from '../../firebaseConfig';
import { useGuest } from '../../context/GuestContext';
import { TranslationResource, useTranslations } from '../../context/LanguageContext';
import type { Orchard } from '../../services/orchards';
import { resolveScanHuerta, type HuertaResolution } from '../../services/huertaResolver';
import { frameTimes, guardarGrabacion, MAX_VIDEO_MIN, ZONE_UI, zonasDeHuerta, type ZonaSnapshot } from '../../services/grabacion';
import { extractFrames } from '../../services/videoFrames';
import { getMobileDataAllowed, uploadRecorrido } from '../../services/recorridos';
import type { ZoneId } from '../../services/satZones';
import ZoneBoard, { pointInPolygon } from '../../components/grabacion/ZoneBoard';
import ZoneMap3D, { project3D } from '../../components/grabacion/ZoneMap3D';
import OrchardPickerSheet, { haLabel } from '../../components/scan/OrchardPickerSheet';
import { PressableScale } from '../../components/scan/motion';

const auth = firebaseAuth as Auth;
const COVER = require('../../assets/images/grabacion/portada-huerta.jpg');

const C = {
  deep: '#0F3D24', deep2: '#0A2B19', lime: '#BEF264', limeStrong: '#A3E635', limeSoft: '#ECFCCB',
  bg: '#F3F5EF', card: '#FFFFFF', ink: '#14231A', muted: '#64748B', line: '#E3E8DF', red: '#B91C1C', amber: '#92400E',
} as const;

const translations: TranslationResource = {
  brand: { es: 'AVOTEX', en: 'AVOTEX' },
  back: { es: 'Volver', en: 'Back' },
  step1: { es: 'Paso 1 de 2', en: 'Step 1 of 2' },
  step2: { es: 'Paso 2 de 2', en: 'Step 2 of 2' },
  title1: { es: 'Subir grabación', en: 'Upload recording' },
  sub1: { es: 'Importa un video de tu recorrido.', en: 'Import a video of your walk.' },
  title2: { es: 'Ubica tus fotos', en: 'Place your photos' },
  title2none: { es: 'Revisa tus fotos', en: 'Review your photos' },
  noOrchard: { es: 'Sin huerta asignada', en: 'No orchard assigned' },
  noOrchardHint: { es: 'Toca para elegir una huerta', en: 'Tap to choose an orchard' },
  zonesN: { es: '{n} zonas', en: '{n} zones' },
  noZonesShort: { es: 'sin zonas', en: 'no zones' },
  finding: { es: 'Buscando la huerta donde estás…', en: 'Finding the orchard you are in…' },
  changeMsg: { es: '¿En qué huerta grabaste el video? Puede ser distinta a donde estás ahora.', en: 'Which orchard did you record in? It can differ from where you are now.' },
  uploadVideo: { es: 'Subir video', en: 'Upload video' },
  limit: { es: 'Videos de hasta {min} min', en: 'Videos up to {min} min' },
  pickVideo: { es: 'Elegir video de la galería', en: 'Choose a video from the gallery' },
  continueN: { es: 'Continuar con {n} fotos', en: 'Continue with {n} photos' },
  otherVideo: { es: 'Elegir otro video', en: 'Choose another video' },
  permission: { es: 'Permite el acceso a tus videos para continuar.', en: 'Allow access to your videos to continue.' },
  tooLong: { es: 'El video dura más de {min} min: tomaremos 30 fotos repartidas en todo el video.', en: 'The video is longer than {min} min: we will take 30 photos spread across it.' },
  extracting: { es: 'Sacando fotos… {done}/{total}', en: 'Taking photos… {done}/{total}' },
  extractFail: { es: 'No pudimos leer ese video. Prueba con otro.', en: 'We could not read that video. Try another one.' },
  placed: { es: '{n} de {total} ubicadas', en: '{n} of {total} placed' },
  hint: { es: 'Arrastra una foto o toca una zona.', en: 'Drag a photo or tap a zone.' },
  hintNone: { es: 'Descarta las fotos que no muestren tu cultivo.', en: 'Discard photos that do not show your crop.' },
  noneBody: { es: 'Sin huerta: las fotos se analizarán sin zona.', en: 'No orchard: photos will be analyzed without a zone.' },
  noZonesBody: { es: 'Esta huerta aún no tiene zonas (es muy pequeña o su contorno se cruza). Se subirá con la huerta y sin zona.', en: 'This orchard has no zones yet (too small or self-crossing). It will upload with the orchard and no zone.' },
  zoneCount: { es: 'Zona {z} · {n} {fotos}', en: 'Zone {z} · {n} {fotos}' },
  foto1: { es: 'foto', en: 'photo' }, fotoN: { es: 'fotos', en: 'photos' },
  photoA11y: { es: 'Foto {i} de {n}, segundo {time}', en: 'Photo {i} of {n}, at {time}' },
  zoneOf: { es: 'zona {z}', en: 'zone {z}' },
  unplaced: { es: 'sin zona', en: 'no zone' },
  discard: { es: 'Descartar', en: 'Discard' },
  discarded: { es: '{n} descartadas · ', en: '{n} discarded · ' },
  restore: { es: 'Recuperar', en: 'Restore' },
  pending: { es: 'Faltan {n} por ubicar', en: '{n} left to place' },
  upload: { es: 'Subir {n} fotos', en: 'Upload {n} photos' },
  uploadOne: { es: 'Subir 1 foto', en: 'Upload 1 photo' },
  saving: { es: 'Guardando…', en: 'Saving…' },
  uploading: { es: 'Subiendo {done}/{total}…', en: 'Uploading {done}/{total}…' },
  cellular: { es: 'Estás con datos móviles', en: 'You are on mobile data' },
  cellularBody: { es: '¿Subir ahora (~{mb} MB) o esperar a tener WiFi? Quedará guardada en tu celular.', en: 'Upload now (~{mb} MB) or wait for WiFi? It stays saved on your phone.' },
  uploadNow: { es: 'Subir ahora', en: 'Upload now' },
  waitWifi: { es: 'Esperar WiFi', en: 'Wait for WiFi' },
  changeTitle: { es: '¿Cambiar de huerta?', en: 'Change orchard?' },
  changeBody: { es: 'Se borrarán las zonas de {n} fotos. El video y las fotos se conservan.', en: 'Zones of {n} photos will be cleared. The video and photos are kept.' },
  cancel: { es: 'Cancelar', en: 'Cancel' },
  change: { es: 'Cambiar', en: 'Change' },
  doneTitle: { es: 'Grabación enviada', en: 'Recording sent' },
  doneBody: { es: 'La estamos analizando. En Mis escaneos → Procesando verás cómo avanza.', en: 'We are analyzing it. In My scans → Processing you will see its progress.' },
  savedTitle: { es: 'Grabación guardada', en: 'Recording saved' },
  savedBody: { es: 'Está en tu celular y se subirá cuando tengas conexión (Mis escaneos → Procesando).', en: 'It is on your phone and will upload when you are online (My scans → Processing).' },
  failedBody: { es: 'Quedó guardada en tu celular; puedes subirla desde Mis escaneos.', en: 'It is saved on your phone; you can upload it from My scans.' },
  openScans: { es: 'Ver en Mis escaneos', en: 'View in My scans' },
  another: { es: 'Subir otra grabación', en: 'Upload another recording' },
  guest: { es: 'Crea una cuenta para subir grabaciones.', en: 'Create an account to upload recordings.' },
};

type Frame = { key: string; uri: string; timeMs: number; zona: ZoneId | null; removed: boolean };
type Phase = 'resolving' | 'setup' | 'extracting' | 'assign' | 'saving' | 'ask-cellular' | 'uploading' | 'done';
/** undefined = aún sin decidir; null = «No asignar a ninguna huerta». */
type OrchardChoice = string | null | undefined;
type PickState = { mode: 'entry' | 'change'; reason: Extract<HuertaResolution, { kind: 'manual' }>['reason'] | null; accuracyM: number | null; candidates: string[] };

const fmtTime = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const THUMB = 82;

/** Cada entrada desde Escanear (parámetro n) empieza de cero. */
export default function GrabacionRoute() {
  const { n } = useLocalSearchParams<{ n?: string }>();
  return <GrabacionScreen key={n ?? 'g'} />;
}

function GrabacionScreen() {
  const t = useTranslations(translations);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const { isGuest } = useGuest();

  const [user, setUser] = useState<User | null>(auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  const email = user?.email ?? null;

  const [orchards, setOrchards] = useState<Orchard[]>([]);
  const [choice, setChoice] = useState<OrchardChoice>(undefined);
  const [pick, setPick] = useState<PickState | null>(null);
  const [pendingChange, setPendingChange] = useState<string | null | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>('resolving');
  const [frames, setFrames] = useState<Frame[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [lastZone, setLastZone] = useState<ZoneId | null>(null);
  const [dropTick, setDropTick] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<'sent' | 'saved' | 'failed' | null>(null);
  const [saved, setSaved] = useState<Awaited<ReturnType<typeof guardarGrabacion>> | null>(null);
  const cancelled = useRef(false);
  useEffect(() => { cancelled.current = false; return () => { cancelled.current = true; }; }, []);

  // ───────── entrada: misma resolución de huerta que Recorrido inteligente ─────────
  useEffect(() => {
    if (!email || isGuest) return;
    let alive = true;
    resolveScanHuerta(email).then(res => {
      if (!alive) return;
      setOrchards(res.orchards);
      if (res.kind === 'auto') { setChoice(res.huerta.id); setPhase('setup'); return; }
      setPhase('setup');
      setPick({ mode: 'entry', reason: res.reason, accuracyM: res.accuracyM, candidates: res.candidates });
    });
    return () => { alive = false; };
  }, [email, isGuest]);

  const orchard = typeof choice === 'string' ? orchards.find(o => o.id === choice) ?? null : null;
  const zonas = useMemo<ZonaSnapshot[] | null>(() => (orchard ? zonasDeHuerta(orchard.coordinates, orchard.id) : null), [orchard]);
  const outline = useMemo(() => (orchard ? orchard.coordinates.map(p => ({ lat: p.latitude, lng: p.longitude })) : null), [orchard]);
  const withZones = !!zonas;

  const live = frames.filter(f => !f.removed);
  const removedCount = frames.length - live.length;
  const placedCount = withZones ? live.filter(f => f.zona).length : 0;
  const unassigned = withZones ? live.length - placedCount : 0;
  const counts: Partial<Record<ZoneId, number>> = {};
  for (const f of live) if (f.zona) counts[f.zona] = (counts[f.zona] ?? 0) + 1;
  const selected = live.find(f => f.key === sel) ?? null;

  // ───────── huerta: elegir / cambiar ─────────
  const applyChoice = (next: string | null) => {
    setChoice(next);
    setFrames(prev => prev.map(f => ({ ...f, zona: null })));
    setLastZone(null);
  };
  const onPickConfirm = (id: string | null) => {
    const mode = pick?.mode;
    setPick(null);
    if (mode === 'change' && id !== choice && frames.some(f => f.zona)) { setPendingChange(id); return; }
    if (id !== choice) applyChoice(id);
  };
  const onPickCancel = () => {
    const mode = pick?.mode;
    setPick(null);
    // Al entrar hay que decidir: cerrar el modal sin elegir regresa a Escanear.
    if (mode === 'entry' && choice === undefined) router.back();
  };
  const openChange = () => {
    if (phase === 'saving' || phase === 'uploading') return;
    Haptics.selectionAsync().catch(() => {});
    setPick({ mode: 'change', reason: orchards.length ? null : 'no-orchards', accuracyM: null, candidates: [] });
  };

  // ───────── video ─────────
  const pickVideo = async () => {
    if (phase !== 'setup') return;
    setError(null); setNotice(null);
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync().catch(() => null);
      if (perm && !perm.granted && perm.accessPrivileges !== 'limited') { setError(t('permission')); return; }
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: false, quality: 1 }).catch(() => null);
    if (!res || res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    const duration = Number(asset.duration) || 0; // ms (iOS/Android)
    if (duration > MAX_VIDEO_MIN * 60000) setNotice(t('tooLong', { min: MAX_VIDEO_MIN }));
    setPhase('extracting');
    setProgress({ done: 0, total: frameTimes(duration).length });
    try {
      const out = await extractFrames(asset.uri, duration, (done, total) => !cancelled.current && setProgress({ done, total }), () => cancelled.current);
      if (cancelled.current) return;
      if (!out.length) throw new Error('empty');
      const list = out.map((f, i) => ({ key: `${Date.now().toString(36)}-${i}`, uri: f.uri, timeMs: f.timeMs, zona: null, removed: false }));
      setFrames(list);
      setSel(list[0].key);
      setLastZone(null);
      setPhase('assign');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      setPhase('setup');
      setError(t('extractFail'));
    }
  };

  // ───────── asignación ─────────
  const assign = useCallback((key: string, zona: ZoneId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setLastZone(zona);
    setDropTick(x => x + 1);
    setFrames(prev => {
      const next = prev.map(f => (f.key === key ? { ...f, zona } : f));
      const alive = next.filter(f => !f.removed);
      const i = alive.findIndex(f => f.key === key);
      const after = [...alive.slice(i + 1), ...alive.slice(0, i)].find(f => !f.zona);
      setSel(after?.key ?? key);
      return next;
    });
  }, []);
  const remove = (key: string) => {
    Haptics.selectionAsync().catch(() => {});
    setFrames(prev => {
      const alive = prev.filter(f => !f.removed);
      const i = alive.findIndex(f => f.key === key);
      const nextSel = alive[i + 1] ?? alive[i - 1] ?? null;
      setSel(nextSel?.key ?? null);
      return prev.map(f => (f.key === key ? { ...f, removed: true } : f));
    });
  };
  const restoreAll = () => setFrames(prev => prev.map(f => ({ ...f, removed: false })));

  // ───────── arrastre (hilo de UI) ─────────
  const mapW = Math.min(width - 32, 560);
  const mapH = Math.round(Math.max(220, Math.min(height * 0.38, mapW * 0.82)));
  const faces = useMemo(() => (zonas ? project3D(zonas, outline, mapW, mapH) : []), [zonas, outline, mapW, mapH]);
  const polys = useSharedValue<[number, number][][]>([]);
  useEffect(() => { polys.set(faces.map(f => f.top)); }, [faces, polys]);
  const rootRef = useRef<React.ComponentRef<typeof View>>(null);
  const mapRef = useRef<React.ComponentRef<typeof View>>(null);
  const origin = useSharedValue({ rx: 0, ry: 0, bx: 0, by: 0 });
  const measure = () => {
    rootRef.current?.measureInWindow((rx, ry) => mapRef.current?.measureInWindow((bx, by) => origin.set({ rx, ry, bx, by })));
  };
  const hover = useSharedValue(-1);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragOn = useSharedValue(0);
  const [dragUri, setDragUri] = useState<string | null>(null);
  const zoneIds = useMemo(() => faces.map(f => f.id), [faces]);
  const onDrop = useCallback((key: string, idx: number) => {
    setDragUri(null);
    if (idx >= 0 && zoneIds[idx]) assign(key, zoneIds[idx]);
  }, [assign, zoneIds]);
  const startDrag = useCallback((key: string, uri: string) => {
    measure();
    setSel(key);
    setDragUri(uri);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const drag = useMemo(() => ({ dragX, dragY, dragOn, hover, origin, polys }), [dragX, dragY, dragOn, hover, origin, polys]);
  const ghostStyle = useAnimatedStyle(() => ({
    opacity: dragOn.get(),
    transform: [{ translateX: dragX.get() - origin.get().rx - THUMB / 2 }, { translateY: dragY.get() - origin.get().ry - THUMB / 2 }, { scale: 0.9 + 0.2 * dragOn.get() }],
  }));

  // ───────── guardar y subir ─────────
  const mb = Math.max(1, Math.round(live.length * 0.25));
  const doUpload = async (rec: NonNullable<typeof saved>) => {
    setPhase('uploading');
    setProgress({ done: 0, total: rec.fotos.length });
    try {
      await uploadRecorrido(rec, (done, total) => setProgress({ done, total }));
      setResult('sent');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setResult('failed');
      setError(e instanceof Error ? e.message : null);
    }
    setPhase('done');
  };
  const save = async () => {
    if (!email || !live.length || unassigned) return;
    setPhase('saving');
    try {
      const rec = await guardarGrabacion({
        userEmail: email, huertaId: orchard?.id ?? null, fuente: 'celular', zonas,
        frames: live.map(f => ({ uri: f.uri, timeMs: f.timeMs, zona: zonas ? f.zona : null })),
      });
      setSaved(rec);
      let kind: 'wifi' | 'cellular' | 'offline' = 'cellular';
      try {
        const st = await Network.getNetworkStateAsync();
        kind = !st.isConnected || st.isInternetReachable === false ? 'offline'
          : st.type === Network.NetworkStateType.WIFI || st.type === Network.NetworkStateType.ETHERNET ? 'wifi' : 'cellular';
      } catch { /* sin dato: se intenta */ }
      if (kind === 'offline') { setResult('saved'); setPhase('done'); return; }
      if (kind === 'cellular' && !(await getMobileDataAllowed())) { setPhase('ask-cellular'); return; }
      await doUpload(rec);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('assign');
    }
  };
  const reset = () => { setPhase('setup'); setFrames([]); setSel(null); setError(null); setNotice(null); setResult(null); setSaved(null); setLastZone(null); };

  // ───────── vistas ─────────
  const step2 = phase === 'assign' || phase === 'saving' || phase === 'ask-cellular' || phase === 'uploading';
  const goBack = () => {
    if (step2 && phase === 'assign') { setPhase('setup'); return; }
    if (router.canGoBack()) router.back(); else router.navigate('/(app)/scan');
  };
  const header = (stepLabel: string | null, title: string, subtitle: string) => (
    <LinearGradient colors={[C.deep, C.deep2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.header, { paddingTop: insets.top + 8 }]}>
      {/* Motivo sutil: franjas diagonales claras */}
      <View pointerEvents="none" style={[s.stripe, { right: -60, top: -10 }]} />
      <View pointerEvents="none" style={[s.stripe, { right: 30, top: -40, opacity: 0.05 }]} />
      <View style={s.brandRow}>
        <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel={t('back')} hitSlop={8} style={s.backBtn}>
          <ArrowLeft size={20} color="#FFFFFF" />
        </PressableScale>
        <Satellite size={22} color={C.lime} />
        <Text style={s.brand}>{t('brand')}</Text>
      </View>
      {stepLabel ? <View style={s.stepPill}><Text style={s.stepText}>{stepLabel}</Text></View> : null}
      <Text style={s.hTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} accessibilityRole="header">{title}</Text>
      <Text style={s.hSub} numberOfLines={1}>{subtitle}</Text>
    </LinearGradient>
  );

  if (isGuest || !email) {
    return <View style={s.screen}>{header(null, t('title1'), t('sub1'))}<View style={[s.body, s.center]}><Text style={s.text}>{t('guest')}</Text></View></View>;
  }

  const picker = (
    <OrchardPickerSheet
      visible={!!pick}
      reason={pick?.reason ?? null}
      accuracyM={pick?.accuracyM}
      orchards={orchards}
      candidates={pick?.candidates}
      message={pick?.mode === 'change' && orchards.length ? t('changeMsg') : undefined}
      onCancel={onPickCancel}
      onRegister={() => { setPick(null); router.navigate('/(app)/mapping'); }}
      onConfirm={onPickConfirm}
    />
  );
  const changeConfirm = pendingChange !== undefined && (
    <Modal transparent visible animationType="fade" onRequestClose={() => setPendingChange(undefined)} statusBarTranslucent>
      <View style={s.overlay}>
        <View style={s.dialog}>
          <Text style={s.dTitle}>{t('changeTitle')}</Text>
          <Text style={s.text}>{t('changeBody', { n: frames.filter(f => f.zona).length })}</Text>
          <View style={s.dRow}>
            <PressableScale onPress={() => setPendingChange(undefined)} style={[s.ghostBtn, { flex: 1 }]} accessibilityRole="button"><Text style={s.ghostText}>{t('cancel')}</Text></PressableScale>
            <PressableScale onPress={() => { applyChoice(pendingChange ?? null); setPendingChange(undefined); }} style={[s.ghostBtn, s.dangerBtn, { flex: 1 }]} accessibilityRole="button"><Text style={[s.ghostText, { color: '#FFFFFF' }]}>{t('change')}</Text></PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Tarjeta de huerta (paso 1)
  const orchardCard = (
    <PressableScale onPress={openChange} disabled={phase === 'resolving'} accessibilityRole="button"
      accessibilityLabel={orchard ? `${orchard.nombre}, ${haLabel(orchard.area_m2)}. ${t('change')}` : `${t('noOrchard')}. ${t('noOrchardHint')}`} style={s.orchCard}>
      <View style={s.orchThumb}>
        {phase === 'resolving' ? <ActivityIndicator color={C.deep} />
          : zonas ? <ZoneBoard zonas={zonas} outline={outline} width={76} height={62} compact />
            : orchard ? <Film size={22} color={C.muted} /> : <Unlink size={22} color={C.muted} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.orchName} numberOfLines={1}>{phase === 'resolving' ? t('finding') : orchard ? orchard.nombre : t('noOrchard')}</Text>
        {phase !== 'resolving' && (
          <Text style={s.orchMeta} numberOfLines={1}>{orchard ? `${haLabel(orchard.area_m2)} · ${zonas ? t('zonesN', { n: zonas.length }) : t('noZonesShort')}` : t('noOrchardHint')}</Text>
        )}
      </View>
      <ChevronRight size={22} color={C.ink} />
    </PressableScale>
  );

  // ───────── listo ─────────
  if (phase === 'done') {
    const ok = result === 'sent';
    return (
      <View style={s.screen}>
        {header(null, ok ? t('doneTitle') : t('savedTitle'), orchard?.nombre ?? t('noOrchard'))}
        <Reanimated.View entering={reduced ? undefined : FadeInDown.duration(220)} style={[s.body, s.center, { paddingHorizontal: 24 }]}>
          <View style={[s.doneIcon, !ok && { backgroundColor: '#FEF3C7' }]}>{ok ? <Check size={34} color="#3F6212" strokeWidth={3} /> : <CloudUpload size={30} color={C.amber} />}</View>
          <Text style={[s.text, { textAlign: 'center' }]}>{ok ? t('doneBody') : result === 'saved' ? t('savedBody') : (error ?? t('failedBody'))}</Text>
          {result === 'failed' && error ? <Text style={[s.small, { textAlign: 'center', marginTop: 6 }]}>{t('failedBody')}</Text> : null}
          <PressableScale onPress={() => router.replace({ pathname: '/(app)/escaneos', params: { tab: 'processing', n: String(Date.now()) } })} style={[s.primary, { marginTop: 22, alignSelf: 'stretch' }]} accessibilityRole="button">
            <Text style={s.primaryText}>{t('openScans')}</Text><ChevronRight size={20} color="#FFFFFF" />
          </PressableScale>
          <Pressable onPress={reset} style={s.linkBtn} accessibilityRole="button"><Text style={s.link}>{t('another')}</Text></Pressable>
        </Reanimated.View>
      </View>
    );
  }

  // ───────── paso 1 · Subir grabación ─────────
  if (!step2) {
    const coverH = Math.round(Math.max(170, Math.min(height < 720 ? height * 0.27 : height * 0.33, width * 0.78)));
    const hasFrames = live.length > 0;
    const busy = phase === 'extracting' || phase === 'resolving';
    return (
      <View style={s.screen}>
        {header(t('step1'), t('title1'), t('sub1'))}
        <View style={s.body}>
          <RNScrollView contentContainerStyle={{ padding: 16, paddingTop: 18, gap: 14 }} showsVerticalScrollIndicator={false}>
            <Pressable onPress={pickVideo} disabled={busy || hasFrames} accessibilityRole="button" accessibilityLabel={t('uploadVideo')} style={[s.cover, { height: coverH }]}>
              <Image source={hasFrames ? { uri: live[0].uri } : COVER} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)']} style={StyleSheet.absoluteFill} />
              {phase === 'extracting' ? (
                <View style={s.coverCenter}>
                  <View style={s.playBtn}><ActivityIndicator color="#FFFFFF" /><Text style={s.playText}>{t('extracting', progress)}</Text></View>
                </View>
              ) : !hasFrames ? (
                <View style={s.coverCenter}>
                  <View style={s.playBtn}><Play size={34} color="#FFFFFF" fill="#FFFFFF" /><Text style={s.playText}>{t('uploadVideo')}</Text></View>
                </View>
              ) : null}
            </Pressable>
            {orchardCard}
            <View style={s.limitRow}><Film size={17} color={C.muted} /><Text style={s.limitText}>{t('limit', { min: MAX_VIDEO_MIN })}</Text></View>
            {notice ? <Text style={s.notice}>{notice}</Text> : null}
            {error ? <Text style={s.error}>{error}</Text> : null}
          </RNScrollView>
          <View style={[s.bottom, { paddingBottom: insets.bottom + 12 }]}>
            {hasFrames ? (
              <>
                <PressableScale onPress={() => setPhase('assign')} style={s.primary} accessibilityRole="button">
                  <Text style={s.primaryText}>{t('continueN', { n: live.length })}</Text><ChevronRight size={20} color="#FFFFFF" />
                </PressableScale>
                <Pressable onPress={() => { setFrames([]); setSel(null); void pickVideo(); }} style={s.linkBtn} accessibilityRole="button"><Text style={s.link}>{t('otherVideo')}</Text></Pressable>
              </>
            ) : (
              <PressableScale onPress={pickVideo} disabled={busy} style={[s.primary, busy && { opacity: 0.6 }]} accessibilityRole="button" accessibilityState={{ disabled: busy }}>
                <ImageIcon size={20} color="#FFFFFF" /><Text style={s.primaryText}>{t('pickVideo')}</Text>
              </PressableScale>
            )}
          </View>
        </View>
        {picker}
        {changeConfirm}
      </View>
    );
  }

  // ───────── paso 2 · Ubica tus fotos / Revisa tus fotos ─────────
  const busy = phase === 'saving' || phase === 'uploading';
  const blocked = busy || !live.length || unassigned > 0;
  const label = busy ? (phase === 'saving' ? t('saving') : t('uploading', progress)) : live.length === 1 ? t('uploadOne') : t('upload', { n: live.length });
  const zoneText = (z: ZoneId, n: number) => t('zoneCount', { z, n, fotos: n === 1 ? t('foto1') : t('fotoN') });
  return (
    <GestureHandlerRootView style={s.screen}>
      <View ref={rootRef} style={{ flex: 1 }} onLayout={measure}>
        {header(t('step2'), withZones ? t('title2') : t('title2none'), orchard?.nombre ?? t('noOrchard'))}
        <View style={s.body}>
          <RNScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, gap: 12 }} scrollEnabled={!dragUri} showsVerticalScrollIndicator={false}>
            {withZones && (
              <View style={s.progressRow} accessibilityLabel={t('placed', { n: placedCount, total: live.length })}>
                <View style={s.track}><View style={[s.fill, { width: `${live.length ? (placedCount / live.length) * 100 : 0}%` }]} /></View>
                <Text style={s.progressText}>{t('placed', { n: placedCount, total: live.length })}</Text>
              </View>
            )}
            {withZones && zonas ? (
              <View ref={mapRef} onLayout={measure} style={[s.mapCard, { alignSelf: 'center' }]}>
                <ZoneMap3D zonas={zonas} outline={outline} width={mapW} height={mapH} counts={counts} activeZone={lastZone} dropTick={dropTick}
                  hover={hover} activeText={zoneText} onZonePress={id => selected && !busy && assign(selected.key, id)} />
              </View>
            ) : (
              <View style={[s.mapCard, s.previewCard, { height: mapH }]}>
                {selected ? <Image source={{ uri: selected.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
                <LinearGradient colors={['rgba(10,38,24,0)', 'rgba(10,38,24,0.85)']} style={[StyleSheet.absoluteFill, { top: '55%' }]} />
                <Text style={s.previewNote}>{orchard ? t('noZonesBody') : t('noneBody')}</Text>
              </View>
            )}
            <Text style={s.hint}>{withZones ? t('hint') : t('hintNone')}</Text>
          </RNScrollView>

          <View style={s.trayWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }} scrollEnabled={!dragUri}>
              {live.map((f, i) => {
                const z = f.zona && zonas ? zonas.find(x => x.id === f.zona) : null;
                return (
                  <TrayItem key={f.key} frame={f} on={f.key === sel} zoneColor={z ? ZONE_UI[z.color].fill : null} draggable={withZones}
                    label={`${t('photoA11y', { i: i + 1, n: live.length, time: fmtTime(f.timeMs) })}, ${f.zona ? t('zoneOf', { z: f.zona }) : t('unplaced')}`}
                    drag={drag} onSelect={setSel} onStart={startDrag} onDrop={onDrop} />
                );
              })}
            </ScrollView>
            <View style={s.actionsRow}>
              <PressableScale onPress={() => selected && remove(selected.key)} disabled={!selected || busy} style={[s.discard, (!selected || busy) && { opacity: 0.5 }]}
                accessibilityRole="button" accessibilityLabel={t('discard')}>
                <Trash2 size={17} color={C.red} /><Text style={s.discardText}>{t('discard')}</Text>
              </PressableScale>
              {removedCount > 0 && (
                <Pressable onPress={restoreAll} disabled={busy} hitSlop={6} accessibilityRole="button">
                  <Text style={s.small}>{t('discarded', { n: removedCount })}<Text style={s.link}>{t('restore')}</Text></Text>
                </Pressable>
              )}
            </View>
            <View style={[s.footer, { paddingBottom: insets.bottom + 10 }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                {withZones && unassigned > 0 ? <Text style={s.pending}>{t('pending', { n: unassigned })}</Text> : null}
                {error ? <Text style={s.error} numberOfLines={3}>{error}</Text> : null}
              </View>
              <PressableScale onPress={save} disabled={blocked} style={[s.uploadBtn, blocked && !busy && s.uploadOff]}
                accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: blocked, busy }}>
                {busy ? <ActivityIndicator color={C.ink} /> : <CloudUpload size={19} color={blocked ? '#94A3B8' : C.ink} />}
                <Text style={[s.uploadText, blocked && !busy && { color: '#94A3B8' }]} numberOfLines={1}>{label}</Text>
              </PressableScale>
            </View>
          </View>
        </View>

        {phase === 'ask-cellular' && saved && (
          <View style={s.overlay}>
            <Reanimated.View entering={reduced ? undefined : FadeIn.duration(180)} style={s.dialog}>
              <Text style={s.dTitle}>{t('cellular')}</Text>
              <Text style={s.text}>{t('cellularBody', { mb })}</Text>
              <View style={s.dRow}>
                <PressableScale onPress={() => { setResult('saved'); setPhase('done'); }} style={[s.ghostBtn, { flex: 1 }]} accessibilityRole="button"><Text style={s.ghostText}>{t('waitWifi')}</Text></PressableScale>
                <PressableScale onPress={() => doUpload(saved)} style={[s.ghostBtn, { flex: 1, backgroundColor: C.limeStrong, borderColor: C.limeStrong }]} accessibilityRole="button"><Text style={s.ghostText}>{t('uploadNow')}</Text></PressableScale>
              </View>
            </Reanimated.View>
          </View>
        )}

        {dragUri && (
          <Reanimated.View pointerEvents="none" style={[s.ghost, ghostStyle]}>
            <Image source={{ uri: dragUri }} style={s.ghostImg} />
          </Reanimated.View>
        )}
      </View>
      {picker}
      {changeConfirm}
    </GestureHandlerRootView>
  );
}

type DragValues = {
  dragX: SharedValue<number>; dragY: SharedValue<number>; dragOn: SharedValue<number>; hover: SharedValue<number>;
  origin: SharedValue<{ rx: number; ry: number; bx: number; by: number }>; polys: SharedValue<[number, number][][]>;
};

/** Foto de la tira: toque = seleccionar; pulsación sostenida + arrastre = llevarla a una zona (hilo de UI). */
const TrayItem = memo(function TrayItem({ frame, on, zoneColor, label, draggable, drag, onSelect, onStart, onDrop }: {
  frame: Frame; on: boolean; zoneColor: string | null; label: string; draggable: boolean; drag: DragValues;
  onSelect: (key: string) => void; onStart: (key: string, uri: string) => void; onDrop: (key: string, idx: number) => void;
}) {
  const gesture = useMemo(() => {
    const { dragX, dragY, dragOn, hover, origin, polys } = drag;
    const key = frame.key, uri = frame.uri;
    const pan = Gesture.Pan()
      .enabled(draggable)
      .activateAfterLongPress(220)
      .onStart(e => {
        dragX.set(e.absoluteX); dragY.set(e.absoluteY);
        dragOn.set(withTiming(1, { duration: 120 }));
        scheduleOnRN(onStart, key, uri);
      })
      .onUpdate(e => {
        dragX.set(e.absoluteX); dragY.set(e.absoluteY);
        const o = origin.get();
        const x = e.absoluteX - o.bx, y = e.absoluteY - o.by;
        const list = polys.get();
        let hit = -1;
        for (let i = 0; i < list.length; i++) if (pointInPolygon(x, y, list[i])) { hit = i; break; }
        hover.set(hit);
      })
      .onEnd(() => { scheduleOnRN(onDrop, key, hover.get()); })
      .onFinalize(() => { dragOn.set(withTiming(0, { duration: 140 })); hover.set(-1); });
    const tap = Gesture.Tap().onEnd(() => { scheduleOnRN(onSelect, key); });
    return Gesture.Exclusive(pan, tap);
  }, [drag, frame.key, frame.uri, draggable, onSelect, onStart, onDrop]);
  return (
    <GestureDetector gesture={gesture}>
      <View style={[s.thumbWrap, on && s.thumbOn]} accessible accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }}>
        <Image source={{ uri: frame.uri }} style={s.thumb} />
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} style={[StyleSheet.absoluteFill, { top: '55%' }]} />
        {frame.zona && zoneColor ? <View style={[s.badge, { backgroundColor: zoneColor }]}><Text style={s.badgeText}>{frame.zona}</Text></View> : null}
        <Text style={s.time}>{fmtTime(frame.timeMs)}</Text>
      </View>
    </GestureDetector>
  );
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.deep2 },
  header: { paddingHorizontal: 20, paddingBottom: 40, overflow: 'hidden' },
  stripe: { position: 'absolute', width: 120, height: 320, backgroundColor: '#FFFFFF', opacity: 0.04, transform: [{ rotate: '35deg' }] },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)', marginRight: 2 },
  brand: { fontFamily: 'Poppins_700Bold', fontSize: 17, letterSpacing: 3, color: '#FFFFFF' },
  stepPill: { alignSelf: 'flex-start', backgroundColor: C.lime, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4, marginBottom: 8 },
  stepText: { fontFamily: 'Poppins_700Bold', fontSize: 13, color: C.ink },
  hTitle: { fontFamily: 'Poppins_700Bold', fontSize: 32, lineHeight: 40, color: '#FFFFFF', letterSpacing: -0.5 },
  hSub: { fontFamily: 'Poppins_400Regular', fontSize: 14.5, color: 'rgba(255,255,255,0.82)' },
  body: { flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -26, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 20, color: '#334155' },
  small: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.muted },
  link: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#3F6212' },
  linkBtn: { alignSelf: 'center', padding: 10 },
  error: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: C.red },
  notice: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: C.amber, backgroundColor: '#FEF3C7', padding: 10, borderRadius: 12 },
  cover: { borderRadius: 24, overflow: 'hidden', backgroundColor: '#1F3A2A' },
  coverCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 132, height: 132, borderRadius: 66, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(15,61,36,0.55)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)', paddingHorizontal: 10 },
  playText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#FFFFFF', textAlign: 'center' },
  orchCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 22, backgroundColor: '#E9EFE4' },
  orchThumb: { width: 76, height: 62, borderRadius: 16, backgroundColor: '#DDE7D6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  orchName: { fontFamily: 'Poppins_700Bold', fontSize: 18, color: C.ink },
  orchMeta: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: C.muted },
  limitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  limitText: { fontFamily: 'Poppins_400Regular', fontSize: 13.5, color: C.muted },
  bottom: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: C.bg },
  primary: { height: 56, borderRadius: 18, backgroundColor: C.deep, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryText: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#FFFFFF' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { flex: 1, height: 12, borderRadius: 6, backgroundColor: '#D7DCD3', overflow: 'hidden' },
  fill: { height: 12, borderRadius: 6, backgroundColor: C.limeStrong },
  progressText: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: C.ink },
  mapCard: { borderRadius: 22, overflow: 'hidden' },
  previewCard: { backgroundColor: '#123D2A', justifyContent: 'flex-end' },
  previewNote: { margin: 14, fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#FFFFFF' },
  hint: { textAlign: 'center', fontFamily: 'Poppins_600SemiBold', fontSize: 14.5, color: C.ink },
  trayWrap: { paddingTop: 4, backgroundColor: C.bg },
  thumbWrap: { width: THUMB, height: THUMB * 1.12, borderRadius: 16, overflow: 'hidden', borderWidth: 3, borderColor: 'transparent', backgroundColor: '#D7DCD3' },
  thumbOn: { borderColor: C.limeStrong },
  thumb: { width: '100%', height: '100%' },
  badge: { position: 'absolute', top: 5, right: 5, minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#FFFFFF' },
  badgeText: { fontFamily: 'Poppins_700Bold', fontSize: 11.5, color: C.ink },
  time: { position: 'absolute', left: 6, bottom: 4, fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#FFFFFF' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10 },
  discard: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#FDECEC', borderWidth: 1, borderColor: '#F8C9C9' },
  discardText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: C.red },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10 },
  pending: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: C.amber },
  uploadBtn: { height: 52, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, backgroundColor: C.limeStrong },
  uploadOff: { backgroundColor: '#E2E5DF' },
  uploadText: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: C.ink },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11,26,18,0.4)', justifyContent: 'flex-end', padding: 16 },
  dialog: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 8 },
  dTitle: { fontFamily: 'Poppins_700Bold', fontSize: 17, color: C.ink },
  dRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  ghostBtn: { height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: C.line },
  ghostText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: C.ink },
  dangerBtn: { backgroundColor: '#B91C1C', borderColor: '#B91C1C' },
  doneIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: C.limeSoft, marginBottom: 14 },
  ghost: { position: 'absolute', left: 0, top: 0, width: THUMB, height: THUMB, borderRadius: 16, overflow: 'hidden', borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
  ghostImg: { width: '100%', height: '100%' },
});
