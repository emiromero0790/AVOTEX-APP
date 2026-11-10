/**
 * Recorrido inteligente — "Antes de empezar".
 *
 * Todo lo que se muestra es real:
 * - Huerta: polígono y superficie guardados (o detección por GPS).
 * - Dispositivo: permisos de cámara y ubicación, conexión, espacio libre y batería del teléfono.
 *
 * Movimiento (animate-expo): el anillo de preparación avanza (500 ms, curva de salida) conforme
 * terminan las revisiones; cada revisión marca su check con un ZoomIn corto; la hoja para cambiar
 * de huerta sube desde abajo. Vibración ligera al elegir huerta. "Reducir movimiento": sin escalas.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Battery from 'expo-battery';
import * as Haptics from 'expo-haptics';
import Reanimated, {
  FadeIn, FadeInDown, FadeOut, FadeOutDown, LinearTransition, ZoomIn, useAnimatedProps, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import {
  AlertTriangle, BatteryMedium, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, HardDrive, Leaf, LocateFixed, MapPin, Play, Repeat2,
  TrendingUp, Wifi, WifiOff, X,
} from 'lucide-react-native';
import { withTimeout } from '../../services/timeout';
import { TranslationResource, useTranslations } from '../../context/LanguageContext';
import type { Orchard } from '../../services/orchards';
import { supabase } from '../../supabaseConfig';
import ScanHeader from './ScanHeader';
import { EASE_IN_OUT, EASE_OUT, PressableScale } from './motion';
import { CARD_SHADOW, SCAN } from './theme';

// Foto del héroe proporcionada por AVOTEX; vista aérea de Pexels (ver CREDITOS.md).
const IMG_HERO = require('../../assets/images/escanear/hero-recorrido.jpg');
const IMG_AERIAL = require('../../assets/images/escanear/recorrido-aereo.jpg');

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
const SHEET_IN = FadeInDown.duration(280).easing(EASE_OUT);
const SHEET_OUT = FadeOutDown.duration(200);
const EXPAND = LinearTransition.duration(260).easing(EASE_IN_OUT);

export type PermState = 'granted' | 'ask' | 'denied' | null;
type Status = 'ok' | 'warn' | 'info' | 'pending';

const translations: TranslationResource = {
  back: { es: 'Regresar', en: 'Go back' },
  chip: { es: 'Recorrido inteligente', en: 'Smart walk' },
  title: { es: 'Explora tu huerta con IA', en: 'Explore your orchard with AI' },
  subtitle: { es: 'Recorre, captura y analiza tus cultivos automáticamente.', en: 'Walk, capture and analyze your crops automatically.' },
  orchardTitle: { es: 'Huerta seleccionada', en: 'Selected orchard' },
  orchardAuto: { es: 'Detectar por GPS', en: 'Detect by GPS' },
  orchardAutoSub: { es: 'Se asigna sola con la ubicación de las fotos', en: 'Assigned from the photos’ location' },
  orchardArea: { es: '{ha} ha registradas', en: '{ha} ha registered' },
  orchardNoArea: { es: 'Huerta registrada', en: 'Registered orchard' },
  change: { es: 'Cambiar', en: 'Change' },
  sheetTitle: { es: 'Elige la huerta', en: 'Choose the orchard' },
  sheetEmpty: { es: 'Aún no tienes huertas dibujadas. Puedes crearlas en Mapeo.', en: 'You have no orchards yet. Create them in Mapping.' },
  close: { es: 'Cerrar', en: 'Close' },
  ready: { es: 'Dispositivo listo', en: 'Device ready' },
  readySub: { es: 'Todo está preparado para iniciar tu recorrido', en: 'Everything is ready to start your walk' },
  checking: { es: 'Revisando tu celular…', en: 'Checking your phone…' },
  checkingSub: { es: 'Permisos, conexión, espacio y batería', en: 'Permissions, connection, storage and battery' },
  almost: { es: 'Casi listo', en: 'Almost ready' },
  almostAsk: { es: 'Te pediremos los permisos al comenzar', en: 'We will ask for permissions when you start' },
  almostWarn: { es: 'Revisa los puntos marcados en amarillo', en: 'Check the items marked in yellow' },
  almostNa: { es: 'Algunas revisiones no están disponibles en este dispositivo', en: 'Some checks are not available on this device' },
  camera: { es: 'Cámara', en: 'Camera' },
  gps: { es: 'GPS', en: 'GPS' },
  connection: { es: 'Conexión', en: 'Connection' },
  storage: { es: 'Espacio', en: 'Storage' },
  battery: { es: 'Batería', en: 'Battery' },
  active: { es: 'Activa', en: 'Active' },
  activeM: { es: 'Activo', en: 'Active' },
  willAsk: { es: 'Se pedirá', en: 'Will ask' },
  denied: { es: 'Sin permiso', en: 'Denied' },
  wifi: { es: 'WiFi', en: 'WiFi' },
  cellular: { es: 'Datos', en: 'Data' },
  offline: { es: 'Sin señal', en: 'Offline' },
  enough: { es: 'Suficiente', en: 'Enough' },
  low: { es: 'Poco', en: 'Low' },
  na: { es: 'No disp.', en: 'N/A' },
  deniedHelp: { es: 'Activa el permiso en los Ajustes del teléfono.', en: 'Enable the permission in phone Settings.' },
  gpsDeniedHelp: { es: 'Sin GPS se graba igual, pero los hallazgos no tendrán ubicación.', en: 'Without GPS it still records, but findings will have no location.' },
  offlineHelp: { es: 'Sin señal también se graba: se sube cuando tengas conexión.', en: 'It records offline too: it uploads when you are online.' },
  cellularHelp: { es: 'Con datos móviles se sube al tener WiFi (o si lo permites en Mis recorridos).', en: 'On mobile data it uploads on WiFi (or if you allow it in My walks).' },
  lowSpaceHelp: { es: 'Libera espacio antes de grabar (mínimo 300 MB).', en: 'Free up space before recording (300 MB minimum).' },
  lowBatteryHelp: { es: 'Batería baja: la cámara y el GPS gastan más de lo normal.', en: 'Low battery: camera and GPS use more power than usual.' },
  goalTitle: { es: '¿Qué lograrás?', en: 'What will you get?' },
  goalBody: { es: 'El diagnóstico de los frutos de tu huerta, cada uno ubicado en el mapa.', en: 'A diagnosis of your orchard’s fruits, each one placed on the map.' },
  tipsTitle: { es: 'Antes de salir', en: 'Before you go' },
  start: { es: 'Comenzar recorrido', en: 'Start walk' },
};

type Props = {
  topInset: number;
  bottomInset: number;
  email: string;
  orchards: Orchard[];
  huertaId: string | null;
  onChangeOrchard: (id: string | null) => void;
  camera: PermState;
  location: PermState;
  /** null = revisando; 'na' = el teléfono no lo informó. */
  freeBytes: number | null | 'na';
  network: 'wifi' | 'cellular' | 'offline' | 'unknown';
  /** false mientras se revisa la conexión; 'unknown' ya revisado = no disponible. */
  networkChecked?: boolean;
  isWeb: boolean;
  tips: string[];
  onBack: () => void;
  onStart: () => void;
  /** Mientras se verifica la huerta por GPS: el botón muestra este texto y no responde. */
  busyLabel?: string | null;
};

/** Contorno real de la huerta, escalado a la miniatura. */
function OrchardShape({ orchard, size }: { orchard: Orchard; size: number }) {
  const pts = orchard.coordinates ?? [];
  const path = useMemo(() => {
    if (pts.length < 3) return null;
    const lats = pts.map(p => p.latitude);
    const lngs = pts.map(p => p.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const span = Math.max(maxLat - minLat, maxLng - minLng) || 1;
    const pad = 12;
    const k = (size - pad * 2) / span;
    const offX = (size - (maxLng - minLng) * k) / 2;
    const offY = (size - (maxLat - minLat) * k) / 2;
    return pts.map(p => `${(offX + (p.longitude - minLng) * k).toFixed(1)},${(offY + (maxLat - p.latitude) * k).toFixed(1)}`).join(' ');
  }, [pts, size]);
  return (
    <Svg width={size} height={size}>
      {path ? <Polygon points={path} fill="rgba(163,230,53,0.35)" stroke="#BEF264" strokeWidth={2.5} strokeLinejoin="round" /> : null}
    </Svg>
  );
}

function CheckCell({ icon, label, value, status, reduced }: { icon: React.ReactNode; label: string; value: string; status: Status; reduced: boolean }) {
  return (
    <View style={s.cell} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={s.cellIcon}>
        {icon}
        <View style={s.badgeSlot}>
          {status === 'pending' ? (
            <View style={[s.badge, s.badgePending]}><ActivityIndicator size={9} color="#D1FAE5" /></View>
          ) : (
            <Reanimated.View key={status} entering={reduced ? undefined : ZoomIn.duration(220).easing(EASE_OUT)} style={[s.badge, status === 'ok' ? s.badgeOk : status === 'warn' ? s.badgeWarn : s.badgeInfo]}>
              {status === 'ok' ? <Check size={9} color="#052e16" strokeWidth={3.5} /> : status === 'warn' ? <Text style={s.badgeMark}>!</Text> : <Text style={s.badgeMark}>i</Text>}
            </Reanimated.View>
          )}
        </View>
      </View>
      <Text style={s.cellLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{label}</Text>
      <Text style={[s.cellValue, status === 'warn' && { color: '#FDE68A' }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export default function WalkPrepare(props: Props) {
  const { topInset, bottomInset, email, orchards, huertaId, onChangeOrchard, camera, location, freeBytes, network, networkChecked = true, isWeb, tips, onBack, onStart, busyLabel = null } = props;
  const t = useTranslations(translations);
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const [tokens, setTokens] = useState<number | null>(null);
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null | 'na'>(null);
  const [sheet, setSheet] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);

  useEffect(() => {
    if (!email) return;
    Promise.resolve(supabase.from('users').select('tokens').eq('user_email', email).maybeSingle())
      .then(({ data }) => setTokens((data?.tokens ?? null) as number | null)).catch(() => {});
  }, [email]);

  // Batería real del teléfono (en web no está disponible).
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let alive = true;
    (async () => {
      try {
        // Con límite de tiempo: si el teléfono no responde, se muestra «No disponible».
        if (!(await withTimeout(Battery.isAvailableAsync(), 3000, false))) { if (alive) setBattery('na'); return; }
        const st = await withTimeout(Battery.getPowerStateAsync(), 3000, null);
        if (!alive) return;
        if (!st) { setBattery('na'); return; }
        if (st.batteryLevel < 0) { setBattery('na'); return; }
        const charging = st.batteryState === Battery.BatteryState.CHARGING || st.batteryState === Battery.BatteryState.FULL;
        setBattery({ level: st.batteryLevel, charging });
        sub = Battery.addBatteryLevelListener(e => setBattery(prev => ({ level: e.batteryLevel, charging: prev && prev !== 'na' ? prev.charging : false })));
      } catch { if (alive) setBattery('na'); }
    })();
    return () => { alive = false; sub?.remove(); };
  }, []);

  const selected = orchards.find(o => o.id === huertaId) ?? null;
  const gb = typeof freeBytes === 'number' ? freeBytes / 1024 ** 3 : null;
  const lowSpace = typeof freeBytes === 'number' && freeBytes < 300 * 1024 * 1024;
  const spaceNa = isWeb || freeBytes === 'na';

  const perm = (p: PermState, female: boolean): { status: Status; value: string } =>
    !p ? { status: 'pending', value: '…' }
      : p === 'granted' ? { status: 'ok', value: female ? t('active') : t('activeM') }
      : p === 'denied' ? { status: 'warn', value: t('denied') }
      : { status: 'info', value: t('willAsk') };

  const checks = [
    { key: 'camera', icon: <Camera size={22} color="#ECFDF5" />, label: t('camera'), ...perm(camera, true), help: camera === 'denied' ? t('deniedHelp') : null },
    { key: 'gps', icon: <MapPin size={22} color="#ECFDF5" />, label: t('gps'), ...perm(location, false), help: location === 'denied' ? t('gpsDeniedHelp') : null },
    {
      key: 'net', icon: network === 'offline' ? <WifiOff size={22} color="#ECFDF5" /> : <Wifi size={22} color="#ECFDF5" />, label: t('connection'),
      // Sin señal no impide grabar: el recorrido funciona sin internet.
      status: (!networkChecked ? 'pending' : network === 'unknown' ? 'info' : 'ok') as Status,
      value: network === 'wifi' ? t('wifi') : network === 'cellular' ? t('cellular') : network === 'offline' ? t('offline') : !networkChecked ? '…' : t('na'),
      help: network === 'offline' ? t('offlineHelp') : network === 'cellular' ? t('cellularHelp') : null,
    },
    {
      key: 'storage', icon: <HardDrive size={22} color="#ECFDF5" />, label: t('storage'),
      status: (spaceNa ? 'info' : gb == null ? 'pending' : lowSpace ? 'warn' : 'ok') as Status,
      value: spaceNa ? t('na') : gb == null ? '…' : lowSpace ? t('low') : gb >= 10 ? `${Math.round(gb)} GB` : `${gb.toFixed(1)} GB`,
      help: lowSpace ? t('lowSpaceHelp') : null,
    },
    {
      key: 'battery', icon: <BatteryMedium size={22} color="#ECFDF5" />, label: t('battery'),
      status: (battery === null ? 'pending' : battery === 'na' ? 'info' : battery.level < 0.2 && !battery.charging ? 'warn' : 'ok') as Status,
      value: battery === null ? '…' : battery === 'na' ? t('na') : `${Math.round(battery.level * 100)}%`,
      help: battery && battery !== 'na' && battery.level < 0.2 && !battery.charging ? t('lowBatteryHelp') : null,
      // Solo informativa: con poca batería se ve en amarillo y con su nota, pero no impide estar listo.
      advisory: true,
    },
  ] as { key: string; icon: React.ReactNode; label: string; status: Status; value: string; help: string | null; advisory?: boolean }[];
  // Una revisión informativa cuenta como lista en cuanto se conoce su valor (sin importar cuál sea).
  const isReady = (c: { status: Status; advisory?: boolean }) => c.status === 'ok' || (!!c.advisory && c.status !== 'pending');
  const total = checks.length;
  const okCount = checks.filter(isReady).length;
  const pending = checks.some(c => c.status === 'pending');
  const warn = checks.some(c => c.status === 'warn' && !c.advisory);
  const allOk = okCount === total;
  const helps = checks.map(c => c.help).filter(Boolean) as string[];
  const headline = pending ? t('checking') : allOk ? t('ready') : t('almost');
  const asking = camera === 'ask' || location === 'ask';
  const sub = pending ? t('checkingSub') : allOk ? t('readySub') : warn ? t('almostWarn') : asking ? t('almostAsk') : t('almostNa');
  const narrow = width < 380;

  // Anillo de preparación: avanza con las revisiones terminadas.
  const R = 30;
  const C = 2 * Math.PI * R;
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(okCount / total, { duration: reduced ? 0 : 500, easing: EASE_OUT }));
  }, [okCount, total, progress, reduced]);
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - progress.get()) }));

  const heroH = Math.round(Math.min(Math.max(height * 0.46, 340), isTablet ? 520 : 430));
  const contentW = isTablet ? Math.min(width - 64, 680) : width;

  const pickOrchard = (id: string | null) => {
    if (id !== huertaId) Haptics.selectionAsync().catch(() => {});
    onChangeOrchard(id);
    setSheet(false);
  };

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomInset + 120 }} showsVerticalScrollIndicator={false}>
        {/* ── Héroe fotográfico ── */}
        <View style={[s.hero, { height: heroH + topInset }]}>
          <Image source={IMG_HERO} style={s.img} resizeMode="cover" accessibilityIgnoresInvertColors />
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0)']} locations={[0, 0.3, 0.45]} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(5,30,15,0.7)', 'rgba(5,30,15,0.25)', 'rgba(5,30,15,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 0.85, y: 0.5 }} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)', '#FFFFFF']} locations={[0.72, 0.93, 1]} style={StyleSheet.absoluteFill} />
          {/* trazo de recorrido */}
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none">
            <Path d="M 70 70 C 82 58, 92 52, 106 40" stroke="rgba(132,204,22,0.75)" strokeWidth={0.9} fill="none" strokeLinecap="round" />
          </Svg>
          <View style={[s.heroTop, { paddingTop: topInset + 8, width: contentW }]}>
            <View style={s.headRow}>
              <PressableScale style={s.back} onPress={onBack} accessibilityRole="button" accessibilityLabel={t('back')}><ChevronLeft size={22} color={SCAN.ink} /></PressableScale>
              <View style={{ flex: 1 }}><ScanHeader remaining={tokens != null ? tokens * 100 : null} email={email} onImage /></View>
            </View>
            <Text style={[s.title, isTablet && s.titleTablet]} accessibilityRole="header">{t('title')}</Text>
            <Text style={s.subtitle}>{t('subtitle')}</Text>
          </View>
        </View>

        <View style={[s.body, { width: contentW, marginTop: -Math.round(heroH * 0.16) }]}>
          {/* ── Huerta seleccionada ── */}
          <View style={s.orchardCard}>
            <View style={s.cardHead}><Leaf size={18} color={SCAN.lime} fill="#BEF264" /><Text style={s.cardHeadText}>{t('orchardTitle')}</Text></View>
            <View style={s.orchardRow}>
              <View style={s.orchardThumb}>
                <Image source={IMG_AERIAL} style={s.img} resizeMode="cover" accessibilityIgnoresInvertColors />
                <View style={s.thumbShade} />
                <View style={s.thumbShape}>
                  {selected ? <OrchardShape orchard={selected} size={88} /> : <View style={s.gpsDot}><LocateFixed size={22} color="#ffffff" /></View>}
                </View>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.orchardName} numberOfLines={2}>{selected?.nombre ?? t('orchardAuto')}</Text>
                <View style={s.orchardMetaRow}>
                  <MapPin size={13} color={SCAN.muted} />
                  <Text style={s.orchardMeta} numberOfLines={2}>
                    {selected ? (selected.area_m2 ? t('orchardArea', { ha: (Number(selected.area_m2) / 10000).toFixed(1) }) : t('orchardNoArea')) : t('orchardAutoSub')}
                  </Text>
                </View>
              </View>
              {/* En pantallas angostas solo el icono, para no partir el nombre de la huerta. */}
              <PressableScale style={[s.changeBtn, narrow && s.changeBtnIcon]} onPress={() => setSheet(true)} accessibilityRole="button" accessibilityLabel={t('change')}>
                <Repeat2 size={16} color={SCAN.ink} />
                {!narrow && <Text style={s.changeText}>{t('change')}</Text>}
              </PressableScale>
            </View>
          </View>

          {/* ── Dispositivo ── */}
          <LinearGradient colors={['#1E5A3C', '#14432C', '#0F3523']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.deviceCard}>
            <View style={s.deviceHead}>
              <View style={s.ring}>
                <Svg width={76} height={76} viewBox="0 0 76 76">
                  <Circle cx={38} cy={38} r={R} stroke="rgba(255,255,255,0.14)" strokeWidth={7} fill="none" />
                  <AnimatedCircle
                    cx={38} cy={38} r={R} stroke="#84CC16" strokeWidth={7} fill="none" strokeLinecap="round"
                    strokeDasharray={`${C} ${C}`} animatedProps={ringProps} transform="rotate(-90 38 38)"
                  />
                </Svg>
                <View style={s.ringCenter}>
                  {pending ? <ActivityIndicator color="#BEF264" />
                    : allOk ? <Reanimated.View entering={reduced ? undefined : ZoomIn.duration(260).easing(EASE_OUT)}><Check size={30} color="#BEF264" strokeWidth={3.5} /></Reanimated.View>
                    : warn ? <AlertTriangle size={24} color="#FCD34D" /> : <Text style={s.ringCount}>{okCount}/{total}</Text>}
                </View>
              </View>
              <View style={{ flex: 1, gap: 2, paddingRight: 58 }}>
                <Reanimated.Text key={headline} entering={reduced ? undefined : FadeIn.duration(200)} style={s.deviceTitle}>{headline}</Reanimated.Text>
                <Text style={s.deviceSub}>{sub}</Text>
              </View>
              <View style={[s.countPill, allOk ? s.countOk : s.countWait]}>
                <Text style={[s.countText, allOk && { color: '#052e16' }]}>{okCount}/{total}</Text>
                {allOk && <Check size={13} color="#052e16" strokeWidth={3} />}
              </View>
            </View>
            <View style={s.cells}>
              {checks.map((c, i) => (
                <React.Fragment key={c.key}>
                  {i > 0 && <View style={s.sep} />}
                  <CheckCell icon={c.icon} label={c.label} value={c.value} status={c.status} reduced={reduced} />
                </React.Fragment>
              ))}
            </View>
            {helps.length > 0 && (
              <Reanimated.View entering={reduced ? undefined : FadeIn.duration(200)} style={s.helps}>
                {helps.map(h => <Text key={h} style={s.help}>• {h}</Text>)}
              </Reanimated.View>
            )}
          </LinearGradient>

          {/* ── ¿Qué lograrás? ── */}
          <LinearGradient colors={['#1E5A3C', '#14432C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.goalCard}>
            <View style={s.goalArt}>
              <Image source={IMG_AERIAL} style={s.img} resizeMode="cover" accessibilityIgnoresInvertColors />
              <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
                <Polygon points="22,58 62,40 88,62 48,84" fill="rgba(163,230,53,0.35)" stroke="#BEF264" strokeWidth={1.4} />
              </Svg>
              <View style={s.goalPin}><MapPin size={26} color="#38BDF8" fill="#E0F2FE" /></View>
              <LinearGradient colors={['rgba(20,67,44,0)', '#14432C']} start={{ x: 0.55, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
            </View>
            <View style={s.goalText}>
              <View style={s.goalTitleRow}>
                <Text style={s.goalTitle}>{t('goalTitle')}</Text>
                <TrendingUp size={20} color="#4ADE80" />
              </View>
              <Text style={s.goalBody}>{t('goalBody')}</Text>
            </View>
          </LinearGradient>

          {/* ── Recomendaciones (se pueden desplegar) ── */}
          <Reanimated.View layout={reduced ? undefined : EXPAND} style={s.tipsCard}>
            <Pressable style={s.tipsHead} onPress={() => setTipsOpen(o => !o)} accessibilityRole="button" accessibilityState={{ expanded: tipsOpen }}>
              <Text style={s.tipsTitle}>{t('tipsTitle')}</Text>
              <View style={[s.tipsCount]}><Text style={s.tipsCountText}>{tips.length}</Text></View>
              <View style={{ flex: 1 }} />
              <View style={{ transform: [{ rotate: tipsOpen ? '180deg' : '0deg' }], transitionProperty: 'transform', transitionDuration: 200 } as object}>
                <ChevronDown size={20} color={SCAN.muted} />
              </View>
            </Pressable>
            {tipsOpen && (
              <Reanimated.View entering={reduced ? undefined : FadeIn.duration(200)} exiting={reduced ? undefined : FadeOut.duration(120)} style={{ gap: 10 }}>
                {tips.map((tip, i) => (
                  <View key={i} style={s.tipRow}>
                    <View style={s.tipNum}><Text style={s.tipNumText}>{i + 1}</Text></View>
                    <Text style={s.tipText}>{tip}</Text>
                  </View>
                ))}
              </Reanimated.View>
            )}
          </Reanimated.View>
        </View>
      </ScrollView>

      {/* ── Acción fija ── */}
      <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.95)', '#FFFFFF']} locations={[0, 0.4, 1]} style={[s.footer, { paddingBottom: bottomInset + 14 }]} pointerEvents="box-none">
        <PressableScale
          style={[s.ctaWrap, lowSpace && { opacity: 0.5 }, isTablet && { width: contentW - 32, alignSelf: 'center' }]}
          onPress={onStart}
          disabled={lowSpace || !!busyLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: lowSpace, busy: !!busyLabel }}
          accessibilityLabel={busyLabel ?? t('start')}
        >
          <LinearGradient colors={['#22C55E', '#16A34A', '#15803D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cta}>
            {busyLabel ? <ActivityIndicator color="#ffffff" /> : <Play size={24} color="#ffffff" />}
            <Text style={[s.ctaText, !!busyLabel && { fontSize: 16 }]} numberOfLines={1}>{busyLabel ?? t('start')}</Text>
            <ChevronRight size={24} color="#ffffff" />
          </LinearGradient>
        </PressableScale>
      </LinearGradient>

      {/* ── Hoja para cambiar de huerta ── */}
      <Modal visible={sheet} transparent animationType="none" statusBarTranslucent onRequestClose={() => setSheet(false)}>
        <Reanimated.View entering={FadeIn.duration(180)} style={s.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheet(false)} accessibilityLabel={t('close')} />
          <Reanimated.View entering={reduced ? FadeIn.duration(150) : SHEET_IN} exiting={reduced ? undefined : SHEET_OUT} style={[s.sheet, { paddingBottom: bottomInset + 16 }]}>
            <View style={s.grabber} />
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>{t('sheetTitle')}</Text>
              <PressableScale style={s.sheetClose} onPress={() => setSheet(false)} accessibilityRole="button" accessibilityLabel={t('close')}><X size={18} color={SCAN.muted} /></PressableScale>
            </View>
            <ScrollView style={{ maxHeight: height * 0.5 }} contentContainerStyle={{ gap: 8 }}>
              {[{ id: null as string | null, nombre: t('orchardAuto'), area: null as number | null }, ...orchards.map(o => ({ id: o.id as string | null, nombre: o.nombre, area: o.area_m2 ? Number(o.area_m2) : null }))].map(o => {
                const on = huertaId === o.id;
                return (
                  <PressableScale key={o.id ?? 'auto'} style={[s.option, on && s.optionOn]} onPress={() => pickOrchard(o.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                    {o.id === null ? <LocateFixed size={18} color={SCAN.brand} /> : <Leaf size={18} color={SCAN.lime} />}
                    <View style={{ flex: 1 }}>
                      <Text style={s.optionName}>{o.nombre}</Text>
                      <Text style={s.optionMeta}>{o.id === null ? t('orchardAutoSub') : o.area ? t('orchardArea', { ha: (o.area / 10000).toFixed(1) }) : t('orchardNoArea')}</Text>
                    </View>
                    <View style={[s.radio, on && s.radioOn]}>{on && <Check size={13} color="#ffffff" strokeWidth={3} />}</View>
                  </PressableScale>
                );
              })}
              {!orchards.length && <Text style={s.sheetEmpty}>{t('sheetEmpty')}</Text>}
            </ScrollView>
          </Reanimated.View>
        </Reanimated.View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SCAN.bg },
  img: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  hero: { width: '100%', overflow: 'hidden', alignItems: 'center' },
  heroTop: { paddingHorizontal: 18, gap: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 14, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(22,101,52,0.55)', borderWidth: 1, borderColor: 'rgba(190,242,100,0.6)',
  },
  chipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, letterSpacing: 0.6, color: '#ECFCCB' },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 34, lineHeight: 40, letterSpacing: -0.9, color: '#ffffff', maxWidth: 300, marginTop: 4 },
  titleTablet: { fontSize: 44, lineHeight: 50, maxWidth: 460 },
  subtitle: { fontFamily: 'Poppins_400Regular', fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.92)', maxWidth: 280 },
  body: { alignSelf: 'center', paddingHorizontal: 16, gap: 14 },
  orchardCard: { padding: 14, gap: 12, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.97)', ...CARD_SHADOW },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardHeadText: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#14532D' },
  orchardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orchardThumb: { width: 96, height: 72, borderRadius: 16, overflow: 'hidden', backgroundColor: '#14432C' },
  thumbShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,30,15,0.35)' },
  thumbShape: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  gpsDot: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,118,110,0.85)', borderWidth: 2, borderColor: '#ffffff' },
  orchardName: { fontFamily: 'Poppins_600SemiBold', fontSize: 16.5, lineHeight: 21, color: SCAN.ink },
  orchardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  orchardMeta: { flexShrink: 1, fontFamily: 'Poppins_400Regular', fontSize: 12.5, lineHeight: 17, color: SCAN.muted },
  changeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: SCAN.surface, borderWidth: 1, borderColor: SCAN.line },
  changeBtnIcon: { width: 40, paddingHorizontal: 0, justifyContent: 'center' },
  changeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: SCAN.ink },
  deviceCard: { borderRadius: 26, padding: 14, gap: 14, ...CARD_SHADOW, shadowOpacity: 0.2 },
  deviceHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ring: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  ringCount: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: '#ECFDF5' },
  deviceTitle: { fontFamily: 'Poppins_700Bold', fontSize: 19, color: '#ffffff' },
  deviceSub: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, lineHeight: 18, color: 'rgba(236,253,245,0.82)' },
  countPill: { position: 'absolute', top: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 28, borderRadius: 14 },
  countOk: { backgroundColor: '#4ADE80' },
  countWait: { backgroundColor: 'rgba(255,255,255,0.14)' },
  countText: { fontFamily: 'Poppins_700Bold', fontSize: 13, color: '#ECFDF5' },
  cells: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: 12, paddingHorizontal: 4, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.18)' },
  sep: { width: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 6 },
  cell: { flex: 1, alignItems: 'center', gap: 3 },
  cellIcon: { width: 36, height: 30, alignItems: 'center', justifyContent: 'center' },
  badgeSlot: { position: 'absolute', right: -2, bottom: -2 },
  badge: { width: 15, height: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#14432C' },
  badgeOk: { backgroundColor: '#4ADE80' },
  badgeWarn: { backgroundColor: '#FCD34D' },
  badgeInfo: { backgroundColor: '#93C5FD' },
  badgePending: { backgroundColor: 'rgba(255,255,255,0.2)' },
  badgeMark: { fontFamily: 'Poppins_700Bold', fontSize: 9, lineHeight: 11, color: '#052e16' },
  cellLabel: { alignSelf: 'stretch', textAlign: 'center', paddingHorizontal: 2, fontFamily: 'Poppins_600SemiBold', fontSize: 11.5, color: '#ffffff' },
  cellValue: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: 'rgba(236,253,245,0.8)' },
  helps: { gap: 4, paddingHorizontal: 4 },
  help: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 17, color: 'rgba(236,253,245,0.85)' },
  goalCard: { flexDirection: 'row', minHeight: 132, borderRadius: 26, overflow: 'hidden', ...CARD_SHADOW, shadowOpacity: 0.18 },
  goalArt: { width: '42%' },
  goalPin: { position: 'absolute', left: '42%', top: '24%' },
  goalText: { flex: 1, padding: 14, gap: 6, justifyContent: 'center' },
  goalTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  goalTitle: { fontFamily: 'Poppins_700Bold', fontSize: 17, color: '#ffffff' },
  goalBody: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 19, color: 'rgba(236,253,245,0.86)' },
  tipsCard: { borderRadius: 22, padding: 14, gap: 12, backgroundColor: SCAN.card, borderWidth: 1, borderColor: '#EEF2F7', ...CARD_SHADOW, shadowOpacity: 0.06 },
  tipsHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  tipsTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: SCAN.ink },
  tipsCount: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: SCAN.limeSoft },
  tipsCountText: { fontFamily: 'Poppins_700Bold', fontSize: 11.5, color: SCAN.limeInk },
  tipRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCFCE7', marginTop: 1 },
  tipNumText: { fontFamily: 'Poppins_700Bold', fontSize: 11.5, color: '#166534' },
  tipText: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 13.5, lineHeight: 20, color: SCAN.inkSoft },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 30 },
  ctaWrap: { borderRadius: 30, shadowColor: '#15803D', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, height: 64, borderRadius: 30, paddingHorizontal: 22 },
  ctaText: { flex: 1, textAlign: 'center', fontFamily: 'Poppins_700Bold', fontSize: 19, color: '#ffffff' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#E2E8F0' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: 'Poppins_700Bold', fontSize: 18, color: SCAN.ink },
  sheetClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: SCAN.surface },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: SCAN.line, backgroundColor: SCAN.surface },
  optionOn: { borderColor: SCAN.lime, backgroundColor: SCAN.limeSoft },
  optionName: { fontFamily: 'Poppins_600SemiBold', fontSize: 14.5, color: SCAN.ink },
  optionMeta: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: SCAN.muted },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  sheetEmpty: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 19, color: SCAN.muted, textAlign: 'center', paddingVertical: 8 },
});
