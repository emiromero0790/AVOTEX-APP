/**
 * Importar fotos de dron o de cámara de acción (GoPro y similares).
 *
 * No existe conexión directa con ningún fabricante (DJI, GoPro, etc.): el usuario pasa las fotos a su
 * celular con la app o el cable del fabricante y aquí las elige de la galería. Cada importación se
 * guarda como un escaneo en el celular y se sube con la misma lógica que el recorrido inteligente;
 * el procesador elige las fotos útiles (nítidas, sin repetir lugar) y genera los resultados.
 *
 * Videos: aún no se pueden importar (haría falta extraer cuadros en el celular).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Reanimated, { FadeIn, FadeInDown, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { CheckCircle2, ChevronLeft, CloudUpload, ImagePlus, Info, Lock, MapPin, Plane, RotateCcw, Trash2, Video, Calendar, Map as MapIcon } from 'lucide-react-native';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { auth as firebaseAuth } from '../../firebaseConfig';
import { useGuest } from '../../context/GuestContext';
import { TranslationResource, useTranslations } from '../../context/LanguageContext';
import { listOrchards, Orchard } from '../../services/orchards';
import { MAX_IMPORT, importPhotos, readExif, summarize } from '../../services/importar';
import { uploadPending, type SyncResult } from '../../services/recorridos';
import { CSS_EASE_OUT, EASE_OUT, PressableScale } from '../../components/scan/motion';
import { CARD_SHADOW, LIME_GRADIENT, SCAN } from '../../components/scan/theme';

const auth = firebaseAuth as Auth;

// Fotos locales (ver assets/images/escanear/CREDITOS.md). Cada una se usa en una sola pantalla.
const IMG_AERIAL = require('../../assets/images/escanear/recorrido-aereo.jpg');
const IMG_CHEST = require('../../assets/images/escanear/montaje-pecho.jpg');

const STEP_IN = FadeInDown.duration(260).easing(EASE_OUT);
const FADE = FadeIn.duration(200).easing(EASE_OUT);
const DONE_IN = ZoomIn.duration(320).easing(EASE_OUT);

type Fuente = 'dron' | 'camara';
type Phase = 'pick' | 'review' | 'preparing' | 'done';

const translations: TranslationResource = {
  back: { es: 'Volver', en: 'Back' },
  kickerDron: { es: 'Dron', en: 'Drone' },
  kickerCamara: { es: 'GoPro / Cámara de acción', en: 'GoPro / Action camera' },
  titleDron: { es: 'Fotos aéreas de tu huerta', en: 'Aerial photos of your orchard' },
  titleCamara: { es: 'Fotos de tu cámara de acción', en: 'Photos from your action camera' },
  bodyDron: { es: 'Importa las fotos que tomó tu dron. AVOTEX las ubica con su GPS, elige las útiles y las analiza con IA.', en: 'Import the photos your drone took. AVOTEX places them by GPS, picks the useful ones and analyzes them with AI.' },
  bodyCamara: { es: 'Importa las fotos de tu GoPro o cámara de acción montada en el pecho o el casco. Se organizan como un recorrido.', en: 'Import photos from your GoPro or action camera mounted on your chest or helmet. They are organized as a walk.' },
  step1: { es: 'Elegir', en: 'Choose' },
  step2: { es: 'Revisar', en: 'Review' },
  step3: { es: 'Preparar', en: 'Prepare' },
  howTitle: { es: 'Antes de importar', en: 'Before importing' },
  d1: { es: 'Pasa las fotos del dron a tu celular con la app del fabricante, cable o tarjeta.', en: 'Move the drone photos to your phone with the maker’s app, a cable or the card.' },
  d2: { es: 'Vuela bajo (5–15 m) para que se distingan los frutos: el modelo de IA analiza frutos.', en: 'Fly low (5–15 m) so fruits are visible: the AI model analyzes fruits.' },
  d3: { es: 'Las fotos con GPS aparecen en el mapa de Mis escaneos; las demás, solo en el historial.', en: 'Photos with GPS show on the My scans map; the rest only in the history.' },
  c1: { es: 'Usa modo foto o time-lapse con GPS activado en la cámara.', en: 'Use photo or time-lapse mode with GPS on in the camera.' },
  c2: { es: 'Monta la cámara en el pecho o el casco, apuntando a los árboles.', en: 'Mount the camera on your chest or helmet, facing the trees.' },
  c3: { es: 'Los videos todavía no se pueden importar: exporta fotos o usa time-lapse.', en: 'Videos cannot be imported yet: export photos or use time-lapse.' },
  noDirect: { es: 'AVOTEX no se conecta directamente con drones ni cámaras: las fotos se eligen de tu galería.', en: 'AVOTEX does not connect directly to drones or cameras: photos are chosen from your gallery.' },
  chest: { es: 'En el pecho', en: 'On chest' },
  helmet: { es: 'En el casco', en: 'On helmet' },
  pick: { es: 'Seleccionar fotos', en: 'Select photos' },
  pickMore: { es: 'Agregar más', en: 'Add more' },
  clear: { es: 'Quitar todas', en: 'Remove all' },
  permDenied: { es: 'Necesitamos acceso a tus fotos para importarlas.', en: 'We need access to your photos to import them.' },
  statPhotos: { es: 'fotos', en: 'photos' },
  statGps: { es: 'con GPS', en: 'with GPS' },
  statDate: { es: 'con fecha', en: 'with date' },
  noGpsWarn: { es: 'Ninguna foto trae GPS: el escaneo no aparecerá en el mapa, pero sí se analiza.', en: 'No photo has GPS: the scan will not show on the map, but it will be analyzed.' },
  limit: { es: 'Se importarán las primeras {max} fotos.', en: 'Only the first {max} photos will be imported.' },
  orchard: { es: 'Huerta', en: 'Orchard' },
  orchardAuto: { es: 'Detectar por GPS', en: 'Detect by GPS' },
  prepare: { es: 'Preparar y guardar', en: 'Prepare and save' },
  preparing: { es: 'Preparando {done} de {total}', en: 'Preparing {done} of {total}' },
  preparingHint: { es: 'Se reducen las fotos para subirlas más rápido. No cierres la app.', en: 'Photos are reduced to upload faster. Do not close the app.' },
  doneTitle: { es: 'Escaneo guardado', en: 'Scan saved' },
  doneBody: { es: '{count} fotos guardadas en tu celular ({gps} con ubicación).', en: '{count} photos saved on your phone ({gps} with location).' },
  syncDone: { es: 'Subido: el análisis empieza en unos minutos y te avisaremos al terminar.', en: 'Uploaded: analysis starts within minutes and we will notify you.' },
  syncOffline: { es: 'Sin conexión: se subirá cuando tengas señal.', en: 'Offline: it will upload when you are online.' },
  syncWifi: { es: 'Se subirá con WiFi (o permite datos móviles en Mis escaneos).', en: 'It will upload on WiFi (or allow mobile data in My scans).' },
  syncError: { es: 'No se pudo subir todavía; lo reintentaremos desde Mis escaneos.', en: 'Could not upload yet; we will retry from My scans.' },
  syncing: { es: 'Subiendo… {done}/{total}', en: 'Uploading… {done}/{total}' },
  viewScans: { es: 'Ver en Mis escaneos', en: 'View in My scans' },
  importMore: { es: 'Importar más', en: 'Import more' },
  error: { es: 'No se pudieron preparar las fotos. Intenta de nuevo.', en: 'Photos could not be prepared. Try again.' },
  locked: { es: 'Crea una cuenta para importar fotos.', en: 'Create an account to import photos.' },
  signIn: { es: 'Crear cuenta / Iniciar sesión', en: 'Create account / Sign in' },
};

export default function ImportarFotos() {
  const t = useTranslations(translations);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const { isGuest } = useGuest();
  const params = useLocalSearchParams<{ fuente?: string; n?: string }>();
  const fuente: Fuente = params.fuente === 'camara' ? 'camara' : 'dron';
  const isTablet = width >= 768;

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const email = user?.email ?? '';
  const [phase, setPhase] = useState<Phase>('pick');
  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [orchards, setOrchards] = useState<Orchard[]>([]);
  const [huertaId, setHuertaId] = useState<string | null>(null);
  const [prog, setProg] = useState({ done: 0, total: 0 });
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedGps, setSavedGps] = useState(0);
  const [sync, setSync] = useState<SyncResult | 'running' | null>(null);
  const [upProg, setUpProg] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useFocusEffect(useCallback(() => { setStatusBarStyle('dark'); }, []));

  // Cada vez que se abre desde Escanear empieza de cero (la pantalla sigue montada entre visitas).
  useEffect(() => {
    setPhase('pick'); setAssets([]); setHuertaId(null); setSavedId(null); setSync(null); setError(null);
  }, [params.n, params.fuente]);

  useEffect(() => {
    if (email) listOrchards(email).then(setOrchards).catch(() => {});
  }, [email]);

  const summary = useMemo(() => summarize(assets), [assets]);

  const pickPhotos = async (append: boolean) => {
    setError(null);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMPORT,
        orderedSelection: true,
        exif: true,
        quality: 1,
      });
      if (res.canceled || !res.assets?.length) return;
      Haptics.selectionAsync().catch(() => {});
      setAssets(prev => {
        const merged = append ? [...prev, ...res.assets] : res.assets;
        const seen = new Set<string>();
        return merged.filter(a => { const k = a.assetId ?? a.uri; if (seen.has(k)) return false; seen.add(k); return true; });
      });
      setPhase('review');
    } catch {
      setError(t('permDenied'));
    }
  };

  const prepare = async () => {
    if (!email || !assets.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setPhase('preparing');
    setError(null);
    try {
      const rec = await importPhotos(email, fuente, assets, huertaId, (done, total) => setProg({ done, total }));
      setSavedId(rec.localId);
      setSavedGps(rec.fotos.filter(f => f.lat != null).length);
      setPhase('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Subida inmediata con la regla de siempre (WiFi, o datos si el usuario lo permitió).
      setSync('running');
      const res = await uploadPending(email, { onProgress: (_id, done, total) => setUpProg({ done, total }) }).catch(() => 'partial' as const);
      setSync(res);
    } catch {
      setPhase('review');
      setError(t('error'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  if (isGuest) {
    return (
      <View style={[s.screen, s.center, { paddingTop: insets.top }]}>
        <Lock size={36} color={SCAN.brand} />
        <Text style={s.lockText}>{t('locked')}</Text>
        <PressableScale style={s.lockBtn} onPress={() => router.replace('/(auth)')} accessibilityRole="button"><Text style={s.lockBtnText}>{t('signIn')}</Text></PressableScale>
      </View>
    );
  }

  const stepIndex = phase === 'pick' ? 0 : phase === 'review' ? 1 : 2;
  const goBack = () => (router.canGoBack() ? router.back() : router.navigate('/(app)/scan'));
  const tabSpace = (isTablet ? 82 + 24 : 72 + 18) + 24 + insets.bottom;
  const heroH = isTablet ? 280 : 190;

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: tabSpace }} showsVerticalScrollIndicator={false}>
        {/* ── Encabezado (blanco) y tarjeta fotográfica ── */}
        <View style={[s.top, isTablet && s.contentTablet, { paddingTop: insets.top + 8 }]}>
          <View style={s.headRow}>
            <PressableScale style={s.back} onPress={goBack} accessibilityRole="button" accessibilityLabel={t('back')}><ChevronLeft size={22} color={SCAN.ink} /></PressableScale>
            <View style={s.kicker}>
              {fuente === 'dron' ? <Plane size={14} color={SCAN.limeInk} /> : <Video size={14} color={SCAN.limeInk} />}
              <Text style={s.kickerText}>{fuente === 'dron' ? t('kickerDron') : t('kickerCamara')}</Text>
            </View>
          </View>
          <Text style={s.title} accessibilityRole="header">{fuente === 'dron' ? t('titleDron') : t('titleCamara')}</Text>
          <Text style={s.body}>{fuente === 'dron' ? t('bodyDron') : t('bodyCamara')}</Text>
          <View style={[s.hero, { height: heroH }]}>
            <View style={s.heroClip}>
              <Image source={fuente === 'dron' ? IMG_AERIAL : IMG_CHEST} style={s.img} resizeMode="cover" accessibilityIgnoresInvertColors />
              {fuente === 'camara' && (
                <View style={s.heroTag}><Text style={s.heroTagText}>{t('chest')}</Text></View>
              )}
            </View>
          </View>
        </View>

        <View style={[s.content, isTablet && s.contentTablet]}>
          {/* pasos */}
          <View style={s.steps}>
            {[t('step1'), t('step2'), t('step3')].map((label, i) => {
              const on = i <= stepIndex;
              return (
                <View key={label} style={s.step}>
                  <View style={[s.stepBar, { backgroundColor: on ? SCAN.lime : '#E2E8F0', transitionProperty: 'backgroundColor', transitionDuration: 220, transitionTimingFunction: CSS_EASE_OUT } as object]} />
                  <Text style={[s.stepText, on && { color: SCAN.ink }]}>{`${i + 1}. ${label}`}</Text>
                </View>
              );
            })}
          </View>

          {error && <Reanimated.Text entering={FADE} style={s.error}>{error}</Reanimated.Text>}

          {phase === 'pick' && (
            <Reanimated.View entering={reduced ? undefined : STEP_IN} style={s.block}>
              <View style={s.card}>
                <Text style={s.cardTitle}>{t('howTitle')}</Text>
                {(fuente === 'dron' ? [t('d1'), t('d2'), t('d3')] : [t('c1'), t('c2'), t('c3')]).map((line, i) => (
                  <View key={i} style={s.li}>
                    <View style={s.liNum}><Text style={s.liNumText}>{i + 1}</Text></View>
                    <Text style={s.liText}>{line}</Text>
                  </View>
                ))}
              </View>
              <View style={s.note}><Info size={15} color={SCAN.sky} /><Text style={s.noteText}>{t('noDirect')}</Text></View>
              <Cta label={t('pick')} icon={<ImagePlus size={22} color={SCAN.limeInk} />} onPress={() => pickPhotos(false)} />
            </Reanimated.View>
          )}

          {phase === 'review' && (
            <Reanimated.View entering={reduced ? undefined : STEP_IN} style={s.block}>
              <View style={s.stats}>
                <Stat icon={<ImagePlus size={16} color={SCAN.brand} />} value={summary.total} label={t('statPhotos')} />
                <Stat icon={<MapPin size={16} color={summary.withGps ? SCAN.brand : SCAN.amber} />} value={summary.withGps} label={t('statGps')} />
                <Stat icon={<Calendar size={16} color={SCAN.brand} />} value={summary.withDate} label={t('statDate')} />
              </View>
              {summary.total > 0 && summary.withGps === 0 && (
                <View style={[s.note, s.noteWarn]}><MapIcon size={15} color={SCAN.amber} /><Text style={[s.noteText, { color: '#92400E' }]}>{t('noGpsWarn')}</Text></View>
              )}
              {summary.total > MAX_IMPORT && <Text style={s.small}>{t('limit', { max: MAX_IMPORT })}</Text>}

              <View style={s.grid}>
                {assets.slice(0, 15).map((a, i) => {
                  const gps = readExif(a.exif as Record<string, unknown> | null | undefined).lat != null;
                  return (
                    <View key={a.assetId ?? a.uri} style={s.cell}>
                      <Image source={{ uri: a.uri }} style={s.img} resizeMode="cover" />
                      {gps && <View style={s.gpsBadge}><MapPin size={10} color={SCAN.limeInk} /></View>}
                      {i === 14 && assets.length > 15 && <View style={s.more}><Text style={s.moreText}>+{assets.length - 14}</Text></View>}
                    </View>
                  );
                })}
              </View>
              <View style={s.row}>
                <PressableScale style={s.ghost} onPress={() => pickPhotos(true)} accessibilityRole="button"><ImagePlus size={16} color={SCAN.ink} /><Text style={s.ghostText}>{t('pickMore')}</Text></PressableScale>
                <PressableScale style={s.ghost} onPress={() => { setAssets([]); setPhase('pick'); }} accessibilityRole="button"><Trash2 size={16} color={SCAN.red} /><Text style={s.ghostText}>{t('clear')}</Text></PressableScale>
              </View>

              <Text style={s.section}>{t('orchard')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
                {[{ id: null as string | null, nombre: t('orchardAuto') }, ...orchards.map(o => ({ id: o.id as string | null, nombre: o.nombre }))].map(o => {
                  const on = huertaId === o.id;
                  return (
                    <PressableScale key={o.id ?? 'auto'} onPress={() => { if (!on) Haptics.selectionAsync().catch(() => {}); setHuertaId(o.id); }} style={[s.chip, on && s.chipOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                      {o.id === null && <MapPin size={14} color={on ? SCAN.limeInk : SCAN.brand} />}
                      <Text style={[s.chipText, on && s.chipTextOn]}>{o.nombre}</Text>
                    </PressableScale>
                  );
                })}
              </ScrollView>

              <Cta label={t('prepare')} icon={<CloudUpload size={22} color={SCAN.limeInk} />} onPress={prepare} />
            </Reanimated.View>
          )}

          {phase === 'preparing' && (
            <Reanimated.View entering={reduced ? undefined : FADE} style={[s.card, s.center, { paddingVertical: 28 }]}>
              <ActivityIndicator color={SCAN.brand} size="large" />
              <Text style={s.cardTitle}>{t('preparing', { done: prog.done, total: prog.total })}</Text>
              <View style={s.track}>
                {/* relleno absoluto sin hijos: anima su ancho sin recalcular el resto */}
                <Reanimated.View style={[s.fill, { width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%`, transitionProperty: 'width', transitionDuration: 300, transitionTimingFunction: CSS_EASE_OUT }]} />
              </View>
              <Text style={s.small}>{t('preparingHint')}</Text>
            </Reanimated.View>
          )}

          {phase === 'done' && (
            <View style={s.block}>
              <Reanimated.View entering={reduced ? FADE : DONE_IN} style={[s.card, s.center, { paddingVertical: 24 }]}>
                <CheckCircle2 size={46} color={SCAN.lime} />
                <Text style={s.doneTitle}>{t('doneTitle')}</Text>
                <Text style={s.doneBody}>{t('doneBody', { count: prog.total, gps: savedGps })}</Text>
                <View style={s.syncRow}>
                  {sync === 'running' ? <ActivityIndicator size="small" color={SCAN.sky} /> : <CloudUpload size={16} color={sync === 'done' ? SCAN.brand : SCAN.sky} />}
                  <Text style={s.syncText}>
                    {sync === 'running' ? t('syncing', { done: upProg.done, total: upProg.total || prog.total })
                      : sync === 'done' ? t('syncDone') : sync === 'offline' ? t('syncOffline') : sync === 'wifi-required' ? t('syncWifi') : t('syncError')}
                  </Text>
                </View>
              </Reanimated.View>
              <Cta
                label={t('viewScans')}
                icon={<MapIcon size={22} color={SCAN.limeInk} />}
                onPress={() => router.replace({ pathname: '/(app)/escaneos', params: { n: String(Date.now()), focus: savedId ? `local:${savedId}` : undefined } })}
              />
              <PressableScale style={s.secondary} onPress={() => { setAssets([]); setPhase('pick'); setSync(null); }} accessibilityRole="button">
                <RotateCcw size={17} color={SCAN.ink} />
                <Text style={s.secondaryText}>{t('importMore')}</Text>
              </PressableScale>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Cta({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={s.ctaWrap}>
      <LinearGradient colors={[...LIME_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cta}>
        {icon}
        <Text style={s.ctaText}>{label}</Text>
      </LinearGradient>
    </PressableScale>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <View style={s.stat}>
      {icon}
      <Reanimated.Text key={value} entering={FadeIn.duration(180)} style={s.statValue}>{value}</Reanimated.Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SCAN.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  lockText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: SCAN.ink, textAlign: 'center', paddingHorizontal: 28 },
  lockBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, backgroundColor: SCAN.limeBright },
  lockBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: SCAN.limeInk },
  top: { paddingHorizontal: 16, gap: 6 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: SCAN.surface, borderWidth: 1, borderColor: SCAN.line },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: SCAN.limeSoft, borderWidth: 1, borderColor: '#D9F99D' },
  kickerText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: SCAN.limeInk },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 28, lineHeight: 34, letterSpacing: -0.8, color: SCAN.ink },
  body: { fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 21, color: '#52606D' },
  hero: { marginTop: 8, borderRadius: 26, backgroundColor: '#E2E8F0', ...CARD_SHADOW },
  heroClip: { flex: 1, borderRadius: 26, overflow: 'hidden' },
  heroTag: { position: 'absolute', left: 12, bottom: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.94)' },
  heroTagText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: SCAN.ink },
  img: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  content: { paddingHorizontal: 16, gap: 14, marginTop: 16 },
  contentTablet: { maxWidth: 720, width: '100%', alignSelf: 'center' },
  steps: { flexDirection: 'row', gap: 8 },
  step: { flex: 1, gap: 6 },
  stepBar: { height: 4, borderRadius: 2 },
  stepText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11.5, color: SCAN.muted },
  block: { gap: 14 },
  card: { borderRadius: 22, padding: 16, gap: 12, backgroundColor: SCAN.card, borderWidth: 1, borderColor: '#EEF2F7', ...CARD_SHADOW, shadowOpacity: 0.08 },
  cardTitle: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: SCAN.ink },
  li: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  liNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: SCAN.limeSoft, marginTop: 1 },
  liNumText: { fontFamily: 'Poppins_700Bold', fontSize: 11.5, color: SCAN.limeInk },
  liText: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 13.5, lineHeight: 20, color: SCAN.inkSoft },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD' },
  noteWarn: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  noteText: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 12.5, lineHeight: 18, color: '#075985' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'flex-start', gap: 2, padding: 12, borderRadius: 18, backgroundColor: SCAN.card, borderWidth: 1, borderColor: '#EEF2F7', ...CARD_SHADOW, shadowOpacity: 0.06 },
  statValue: { fontFamily: 'Poppins_700Bold', fontSize: 24, color: SCAN.ink, fontVariant: ['tabular-nums'] },
  statLabel: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: SCAN.muted },
  small: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 17, color: SCAN.muted, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: '18.8%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F1F5F9' },
  gpsBadge: { position: 'absolute', right: 3, bottom: 3, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: SCAN.limeBright },
  more: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.55)' },
  moreText: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: '#ffffff' },
  row: { flexDirection: 'row', gap: 10 },
  ghost: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: SCAN.line, backgroundColor: SCAN.surface },
  ghostText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: SCAN.ink },
  section: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: SCAN.muted, marginTop: 4 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: SCAN.line, backgroundColor: SCAN.surface },
  chipOn: { backgroundColor: SCAN.limeSoft, borderColor: SCAN.lime },
  chipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: SCAN.inkSoft },
  chipTextOn: { color: SCAN.limeInk },
  track: { alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3, backgroundColor: SCAN.lime },
  doneTitle: { fontFamily: 'Poppins_700Bold', fontSize: 22, color: SCAN.ink },
  doneBody: { fontFamily: 'Poppins_400Regular', fontSize: 13.5, lineHeight: 20, color: SCAN.inkSoft, textAlign: 'center' },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: '#F0F9FF' },
  syncText: { flexShrink: 1, fontFamily: 'Poppins_400Regular', fontSize: 12.5, lineHeight: 18, color: '#075985' },
  error: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: SCAN.red },
  ctaWrap: { borderRadius: 22, shadowColor: SCAN.lime, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 58, borderRadius: 22, paddingHorizontal: 20 },
  ctaText: { fontFamily: 'Poppins_700Bold', fontSize: 17, color: SCAN.limeInk },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 50, borderRadius: 20, borderWidth: 1.5, borderColor: SCAN.line, backgroundColor: SCAN.card },
  secondaryText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: SCAN.ink },
});
