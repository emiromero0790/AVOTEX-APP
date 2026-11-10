/**
 * Detalle del hallazgo — un solo hallazgo de un recorrido inteligente como protagonista.
 *
 * Datos reales (hallazgos por id + user_email): estado, fruto, confianza, confianza_fruto, fotos_en_grupo,
 * miniatura_path, lat/lng y tomada_at. Recorrido, huerta y otros hallazgos solo del MISMO recorrido.
 * - Imágenes: solo las que existen y se pueden abrir (hoy, la miniatura del hallazgo; las fotos
 *   originales se borran tras el análisis). Sin imagen → estado vacío, nunca una foto genérica.
 * - Explicación y recomendaciones: catálogo controlado (services/diagnosticos.ts), sin productos ni dosis.
 * - Ubicación: solo coordenadas válidas; sin GPS → "Ubicación no disponible".
 *
 * Movimiento (animate-expo): el panel entra sobre la foto con un desplazamiento corto, las secciones
 * aparecen en cascada, los desplegables se abren con transición de layout y hay vibración discreta.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Reanimated, { FadeIn, FadeInDown, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import {
  AlertTriangle, Bug, Calendar, Camera, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock, Expand, FileText, ImageOff,
  Images, Info, Leaf, Lightbulb, Map as MapIcon, MapPin, Route, Share2, Sprout, Stethoscope, Target, X,
} from 'lucide-react-native';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { auth as firebaseAuth } from '../../firebaseConfig';
import { localizeDomainLabel, TranslationResource, useLanguage, useTranslations } from '../../context/LanguageContext';
import { listOrchards, type Orchard } from '../../services/orchards';
import { getRemote, listHallazgos, type Hallazgo, type RecorridoRemoto } from '../../services/recorridos';
import {
  categoria, cleanRoute, getHallazgo, listRecorridoFotos, routeMeters, storageImage, validCoord,
  type CategoriaHallazgo, type FotoPunto, type HallazgoDetalle,
} from '../../services/escaneos';
import { getDiagnostico } from '../../services/diagnosticos';
import SatThumb from '../../components/escaneos/SatThumb';
import PhotoViewer from '../../components/hallazgo/PhotoViewer';
import ScansMap from '../../components/ScansMap';
import { FINDING_COLOR, type ScansMapData, type ScansMapDetail } from '../../components/scansMapHtml';
import { EASE_OUT } from '../../components/scan/motion';

const auth = firebaseAuth as Auth;

const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#EDF0EE';
const TEAL = '#0F766E';
const DEEP = '#166534';

const TONE: Record<CategoriaHallazgo, { ink: string; bg: string; soft: string; border: string }> = {
  enfermo: { ink: '#D9363E', bg: '#FFF4F3', soft: '#FFE3E1', border: '#FBD0CC' },
  revisar: { ink: '#B45309', bg: '#FFF8EC', soft: '#FDECC8', border: '#F9DCA0' },
  sano: { ink: '#15803D', bg: '#F0FBF3', soft: '#D7F5DF', border: '#BBEBC9' },
  otro: { ink: '#475569', bg: '#F4F6F8', soft: '#E7EBEF', border: '#DCE2E8' },
};

const T: TranslationResource = {
  title: { es: 'Detalle del hallazgo', en: 'Finding details' },
  back: { es: 'Volver', en: 'Back' },
  share: { es: 'Compartir', en: 'Share' },
  expand: { es: 'Ampliar foto', en: 'Enlarge photo' },
  close: { es: 'Cerrar', en: 'Close' },
  noImage: { es: 'Sin imagen para este hallazgo', en: 'No image for this finding' },
  noImageBody: { es: 'El análisis guardó el diagnóstico, pero no una miniatura.', en: 'The analysis saved the diagnosis but no thumbnail.' },
  modelConfidence: { es: 'Confianza del modelo', en: 'Model confidence' },
  crop: { es: 'Cultivo', en: 'Crop' },
  evidence: { es: 'Evidencia', en: 'Evidence' },
  grouped: { es: '{count} fotos agrupadas', en: '{count} grouped photos' },
  grouped1: { es: '1 foto', en: '1 photo' },
  stEnfermo: { es: 'Requiere atención', en: 'Needs attention' },
  stRevisar: { es: 'Revisar', en: 'Review' },
  stSano: { es: 'Sin señales de riesgo', en: 'No signs of risk' },
  stOtro: { es: 'Sin evaluar', en: 'Not assessed' },
  in: { es: 'en {crop}', en: 'on {crop}' },
  reviewNote: { es: 'Resultado incierto: la confianza del modelo es baja. Revisa las imágenes o vuelve a escanear este punto.', en: 'Uncertain result: model confidence is low. Check the images or scan this spot again.' },
  whatIs: { es: '¿Qué significa este resultado?', en: 'What does this result mean?' },
  symptoms: { es: 'Síntomas comunes', en: 'Common symptoms' },
  recs: { es: 'Recomendaciones generales', en: 'General recommendations' },
  noCatalog: { es: 'Aún no tenemos información de referencia para «{name}».', en: 'We do not have reference information for “{name}” yet.' },
  autoNote: { es: 'Este resultado es una evaluación automatizada y puede requerir confirmación en campo.', en: 'This result is an automated assessment and may need confirmation in the field.' },
  location: { es: 'Ubicación del hallazgo', en: 'Finding location' },
  coords: { es: 'Coordenadas', en: 'Coordinates' },
  dateTime: { es: 'Fecha y hora', en: 'Date and time' },
  viewMap: { es: 'Ver en mapa', en: 'View on map' },
  noLocation: { es: 'Ubicación no disponible', en: 'Location unavailable' },
  noLocationBody: { es: 'Esta foto no guardó GPS al tomarse.', en: 'This photo had no GPS when taken.' },
  evidenceTitle: { es: 'Evidencia del hallazgo', en: 'Finding evidence' },
  thumbCaption: { es: 'Miniatura guardada del hallazgo', en: 'Saved thumbnail of the finding' },
  groupNote: { es: 'Este hallazgo agrupa {count} fotos tomadas en el mismo punto; después del análisis se conserva una miniatura.', en: 'This finding groups {count} photos taken at the same spot; one thumbnail is kept after analysis.' },
  noEvidence: { es: 'No hay imágenes guardadas para este hallazgo.', en: 'No saved images for this finding.' },
  walk: { es: 'Recorrido asociado', en: 'Related walk' },
  walkKind: { es: 'Recorrido inteligente', en: 'Smart walk' },
  done: { es: 'Completado', en: 'Completed' },
  photos: { es: 'Fotos', en: 'Photos' },
  findings: { es: 'Hallazgos', en: 'Findings' },
  route: { es: 'Recorrido', en: 'Route' },
  noOrchard: { es: 'Sin huerta asignada', en: 'No orchard' },
  others: { es: 'Otros hallazgos en este recorrido', en: 'Other findings in this walk' },
  confidence: { es: 'Confianza {pct} %', en: 'Confidence {pct}%' },
  extra: { es: 'Información adicional', en: 'Additional information' },
  fruit: { es: 'Fruto', en: 'Fruit' },
  fruitConfidence: { es: 'Confianza del fruto', en: 'Fruit confidence' },
  findingType: { es: 'Tipo de hallazgo', en: 'Finding type' },
  catEnfermo: { es: 'Posible enfermedad', en: 'Possible disease' },
  catRevisar: { es: 'Resultado incierto', en: 'Uncertain result' },
  catSano: { es: 'Saludable', en: 'Healthy' },
  catOtro: { es: 'No es fruto', en: 'Not a fruit' },
  notAvailable: { es: 'No disponible', en: 'Not available' },
  quote: { es: '“Un diagnóstico temprano ayuda a proteger tu cultivo”', en: '“Early diagnosis helps protect your crop”' },
  quoteBy: { es: 'AVOTEX · Inteligencia agrícola', en: 'AVOTEX · Agricultural intelligence' },
  viewWalk: { es: 'Ver en recorrido', en: 'View in walk' },
  recommendations: { es: 'Recomendaciones', en: 'Recommendations' },
  whenVerify: { es: 'Cuándo confirmar', en: 'When to confirm' },
  recsNote: { es: 'Información general de referencia. No incluye productos ni dosis: para tratamientos consulta a un agrónomo.', en: 'General reference information. It does not include products or doses: ask an agronomist about treatments.' },
  noRecs: { es: 'Todavía no tenemos recomendaciones revisadas para este resultado.', en: 'We do not have reviewed recommendations for this result yet.' },
  notFound: { es: 'No encontramos este hallazgo', en: 'Finding not found' },
  notFoundBody: { es: 'Puede que se haya eliminado o que no pertenezca a tu cuenta.', en: 'It may have been deleted or may not belong to your account.' },
  loadError: { es: 'No se pudo cargar el hallazgo. Revisa tu conexión.', en: 'Could not load the finding. Check your connection.' },
  retry: { es: 'Reintentar', en: 'Retry' },
  shareText: { es: 'AVOTEX · {name} en {crop} (confianza del modelo {pct} %) · {date}', en: 'AVOTEX · {name} on {crop} (model confidence {pct}%) · {date}' },
  mapTitle: { es: 'Ubicación del hallazgo', en: 'Finding location' },
};

const tick = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };

type Load = { status: 'loading' } | { status: 'error' } | { status: 'notfound' } | {
  status: 'ok'; h: HallazgoDetalle; rec: RecorridoRemoto | null; others: Hallazgo[]; orchard: Orchard | null;
};

export default function HallazgoScreen() {
  const t = useTranslations(T);
  const { language, locale } = useLanguage();
  const lang = language === 'en' ? 'en' : 'es';
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const params = useLocalSearchParams<{ id?: string; n?: string }>();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const email = user?.email ?? '';
  const [state, setState] = useState<Load>({ status: 'loading' });
  const [open, setOpen] = useState<Record<string, boolean>>({ what: true, sym: false, recs: false });
  const [viewer, setViewer] = useState<number | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [recsOpen, setRecsOpen] = useState(false);
  const [fotos, setFotos] = useState<FotoPunto[] | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useFocusEffect(useCallback(() => { setStatusBarStyle('light'); return () => setStatusBarStyle('dark'); }, []));

  const load = useCallback(async () => {
    const id = params.id;
    if (!id || !email) return;
    setState({ status: 'loading' });
    setFotos(null);
    try {
      const h = await getHallazgo(id, email);
      if (!h) { setState({ status: 'notfound' }); return; }
      // Solo datos del mismo recorrido y del mismo usuario.
      const [rec, all, orchards] = await Promise.all([
        getRemote(h.recorrido_id, email).catch(() => null),
        listHallazgos(h.recorrido_id, email).catch(() => [] as Hallazgo[]),
        listOrchards(email).catch(() => [] as Orchard[]),
      ]);
      const orchardId = h.huerta_id ?? rec?.huerta_id ?? null;
      setState({ status: 'ok', h, rec, others: all.filter(x => x.id !== h.id), orchard: orchards.find(o => o.id === orchardId) ?? null });
    } catch {
      setState({ status: 'error' });
    }
  }, [params.id, email]);

  useEffect(() => { void load(); }, [load, params.n]);

  const goBack = () => {
    tick();
    if (router.canGoBack()) router.back(); else router.navigate('/(app)/escaneos');
  };

  const narrow = width < 380;
  const heroH = Math.round(Math.min(380, Math.max(240, height * 0.34)));

  // ── Cargando / errores ──
  if (state.status !== 'ok') {
    return (
      <View style={st.screen}>
        <View style={[st.heroEmpty, { height: heroH }]}>
          <LinearGradient colors={['#0B2A1C', '#123B28']} style={StyleSheet.absoluteFill} />
          <TopBar t={t} insetsTop={insets.top} onBack={goBack} />
        </View>
        <View style={[st.panel, { marginTop: -26, flex: 1 }]}>
          {state.status === 'loading' ? (
            <View style={{ padding: 20, gap: 12 }}>
              <View style={[st.skel, { height: 84 }]} /><View style={[st.skel, { height: 56 }]} /><View style={[st.skel, { height: 120 }]} />
              <ActivityIndicator color={TEAL} style={{ marginTop: 8 }} />
            </View>
          ) : (
            <View style={st.stateBox}>
              <CircleHelp size={30} color={MUTED} />
              <Text style={st.stateTitle}>{state.status === 'notfound' ? t('notFound') : t('loadError')}</Text>
              {state.status === 'notfound' && <Text style={st.stateBody}>{t('notFoundBody')}</Text>}
              <Pressable onPress={state.status === 'notfound' ? goBack : () => void load()} accessibilityRole="button" style={({ pressed }) => [st.btnFill, { marginTop: 14, paddingHorizontal: 24 }, pressed && st.pressed]}>
                <Text style={st.btnFillText}>{state.status === 'notfound' ? t('back') : t('retry')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    );
  }

  const { h, rec, others, orchard } = state;
  const cat = categoria(h);
  const tone = TONE[cat];
  const diag = getDiagnostico(h.estado, h.fruto);
  const name = cat === 'otro' ? t('catOtro') : localizeDomainLabel(h.estado, language) ?? h.estado;
  const crop = localizeDomainLabel(h.fruto, language) ?? h.fruto;
  const pct = Math.round((h.confianza ?? 0) * 100);
  const geo = validCoord(h.lat, h.lng);
  const point = geo ? { lat: h.lat as number, lng: h.lng as number } : null;
  const when = new Date(h.tomada_at);
  const dateText = when.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const timeText = when.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  // Imágenes navegables: solo las que existen de verdad.
  const images = h.miniatura_path ? [{ source: storageImage(h.miniatura_path), caption: t('thumbCaption') }] : [];
  const statusText = cat === 'enfermo' ? t('stEnfermo') : cat === 'revisar' ? t('stRevisar') : cat === 'sano' ? t('stSano') : t('stOtro');
  const catText = cat === 'enfermo' ? t('catEnfermo') : cat === 'revisar' ? t('catRevisar') : cat === 'sano' ? t('catSano') : t('catOtro');
  const Icon = cat === 'enfermo' ? Bug : cat === 'sano' ? Leaf : cat === 'revisar' ? AlertTriangle : CircleHelp;
  const route = cleanRoute(rec?.ruta);
  const orchardPts = (orchard?.coordinates ?? []).filter(c => validCoord(c.latitude, c.longitude)).map(c => ({ lat: c.latitude, lng: c.longitude }));
  const enter = (i: number) => (reduced ? undefined : FadeInDown.duration(260).delay(80 + i * 50).easing(EASE_OUT));

  const share = async () => {
    tick();
    const msg = t('shareText', { name, crop, pct, date: `${dateText} ${timeText}` }) + (point ? `\nhttps://maps.google.com/?q=${point.lat.toFixed(6)},${point.lng.toFixed(6)}` : '');
    try { await Share.share({ message: msg }); } catch { /* cancelado o no disponible */ }
  };
  const canShare = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && 'share' in navigator);

  const viewInWalk = () => {
    tick();
    router.navigate({ pathname: '/(app)/escaneos', params: { focus: `remote:${h.recorrido_id}`, point: h.id, n: String(Date.now()) } });
  };
  const openMap = () => {
    tick();
    setMapOpen(true);
    if (!fotos) listRecorridoFotos(h.recorrido_id).then(setFotos).catch(() => setFotos([]));
  };

  const mapData: ScansMapData = {
    orchards: orchard && orchardPts.length > 2 ? [{ id: orchard.id, name: orchard.nombre, points: orchardPts }] : [],
    scans: [], routes: [], zones: [],
    focusOrchard: orchard?.id ?? null, fitKey: h.id,
    pad: { top: insets.top + 64, right: 16, bottom: 90, left: 16 },
    show: { routes: true, photos: true, findings: true, orchards: true },
    reduced,
  };
  const mapDetail: ScansMapDetail = {
    id: `remote:${h.recorrido_id}`,
    route,
    photos: (fotos ?? []).map((p, i) => ({ id: p.id, lat: p.lat, lng: p.lng, n: i + 1 })),
    findings: [h, ...others].filter(x => validCoord(x.lat, x.lng)).map(x => ({ id: x.id, lat: x.lat as number, lng: x.lng as number, cat: categoria(x) })),
    orchard: orchardPts,
  };

  const barH = 76 + insets.bottom;

  return (
    <View style={st.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: barH + 20 }} showsVerticalScrollIndicator={false}>
        {/* ── Hero fotográfico ── */}
        <View style={{ height: heroH }}>
          {images.length ? (
            <Pressable onPress={() => { tick(); setViewer(0); }} accessibilityRole="imagebutton" accessibilityLabel={t('expand')} style={StyleSheet.absoluteFill}>
              <Reanimated.View entering={reduced ? undefined : FadeIn.duration(320)} style={StyleSheet.absoluteFill}>
                <Image source={images[0].source} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
              </Reanimated.View>
            </Pressable>
          ) : (
            <View style={[StyleSheet.absoluteFill, st.heroEmpty]}>
              <LinearGradient colors={['#0B2A1C', '#163E2B']} style={StyleSheet.absoluteFill} />
              <ImageOff size={30} color="#A7C4B2" />
              <Text style={st.heroEmptyTitle}>{t('noImage')}</Text>
              <Text style={st.heroEmptyBody}>{t('noImageBody')}</Text>
            </View>
          )}
          <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']} style={st.heroTopShade} pointerEvents="none" />
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']} style={st.heroBottomShade} pointerEvents="none" />
          <TopBar t={t} insetsTop={insets.top} onBack={goBack} onShare={canShare ? share : undefined} />
          {images.length > 0 && (
            <View style={st.heroTools}>
              {images.length > 1 && <View style={st.counter}><Text style={st.counterText}>1 / {images.length}</Text></View>}
              <Pressable onPress={() => { tick(); setViewer(0); }} accessibilityRole="button" accessibilityLabel={t('expand')} hitSlop={8} style={st.glassBtn}>
                <Expand size={16} color="#fff" />
              </Pressable>
            </View>
          )}
        </View>

        {/* ── Panel de diagnóstico ── */}
        <Reanimated.View entering={reduced ? undefined : FadeInDown.duration(320).easing(EASE_OUT)} style={[st.panel, { marginTop: -26 }]}>
          <View style={[st.diag, { backgroundColor: tone.bg, borderColor: tone.border }]}>
            <View style={[st.diagIcon, { backgroundColor: tone.soft }, narrow && { width: 44, height: 44 }]}><Icon size={narrow ? 22 : 26} color={tone.ink} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[st.diagName, { color: INK }, narrow && { fontSize: 18, lineHeight: 23 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{name}</Text>
              <Text style={st.diagKind} numberOfLines={2}>{diag ? `${diag.kind[lang]} ${t('in', { crop: crop.toLowerCase() })}` : catText}</Text>
              <View style={[st.statusPill, { marginLeft: 0, marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#fff', borderColor: tone.border }]}>
                <Text style={[st.statusText, { color: tone.ink }]} numberOfLines={1}>{statusText}</Text>
              </View>
            </View>
            <View style={[st.confBox, narrow && { paddingHorizontal: 7 }]} accessible accessibilityLabel={`${t('modelConfidence')}: ${pct} %`}>
              <Text style={st.confLabel}>{t('modelConfidence')}</Text>
              <Text style={[st.confValue, { color: cat === 'revisar' ? TONE.revisar.ink : DEEP }]}>{pct} %</Text>
            </View>
          </View>

          <View style={st.infoRow}>
            <View style={[st.infoItem, { flex: 1 }]}>
              <View style={st.infoIcon}><Sprout size={17} color={DEEP} /></View>
              <View style={{ minWidth: 0 }}><Text style={st.infoLabel}>{t('crop')}</Text><Text style={st.infoValue} numberOfLines={1}>{crop}</Text></View>
            </View>
            <View style={st.infoSep} />
            <View style={[st.infoItem, { flex: 1.3 }]}>
              <View style={st.infoIcon}><Images size={17} color={DEEP} /></View>
              <View style={{ minWidth: 0 }}><Text style={st.infoLabel}>{t('evidence')}</Text>
                <Text style={st.infoValue} numberOfLines={1}>{h.fotos_en_grupo > 1 ? t('grouped', { count: h.fotos_en_grupo }) : t('grouped1')}</Text></View>
            </View>
          </View>

          {cat === 'revisar' && (
            <Reanimated.View entering={enter(0)} style={[st.note, { backgroundColor: TONE.revisar.bg, borderColor: TONE.revisar.border }]}>
              <AlertTriangle size={16} color={TONE.revisar.ink} />
              <Text style={[st.noteText, { color: '#92400E' }]}>{t('reviewNote')}</Text>
            </Reanimated.View>
          )}

          {/* ── ¿Qué significa? / Síntomas / Recomendaciones ── */}
          {diag ? (
            <>
              <Accordion index={1} enter={enter} reduced={reduced} open={open.what} onToggle={() => { tick(); setOpen(o => ({ ...o, what: !o.what })); }}
                icon={<Info size={18} color="#fff" />} iconBg={DEEP} title={t('whatIs')}>
                <Text style={st.body}>{diag.summary[lang]}</Text>
              </Accordion>
              {diag.symptoms.length > 0 && (
                <Accordion index={2} enter={enter} reduced={reduced} open={open.sym} onToggle={() => { tick(); setOpen(o => ({ ...o, sym: !o.sym })); }}
                  icon={<Leaf size={18} color={DEEP} />} title={t('symptoms')}>
                  {diag.symptoms.map((x, i) => <Bullet key={i} text={x[lang]} />)}
                </Accordion>
              )}
              <Accordion index={3} enter={enter} reduced={reduced} open={open.recs} onToggle={() => { tick(); setOpen(o => ({ ...o, recs: !o.recs })); }}
                icon={<Lightbulb size={18} color={DEEP} />} title={t('recs')}>
                {diag.recommendations.map((x, i) => <Bullet key={i} text={x[lang]} />)}
              </Accordion>
            </>
          ) : (
            <Reanimated.View entering={enter(1)} style={[st.note, { backgroundColor: '#F6F8F7', borderColor: LINE }]}>
              <FileText size={16} color={MUTED} />
              <Text style={st.noteText}>{t('noCatalog', { name })}</Text>
            </Reanimated.View>
          )}
          <Reanimated.View entering={enter(4)} style={[st.note, { backgroundColor: '#F2FAF4', borderColor: '#DCEFE2' }]}>
            <Info size={15} color={DEEP} />
            <Text style={st.noteText}>{t('autoNote')}</Text>
          </Reanimated.View>

          {/* ── Ubicación ── */}
          <Reanimated.View entering={enter(5)}>
            <SectionTitle icon={<MapPin size={18} color={DEEP} />} title={t('location')} />
            <View style={st.locCard}>
              {point ? (
                <Pressable onPress={openMap} accessibilityRole="button" accessibilityLabel={t('viewMap')}>
                  <SatThumb route={[]} pin={point} pinColor={FINDING_COLOR[cat]} size={Math.min(190, (width - 64) * 0.5)} height={124} radius={14} minMeters={60} />
                </Pressable>
              ) : (
                <View style={[st.locEmpty, { width: Math.min(190, (width - 64) * 0.5) }]}>
                  <MapPin size={22} color="#94A3B8" />
                  <Text style={st.locEmptyText}>{t('noLocation')}</Text>
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
                <View style={st.locRow}>
                  <MapPin size={15} color={DEEP} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={st.locLabel}>{t('coords')}</Text>
                    {point ? (
                      <>
                        <Text style={st.locValue} selectable>Lat: {point.lat.toFixed(5)}</Text>
                        <Text style={st.locValue} selectable>Lng: {point.lng.toFixed(5)}</Text>
                      </>
                    ) : <Text style={st.locValue}>{t('noLocationBody')}</Text>}
                  </View>
                </View>
                <View style={st.locDivider} />
                <View style={st.locRow}>
                  <Calendar size={15} color={DEEP} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={st.locLabel}>{t('dateTime')}</Text>
                    <Text style={st.locValue}>{dateText} · {timeText}</Text>
                  </View>
                </View>
              </View>
            </View>
            {point && (
              <Pressable onPress={openMap} accessibilityRole="button" style={({ pressed }) => [st.rowBtn, pressed && st.pressed]}>
                <MapIcon size={17} color={DEEP} />
                <Text style={st.rowBtnText}>{t('viewMap')}</Text>
                <ChevronRight size={18} color={INK} />
              </Pressable>
            )}
          </Reanimated.View>

          {/* ── Evidencia ── */}
          <Reanimated.View entering={enter(6)}>
            <SectionTitle icon={<Images size={18} color={DEEP} />} title={t('evidenceTitle')} />
            {images.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 2 }}>
                {images.map((im, i) => (
                  <Pressable key={i} onPress={() => { tick(); setViewer(i); }} accessibilityRole="imagebutton" accessibilityLabel={t('expand')}
                    style={({ pressed }) => [st.evThumb, i === 0 && st.evThumbOn, pressed && st.pressed]}>
                    <Image source={im.source} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            ) : <Text style={st.muted}>{t('noEvidence')}</Text>}
            {h.fotos_en_grupo > 1 && <Text style={[st.muted, { marginTop: 8 }]}>{t('groupNote', { count: h.fotos_en_grupo })}</Text>}
          </Reanimated.View>

          {/* ── Recorrido asociado ── */}
          {rec && (
            <Reanimated.View entering={enter(7)}>
              <SectionTitle icon={<Route size={18} color={DEEP} />} title={t('walk')} />
              <Pressable onPress={() => { tick(); router.navigate({ pathname: '/(app)/escaneos', params: { focus: `remote:${rec.id}`, n: String(Date.now()) } }); }}
                accessibilityRole="button" style={({ pressed }) => [st.walkCard, pressed && { opacity: 0.9 }]}>
                <View style={st.walkTop}>
                  {route.length > 1 || point ? (
                    <SatThumb route={route} outline={orchardPts} pin={point} pinColor={FINDING_COLOR[cat]} size={92} radius={14} minMeters={30} />
                  ) : <View style={[st.walkThumbEmpty]}><Route size={22} color="#94A3B8" /></View>}
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Text style={st.walkTitle} numberOfLines={1}>{t('walkKind')}</Text>
                    <Text style={st.muted} numberOfLines={1}>{orchard?.nombre ?? t('noOrchard')}</Text>
                    <View style={[st.row, { gap: 6 }]}><Calendar size={13} color={MUTED} />
                      <Text style={st.muted}>{new Date(rec.iniciado_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })} · {new Date(rec.iniciado_at).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}</Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color={MUTED} />
                </View>
                <View style={st.walkStats}>
                  <WalkStat icon={<Camera size={16} color={DEEP} />} value={String(rec.fotos_total)} label={t('photos')} />
                  <View style={st.infoSep} />
                  <WalkStat icon={<Bug size={16} color={FINDING_COLOR.enfermo} />} value={String(rec.hallazgos_total)} label={t('findings')} />
                  <View style={st.infoSep} />
                  <WalkStat icon={<Route size={16} color={DEEP} />} value={(() => { const m = routeMeters(route); return m > 0 ? (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`) : '—'; })()} label={t('route')} />
                </View>
              </Pressable>
            </Reanimated.View>
          )}

          {/* ── Otros hallazgos del mismo recorrido ── */}
          {others.length > 0 && (
            <Reanimated.View entering={enter(8)}>
              <SectionTitle icon={<Target size={18} color={DEEP} />} title={t('others')} />
              {others.slice(0, 6).map(o => {
                const c = categoria(o);
                return (
                  <Pressable key={o.id} onPress={() => { tick(); router.setParams({ id: o.id, n: String(Date.now()) }); }}
                    accessibilityRole="button" style={({ pressed }) => [st.otherRow, pressed && { opacity: 0.85 }]}>
                    <View style={st.otherThumb}>
                      {o.miniatura_path ? <Image source={storageImage(o.miniatura_path)} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Bug size={18} color={FINDING_COLOR[c]} />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={st.walkTitle} numberOfLines={1}>{c === 'otro' ? t('catOtro') : localizeDomainLabel(o.estado, language) ?? o.estado}</Text>
                      <View style={[st.statusPill, { alignSelf: 'flex-start', marginLeft: 0, backgroundColor: TONE[c].bg, borderColor: TONE[c].border, paddingVertical: 1 }]}>
                        <Text style={[st.statusText, { color: TONE[c].ink, fontSize: 10.5 }]}>{c === 'enfermo' ? t('stEnfermo') : c === 'revisar' ? t('stRevisar') : c === 'sano' ? t('stSano') : t('stOtro')}</Text>
                      </View>
                      <Text style={st.muted} numberOfLines={1}>{t('confidence', { pct: Math.round(o.confianza * 100) })} · {new Date(o.tomada_at).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}</Text>
                    </View>
                    <ChevronRight size={18} color={MUTED} />
                  </Pressable>
                );
              })}
            </Reanimated.View>
          )}

          {/* ── Información adicional ── */}
          <Reanimated.View entering={enter(9)}>
            <SectionTitle icon={<FileText size={18} color={DEEP} />} title={t('extra')} />
            <View style={st.extraCard}>
              <ExtraRow icon={<Leaf size={17} color={DEEP} />} label={t('fruit')} value={crop} />
              <ExtraRow icon={<Target size={17} color={DEEP} />} label={t('fruitConfidence')} value={h.confianza_fruto != null ? `${Math.round(h.confianza_fruto * 100)} %` : t('notAvailable')} />
              <ExtraRow icon={<Stethoscope size={17} color={DEEP} />} label={t('findingType')} value={catText} last />
            </View>
          </Reanimated.View>

          <View style={st.quote}>
            <Sprout size={22} color={DEEP} />
            <View style={{ flex: 1 }}>
              <Text style={st.quoteText}>{t('quote')}</Text>
              <Text style={st.quoteBy}>{t('quoteBy')}</Text>
            </View>
          </View>
        </Reanimated.View>
      </ScrollView>

      {/* ── Acciones ── */}
      <View style={[st.bar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable onPress={viewInWalk} accessibilityRole="button" style={({ pressed }) => [st.btnLine, pressed && st.pressed]}>
          {!narrow && <Route size={18} color={DEEP} />}
          <Text style={[st.btnLineText, narrow && { fontSize: 13 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{t('viewWalk')}</Text>
        </Pressable>
        <Pressable onPress={() => { tick(); setRecsOpen(true); }} accessibilityRole="button" style={({ pressed }) => [st.btnFill, pressed && st.pressed]}>
          {!narrow && <Leaf size={18} color="#fff" />}
          <Text style={[st.btnFillText, narrow && { fontSize: 13 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{t('recommendations')}</Text>
        </Pressable>
      </View>

      <PhotoViewer visible={viewer !== null} images={images} index={viewer ?? 0} onIndex={setViewer} onClose={() => setViewer(null)} reduced={reduced} closeLabel={t('close')} />

      {/* Mapa ampliado: huerta, ruta y hallazgos reales del recorrido; este hallazgo resaltado */}
      <Modal visible={mapOpen} animationType={reduced ? 'fade' : 'slide'} onRequestClose={() => setMapOpen(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: '#dfe7e1' }}>
          {mapOpen && <ScansMap data={mapData} selectedId={null} detail={mapDetail} point={{ kind: 'finding', id: h.id }} user={null} layer="satelite" onEvent={() => {}} />}
          <View style={[st.mapTop, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            <Pressable onPress={() => setMapOpen(false)} accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={8} style={st.mapBtn}>
              <X size={20} color={INK} />
            </Pressable>
            <View style={st.mapTitleBox}><Text style={st.mapTitle} numberOfLines={1}>{t('mapTitle')}</Text></View>
            <View style={{ width: 40 }} />
          </View>
          <View style={[st.mapFoot, { bottom: insets.bottom + 16 }]}>
            <View style={[st.dot, { backgroundColor: FINDING_COLOR[cat] }]} />
            <Text style={st.mapFootText} numberOfLines={1}>{name} · {dateText} {timeText}</Text>
          </View>
        </View>
      </Modal>

      {/* Recomendaciones (contenido controlado) */}
      <Modal visible={recsOpen} transparent animationType={reduced ? 'fade' : 'slide'} onRequestClose={() => setRecsOpen(false)} statusBarTranslucent>
        <Pressable style={st.backdrop} onPress={() => setRecsOpen(false)} accessibilityLabel={t('close')} />
        <View style={[st.sheet, { paddingBottom: insets.bottom + 18, maxHeight: height * 0.8 }]}>
          <View style={st.handle} />
          <View style={[st.row, { justifyContent: 'space-between', marginBottom: 6 }]}>
            <Text style={st.sheetTitle}>{t('recommendations')}</Text>
            <Pressable onPress={() => setRecsOpen(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')} style={st.closeRound}><X size={17} color={MUTED} /></Pressable>
          </View>
          <Text style={[st.muted, { marginBottom: 10 }]}>{name} · {crop}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {diag && diag.recommendations.length ? (
              <>
                {diag.recommendations.map((x, i) => (
                  <Reanimated.View key={i} entering={reduced ? undefined : FadeInDown.duration(220).delay(i * 40)} style={st.recRow}>
                    <View style={st.recNum}><Text style={st.recNumText}>{i + 1}</Text></View>
                    <Text style={[st.body, { flex: 1 }]}>{x[lang]}</Text>
                  </Reanimated.View>
                ))}
                <Text style={[st.sheetSub, { marginTop: 14 }]}>{t('whenVerify')}</Text>
                <Text style={st.body}>{diag.verify[lang]}</Text>
              </>
            ) : (
              <View style={st.stateBox}><Lightbulb size={26} color={MUTED} /><Text style={st.stateBody}>{t('noRecs')}</Text></View>
            )}
            <View style={[st.note, { backgroundColor: '#F6F8F7', borderColor: LINE, marginTop: 16 }]}>
              <Info size={15} color={MUTED} />
              <Text style={st.noteText}>{t('recsNote')}</Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ───────── piezas ─────────

function TopBar({ t, insetsTop, onBack, onShare }: { t: (k: string) => string; insetsTop: number; onBack: () => void; onShare?: () => void }) {
  return (
    <View style={[st.topBar, { paddingTop: insetsTop + 8 }]} pointerEvents="box-none">
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t('back')} hitSlop={8} style={({ pressed }) => [st.roundWhite, pressed && st.pressed]}>
        <ChevronLeft size={22} color={INK} />
      </Pressable>
      <Text style={st.topTitle} numberOfLines={1} accessibilityRole="header">{t('title')}</Text>
      {onShare ? (
        <Pressable onPress={onShare} accessibilityRole="button" accessibilityLabel={t('share')} hitSlop={8} style={({ pressed }) => [st.roundWhite, pressed && st.pressed]}>
          <Share2 size={18} color={INK} />
        </Pressable>
      ) : <View style={{ width: 42 }} />}
    </View>
  );
}

function Accordion({ index, enter, reduced, open, onToggle, icon, iconBg, title, children }: {
  index: number; enter: (i: number) => ReturnType<typeof FadeInDown.duration> | undefined; reduced: boolean; open: boolean; onToggle: () => void;
  icon: React.ReactNode; iconBg?: string; title: string; children: React.ReactNode;
}) {
  return (
    <Reanimated.View entering={enter(index)} layout={reduced ? undefined : LinearTransition.duration(220).easing(EASE_OUT)} style={st.acc}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={st.accHead}>
        <View style={[st.accIcon, iconBg ? { backgroundColor: iconBg } : null]}>{icon}</View>
        <Text style={st.accTitle}>{title}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}><ChevronDown size={18} color={MUTED} /></View>
      </Pressable>
      {open && <Reanimated.View entering={reduced ? undefined : FadeIn.duration(180)} style={st.accBody}>{children}</Reanimated.View>}
    </Reanimated.View>
  );
}

function Bullet({ text }: { text: string }) {
  return <View style={st.bullet}><View style={st.bulletDot} /><Text style={[st.body, { flex: 1 }]}>{text}</Text></View>;
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <View style={st.section}>{icon}<Text style={st.sectionText}>{title}</Text></View>;
}

function WalkStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <View style={{ flex: 1, alignItems: 'center', gap: 1 }}>{icon}<Text style={st.statValue}>{value}</Text><Text style={st.statLabel}>{label}</Text></View>;
}

function ExtraRow({ icon, label, value, last }: { icon: React.ReactNode; label: string; value: string; last?: boolean }) {
  return (
    <View style={[st.extraRow, !last && { borderBottomWidth: 1, borderBottomColor: LINE }]}>
      <View style={st.infoIcon}>{icon}</View>
      <View style={{ flex: 1 }}><Text style={st.infoLabel}>{label}</Text><Text style={st.infoValue}>{value}</Text></View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  row: { flexDirection: 'row', alignItems: 'center' },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  topTitle: { flex: 1, textAlign: 'center', marginHorizontal: 8, fontFamily: 'Poppins_600SemiBold', fontSize: 16.5, color: '#fff', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 6 },
  roundWhite: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.95)' },
  heroTopShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 130 },
  heroBottomShade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 90 },
  heroEmpty: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 30 },
  heroEmptyTitle: { color: '#E7F2EA', fontFamily: 'Poppins_600SemiBold', fontSize: 14, textAlign: 'center' },
  heroEmptyBody: { color: '#A7C4B2', fontFamily: 'Poppins_400Regular', fontSize: 12, textAlign: 'center' },
  heroTools: { position: 'absolute', right: 14, bottom: 38, flexDirection: 'row', alignItems: 'center', gap: 8 },
  counter: { paddingHorizontal: 10, height: 30, borderRadius: 15, justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.6)' },
  counterText: { color: '#fff', fontFamily: 'Poppins_600SemiBold', fontSize: 12 },
  glassBtn: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.6)' },

  panel: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  diag: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22, borderWidth: 1 },
  diagIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  diagName: { fontFamily: 'Poppins_700Bold', fontSize: 21, lineHeight: 26, letterSpacing: -0.4 },
  diagKind: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 16, color: '#475569' },
  confBox: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.85)' },
  confLabel: { fontFamily: 'Poppins_400Regular', fontSize: 9.5, color: MUTED, textAlign: 'center', maxWidth: 80 },
  confValue: { fontFamily: 'Poppins_700Bold', fontSize: 19, lineHeight: 24 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 18, borderWidth: 1, borderColor: LINE },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  infoIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF8F0' },
  infoLabel: { fontFamily: 'Poppins_400Regular', fontSize: 10.5, color: MUTED },
  infoValue: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: INK },
  infoSep: { width: 1, alignSelf: 'stretch', backgroundColor: LINE },
  statusPill: { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, flexShrink: 1 },
  statusText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11 },

  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: 16, borderWidth: 1 },
  noteText: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 17, color: '#334155' },
  acc: { borderRadius: 18, backgroundColor: '#F7FAF8', borderWidth: 1, borderColor: LINE, overflow: 'hidden' },
  accHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12 },
  accIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F4EA' },
  accTitle: { flex: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 14.5, color: INK },
  accBody: { paddingHorizontal: 14, paddingBottom: 14, paddingLeft: 54, gap: 4 },
  body: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 19.5, color: '#334155' },
  bullet: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bulletDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#4D7C0F', marginTop: 8 },

  section: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 10 },
  sectionText: { fontFamily: 'Poppins_700Bold', fontSize: 15.5, color: INK, letterSpacing: -0.2 },
  locCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 18, borderWidth: 1, borderColor: LINE, backgroundColor: '#fff' },
  locEmpty: { height: 124, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F1F5F9' },
  locEmptyText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11.5, color: MUTED, textAlign: 'center' },
  locRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  locLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 11.5, color: INK },
  locValue: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: MUTED },
  locDivider: { height: 1, backgroundColor: LINE },
  rowBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, minHeight: 46, paddingHorizontal: 14, borderRadius: 23, borderWidth: 1, borderColor: '#DDE7E0' },
  rowBtnText: { flex: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: INK },
  evThumb: { width: 128, height: 96, borderRadius: 14, overflow: 'hidden', backgroundColor: '#F1F5F9', borderWidth: 2.5, borderColor: 'transparent' },
  evThumbOn: { borderColor: '#4ADE80' },
  muted: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 17, color: MUTED },

  walkCard: { padding: 10, borderRadius: 18, borderWidth: 1, borderColor: LINE, backgroundColor: '#fff', gap: 10 },
  walkTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  walkThumbEmpty: { width: 92, height: 92, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  walkTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: INK },
  walkStats: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: LINE },
  statValue: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: INK },
  statLabel: { fontFamily: 'Poppins_400Regular', fontSize: 10.5, color: MUTED },
  otherRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, marginBottom: 8, borderRadius: 16, borderWidth: 1, borderColor: LINE },
  otherThumb: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  extraCard: { borderRadius: 18, borderWidth: 1, borderColor: LINE, paddingHorizontal: 12 },
  extraRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  quote: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, padding: 14, borderRadius: 18, backgroundColor: '#EFF8F1' },
  quoteText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#14532D' },
  quoteBy: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: '#4B7A5B', marginTop: 2 },

  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(255,255,255,0.97)', borderTopWidth: 1, borderTopColor: LINE },
  btnLine: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 50, paddingHorizontal: 10, borderRadius: 25, borderWidth: 1.5, borderColor: '#BFD8C6', backgroundColor: '#fff' },
  btnLineText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: DEEP },
  btnFill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 50, paddingHorizontal: 10, borderRadius: 25, backgroundColor: DEEP },
  btnFillText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#fff' },

  skel: { borderRadius: 18, backgroundColor: '#F1F5F4' },
  stateBox: { alignItems: 'center', paddingVertical: 34, paddingHorizontal: 24, gap: 6 },
  stateTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: INK, textAlign: 'center', marginTop: 6 },
  stateBody: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, lineHeight: 18, color: MUTED, textAlign: 'center' },

  mapTop: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  mapBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  mapTitleBox: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.95)' },
  mapTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: INK },
  mapFoot: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.96)', maxWidth: '90%' },
  mapFootText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: INK },
  dot: { width: 10, height: 10, borderRadius: 5 },

  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 8, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: '#fff' },
  handle: { alignSelf: 'center', width: 38, height: 4.5, borderRadius: 3, backgroundColor: '#CBD5E1', marginBottom: 10 },
  sheetTitle: { fontFamily: 'Poppins_700Bold', fontSize: 18, color: INK },
  sheetSub: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: INK, marginBottom: 4 },
  closeRound: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  recRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  recNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F4EA', marginTop: 1 },
  recNumText: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: DEEP },
});
