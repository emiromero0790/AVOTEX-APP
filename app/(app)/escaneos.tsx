/**
 * Mis escaneos — mapa de los escaneos y su historial.
 *
 * Datos reales, nada inventado:
 * - Polígonos: huertas del usuario (tabla huertas).
 * - Marcadores: escaneos con coordenadas guardadas (ruta GPS de un recorrido o el GPS de las fotos
 *   importadas). Sin coordenadas → solo aparecen en el historial, sin marcador.
 * - Escaneos en el servidor (recorridos), guardados en el celular (sin subir) y fotos individuales
 *   (tabla scans; no guardan ubicación).
 *
 * Movimiento (animate-expo): el panel del escaneo seleccionado entra desde abajo (260 ms, curva de salida)
 * y sale más rápido; el mapa se expande con LinearTransition; las tarjetas responden al toque con escala.
 * Vibración ligera al seleccionar un escaneo. "Reducir movimiento" quita desplazamientos.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Reanimated, { FadeIn, FadeInDown, FadeOutDown, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import {
  BarChart3, Camera, ChevronLeft, ChevronRight, CloudUpload, Layers, LocateFixed, Lock, Maximize2, MapPin, Minimize2, Minus, Navigation,
  Plane, Plus, ScanLine, Smartphone, Video, X,
} from 'lucide-react-native';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { auth as firebaseAuth } from '../../firebaseConfig';
import { supabase } from '../../supabaseConfig';
import { useGuest } from '../../context/GuestContext';
import { localizeDomainLabel, TranslationResource, useLanguage, useTranslations } from '../../context/LanguageContext';
import { listOrchards, Orchard } from '../../services/orchards';
import {
  Fuente, RecorridoLocal, RecorridoRemoto, isHealthy, isUploading, listHallazgos, listLocal, listRemote, recoverInterrupted,
  thumbnailSource, uploadPending,
} from '../../services/recorridos';
import ScansMap, { type ScansMapHandle } from '../../components/ScansMap';
import { SCAN_STATUS_COLOR, type ScanStatus, type ScansMapData, type ScansMapLayer, type ScansMapPoint } from '../../components/scansMapHtml';
import ScanHeader from '../../components/scan/ScanHeader';
import { CSS_EASE_OUT, EASE_IN_OUT, EASE_OUT, PressableScale } from '../../components/scan/motion';
import { CARD_SHADOW, SCAN, STATUS_INK } from '../../components/scan/theme';

const auth = firebaseAuth as Auth;

const PANEL_IN = FadeInDown.duration(260).easing(EASE_OUT);
const PANEL_OUT = FadeOutDown.duration(180);
const MAP_RESIZE = LinearTransition.duration(300).easing(EASE_IN_OUT);
const LIST_IN = FadeIn.duration(220).easing(EASE_OUT);

const translations: TranslationResource = {
  title: { es: 'Mis escaneos', en: 'My scans' },
  subtitle: { es: 'Explora el mapa y revisa tus análisis', en: 'Explore the map and review your analyses' },
  back: { es: 'Volver a Escanear', en: 'Back to Scan' },
  history: { es: 'Historial reciente', en: 'Recent history' },
  all: { es: 'Todos', en: 'All' },
  done: { es: 'Completados', en: 'Completed' },
  processing: { es: 'En proceso', en: 'Processing' },
  queued: { es: 'Pendientes', en: 'Pending' },
  local: { es: 'Sin sincronizar', en: 'Not synced' },
  stListo: { es: 'Análisis completado', en: 'Analysis complete' },
  stProceso: { es: 'En proceso', en: 'Processing' },
  stCola: { es: 'Pendiente', en: 'Pending' },
  stLocal: { es: 'Sin sincronizar', en: 'Not synced' },
  stError: { es: 'Con error', en: 'Error' },
  stUploading: { es: 'Subiendo {done}/{total}', en: 'Uploading {done}/{total}' },
  srcCelular: { es: 'Recorrido', en: 'Walk' },
  srcDron: { es: 'Dron', en: 'Drone' },
  srcCamara: { es: 'GoPro / cámara', en: 'GoPro / camera' },
  srcFoto: { es: 'Foto individual', en: 'Single photo' },
  images: { es: '{count} imágenes', en: '{count} images' },
  findings: { es: '{count} hallazgos', en: '{count} findings' },
  noOrchard: { es: 'Zona sin huerta asignada', en: 'Area without orchard' },
  noLocation: { es: 'Sin ubicación', en: 'No location' },
  onMap: { es: 'Ver en el mapa', en: 'View on map' },
  viewResults: { es: 'Ver resultados', en: 'View results' },
  viewActivity: { es: 'Ver en Actividad', en: 'View in Activity' },
  uploadNow: { es: 'Subir ahora', en: 'Upload now' },
  offline: { es: 'Sin conexión: se subirán al recuperar la señal.', en: 'Offline: they will upload when you are back online.' },
  wifiRequired: { es: 'Se subirán con WiFi (o activa los datos móviles en Mis recorridos).', en: 'They will upload on WiFi (or allow mobile data in My walks).' },
  syncTitle: { es: '{count} escaneo(s) en el celular', en: '{count} scan(s) on this phone' },
  syncing: { es: 'Subiendo al servidor…', en: 'Uploading to the server…' },
  empty: { es: 'Aún no tienes escaneos. Inicia uno desde Escanear.', en: 'No scans yet. Start one from Scan.' },
  emptyFilter: { es: 'No hay escaneos con este estado.', en: 'No scans with this status.' },
  loadError: { es: 'No pudimos cargar todos tus escaneos. Desliza hacia abajo para reintentar.', en: 'We could not load all your scans. Pull down to retry.' },
  layerSat: { es: 'Satélite', en: 'Satellite' },
  layerHybrid: { es: 'Híbrido', en: 'Hybrid' },
  layerMap: { es: 'Mapa', en: 'Map' },
  zoomIn: { es: 'Acercar', en: 'Zoom in' },
  zoomOut: { es: 'Alejar', en: 'Zoom out' },
  locate: { es: 'Mi ubicación', en: 'My location' },
  fit: { es: 'Ver todos', en: 'View all' },
  expand: { es: 'Ampliar mapa', en: 'Expand map' },
  collapse: { es: 'Reducir mapa', en: 'Collapse map' },
  locDenied: { es: 'Activa la ubicación para verte en el mapa.', en: 'Turn on location to see yourself on the map.' },
  close: { es: 'Cerrar', en: 'Close' },
  confidence: { es: 'Confianza {pct}%', en: 'Confidence {pct}%' },
  locked: { es: 'Crea una cuenta para ver tus escaneos en el mapa.', en: 'Create an account to see your scans on the map.' },
  signIn: { es: 'Crear cuenta / Iniciar sesión', en: 'Create account / Sign in' },
  noMapScans: { es: 'Tus escaneos con GPS aparecerán aquí.', en: 'Your scans with GPS will appear here.' },
};

type Filter = 'all' | 'listo' | 'proceso' | 'cola' | 'local';
type Kind = 'remoto' | 'local' | 'foto';

type ScanItem = {
  id: string;
  kind: Kind;
  status: ScanStatus;
  date: string;
  fuente: Fuente | 'foto';
  photos: number | null;
  findings: number | null;
  orchardId: string | null;
  loc: ScansMapPoint | null;
  route: ScansMapPoint[];
  thumb: ImageSourcePropType | null;
  remoteId?: string;
  localId?: string;
  result?: { fruto: string | null; label: string | null; score: number | null };
};

// La tabla scans no tiene columna id: se identifica cada foto por su fecha y su posición.
type SingleScan = { fruto: string | null; label: string | null; score: number | null; created_at: string };

function centroid(points: ScansMapPoint[]): ScansMapPoint | null {
  const valid = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && !(p.lat === 0 && p.lng === 0));
  if (!valid.length) return null;
  return { lat: valid.reduce((a, p) => a + p.lat, 0) / valid.length, lng: valid.reduce((a, p) => a + p.lng, 0) / valid.length };
}

function remoteStatus(estado: RecorridoRemoto['estado']): ScanStatus {
  return estado === 'listo' ? 'listo' : estado === 'procesando' ? 'proceso' : estado === 'error' ? 'error' : 'cola';
}

function SourceIcon({ fuente, size = 14, color = SCAN.ink }: { fuente: ScanItem['fuente']; size?: number; color?: string }) {
  if (fuente === 'dron') return <Plane size={size} color={color} />;
  if (fuente === 'camara') return <Video size={size} color={color} />;
  if (fuente === 'foto') return <Camera size={size} color={color} />;
  return <Smartphone size={size} color={color} />;
}

export default function MisEscaneos() {
  const t = useTranslations(translations);
  const { language, locale } = useLanguage();
  const { isGuest } = useGuest();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const params = useLocalSearchParams<{ n?: string; focus?: string }>();
  const isTablet = width >= 768;

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const email = user?.email ?? '';
  const uid = user?.uid ?? '';
  const [tokens, setTokens] = useState<number | null>(null);
  const [orchards, setOrchards] = useState<Orchard[]>([]);
  const [remotes, setRemotes] = useState<RecorridoRemoto[]>([]);
  const [locals, setLocals] = useState<RecorridoLocal[]>([]);
  const [singles, setSingles] = useState<SingleScan[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ route: ScansMapPoint[]; findings: { lat: number; lng: number; healthy: boolean }[] } | null>(null);
  const [layer, setLayer] = useState<ScansMapLayer>('satelite');
  const [me, setMe] = useState<ScansMapPoint | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState<Record<string, { done: number; total: number }>>({});
  const [syncNote, setSyncNote] = useState<'offline' | 'wifi-required' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const mapRef = useRef<ScansMapHandle>(null);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useFocusEffect(useCallback(() => { setStatusBarStyle('dark'); }, []));

  // ───────── datos ─────────
  const load = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setLoadError(false);
    let failed = false;
    await recoverInterrupted(email).catch(() => {});
    const [o, r, l, sc, tk] = await Promise.all([
      listOrchards(email).catch(() => { failed = true; return [] as Orchard[]; }),
      listRemote(email, 50).catch(() => { failed = true; return [] as RecorridoRemoto[]; }),
      listLocal(email).catch(() => [] as RecorridoLocal[]),
      // Igual que Inicio y Actividad: las fotos individuales se guardan con el uid de Firebase (user_id).
      Promise.resolve(supabase.from('scans').select('fruto,label,score,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(30))
        .then(({ data, error }) => { if (error) { failed = true; return [] as SingleScan[]; } return (data ?? []) as SingleScan[]; })
        .catch(() => { failed = true; return [] as SingleScan[]; }),
      Promise.resolve(supabase.from('users').select('tokens').eq('user_email', email).maybeSingle())
        .then(({ data }) => (data?.tokens ?? null) as number | null).catch(() => null),
    ]);
    setOrchards(o);
    setRemotes(r);
    setLocals(l.filter(x => x.fotos.length > 0));
    setSingles(sc);
    setTokens(tk);
    setLoadError(failed);
    setLoading(false);
    // Miniatura real de cada escaneo terminado: la primera foto con hallazgo (una sola consulta).
    const doneIds = r.filter(x => x.estado === 'listo' && x.hallazgos_total > 0).map(x => x.id);
    if (doneIds.length) {
      const { data } = await supabase.from('hallazgos').select('recorrido_id,miniatura_path,tomada_at')
        .in('recorrido_id', doneIds).not('miniatura_path', 'is', null).order('tomada_at', { ascending: true }).limit(500);
      const map: Record<string, string> = {};
      for (const h of (data ?? []) as Array<{ recorrido_id: string; miniatura_path: string }>) if (!map[h.recorrido_id]) map[h.recorrido_id] = h.miniatura_path;
      setThumbs(map);
    }
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
    const id = setInterval(() => { listRemote(email, 50).then(setRemotes).catch(() => {}); }, 30000);
    return () => clearInterval(id);
  }, [email, remotes]);

  // ───────── escaneos unificados ─────────
  const orchardName = useCallback((id: string | null) => orchards.find(o => o.id === id)?.nombre ?? null, [orchards]);

  const items = useMemo<ScanItem[]>(() => {
    const out: ScanItem[] = [];
    for (const rec of locals) {
      const route = rec.ruta.length ? rec.ruta.map(p => ({ lat: p.lat, lng: p.lng }))
        : rec.fotos.filter(f => f.lat != null && f.lng != null).map(f => ({ lat: f.lat as number, lng: f.lng as number }));
      const first = rec.fotos.find(f => f.uri);
      out.push({
        id: `local:${rec.localId}`, kind: 'local', status: 'local', date: rec.iniciadoAt, fuente: rec.fuente ?? 'celular',
        photos: rec.fotos.length, findings: null, orchardId: rec.huertaId, loc: centroid(route), route,
        thumb: first ? { uri: first.uri } : null, localId: rec.localId,
      });
    }
    for (const r of remotes) {
      const route = (r.ruta ?? []).map(p => ({ lat: p.lat, lng: p.lng }));
      const thumbPath = thumbs[r.id];
      out.push({
        id: `remote:${r.id}`, kind: 'remoto', status: remoteStatus(r.estado), date: r.iniciado_at, fuente: r.fuente ?? 'celular',
        photos: r.fotos_total, findings: r.estado === 'listo' ? r.hallazgos_total : null, orchardId: r.huerta_id,
        loc: centroid(route), route, thumb: thumbPath ? thumbnailSource(thumbPath) : null, remoteId: r.id,
      });
    }
    for (const [i, sc] of singles.entries()) {
      out.push({
        id: `foto:${sc.created_at}:${i}`, kind: 'foto', status: 'listo', date: sc.created_at, fuente: 'foto', photos: 1, findings: null,
        orchardId: null, loc: null, route: [], thumb: null, result: { fruto: sc.fruto, label: sc.label, score: sc.score },
      });
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [locals, remotes, singles, thumbs]);

  // Número de cada escaneo con ubicación (el mismo en el mapa y en el historial).
  const numbers = useMemo(() => {
    const m: Record<string, number> = {};
    let n = 0;
    for (const it of items) if (it.loc) m[it.id] = ++n;
    return m;
  }, [items]);

  const mapData = useMemo<ScansMapData>(() => ({
    polygons: orchards.filter(o => o.coordinates?.length >= 3).map(o => ({
      id: String(o.id), name: o.nombre, points: o.coordinates.map(c => ({ lat: c.latitude, lng: c.longitude })),
    })),
    markers: items.filter(it => it.loc).map(it => ({ id: it.id, lat: it.loc!.lat, lng: it.loc!.lng, status: it.status, n: numbers[it.id] })),
    // Con un escaneo elegido, el panel tapa la parte baja del mapa.
    pad: { top: 8, bottom: selectedId ? 170 : 24, right: 64 },
  }), [orchards, items, numbers, selectedId]);

  const visible = useMemo(() => items.filter(it => filter === 'all' || it.status === filter || (filter === 'cola' && it.status === 'error')), [items, filter]);
  const selected = items.find(it => it.id === selectedId) ?? null;
  const pendingLocal = locals.length;

  // ───────── selección ─────────
  const select = useCallback(async (id: string | null, from: 'map' | 'list' = 'map') => {
    setSelectedId(id);
    setDetail(null);
    if (!id) return;
    Haptics.selectionAsync().catch(() => {});
    const it = items.find(x => x.id === id);
    if (!it) return;
    if (from === 'list') scrollRef.current?.scrollTo({ y: 0, animated: !reduced });
    if (it.kind === 'remoto' && it.status === 'listo' && it.remoteId && email) {
      const hs = await listHallazgos(it.remoteId, email).catch(() => []);
      setDetail({ route: it.route, findings: hs.filter(h => h.lat != null && h.lng != null).map(h => ({ lat: h.lat as number, lng: h.lng as number, healthy: isHealthy(h.estado) })) });
    } else if (it.route.length) {
      setDetail({ route: it.route, findings: [] });
    }
  }, [items, email, reduced]);

  // Abrir con un escaneo concreto (p. ej. al volver de una importación).
  useEffect(() => {
    if (params.focus && items.some(i => i.id === params.focus)) select(params.focus, 'list');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.focus, items.length]);

  const locate = useCallback(async () => {
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) { setNotice(t('locDenied')); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setTimeout(() => mapRef.current?.flyToUser(), 50);
    } catch {
      setNotice(t('locDenied'));
    }
  }, [t]);

  // Si ya hay permiso de ubicación, se muestra el punto del usuario sin preguntar.
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(p => {
      if (p.granted) Location.getLastKnownPositionAsync().then(pos => { if (pos) setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }); }).catch(() => {});
    }).catch(() => {});
  }, []);

  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(null), 2600); return () => clearTimeout(id); }, [notice]);

  const cycleLayer = () => {
    const next: ScansMapLayer = layer === 'satelite' ? 'hibrido' : layer === 'hibrido' ? 'mapa' : 'satelite';
    Haptics.selectionAsync().catch(() => {});
    setLayer(next);
    setNotice(next === 'satelite' ? t('layerSat') : next === 'hibrido' ? t('layerHybrid') : t('layerMap'));
  };

  const statusText = (it: ScanItem) => {
    if (it.localId && progress[it.localId]) return t('stUploading', { done: progress[it.localId].done, total: progress[it.localId].total });
    return it.status === 'listo' ? t('stListo') : it.status === 'proceso' ? t('stProceso') : it.status === 'cola' ? t('stCola') : it.status === 'local' ? t('stLocal') : t('stError');
  };
  const sourceText = (f: ScanItem['fuente']) => f === 'dron' ? t('srcDron') : f === 'camara' ? t('srcCamara') : f === 'foto' ? t('srcFoto') : t('srcCelular');
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const titleOf = (it: ScanItem) => it.kind === 'foto' && it.result
    ? localizeDomainLabel(it.result.fruto, language)
    : orchardName(it.orchardId) ?? t('noOrchard');

  const openResults = (it: ScanItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (it.kind === 'remoto' && it.remoteId) router.push({ pathname: '/(app)/recorrido', params: { id: it.remoteId, from: 'escaneos', n: String(Date.now()) } });
    else if (it.kind === 'foto') router.navigate('/(app)/results');
    else sync(true);
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

  const mapH = Math.round(expanded ? height * 0.7 : Math.max(height * 0.46, 360));
  const tabSpace = (isTablet ? 82 + 24 : 72 + 18) + 24 + insets.bottom;
  const tokensValue = tokens != null ? (tokens * 100).toLocaleString(locale) : null;

  return (
    <View style={st.screen}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: tabSpace }}
        showsVerticalScrollIndicator={false}
        scrollEnabled
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load().then(() => sync(false))} tintColor={SCAN.brand} progressViewOffset={insets.top + 20} />}
      >
        {/* ── Encabezado (sobre blanco, como el resto de la app) ── */}
        <View style={[st.header, { paddingTop: insets.top + 8 }]}>
          <View style={st.headerRow}>
            <PressableScale style={st.back} onPress={() => (router.canGoBack() ? router.back() : router.navigate('/(app)/scan'))} accessibilityRole="button" accessibilityLabel={t('back')}>
              <ChevronLeft size={22} color={SCAN.ink} />
            </PressableScale>
            <View style={{ flex: 1 }}><ScanHeader tokensValue={tokensValue} /></View>
          </View>
          <Text style={st.title} accessibilityRole="header">{t('title')}</Text>
          <Text style={st.subtitle}>{t('subtitle')}</Text>
        </View>

        {/* ── Mapa protagonista (tarjeta) ── */}
        <Reanimated.View layout={reduced ? undefined : MAP_RESIZE} style={[st.mapShadow, { height: mapH }]}>
        <View style={st.mapBox}>
          <ScansMap
            ref={mapRef}
            data={mapData}
            selectedId={selected?.loc ? selectedId : null}
            detail={detail}
            user={me}
            layer={layer}
            onSelect={id => select(id, 'map')}
          />
          {/* controles del mapa */}
          <View style={st.controls}>
            <MapButton label={t('locate')} onPress={locate}><Navigation size={18} color={SCAN.ink} /></MapButton>
            <MapButton label={`${t('layerSat')} / ${t('layerHybrid')} / ${t('layerMap')}`} onPress={cycleLayer}><Layers size={18} color={SCAN.ink} /></MapButton>
            <View style={st.zoom}>
              <MapButton label={t('zoomIn')} onPress={() => mapRef.current?.zoom(1)} flat><Plus size={18} color={SCAN.ink} /></MapButton>
              <View style={st.zoomSep} />
              <MapButton label={t('zoomOut')} onPress={() => mapRef.current?.zoom(-1)} flat><Minus size={18} color={SCAN.ink} /></MapButton>
            </View>
            <MapButton label={t('fit')} onPress={() => mapRef.current?.fitAll()}><LocateFixed size={18} color={SCAN.ink} /></MapButton>
            <MapButton label={expanded ? t('collapse') : t('expand')} onPress={() => { Haptics.selectionAsync().catch(() => {}); setExpanded(e => !e); }}>
              {expanded ? <Minimize2 size={17} color={SCAN.ink} /> : <Maximize2 size={17} color={SCAN.ink} />}
            </MapButton>
          </View>

          {notice && (
            <Reanimated.View entering={FadeIn.duration(160)} style={st.notice} pointerEvents="none">
              <Text style={st.noticeText}>{notice}</Text>
            </Reanimated.View>
          )}

          {!mapData.markers.length && !loading && (
            <View style={st.mapEmpty} pointerEvents="none"><MapPin size={14} color={SCAN.muted} /><Text style={st.mapEmptyText}>{t('noMapScans')}</Text></View>
          )}

          {/* panel del escaneo seleccionado */}
          {selected && (
            <Reanimated.View key={selected.id} entering={reduced ? FadeIn.duration(150) : PANEL_IN} exiting={reduced ? undefined : PANEL_OUT} style={st.panel}>
              <View style={st.panelRow}>
                <Thumb item={selected} size={72} />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={st.panelTitleRow}>
                    <View style={[st.dot, { backgroundColor: SCAN_STATUS_COLOR[selected.status] }]} />
                    <Text style={st.panelTitle} numberOfLines={1}>{titleOf(selected)}</Text>
                  </View>
                  <Text style={st.panelMeta}>{fmtDate(selected.date)}</Text>
                  <View style={st.panelSrc}>
                    <SourceIcon fuente={selected.fuente} size={13} color={SCAN.muted} />
                    <Text style={st.panelMeta}>
                      {sourceText(selected.fuente)}
                      {selected.kind !== 'foto' && selected.photos != null ? ` · ${t('images', { count: selected.photos })}` : ''}
                      {selected.findings != null ? ` · ${t('findings', { count: selected.findings })}` : ''}
                    </Text>
                  </View>
                  {selected.result && (
                    <Text style={[st.panelMeta, { color: isHealthy(selected.result.label ?? '') ? STATUS_INK.listo : SCAN.red }]}>
                      {localizeDomainLabel(selected.result.label, language)}{selected.result.score !== null ? ` · ${t('confidence', { pct: Math.round(selected.result.score * 100) })}` : ''}
                    </Text>
                  )}
                  <StatusChip item={selected} text={statusText(selected)} />
                </View>
                <PressableScale style={st.close} onPress={() => select(null)} accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={10}>
                  <X size={16} color={SCAN.muted} />
                </PressableScale>
              </View>
              <PressableScale
                style={st.panelBtn}
                onPress={() => openResults(selected)}
                accessibilityRole="button"
                disabled={selected.kind === 'local' && syncing}
              >
                {selected.kind === 'local'
                  ? (syncing ? <ActivityIndicator size="small" color={SCAN.limeInk} /> : <CloudUpload size={18} color={SCAN.limeInk} />)
                  : <BarChart3 size={18} color={SCAN.limeInk} />}
                <Text style={st.panelBtnText}>
                  {selected.kind === 'local' ? t('uploadNow') : selected.kind === 'foto' ? t('viewActivity') : t('viewResults')}
                </Text>
              </PressableScale>
            </Reanimated.View>
          )}
        </View>
        </Reanimated.View>

        {/* ── Sincronización ── */}
        {pendingLocal > 0 && (
          <Reanimated.View entering={reduced ? undefined : LIST_IN} style={st.sync}>
            <View style={st.syncIcon}>{syncing ? <ActivityIndicator size="small" color={SCAN.sky} /> : <CloudUpload size={18} color={SCAN.sky} />}</View>
            <View style={{ flex: 1 }}>
              <Text style={st.syncTitle}>{t('syncTitle', { count: pendingLocal })}</Text>
              <Text style={st.syncText}>{syncing ? t('syncing') : syncNote === 'offline' ? t('offline') : syncNote === 'wifi-required' ? t('wifiRequired') : t('stLocal')}</Text>
            </View>
            {!syncing && (
              <PressableScale style={st.syncBtn} onPress={() => sync(true)} accessibilityRole="button" accessibilityLabel={t('uploadNow')}>
                <Text style={st.syncBtnText}>{t('uploadNow')}</Text>
              </PressableScale>
            )}
          </Reanimated.View>
        )}

        {/* ── Historial ── */}
        <View style={st.historyHead}>
          <Text style={st.historyTitle}>{t('history')}</Text>
          <Text style={st.historyCount}>{visible.length}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filters}>
          {([['all', t('all')], ['listo', t('done')], ['proceso', t('processing')], ['cola', t('queued')], ['local', t('local')]] as Array<[Filter, string]>).map(([key, label]) => {
            const on = filter === key;
            return (
              <PressableScale
                key={key}
                onPress={() => { if (!on) Haptics.selectionAsync().catch(() => {}); setFilter(key); }}
                style={[st.filter, on && st.filterOn, { transitionProperty: ['backgroundColor', 'borderColor'], transitionDuration: 160, transitionTimingFunction: CSS_EASE_OUT } as object]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                {key !== 'all' && <View style={[st.dot, { backgroundColor: STATUS_INK[key as ScanStatus] }]} />}
                <Text style={[st.filterText, on && st.filterTextOn]}>{label}</Text>
              </PressableScale>
            );
          })}
        </ScrollView>

        {loadError && <Text style={st.error}>{t('loadError')}</Text>}
        {loading && !items.length ? <ActivityIndicator color={SCAN.brand} style={{ marginTop: 24 }} /> : null}
        {!loading && !items.length && <Text style={st.empty}>{t('empty')}</Text>}
        {!!items.length && !visible.length && <Text style={st.empty}>{t('emptyFilter')}</Text>}

        <View style={st.list}>
          {visible.map(it => (
            <Reanimated.View key={it.id} entering={reduced ? undefined : LIST_IN} layout={reduced ? undefined : MAP_RESIZE}>
              <PressableScale
                style={[st.card, it.id === selectedId && st.cardOn]}
                onPress={() => select(it.id, 'list')}
                accessibilityRole="button"
                accessibilityLabel={`${titleOf(it)}, ${fmtDate(it.date)}, ${statusText(it)}`}
              >
                <Thumb item={it} size={96} number={numbers[it.id]} />
                <View style={st.cardBody}>
                  <View style={st.cardTop}>
                    <Text style={st.cardTitle} numberOfLines={1}>{titleOf(it)}</Text>
                    <ChevronRight size={18} color={SCAN.muted} />
                  </View>
                  <Text style={st.cardMeta}>{fmtDate(it.date)}</Text>
                  <View style={st.panelSrc}>
                    <SourceIcon fuente={it.fuente} size={13} color={SCAN.muted} />
                    <Text style={st.cardMeta} numberOfLines={1}>
                      {sourceText(it.fuente)}
                      {it.kind !== 'foto' && it.photos != null ? ` · ${t('images', { count: it.photos })}` : ''}
                    </Text>
                  </View>
                  <View style={st.cardBottom}>
                    <StatusChip item={it} text={statusText(it)} />
                    <View style={st.locRow}>
                      <MapPin size={12} color={it.loc ? STATUS_INK.listo : SCAN.muted} />
                      <Text style={[st.locText, it.loc && { color: STATUS_INK.listo }]}>{it.loc ? t('onMap') : t('noLocation')}</Text>
                    </View>
                  </View>
                  {it.localId && progress[it.localId] && (
                    <View style={st.track}>
                      <Reanimated.View
                        style={[st.fill, {
                          width: `${(progress[it.localId].done / Math.max(1, progress[it.localId].total)) * 100}%`,
                          transitionProperty: 'width', transitionDuration: 300, transitionTimingFunction: CSS_EASE_OUT,
                        }]}
                      />
                    </View>
                  )}
                </View>
              </PressableScale>
            </Reanimated.View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ───────── piezas ─────────

function MapButton({ label, onPress, children, flat }: { label: string; onPress: () => void; children: React.ReactNode; flat?: boolean }) {
  return (
    <PressableScale style={[st.mapBtn, flat && st.mapBtnFlat]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4}>
      {children}
    </PressableScale>
  );
}

function StatusChip({ item, text }: { item: ScanItem; text: string }) {
  const c = STATUS_INK[item.status];
  return (
    <View style={[st.chip, { backgroundColor: `${c}22`, borderColor: `${c}66` }]}>
      {item.status === 'listo' ? <ScanLine size={11} color={c} /> : <View style={[st.dot, { backgroundColor: c }]} />}
      <Text style={[st.chipText, { color: c }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

/** Miniatura real del escaneo (hallazgo o foto local); si no hay imagen, un mosaico con el icono de la fuente. */
function Thumb({ item, size, number }: { item: ScanItem; size: number; number?: number }) {
  const [failed, setFailed] = useState(false);
  const c = SCAN_STATUS_COLOR[item.status];
  return (
    <View style={[st.thumb, { width: size, height: size }]}>
      {item.thumb && !failed ? (
        <Image source={item.thumb} style={st.thumbImg} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      ) : (
        <LinearGradient colors={['#F0FDF4', '#E2E8F0']} style={[StyleSheet.absoluteFill, st.thumbEmpty]}>
          <SourceIcon fuente={item.fuente} size={26} color={STATUS_INK[item.status]} />
        </LinearGradient>
      )}
      {number != null && <View style={[st.num, { backgroundColor: c }]}><Text style={st.numText}>{number}</Text></View>}
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SCAN.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 },
  lockText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: SCAN.ink, textAlign: 'center' },
  lockBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, backgroundColor: SCAN.limeBright },
  lockBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: SCAN.limeInk },
  header: { paddingHorizontal: 16, paddingBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: SCAN.surface, borderWidth: 1, borderColor: SCAN.line },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 34, lineHeight: 42, letterSpacing: -1, color: SCAN.ink, marginTop: 10 },
  subtitle: { fontFamily: 'Poppins_400Regular', fontSize: 15, color: '#52606D' },
  // Tarjeta del mapa: sombra afuera, recorte adentro.
  mapShadow: { marginHorizontal: 16, borderRadius: 28, backgroundColor: '#E2E8F0', ...CARD_SHADOW },
  mapBox: { flex: 1, borderRadius: 28, overflow: 'hidden' },
  controls: { position: 'absolute', top: 12, right: 12, gap: 8, alignItems: 'center' },
  mapBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: SCAN.glass, borderWidth: 1, borderColor: SCAN.line,
    shadowColor: '#0f172a', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  mapBtnFlat: { backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0 },
  zoom: { borderRadius: 21, backgroundColor: SCAN.glass, borderWidth: 1, borderColor: SCAN.line, overflow: 'hidden' },
  zoomSep: { height: 1, backgroundColor: SCAN.line, marginHorizontal: 8 },
  notice: { position: 'absolute', alignSelf: 'center', top: '42%', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: SCAN.glass, borderWidth: 1, borderColor: SCAN.line },
  noticeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: SCAN.ink },
  mapEmpty: { position: 'absolute', alignSelf: 'center', bottom: 18, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: SCAN.glass },
  mapEmptyText: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: SCAN.inkSoft },
  panel: {
    position: 'absolute', left: 10, right: 10, bottom: 10, padding: 10, gap: 10, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.97)', borderWidth: 1, borderColor: SCAN.line,
    shadowColor: '#0f172a', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  panelRow: { flexDirection: 'row', gap: 12 },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingRight: 24 },
  panelTitle: { flex: 1, fontFamily: 'Poppins_700Bold', fontSize: 16.5, color: SCAN.ink },
  panelMeta: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: SCAN.muted },
  panelSrc: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  close: { position: 'absolute', right: -2, top: -2, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: SCAN.surface },
  panelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: 16,
    backgroundColor: SCAN.limeBright,
  },
  panelBtnText: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: SCAN.limeInk },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1, maxWidth: '100%' },
  chipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11 },
  sync: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 16, padding: 12, borderRadius: 20,
    backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD',
  },
  syncIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E0F2FE' },
  syncTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: SCAN.ink },
  syncText: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 17, color: SCAN.muted },
  syncBtn: { paddingHorizontal: 12, minHeight: 38, justifyContent: 'center', borderRadius: 12, backgroundColor: SCAN.sky },
  syncBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: '#ffffff' },
  historyHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 18, marginTop: 22 },
  historyTitle: { fontFamily: 'Poppins_700Bold', fontSize: 19, color: SCAN.ink, letterSpacing: -0.3 },
  historyCount: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: SCAN.muted },
  filters: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: SCAN.line, backgroundColor: SCAN.surface },
  filterOn: { backgroundColor: SCAN.limeSoft, borderColor: SCAN.lime },
  filterText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: SCAN.muted },
  filterTextOn: { color: SCAN.limeInk },
  error: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: SCAN.red, paddingHorizontal: 18, marginBottom: 8 },
  empty: { fontFamily: 'Poppins_400Regular', fontSize: 13.5, lineHeight: 20, color: SCAN.muted, textAlign: 'center', paddingHorizontal: 30, marginTop: 18 },
  list: { gap: 12, paddingHorizontal: 16 },
  card: { flexDirection: 'row', gap: 12, padding: 10, borderRadius: 24, backgroundColor: SCAN.card, borderWidth: 1, borderColor: '#EEF2F7', ...CARD_SHADOW, shadowOpacity: 0.08 },
  cardOn: { borderColor: SCAN.lime },
  cardBody: { flex: 1, gap: 3, paddingVertical: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { flex: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 15.5, color: SCAN.ink },
  cardMeta: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: SCAN.muted },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: SCAN.muted },
  track: { height: 5, borderRadius: 3, backgroundColor: '#E2E8F0', marginTop: 6, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3, backgroundColor: SCAN.sky },
  thumb: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#F1F5F9' },
  thumbImg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  num: { position: 'absolute', left: 6, top: 6, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff' },
  numText: { fontFamily: 'Poppins_700Bold', fontSize: 11, color: '#0B1A05' },
});
