/**
 * Subir grabación (video sin GPS → fotos asignadas a zonas de la huerta).
 *
 * Pasos: 1) huerta · 2) video · 3) fotos del video → el agricultor borra las que no son del cultivo y
 * arrastra (o toca) cada foto a su zona A–D · 4) se guarda en el celular y se sube con la misma cola que
 * los recorridos; el procesador analiza cada foto y guarda la zona en cada hallazgo.
 *
 * Arrastre: pulsación larga sobre una foto → la foto sigue al dedo; la zona bajo el dedo se ilumina
 * (todo en el hilo de UI) y al soltar se asigna. Alternativa sin arrastre: tocar la foto y luego la zona.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView as RNScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import Reanimated, { FadeIn, FadeInDown, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as Network from 'expo-network';
import { onAuthStateChanged, type Auth, type User } from 'firebase/auth';
import { ArrowLeft, Check, ChevronRight, CloudUpload, Film, Hand, Map as MapIcon, RotateCcw, Trash2, Video } from 'lucide-react-native';
import { auth as firebaseAuth } from '../../firebaseConfig';
import { useGuest } from '../../context/GuestContext';
import { TranslationResource, useTranslations } from '../../context/LanguageContext';
import { listOrchards, type Orchard } from '../../services/orchards';
import { frameTimes, guardarGrabacion, MAX_VIDEO_MIN, ZONE_UI, zonasDeHuerta, type ZonaSnapshot } from '../../services/grabacion';
import { extractFrames } from '../../services/videoFrames';
import { getMobileDataAllowed, uploadRecorrido, type Fuente } from '../../services/recorridos';
import type { ZoneId } from '../../services/satZones';
import ZoneBoard, { pointInPolygon, projectZones } from '../../components/grabacion/ZoneBoard';
import { PressableScale } from '../../components/scan/motion';
import { LIME_GRADIENT, SCAN } from '../../components/scan/theme';
import { LinearGradient } from 'expo-linear-gradient';

const auth = firebaseAuth as Auth;

const translations: TranslationResource = {
  title: { es: 'Subir grabación', en: 'Upload recording' },
  back: { es: 'Volver', en: 'Back' },
  src_celular: { es: 'Celular', en: 'Phone' }, src_dron: { es: 'Dron', en: 'Drone' }, src_camara: { es: 'GoPro', en: 'GoPro' },
  subtitle: { es: 'Sin GPS: tú indicas de qué zona viene cada foto', en: 'No GPS: you set which zone each photo comes from' },
  stepOrchard: { es: '1. ¿De qué huerta es el video?', en: '1. Which orchard is the video from?' },
  noOrchards: { es: 'Aún no tienes huertas', en: 'You have no orchards yet' },
  noOrchardsBody: { es: 'Dibuja tu huerta en Mapeo: sus zonas son las que usarás para ubicar cada foto.', en: 'Draw your orchard in Mapping: its zones are what you will use to place each photo.' },
  goMapping: { es: 'Ir a Mapeo', en: 'Go to Mapping' },
  change: { es: 'Cambiar', en: 'Change' },
  zonesCount: { es: '{n} zonas', en: '{n} zones' },
  noZones: { es: 'Sin zonas (huerta muy pequeña o con lados cruzados)', en: 'No zones (orchard too small or self-crossing)' },
  stepVideo: { es: '2. Elige el video', en: '2. Choose the video' },
  pickVideo: { es: 'Elegir video de la galería', en: 'Choose a video from the gallery' },
  pickHint: { es: 'Tomaremos ~1 foto cada 3 s (de 4 a 30 fotos). Videos de hasta {min} min.', en: 'We take ~1 photo every 3 s (4 to 30 photos). Videos up to {min} min.' },
  permission: { es: 'Permite el acceso a tus videos para continuar.', en: 'Allow access to your videos to continue.' },
  tooLong: { es: 'El video dura más de {min} min: tomaremos 30 fotos repartidas en todo el video.', en: 'The video is longer than {min} min: we will take 30 photos spread across it.' },
  extracting: { es: 'Sacando fotos del video… {done}/{total}', en: 'Taking photos from the video… {done}/{total}' },
  extractFail: { es: 'No pudimos leer ese video. Prueba con otro.', en: 'We could not read that video. Try another one.' },
  stepAssign: { es: '3. Lleva cada foto a su zona', en: '3. Drag each photo to its zone' },
  assignHelp: { es: 'Mantén presionada una foto y suéltala sobre su zona. También puedes tocar la foto y luego la zona.', en: 'Long-press a photo and drop it on its zone. You can also tap the photo, then the zone.' },
  assignNoZones: { es: 'Esta huerta no tiene zonas: las fotos se subirán sin zona. Borra las que no sean del cultivo.', en: 'This orchard has no zones: photos will upload without a zone. Delete those that are not the crop.' },
  photoOf: { es: 'Foto {i} de {n} · {time}', en: 'Photo {i} of {n} · {time}' },
  zoneOf: { es: 'Zona {z}', en: 'Zone {z}' },
  noZone: { es: 'Sin zona', en: 'No zone' },
  deletePhoto: { es: 'Descartar', en: 'Discard' },
  deleteHint: { es: 'Descarta las que no muestran aguacate (u otro cultivo) para no procesarlas.', en: 'Discard those that do not show the crop so they are not processed.' },
  discarded: { es: '{n} descartadas', en: '{n} discarded' },
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
  doneTitle: { es: 'Grabación enviada', en: 'Recording sent' },
  doneBody: { es: 'La analizaremos y te avisaremos. En Mis escaneos verás cada hallazgo en su zona.', en: 'We will analyze it and notify you. In My scans you will see each finding in its zone.' },
  savedTitle: { es: 'Grabación guardada', en: 'Recording saved' },
  savedBody: { es: 'Se subirá desde Mis escaneos cuando tengas conexión.', en: 'It will upload from My scans when you are online.' },
  failedBody: { es: 'Quedó guardada en tu celular; puedes subirla desde Mis escaneos.', en: 'It is saved on your phone; you can upload it from My scans.' },
  openScans: { es: 'Ver en Mis escaneos', en: 'View in My scans' },
  another: { es: 'Subir otra grabación', en: 'Upload another recording' },
  guest: { es: 'Crea una cuenta para subir grabaciones.', en: 'Create an account to upload recordings.' },
};

type Frame = { key: string; uri: string; timeMs: number; zona: ZoneId | null; removed: boolean };
type Phase = 'setup' | 'extracting' | 'assign' | 'saving' | 'ask-cellular' | 'uploading' | 'done';

const fmtTime = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const THUMB = 76;

/** Cada entrada desde Escanear (parámetro n) empieza de cero: se vuelve a montar la pantalla. */
export default function GrabacionRoute() {
  const { n } = useLocalSearchParams<{ n?: string }>();
  return <GrabacionScreen key={n ?? 'g'} />;
}

function GrabacionScreen() {
  const t = useTranslations(translations);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const params = useLocalSearchParams<{ fuente?: string; n?: string }>();
  const fuente: Fuente = params.fuente === 'dron' || params.fuente === 'camara' ? params.fuente : 'celular';
  const { isGuest } = useGuest();

  const [user, setUser] = useState<User | null>(auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  const email = user?.email ?? null;

  const [orchards, setOrchards] = useState<Orchard[] | null>(null);
  const [orchardId, setOrchardId] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [phase, setPhase] = useState<Phase>('setup');
  const [frames, setFrames] = useState<Frame[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<'sent' | 'saved' | 'failed' | null>(null);
  const cancelled = useRef(false);
  const [saved, setSaved] = useState<Awaited<ReturnType<typeof guardarGrabacion>> | null>(null);
  useEffect(() => { cancelled.current = false; return () => { cancelled.current = true; }; }, []);

  useEffect(() => {
    if (!email) return;
    let alive = true;
    listOrchards(email).then(list => {
      if (!alive) return;
      setOrchards(list);
      setOrchardId(prev => prev && list.some(o => o.id === prev) ? prev : list[0]?.id ?? null);
    }).catch(() => alive && setOrchards([]));
    return () => { alive = false; };
  }, [email]);

  const orchard = orchards?.find(o => o.id === orchardId) ?? null;
  const zonas = useMemo<ZonaSnapshot[] | null>(() => (orchard ? zonasDeHuerta(orchard.coordinates, orchard.id) : null), [orchard]);
  const outline = useMemo(() => (orchard ? orchard.coordinates.map(p => ({ lat: p.latitude, lng: p.longitude })) : null), [orchard]);

  const live = frames.filter(f => !f.removed);
  const removedCount = frames.length - live.length;
  const unassigned = zonas ? live.filter(f => !f.zona).length : 0;
  const counts: Partial<Record<ZoneId, number>> = {};
  for (const f of live) if (f.zona) counts[f.zona] = (counts[f.zona] ?? 0) + 1;
  const selected = live.find(f => f.key === sel) ?? null;
  const selIndex = selected ? live.indexOf(selected) : -1;

  // ───────── video ─────────
  const pickVideo = async () => {
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
    setFrames(prev => {
      const next = prev.map(f => (f.key === key ? { ...f, zona } : f));
      // Siguiente foto sin zona (después de la actual; si no hay, desde el inicio).
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

  // ───────── arrastre ─────────
  const boardW = Math.min(width - 32, 560);
  const boardH = Math.round(Math.min(height * 0.36, boardW * 0.78));
  const proj = useMemo(() => (zonas ? projectZones(zonas, outline, boardW, boardH) : null), [zonas, outline, boardW, boardH]);
  const polys = useSharedValue<[number, number][][]>([]);
  useEffect(() => { polys.set(proj ? proj.zones.map(z => z.pts) : []); }, [proj, polys]);
  const rootRef = useRef<React.ComponentRef<typeof View>>(null);
  const boardRef = useRef<React.ComponentRef<typeof View>>(null);
  const origin = useSharedValue({ rx: 0, ry: 0, bx: 0, by: 0 });
  const measure = () => {
    rootRef.current?.measureInWindow((rx, ry) => boardRef.current?.measureInWindow((bx, by) => origin.set({ rx, ry, bx, by })));
  };
  const hover = useSharedValue(-1);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragOn = useSharedValue(0);
  const [dragUri, setDragUri] = useState<string | null>(null);
  const zoneIds = useMemo(() => (proj ? proj.zones.map(z => z.id) : []), [proj]);
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
    if (!email || !orchard || !live.length || unassigned) return;
    setPhase('saving');
    try {
      const rec = await guardarGrabacion({
        userEmail: email, huertaId: orchard.id, fuente, zonas,
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

  const reset = () => { setPhase('setup'); setFrames([]); setSel(null); setError(null); setNotice(null); setResult(null); setSaved(null); };
  const srcName = t(`src_${fuente}`);

  // ───────── vistas ─────────
  const header = (
    <View style={[s.header, { paddingTop: insets.top + 8 }]}>
      <PressableScale onPress={() => (router.canGoBack() ? router.back() : router.navigate('/(app)/scan'))} accessibilityRole="button" accessibilityLabel={t('back')} style={s.backBtn} hitSlop={8}>
        <ArrowLeft size={22} color={SCAN.ink} />
      </PressableScale>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.title} numberOfLines={1}>{t('title')}</Text>
        <Text style={s.subtitle} numberOfLines={2}>{t('subtitle', { src: srcName })}</Text>
      </View>
      <View style={s.srcPill}>{fuente === 'celular' ? <Film size={14} color={SCAN.ink} /> : <Video size={14} color={SCAN.ink} />}<Text style={s.srcText}>{srcName}</Text></View>
    </View>
  );

  if (isGuest || !email) {
    return <View style={s.screen}>{header}<View style={s.center}><Text style={s.body}>{t('guest')}</Text></View></View>;
  }

  if (phase === 'done') {
    const ok = result === 'sent';
    return (
      <View style={s.screen}>
        {header}
        <Reanimated.View entering={reduced ? undefined : FadeInDown.duration(220)} style={[s.center, { paddingHorizontal: 24 }]}>
          <View style={[s.doneIcon, !ok && { backgroundColor: '#FEF3C7' }]}>{ok ? <Check size={34} color="#3F6212" strokeWidth={3} /> : <CloudUpload size={30} color="#92400E" />}</View>
          <Text style={s.doneTitle}>{ok ? t('doneTitle') : t('savedTitle')}</Text>
          <Text style={[s.body, { textAlign: 'center' }]}>{ok ? t('doneBody') : result === 'saved' ? t('savedBody') : (error ?? t('failedBody'))}</Text>
          {!ok && result === 'failed' && error && <Text style={[s.small, { textAlign: 'center', marginTop: 6 }]}>{t('failedBody')}</Text>}
          <PressableScale onPress={() => router.replace({ pathname: '/(app)/escaneos', params: { n: String(Date.now()) } })} style={[s.cta, { marginTop: 22, alignSelf: 'stretch' }]} accessibilityRole="button">
            <LinearGradient colors={[...LIME_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.ctaInner}>
              <Text style={s.ctaText}>{t('openScans')}</Text><ChevronRight size={20} color={SCAN.ink} />
            </LinearGradient>
          </PressableScale>
          <Pressable onPress={reset} style={s.linkBtn} accessibilityRole="button"><Text style={s.link}>{t('another')}</Text></Pressable>
        </Reanimated.View>
      </View>
    );
  }

  const orchardCard = (
    <View style={s.card}>
      <Text style={s.step}>{t('stepOrchard')}</Text>
      {orchards === null ? <ActivityIndicator color={SCAN.lime} style={{ marginVertical: 12 }} />
        : !orchards.length ? (
          <View style={{ gap: 8 }}>
            <Text style={s.bodyStrong}>{t('noOrchards')}</Text>
            <Text style={s.small}>{t('noOrchardsBody')}</Text>
            <PressableScale onPress={() => router.navigate('/(app)/mapping')} style={s.ghostBtn} accessibilityRole="button">
              <MapIcon size={16} color={SCAN.ink} /><Text style={s.ghostText}>{t('goMapping')}</Text>
            </PressableScale>
          </View>
        ) : (choosing || !orchard) ? (
          <View style={{ gap: 8 }}>
            {orchards.map(o => (
              <Pressable key={o.id} onPress={() => { setOrchardId(o.id); setChoosing(false); setFrames(f => f.map(x => ({ ...x, zona: null }))); }}
                style={[s.orchRow, o.id === orchardId && s.orchRowOn]} accessibilityRole="radio" accessibilityState={{ selected: o.id === orchardId }}>
                <Text style={s.bodyStrong} numberOfLines={1}>{o.nombre}</Text>
                <Text style={s.small}>{(o.area_m2 / 10000).toFixed(2)} ha</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={s.orchSel}>
            {zonas ? <ZoneBoard zonas={zonas} outline={outline} width={64} height={52} compact /> : <View style={s.noZoneMini}><MapIcon size={20} color={SCAN.muted} /></View>}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.bodyStrong} numberOfLines={1}>{orchard.nombre}</Text>
              <Text style={s.small} numberOfLines={2}>{(orchard.area_m2 / 10000).toFixed(2)} ha · {zonas ? t('zonesCount', { n: zonas.length }) : t('noZones')}</Text>
            </View>
            {orchards.length > 1 && phase === 'setup' && (
              <Pressable onPress={() => setChoosing(true)} hitSlop={8} accessibilityRole="button"><Text style={s.link}>{t('change')}</Text></Pressable>
            )}
          </View>
        )}
    </View>
  );

  if (phase === 'setup' || phase === 'extracting') {
    return (
      <View style={s.screen}>
        {header}
        <RNScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }}>
          {orchardCard}
          {!!orchard && (
            <View style={s.card}>
              <Text style={s.step}>{t('stepVideo')}</Text>
              {phase === 'extracting' ? (
                <View style={{ gap: 10, paddingVertical: 8 }}>
                  <Text style={s.bodyStrong}>{t('extracting', progress)}</Text>
                  <View style={s.track}><View style={[s.fill, { width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }]} /></View>
                </View>
              ) : (
                <>
                  <PressableScale onPress={pickVideo} style={s.pick} accessibilityRole="button" accessibilityLabel={t('pickVideo')}>
                    <View style={s.pickIcon}><Film size={26} color="#3F6212" /></View>
                    <Text style={s.pickText}>{t('pickVideo')}</Text>
                    <Text style={[s.small, { textAlign: 'center' }]}>{t('pickHint', { min: MAX_VIDEO_MIN })}</Text>
                  </PressableScale>
                  {error && <Text style={s.error}>{error}</Text>}
                </>
              )}
            </View>
          )}
        </RNScrollView>
      </View>
    );
  }

  // ───────── asignar ─────────
  const busy = phase === 'saving' || phase === 'uploading';
  const label = busy ? (phase === 'saving' ? t('saving') : t('uploading', progress)) : live.length === 1 ? t('uploadOne') : t('upload', { n: live.length });
  return (
    <GestureHandlerRootView style={s.screen}>
      <View ref={rootRef} style={{ flex: 1 }} onLayout={measure}>
        {header}
        <RNScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 12 }} scrollEnabled={!dragUri}>
          <View>
            <Text style={s.step}>{t('stepAssign')}</Text>
            <Text style={s.small}>{zonas ? t('assignHelp') : t('assignNoZones')}</Text>
          </View>
          {zonas && (
            <View ref={boardRef} onLayout={measure} style={{ alignSelf: 'center' }}>
              <ZoneBoard zonas={zonas} outline={outline} width={boardW} height={boardH} counts={counts} hover={hover}
                onZonePress={id => selected && !busy && assign(selected.key, id)} />
            </View>
          )}
          {notice && <Text style={s.notice}>{notice}</Text>}
          {selected && (
            <Reanimated.View key={selected.key} entering={reduced ? undefined : FadeIn.duration(140)} style={s.selRow}>
              <Image source={{ uri: selected.uri }} style={s.selImg} />
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <Text style={s.small}>{t('photoOf', { i: selIndex + 1, n: live.length, time: fmtTime(selected.timeMs) })}</Text>
                {zonas && (
                  <View style={[s.zoneChip, selected.zona ? { backgroundColor: ZONE_UI[zonas.find(z => z.id === selected.zona)!.color].soft, borderColor: ZONE_UI[zonas.find(z => z.id === selected.zona)!.color].line } : null]}>
                    {selected.zona ? <Check size={13} color={SCAN.ink} /> : <Hand size={13} color={SCAN.muted} />}
                    <Text style={s.zoneChipText}>{selected.zona ? t('zoneOf', { z: selected.zona }) : t('noZone')}</Text>
                  </View>
                )}
                <PressableScale onPress={() => remove(selected.key)} disabled={busy} style={s.delBtn} accessibilityRole="button" accessibilityLabel={t('deletePhoto')}>
                  <Trash2 size={15} color="#B91C1C" /><Text style={s.delText}>{t('deletePhoto')}</Text>
                </PressableScale>
              </View>
            </Reanimated.View>
          )}
          <Text style={s.small}>{t('deleteHint')}</Text>
        </RNScrollView>

        {/* Bandeja de fotos */}
        <View style={s.tray}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }} scrollEnabled={!dragUri}>
            {live.map((f, i) => {
              const z = f.zona && zonas ? zonas.find(x => x.id === f.zona) : null;
              const on = f.key === sel;
              return (
                <TrayItem key={f.key} frame={f} on={on} line={z ? ZONE_UI[z.color].line : null} draggable={!!zonas}
                  label={`${t('photoOf', { i: i + 1, n: live.length, time: fmtTime(f.timeMs) })}. ${f.zona ? t('zoneOf', { z: f.zona }) : t('noZone')}`}
                  drag={drag} onSelect={setSel} onStart={startDrag} onDrop={onDrop} />
              );
            })}
          </ScrollView>
          <View style={[s.footer, { paddingBottom: insets.bottom + 10 }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              {zonas && unassigned > 0 ? <Text style={s.pending}>{t('pending', { n: unassigned })}</Text> : null}
              {removedCount > 0 && (
                <Pressable onPress={restoreAll} disabled={busy} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <RotateCcw size={12} color={SCAN.muted} /><Text style={s.small}>{t('discarded', { n: removedCount })} · <Text style={s.link}>{t('restore')}</Text></Text>
                </Pressable>
              )}
              {error && <Text style={s.error} numberOfLines={3}>{error}</Text>}
            </View>
            <PressableScale onPress={save} disabled={busy || !live.length || unassigned > 0} style={[s.cta, (busy || !live.length || unassigned > 0) && s.ctaOff]}
              accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: busy || !live.length || unassigned > 0, busy }}>
              <LinearGradient colors={unassigned > 0 || !live.length ? ['#E5E7EB', '#D1D5DB'] : [...LIME_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.ctaInner}>
                {busy ? <ActivityIndicator color={SCAN.ink} /> : <CloudUpload size={18} color={SCAN.ink} />}
                <Text style={s.ctaText} numberOfLines={1}>{label}</Text>
              </LinearGradient>
            </PressableScale>
          </View>
        </View>

        {phase === 'ask-cellular' && saved && (
          <View style={s.overlay}>
            <Reanimated.View entering={reduced ? undefined : FadeInDown.duration(200)} style={s.ask}>
              <Text style={s.bodyStrong}>{t('cellular')}</Text>
              <Text style={s.body}>{t('cellularBody', { mb })}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                <PressableScale onPress={() => { setResult('saved'); setPhase('done'); }} style={[s.ghostBtn, { flex: 1 }]} accessibilityRole="button"><Text style={s.ghostText}>{t('waitWifi')}</Text></PressableScale>
                <PressableScale onPress={() => doUpload(saved)} style={[s.ghostBtn, { flex: 1, backgroundColor: SCAN.limeBright }]} accessibilityRole="button"><Text style={s.ghostText}>{t('uploadNow')}</Text></PressableScale>
              </View>
            </Reanimated.View>
          </View>
        )}

        {/* Foto que sigue al dedo */}
        {dragUri && (
          <Reanimated.View pointerEvents="none" style={[s.ghost, ghostStyle]}>
            <Image source={{ uri: dragUri }} style={s.ghostImg} />
          </Reanimated.View>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

type DragValues = {
  dragX: SharedValue<number>; dragY: SharedValue<number>; dragOn: SharedValue<number>; hover: SharedValue<number>;
  origin: SharedValue<{ rx: number; ry: number; bx: number; by: number }>; polys: SharedValue<[number, number][][]>;
};

/** Foto de la bandeja: toque = seleccionar; pulsación larga + arrastre = llevarla a una zona (todo en el hilo de UI). */
const TrayItem = memo(function TrayItem({ frame, on, line, label, draggable, drag, onSelect, onStart, onDrop }: {
  frame: Frame; on: boolean; line: string | null; label: string; draggable: boolean; drag: DragValues;
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
      <View style={[s.thumbWrap, on && s.thumbOn, line ? { borderColor: line } : null]} accessible accessibilityRole="button" accessibilityLabel={label}>
        <Image source={{ uri: frame.uri }} style={s.thumb} />
        {frame.zona && line ? <View style={[s.badge, { backgroundColor: line }]}><Text style={s.badgeText}>{frame.zona}</Text></View> : null}
        <Text style={s.time}>{fmtTime(frame.timeMs)}</Text>
      </View>
    </GestureDetector>
  );
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8F3' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  backBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: SCAN.line },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 20, color: SCAN.ink },
  subtitle: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: SCAN.muted },
  srcPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 30, borderRadius: 15, backgroundColor: 'rgba(236,252,203,0.95)', borderWidth: 1, borderColor: 'rgba(132,204,22,0.4)' },
  srcText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: SCAN.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, gap: 10, borderWidth: 1, borderColor: SCAN.line },
  step: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: SCAN.ink },
  body: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: SCAN.inkSoft, lineHeight: 20 },
  bodyStrong: { fontFamily: 'Poppins_600SemiBold', fontSize: 14.5, color: SCAN.ink },
  small: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: SCAN.muted, lineHeight: 17 },
  link: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#3F6212' },
  linkBtn: { marginTop: 14, padding: 8 },
  error: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: '#B91C1C' },
  notice: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#92400E', backgroundColor: '#FEF3C7', padding: 10, borderRadius: 12 },
  orchRow: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: SCAN.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  orchRowOn: { borderColor: SCAN.lime, backgroundColor: 'rgba(236,252,203,0.6)' },
  orchSel: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  noZoneMini: { width: 64, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: SCAN.surface },
  ghostBtn: { height: 42, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, backgroundColor: SCAN.surface, borderWidth: 1, borderColor: SCAN.line },
  ghostText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: SCAN.ink },
  pick: { alignItems: 'center', gap: 8, paddingVertical: 22, paddingHorizontal: 14, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(132,204,22,0.6)', backgroundColor: 'rgba(247,254,231,0.7)' },
  pickIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(217,249,157,0.9)' },
  pickText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15.5, color: SCAN.ink },
  track: { height: 8, borderRadius: 4, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: SCAN.lime },
  selRow: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 10, borderWidth: 1, borderColor: SCAN.line },
  selImg: { width: 116, height: 116, borderRadius: 14, backgroundColor: '#E5E7EB' },
  zoneChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 28, borderRadius: 14, borderWidth: 1, borderColor: SCAN.line, backgroundColor: SCAN.surface },
  zoneChipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: SCAN.ink },
  delBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  delText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: '#B91C1C' },
  tray: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, borderWidth: 1, borderColor: SCAN.line, shadowColor: '#0B1A12', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 8 },
  thumbWrap: { width: THUMB, height: THUMB, borderRadius: 14, overflow: 'hidden', borderWidth: 2.5, borderColor: 'transparent', backgroundColor: '#E5E7EB' },
  thumbOn: { borderColor: SCAN.ink },
  thumb: { width: '100%', height: '100%' },
  badge: { position: 'absolute', top: 4, right: 4, minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontFamily: 'Poppins_700Bold', fontSize: 11, color: '#FFFFFF' },
  time: { position: 'absolute', left: 4, bottom: 3, fontFamily: 'Poppins_600SemiBold', fontSize: 10, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  pending: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: '#92400E' },
  cta: { borderRadius: 18, shadowColor: '#65A30D', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  ctaOff: { shadowOpacity: 0, elevation: 0 },
  ctaInner: { height: 50, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  ctaText: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: SCAN.ink },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11,26,18,0.35)', justifyContent: 'flex-end', padding: 16 },
  ask: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 8 },
  doneIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFCCB', marginBottom: 12 },
  doneTitle: { fontFamily: 'Poppins_700Bold', fontSize: 20, color: SCAN.ink, marginBottom: 6 },
  ghost: { position: 'absolute', left: 0, top: 0, width: THUMB, height: THUMB, borderRadius: 16, overflow: 'hidden', borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
  ghostImg: { width: '100%', height: '100%' },
});
