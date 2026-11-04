/**
 * Escanear — selector de modalidad.
 *
 * Dos modalidades con el mismo peso visual dentro de un "visor" oscuro:
 * - Recorrido inteligente (verde): vista aérea con la ruta, puntos de captura y detecciones.
 * - Foto individual (morado): fruto encuadrado por la retícula de la cámara.
 *
 * Movimiento (skill animate-expo):
 * - El cambio de modalidad se hace con el dedo (paginado nativo) o tocando el selector; el indicador
 *   sigue el desplazamiento en el hilo de UI (useAnimatedScrollHandler), sin renders por fotograma.
 * - El cambio de modalidad se confirma con Haptics.selectionAsync, una vez por cambio.
 * - Solo la modalidad visible tiene una animación continua (pulso o línea de escaneo); la otra queda en pausa.
 * - Sin animaciones de entrada al visitar la pestaña: se abre decenas de veces al día.
 * - "Reducir movimiento": no hay bucles y el cambio de página es instantáneo.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkState } from 'expo-network';
import * as Haptics from 'expo-haptics';
import Reanimated, {
  FadeIn,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { ArrowRight, Camera, ChevronRight, CloudUpload, Coins, Footprints, Lock, ScanLine, Sparkles, WifiOff, Wifi, Aperture, Smartphone } from 'lucide-react-native';
import { TranslationResource, useTranslations } from '../context/LanguageContext';
import { CSS_EASE_OUT, EASE_OUT, PressableScale, PulseRing } from './scan/motion';

// Fotos de Pexels (licencia Pexels: uso comercial libre). Ver assets/images/escanear/CREDITOS.md
const IMG_AERIAL = require('../assets/images/escanear/recorrido-aereo.jpg');
const IMG_AVOCADO = require('../assets/images/escanear/foto-aguacate.jpg');
// Fotos reales de montaje (Flickr, CC BY 2.0 y CC BY-SA 2.0). Ver CREDITOS.md
const IMG_MOUNT_CHEST = require('../assets/images/escanear/montaje-pecho.jpg');
const IMG_MOUNT_HELMET = require('../assets/images/escanear/montaje-casco.jpg');

// Paleta: pantalla blanca; los acentos claros (GREEN/PURPLE) solo se usan sobre las fotos del visor.
const BG = '#FFFFFF';
const INK = '#0A0A0A';
const MUTED = '#5B6B73';
const LINE = '#E5E7EB';
const SURFACE = '#F8FAFC';
const G_TXT = '#047857';
const P_TXT = '#6D28D9';
const GREEN = '#34D399';
const GREEN_DEEP = '#0f766e';
const PURPLE = '#A78BFA';

const STEPS_FADE = FadeIn.duration(200).easing(EASE_OUT);

const translations: TranslationResource = {
  kicker: { es: 'AVOTEX · Visión IA', en: 'AVOTEX · AI Vision' },
  title: { es: 'Escanear', en: 'Scan' },
  subtitle: { es: 'Elige cómo quieres revisar tu cultivo.', en: 'Choose how to check your crop.' },
  tokens: { es: 'tokens', en: 'tokens' },
  tokensA11y: { es: '{value} tokens disponibles', en: '{value} tokens available' },
  // selector
  walkTab: { es: 'Recorrido', en: 'Field walk' },
  walkTabSub: { es: 'Automático', en: 'Automatic' },
  photoTab: { es: 'Foto', en: 'Photo' },
  photoTabSub: { es: 'Manual', en: 'Manual' },
  swipeHint: { es: 'Desliza para cambiar de modalidad', en: 'Swipe to switch mode' },
  // recorrido
  walkTitle: { es: 'Recorrido inteligente', en: 'Smart field walk' },
  walkBody: {
    es: 'Lleva el celular en el pecho o casco y camina tu huerta. AVOTEX toma las fotos solo y elige las mejores para la IA.',
    en: 'Wear the phone on your chest or helmet and walk your orchard. AVOTEX takes the photos and picks the best ones for the AI.',
  },
  walkBadge: { es: 'Captura automática', en: 'Auto capture' },
  walkOffline: { es: 'Sin internet', en: 'Offline' },
  walkStep1: { es: 'Coloca el celular', en: 'Mount the phone' },
  walkStep2: { es: 'Camina tu huerta', en: 'Walk the orchard' },
  walkStep3: { es: 'Recibe el análisis', en: 'Get the analysis' },
  walkInfo: {
    es: 'Funciona sin señal: las fotos se guardan en el celular y se suben cuando tengas WiFi.',
    en: 'Works without signal: photos are saved on the phone and upload when you are on WiFi.',
  },
  pendingOne: { es: '1 recorrido por subir', en: '1 walk to upload' },
  pendingMany: { es: '{count} recorridos por subir', en: '{count} walks to upload' },
  pendingPhotos: { es: '{count} fotos en tu celular', en: '{count} photos on your phone' },
  pendingOpen: { es: 'Ver', en: 'View' },
  walkCta: { es: 'Iniciar recorrido', en: 'Start walk' },
  walkLocked: { es: 'Crea una cuenta para usarlo', en: 'Create an account to use it' },
  myWalks: { es: 'Mis recorridos y resultados', en: 'My walks and results' },
  mountTitle: { es: '¿Dónde llevar el celular?', en: 'Where to wear the phone?' },
  mountChest: { es: 'En el pecho', en: 'On your chest' },
  mountChestBody: { es: 'Arnés de pecho, cámara al frente. Las manos quedan libres.', en: 'Chest harness, camera facing forward. Hands stay free.' },
  mountHelmet: { es: 'En el casco', en: 'On a helmet' },
  mountHelmetBody: { es: 'Soporte en el casco: ve lo que tú ves, a la altura de los frutos.', en: 'Helmet mount: it sees what you see, at fruit height.' },
  mountBest: { es: 'Recomendado', en: 'Recommended' },
  detectFruit: { es: 'Fruto', en: 'Fruit' },
  detectLeaf: { es: 'Hoja', en: 'Leaf' },
  detectReview: { es: 'Revisar', en: 'Check' },
  // foto
  photoTitle: { es: 'Foto individual', en: 'Single photo' },
  photoBody: {
    es: 'Apunta a un fruto, hoja o árbol y toma la foto. La IA te da el diagnóstico en segundos.',
    en: 'Point at a fruit, leaf or tree and take the photo. The AI gives you a diagnosis in seconds.',
  },
  photoBadge: { es: 'Diagnóstico al instante', en: 'Instant diagnosis' },
  photoStep1: { es: 'Encuadra', en: 'Frame it' },
  photoStep2: { es: 'Captura', en: 'Capture' },
  photoStep3: { es: 'Diagnóstico', en: 'Diagnosis' },
  photoInfo: { es: 'Necesita internet. Cada foto usa tokens de tu saldo.', en: 'Needs internet. Each photo uses tokens from your balance.' },
  photoOffline: { es: 'Sin conexión: la foto individual necesita internet. Prueba el recorrido, que funciona sin señal.', en: 'Offline: single photo needs internet. Try the field walk, it works without signal.' },
  photoCta: { es: 'Abrir cámara', en: 'Open camera' },
};

type Mode = 'walk' | 'photo';
const MODES: Mode[] = ['walk', 'photo'];
type T = (key: string, vars?: Record<string, string | number>) => string;

type Props = {
  isGuest: boolean;
  /** Tokens disponibles ya formateados (ej. "4,800"), o null si aún no se conocen. */
  tokensValue: string | null;
  pendingWalks: number;
  pendingPhotos: number;
  onPhoto: () => void;
  onWalk: () => void;
  /** Abre la lista de recorridos guardados y sus resultados. */
  onOpenWalks: () => void;
};

// ───────────────────────── capas de visión ─────────────────────────

/** Esquinas de un encuadre de detección (coordenadas en el viewBox 0–900 de la foto). */
function Brackets({ x, y, w, h, color, len = 16, sw = 4 }: { x: number; y: number; w: number; h: number; color: string; len?: number; sw?: number }) {
  const d = [
    `M${x} ${y + len} V${y} H${x + len}`,
    `M${x + w - len} ${y} H${x + w} V${y + len}`,
    `M${x + w} ${y + h - len} V${y + h} H${x + w - len}`,
    `M${x + len} ${y + h} H${x} V${y + h - len}`,
  ].join(' ');
  return <Path d={d} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
}

type Pct = `${number}%`;
const pct = (n: number): Pct => `${Number(n.toFixed(2))}%`;

/**
 * Coloca una vista sobre la foto en coordenadas del viewBox 0–900.
 * La foto es cuadrada y se recorta centrada ("cover"), igual que el SVG con "xMidYMid slice":
 * se calcula el mismo recorte para que etiquetas y encuadres coincidan.
 */
function useScenePoint(size: { w: number; h: number }) {
  return useCallback((x: number, y: number) => {
    const side = Math.max(size.w, size.h);
    const offX = (side - size.w) / 2;
    const offY = (side - size.h) / 2;
    return { left: (x / 900) * side - offX, top: (y / 900) * side - offY, scale: side / 900 };
  }, [size.w, size.h]);
}

/** Etiqueta pegada a una detección. */
function DetectTag({ left, top, label, color }: { left: number; top: number; label: string; color: string }) {
  return (
    <View pointerEvents="none" style={[v.tag, { left, top: top - 22, backgroundColor: color }]}>
      <Text style={v.tagText}>{label}</Text>
    </View>
  );
}

/** Vista aérea de la huerta con la ruta del recorrido, fotos tomadas y detecciones. */
function WalkScene({ size, active, locked, t }: { size: { w: number; h: number }; active: boolean; locked: boolean; t: T }) {
  const at = useScenePoint(size);
  // Carril entre hileras: x = 120 + 0.28·y (viewBox 0–900). La ruta ocupa la mitad superior:
  // el título del visor va sobre la parte baja.
  const lane = (y: number) => 120 + 0.28 * y;
  const shots = [455, 400, 345, 290];
  const head = { x: lane(235), y: 235 };
  const fruitBox = { x: lane(420) - 116, y: 392 };
  const reviewBox = { x: lane(290) + 44, y: 268 };
  const headPt = at(head.x, head.y);
  const fruitPt = at(fruitBox.x, fruitBox.y);
  const reviewPt = at(reviewBox.x, reviewBox.y);
  return (
    <View style={[v.scene, { width: size.w, height: size.h }]}>
      <Image source={IMG_AERIAL} style={v.img} resizeMode="cover" accessibilityIgnoresInvertColors />
      <LinearGradient colors={['rgba(4,20,15,0.55)', 'rgba(4,20,15,0)', 'rgba(4,20,15,0.25)', 'rgba(4,20,15,0.96)']} locations={[0, 0.28, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 900 900" preserveAspectRatio="xMidYMid slice">
        {/* zona que la cámara del pecho tiene enfrente */}
        <Path d={`M${head.x} ${head.y} L${head.x - 80} ${head.y - 95} A 120 120 0 0 1 ${head.x + 65} ${head.y - 105} Z`} fill={GREEN} fillOpacity={0.18} />
        {/* ruta recorrida */}
        <Path d={`M${lane(480)} 480 L${head.x} ${head.y}`} stroke="#ffffff" strokeOpacity={0.9} strokeWidth={5} strokeLinecap="round" strokeDasharray="2 16" />
        {shots.map(y => (
          <Circle key={y} cx={lane(y)} cy={y} r={9} fill={GREEN} stroke="#04140F" strokeWidth={3} />
        ))}
        {/* detecciones sobre las copas vecinas */}
        <Brackets x={fruitBox.x} y={fruitBox.y} w={72} h={72} color={GREEN} />
        <Brackets x={lane(330) - 110} y={305} w={62} h={62} color={GREEN} />
        <Brackets x={reviewBox.x} y={reviewBox.y} w={72} h={72} color="#FBBF24" />
      </Svg>
      <DetectTag left={fruitPt.left} top={fruitPt.top} label={t('detectFruit')} color={GREEN} />
      <DetectTag left={reviewPt.left} top={reviewPt.top} label={t('detectReview')} color="#FBBF24" />
      {!locked && (
        <View pointerEvents="none" style={[v.anchor, { left: headPt.left, top: headPt.top }]}>
          <PulseRing size={42} color="#ffffff" paused={!active} />
          <View style={v.walker}><Smartphone size={13} color={GREEN_DEEP} /></View>
        </View>
      )}
    </View>
  );
}

/** Fruto en el árbol encuadrado por la retícula de la cámara, con la línea de análisis. */
function PhotoScene({ size, active, t }: { size: { w: number; h: number }; active: boolean; t: T }) {
  const reduced = useReducedMotion();
  const at = useScenePoint(size);
  // Caja del fruto en el viewBox 0–900 (el fruto queda al centro de la foto).
  const box = { x: 365, y: 360, w: 170, h: 175 };
  const leaf = { x: 760, y: 222, w: 92, h: 78 };
  const b = at(box.x, box.y);
  const l = at(leaf.x, leaf.y);
  const boxW = box.w * b.scale;
  const boxH = box.h * b.scale;
  return (
    <View style={[v.scene, { width: size.w, height: size.h }]}>
      <Image source={IMG_AVOCADO} style={v.img} resizeMode="cover" accessibilityIgnoresInvertColors />
      <LinearGradient colors={['rgba(20,8,45,0.55)', 'rgba(20,8,45,0)', 'rgba(20,8,45,0.3)', 'rgba(14,6,32,0.97)']} locations={[0, 0.28, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 900 900" preserveAspectRatio="xMidYMid slice">
        {/* encuadre general de la cámara */}
        <Brackets x={235} y={170} w={430} h={410} color="#ffffff" len={38} sw={5} />
        {/* fruto detectado */}
        <Rect x={box.x} y={box.y} width={box.w} height={box.h} rx={18} fill={PURPLE} fillOpacity={0.12} />
        <Brackets x={box.x} y={box.y} w={box.w} h={box.h} color={PURPLE} len={30} sw={5} />
        {/* hoja con manchas */}
        <Brackets x={leaf.x} y={leaf.y} w={leaf.w} h={leaf.h} color="#FBBF24" len={18} />
      </Svg>
      {/* Línea de análisis dentro del fruto: única animación continua de esta modalidad. */}
      {!reduced && (
        <View pointerEvents="none" style={[v.scanBox, { left: b.left, top: b.top, width: boxW, height: boxH }]}>
          <Reanimated.View
            style={[
              v.scanLine,
              {
                animationName: { from: { transform: [{ translateY: 4 }] }, to: { transform: [{ translateY: Math.max(8, boxH - 8) }] } },
                animationDuration: 1500,
                animationIterationCount: 'infinite',
                animationDirection: 'alternate',
                animationTimingFunction: 'ease-in-out',
                animationPlayState: active ? 'running' : 'paused',
              },
            ]}
          >
            <LinearGradient colors={['rgba(196,181,253,0)', 'rgba(221,214,254,1)', 'rgba(196,181,253,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Reanimated.View>
        </View>
      )}
      <DetectTag left={b.left} top={b.top} label={t('detectFruit')} color={PURPLE} />
      <DetectTag left={l.left} top={l.top} label={t('detectLeaf')} color="#FBBF24" />
    </View>
  );
}

// ───────────────────────── piezas de la pantalla ─────────────────────────

function Steps({ items, color }: { items: string[]; color: string }) {
  return (
    <View style={s.steps}>
      {items.map((label, i) => (
        <View key={label} style={s.step}>
          <Text style={[s.stepNum, { color }]}>{String(i + 1).padStart(2, '0')}</Text>
          <Text style={s.stepText} numberOfLines={2}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Foto real de cómo llevar el celular durante el recorrido. */
function MountCard({ image, title, body, badge }: { image: number; title: string; body: string; badge?: string }) {
  return (
    <View style={s.mountCard} accessible accessibilityLabel={`${title}. ${body}`}>
      <View style={s.mountMedia}>
        <Image source={image} style={v.img} resizeMode="cover" accessibilityIgnoresInvertColors />
        {badge ? <View style={s.mountBadge}><Text style={s.mountBadgeText}>{badge}</Text></View> : null}
      </View>
      <Text style={s.mountName}>{title}</Text>
      <Text style={s.mountBody}>{body}</Text>
    </View>
  );
}

// ───────────────────────── pantalla ─────────────────────────

export default function ScanModeChooser({ isGuest, tokensValue, pendingWalks, pendingPhotos, onPhoto, onWalk, onOpenWalks }: Props) {
  const t = useTranslations(translations) as T;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const network = useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;

  const isTablet = width >= 768;
  const contentW = isTablet ? Math.min(width - 64, 760) : width - 32;
  const heroW = contentW;
  const heroH = Math.round(isTablet ? Math.min(contentW * 0.72, 540) : Math.min(contentW * (height < 720 ? 0.86 : 1.02), 440));
  const segW = (contentW - 8) / 2;

  const [mode, setMode] = useState<Mode>('walk');
  const modeRef = useRef<Mode>('walk');
  const tapTargetRef = useRef<Mode | null>(null);

  // Paginado nativo: el dedo mueve el visor y el indicador lo sigue en el hilo de UI.
  const pagerRef = useAnimatedRef<Reanimated.ScrollView>();
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({ onScroll: e => { scrollX.set(e.contentOffset.x); } });

  const commitMode = useCallback((next: Mode) => {
    if (next === modeRef.current) return;
    modeRef.current = next;
    setMode(next);
    // El toque ya vibró al presionar; solo el deslizamiento vibra al cruzar la mitad.
    if (tapTargetRef.current !== next) Haptics.selectionAsync().catch(() => {});
    tapTargetRef.current = null;
  }, []);

  // Se cambia de modalidad una sola vez al cruzar la mitad de la página (no en cada fotograma).
  useAnimatedReaction(
    () => (heroW > 0 ? Math.round(scrollX.get() / heroW) : 0),
    (idx, prev) => {
      if (prev !== null && idx !== prev) scheduleOnRN(commitMode, idx >= 1 ? 'photo' : 'walk');
    },
    [heroW],
  );

  const selectMode = useCallback((next: Mode) => {
    if (next === modeRef.current) return;
    tapTargetRef.current = next;
    Haptics.selectionAsync().catch(() => {});
    pagerRef.current?.scrollTo({ x: MODES.indexOf(next) * heroW, animated: !reduced });
    // Con "Reducir movimiento" el salto es inmediato; se confirma sin esperar al desplazamiento.
    if (reduced) commitMode(next);
  }, [heroW, reduced, pagerRef, commitMode]);

  const indicatorStyle = useAnimatedStyle(() => {
    const p = heroW > 0 ? Math.min(Math.max(scrollX.get() / heroW, 0), 1) : 0;
    return {
      transform: [{ translateX: p * segW }],
      backgroundColor: interpolateColor(p, [0, 1], ['#ECFDF5', '#F5F3FF']),
      borderColor: interpolateColor(p, [0, 1], ['#6EE7B7', '#C4B5FD']),
    };
  });

  const isWalk = mode === 'walk';
  const accent = isWalk ? G_TXT : P_TXT;
  const walkSteps = useMemo(() => [t('walkStep1'), t('walkStep2'), t('walkStep3')], [t]);
  const photoSteps = useMemo(() => [t('photoStep1'), t('photoStep2'), t('photoStep3')], [t]);
  const sceneSize = useMemo(() => ({ w: heroW, h: heroH }), [heroW, heroH]);
  // Barra de pestañas flotante (alto + separación) y el botón central que sobresale.
  const bottomSpace = (isTablet ? 82 + 24 : 72 + 18) + 36 + insets.bottom;
  const walkLocked = isWalk && isGuest;
  const pendingLabel = pendingWalks === 1 ? t('pendingOne') : t('pendingMany', { count: pendingWalks });

  return (
    <Reanimated.ScrollView
      style={s.screen}
      contentContainerStyle={[s.content, { paddingTop: insets.top + (isTablet ? 28 : 14), paddingBottom: bottomSpace, width: contentW + 32, alignSelf: 'center' }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Encabezado editorial: título y saldo en filas separadas, nada en la esquina ── */}
      <View style={s.header}>
        <View style={s.kickerRow}>
          <View style={s.kickerDot} />
          <Text style={s.kicker}>{t('kicker')}</Text>
        </View>
        <Text style={[s.title, isTablet && s.titleTablet]} accessibilityRole="header">{t('title')}</Text>
        <View style={s.subRow}>
          <Text style={s.subtitle}>{t('subtitle')}</Text>
          {tokensValue ? (
            <View style={s.tokens} accessible accessibilityLabel={t('tokensA11y', { value: tokensValue })}>
              <Coins size={13} color="#D97706" />
              <Text style={s.tokensValue}>{tokensValue}</Text>
              <Text style={s.tokensLabel}>{t('tokens')}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* ── Selector de modalidad ── */}
      <View style={s.switch} accessibilityRole="tablist">
        <Reanimated.View pointerEvents="none" style={[s.switchPill, { width: segW }, indicatorStyle]} />
        {MODES.map(m => {
          const on = m === mode;
          const walk = m === 'walk';
          const Icon = walk ? Footprints : Aperture;
          return (
            <PressableScale
              key={m}
              onPress={() => selectMode(m)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={walk ? t('walkTitle') : t('photoTitle')}
              style={[s.segment, { width: segW }]}
            >
              <Icon size={18} color={on ? (walk ? G_TXT : P_TXT) : '#94A3B8'} />
              <View>
                <Text style={[s.segLabel, on && s.segLabelOn]}>{walk ? t('walkTab') : t('photoTab')}</Text>
                <Text style={[s.segSub, on && { color: walk ? G_TXT : P_TXT }]}>{walk ? t('walkTabSub') : t('photoTabSub')}</Text>
              </View>
            </PressableScale>
          );
        })}
      </View>

      {/* ── Visor: se desliza con el dedo entre las dos modalidades ── */}
      <View style={[s.hero, { width: heroW, height: heroH }]}>
        <Reanimated.ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          accessibilityHint={t('swipeHint')}
        >
          <WalkScene size={sceneSize} active={isWalk} locked={isGuest} t={t} />
          <PhotoScene size={sceneSize} active={!isWalk} t={t} />
        </Reanimated.ScrollView>

        <View pointerEvents="none" style={s.heroTop}>
          <View style={[s.badge, { borderColor: isWalk ? 'rgba(52,211,153,0.45)' : 'rgba(167,139,250,0.5)' }]}>
            {isWalk ? <ScanLine size={13} color={GREEN} /> : <Sparkles size={13} color={PURPLE} />}
            <Text style={s.badgeText}>{isWalk ? t('walkBadge') : t('photoBadge')}</Text>
          </View>
          {isWalk ? (
            <View style={s.badge}><WifiOff size={13} color="#ffffff" /><Text style={s.badgeText}>{t('walkOffline')}</Text></View>
          ) : null}
        </View>
        {/* Texto del visor: cambia con la modalidad con un fundido corto, sin desplazamiento. */}
        <Reanimated.View key={`txt-${mode}`} entering={reduced ? undefined : STEPS_FADE} pointerEvents="none" style={s.heroText}>
          <Text style={[s.heroTitle, isTablet && s.heroTitleTablet]}>{isWalk ? t('walkTitle') : t('photoTitle')}</Text>
          <Text style={s.heroBody}>{isWalk ? t('walkBody') : t('photoBody')}</Text>
        </Reanimated.View>
        <View pointerEvents="none" style={s.dots}>
          {MODES.map(m => (
            <Reanimated.View
              key={m}
              style={[
                s.dot,
                {
                  backgroundColor: m === mode ? (isWalk ? GREEN : PURPLE) : 'rgba(255,255,255,0.45)',
                  transform: [{ scaleX: m === mode ? 2.4 : 1 }],
                  transitionProperty: ['transform', 'backgroundColor'],
                  transitionDuration: 200,
                  transitionTimingFunction: CSS_EASE_OUT,
                },
              ]}
            />
          ))}
        </View>
        <View pointerEvents="none" style={s.heroBorder} />
        {isGuest && isWalk && (
          <View style={s.lockOverlay}><View style={s.lockCircle}><Lock size={22} color={GREEN_DEEP} /></View></View>
        )}
      </View>

      {/* ── Cómo funciona + estado + acción ── */}
      <Reanimated.View key={`info-${mode}`} entering={reduced ? undefined : STEPS_FADE} style={s.below}>
        <Steps items={isWalk ? walkSteps : photoSteps} color={accent} />

        {isWalk && (
          <View style={s.mount}>
            <Text style={s.mountTitle}>{t('mountTitle')}</Text>
            <View style={s.mountRow}>
              <MountCard image={IMG_MOUNT_CHEST} title={t('mountChest')} body={t('mountChestBody')} badge={t('mountBest')} />
              <MountCard image={IMG_MOUNT_HELMET} title={t('mountHelmet')} body={t('mountHelmetBody')} />
            </View>
          </View>
        )}

        {isWalk ? (
          !isGuest && pendingWalks > 0 ? (
            <PressableScale onPress={onOpenWalks} style={s.pending} accessibilityRole="button" accessibilityLabel={`${pendingLabel}. ${t('pendingOpen')}`}>
              <View style={s.pendingIcon}><CloudUpload size={17} color="#78350F" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.pendingTitle}>{pendingLabel}</Text>
                {pendingPhotos > 0 && <Text style={s.pendingSub}>{t('pendingPhotos', { count: pendingPhotos.toLocaleString() })}</Text>}
              </View>
              <Text style={s.pendingOpen}>{t('pendingOpen')}</Text>
              <ChevronRight size={16} color="#B45309" />
            </PressableScale>
          ) : (
            <View style={s.info}><WifiOff size={15} color={G_TXT} /><Text style={s.infoText}>{t('walkInfo')}</Text></View>
          )
        ) : offline ? (
          <View style={[s.info, s.infoWarn]}><WifiOff size={15} color="#DC2626" /><Text style={[s.infoText, { color: '#991B1B' }]}>{t('photoOffline')}</Text></View>
        ) : (
          <View style={s.info}><Wifi size={15} color={P_TXT} /><Text style={s.infoText}>{t('photoInfo')}</Text></View>
        )}

        <PressableScale
          onPress={() => {
            if (walkLocked) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            if (isWalk) onWalk(); else onPhoto();
          }}
          disabled={walkLocked}
          accessibilityRole="button"
          accessibilityState={{ disabled: walkLocked }}
          accessibilityLabel={isWalk ? (isGuest ? t('walkLocked') : t('walkCta')) : t('photoCta')}
          style={s.ctaWrap}
        >
          <LinearGradient
            colors={isWalk ? (isGuest ? ['#E2E8F0', '#E2E8F0'] : ['#34D399', '#0f766e']) : ['#8B5CF6', '#44227C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.cta}
          >
            <View style={s.ctaIcon}>
              {isWalk ? (isGuest ? <Lock size={18} color="#475569" /> : <Footprints size={19} color="#ffffff" />) : <Camera size={19} color="#ffffff" />}
            </View>
            <Text style={[s.ctaText, walkLocked && { color: '#475569' }]}>{isWalk ? (isGuest ? t('walkLocked') : t('walkCta')) : t('photoCta')}</Text>
            {!walkLocked && <ArrowRight size={20} color="#ffffff" />}
          </LinearGradient>
        </PressableScale>

        {isWalk && !isGuest && (
          <PressableScale onPress={onOpenWalks} style={s.link} accessibilityRole="button" accessibilityLabel={t('myWalks')}>
            <Text style={s.linkText}>{t('myWalks')}</Text>
            <ChevronRight size={16} color="#334155" />
          </PressableScale>
        )}
      </Reanimated.View>
    </Reanimated.ScrollView>
  );
}

// ───────────────────────── estilos ─────────────────────────

const v = StyleSheet.create({
  scene: { overflow: 'hidden', backgroundColor: '#0b2a22' },
  // Ancho/alto explícitos: absoluteFill en <Image> amplía la foto en web.
  img: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  anchor: { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  walker: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: GREEN,
  },
  tag: { position: 'absolute', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontFamily: 'Poppins_600SemiBold', fontSize: 10, color: '#052e16', letterSpacing: 0.3 },
  scanBox: { position: 'absolute', overflow: 'hidden', borderRadius: 10 },
  scanLine: { position: 'absolute', left: 4, right: 4, top: 0, height: 3, borderRadius: 2, overflow: 'hidden' },
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 16, gap: 16 },
  header: { gap: 2 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kickerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: GREEN },
  kicker: { fontFamily: 'Poppins_600SemiBold', fontSize: 11.5, letterSpacing: 1.6, color: '#0f766e', textTransform: 'uppercase' },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 40, lineHeight: 46, letterSpacing: -1.4, color: INK, marginTop: 2 },
  titleTablet: { fontSize: 52, lineHeight: 58 },
  subRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, rowGap: 8 },
  subtitle: { fontFamily: 'Poppins_400Regular', fontSize: 14.5, color: MUTED, flexShrink: 1 },
  tokens: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
  },
  tokensValue: { fontFamily: 'Poppins_700Bold', fontSize: 13, color: '#92400E' },
  tokensLabel: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: '#B45309' },
  // selector
  switch: { flexDirection: 'row', padding: 4, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: LINE },
  switchPill: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 16, borderWidth: 1, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  segment: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 56, paddingVertical: 8 },
  segLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 14.5, color: '#64748B' },
  segLabelOn: { color: INK },
  segSub: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: '#94A3B8', marginTop: -2 },
  // visor
  hero: { borderRadius: 30, overflow: 'hidden', backgroundColor: '#0b2a22' },
  heroBorder: { ...StyleSheet.absoluteFill, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(15,23,42,0.06)' },
  heroTop: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(4,20,15,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  badgeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#ffffff' },
  heroText: { position: 'absolute', left: 18, right: 18, bottom: 34, gap: 4 },
  heroTitle: { fontFamily: 'Poppins_700Bold', fontSize: 28, lineHeight: 33, letterSpacing: -0.8, color: '#ffffff' },
  heroTitleTablet: { fontSize: 36, lineHeight: 42 },
  heroBody: { fontFamily: 'Poppins_400Regular', fontSize: 13.5, lineHeight: 20, color: 'rgba(255,255,255,0.82)' },
  dots: { position: 'absolute', bottom: 14, alignSelf: 'center', flexDirection: 'row', gap: 14 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  lockOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4,20,15,0.45)', alignItems: 'center', justifyContent: 'center' },
  lockCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  // debajo del visor
  below: { gap: 12 },
  steps: { flexDirection: 'row', gap: 8 },
  step: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, backgroundColor: SURFACE, borderWidth: 1, borderColor: LINE, gap: 2 },
  stepNum: { fontFamily: 'Poppins_700Bold', fontSize: 12, letterSpacing: 1 },
  stepText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, lineHeight: 17, color: INK },
  info: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 16, backgroundColor: SURFACE, borderWidth: 1, borderColor: LINE },
  infoWarn: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  infoText: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 12.5, lineHeight: 18, color: '#475569' },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  pendingIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#FCD34D', alignItems: 'center', justifyContent: 'center' },
  pendingTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#78350F' },
  pendingSub: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: '#92400E' },
  pendingOpen: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: '#B45309' },
  ctaWrap: { borderRadius: 22, shadowColor: '#0f766e', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 10, paddingRight: 20, minHeight: 64, borderRadius: 22 },
  ctaIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  ctaText: { flex: 1, fontFamily: 'Poppins_700Bold', fontSize: 16.5, color: '#ffffff' },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 44 },
  linkText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: '#334155' },
  // montaje del celular
  mount: { gap: 10 },
  mountTitle: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: INK, letterSpacing: -0.2 },
  mountRow: { flexDirection: 'row', gap: 10 },
  mountCard: { flex: 1, gap: 4 },
  mountMedia: { aspectRatio: 1.25, borderRadius: 18, overflow: 'hidden', backgroundColor: '#E2E8F0' },
  mountBadge: { position: 'absolute', left: 8, top: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#ffffff' },
  mountBadgeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 10.5, color: G_TXT },
  mountName: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: INK, marginTop: 4 },
  mountBody: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 17, color: MUTED },
});
