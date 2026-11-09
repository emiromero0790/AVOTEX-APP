/**
 * Escanear — pantalla principal (fondo blanco, como el resto de la app).
 *
 * Video de huerta arriba y tres fuentes de captura en tarjetas panorámicas a lo ancho, apiladas:
 * - Dron y GoPro/cámara de acción: importación de fotos desde la galería (no hay conexión directa
 *   con ningún fabricante; ver services/importar.ts).
 * - Celular: Recorrido inteligente y Foto individual (los flujos existentes).
 *
 * Movimiento (skill animate-expo):
 * - Entrada escalonada de las tarjetas solo la primera vez que se monta la pantalla (260 ms, salida fuerte).
 * - Selección: borde, indicador y flecha con transiciones CSS de 180 ms (opacidad, color, escala) +
 *   Haptics.selectionAsync. Nada de animar alto/ancho: el texto del botón cambia con un fundido.
 * - Reducir movimiento: sin entradas ni escalas; se conservan los cambios de color y opacidad.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Reanimated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEventListener } from 'expo';
import { ArrowRight, Camera, ChevronRight, Footprints, History, ImageDown, Lock, Plane, Smartphone, Video } from 'lucide-react-native';
import { TranslationResource, useTranslations } from '../context/LanguageContext';
import ScanHeader from './scan/ScanHeader';
import { CSS_EASE_OUT, EASE_OUT, PressableScale } from './scan/motion';
import { LIME_GRADIENT, SCAN } from './scan/theme';

// Video de dron sobre una huerta (Pexels 13779417, sin audio) y su primer cuadro como póster.
// Ver assets/images/escanear/CREDITOS.md
const VIDEO_HERO = require('../assets/videos/huerta-dron.mp4');
const IMG_POSTER = require('../assets/images/escanear/huerta-dron-poster.jpg');
// Imágenes de las tarjetas (proporcionadas por AVOTEX). El dispositivo está a la derecha de cada foto:
// la imagen se alinea a la derecha de la tarjeta y lo que sobra queda bajo el degradado de la izquierda.
const CARD_IMAGES = {
  dron: { src: require('../assets/images/escanear/avotex_card_dron.jpg'), ratio: 1640 / 208 },
  camara: { src: require('../assets/images/escanear/avotex_card_gopro.jpg'), ratio: 1545 / 202 },
  celular: { src: require('../assets/images/escanear/avotex_card_celular.jpg'), ratio: 1570 / 218 },
} as const;

const C = { deep: '#123D25', lime: '#A3E635', teal: '#14B8A6', white: '#FFFFFF', ink: '#14231A' } as const;

const ROW_IN = FadeInDown.duration(220).easing(EASE_OUT);
const ROW_OUT = FadeOut.duration(140);
const TEXT_IN = FadeIn.duration(180).easing(EASE_OUT);
const cardIn = (i: number) => FadeInDown.duration(260).delay(60 + i * 70).easing(EASE_OUT);
const TRANSITION = { transitionDuration: 180, transitionTimingFunction: CSS_EASE_OUT };

// Las tarjetas entran escalonadas solo la primera vez (la pestaña se visita muchas veces al día).
let cardsShown = false;

export type ScanSource = 'dron' | 'camara' | 'celular';
type PhoneMode = 'recorrido' | 'foto';

const translations: TranslationResource = {
  title: { es: 'Escanear', en: 'Scan' },
  subtitle: { es: 'Explora tu cultivo con inteligencia artificial', en: 'Explore your crop with artificial intelligence' },
  line1: { es: 'Una huerta.', en: 'One orchard.' },
  line2: { es: 'Cualquier cámara.', en: 'Any camera.' },
  srcDrone: { es: 'Dron', en: 'Drone' },
  srcAction: { es: 'GoPro / Cámara de acción', en: 'GoPro / Action camera' },
  srcPhone: { es: 'Celular', en: 'Phone' },
  descDrone: { es: 'Escaneo aéreo de tu huerta para un análisis más completo', en: 'Aerial scan of your orchard for a more complete analysis' },
  descAction: { es: 'Captura recorridos en campo con alta estabilidad', en: 'Capture field walks with high stability' },
  descPhone: { es: 'Escanea plantas, hojas y frutos de forma rápida y sencilla', en: 'Scan plants, leaves and fruit quickly and easily' },
  capImport: { es: 'Importa las fotos desde la galería de tu celular. Se ubican con su GPS.', en: 'Import the photos from your phone gallery. Placed by their GPS.' },
  capWalk: { es: 'Camina tu huerta: el celular toma las fotos solo, sin internet.', en: 'Walk your orchard: the phone takes the photos, offline.' },
  capPhoto: { es: 'Toma una foto de un fruto, hoja o árbol y recibe el diagnóstico.', en: 'Take a photo of a fruit, leaf or tree and get a diagnosis.' },
  modeWalk: { es: 'Recorrido inteligente', en: 'Smart walk' },
  modePhoto: { es: 'Foto individual', en: 'Single photo' },
  ctaWalk: { es: 'Iniciar recorrido', en: 'Start walk' },
  ctaPhoto: { es: 'Tomar fotografía', en: 'Take photo' },
  ctaImport: { es: 'Importar capturas', en: 'Import captures' },
  locked: { es: 'Crea una cuenta para usarlo', en: 'Create an account to use it' },
  myScans: { es: 'Ver mis escaneos', en: 'View my scans' },
  pending: { es: '{count} sin subir', en: '{count} not uploaded' },
  selected: { es: 'seleccionado', en: 'selected' },
  needsAccount: { es: 'requiere cuenta', en: 'requires an account' },
};

type Props = {
  isGuest: boolean;
  tokensValue: string | null;
  /** Escaneos guardados en el celular que aún no se suben. */
  pendingCount: number;
  onPhoto: () => void;
  onWalk: () => void;
  onImport: (fuente: 'dron' | 'camara') => void;
  onOpenScans: () => void;
  /** Mientras se verifica la huerta por GPS: el botón muestra este texto y no responde. */
  busyLabel?: string | null;
};

/** Tarjeta panorámica de fuente de captura: foto a todo el fondo, texto nativo a la izquierda, flecha. */
function SourceCard({ kind, icon, title, desc, selected, locked, onPress, a11y, height, index, animateIn }: {
  kind: ScanSource; icon: React.ReactNode; title: string; desc: string; selected: boolean; locked: boolean;
  onPress: () => void; a11y: string; height: number; index: number; animateIn: boolean;
}) {
  const img = CARD_IMAGES[kind];
  return (
    <Reanimated.View entering={animateIn ? cardIn(index) : undefined}>
      <PressableScale onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={a11y}>
        <View
          style={[
            s.card,
            {
              height,
              // Escala sutil: la no seleccionada queda apenas más chica.
              transform: [{ scale: selected ? 1 : 0.985 }],
              shadowOpacity: selected ? 0.28 : 0.1,
              transitionProperty: ['transform', 'shadowOpacity'],
              ...TRANSITION,
            } as object,
          ]}
        >
          <View style={s.cardClip}>
            <Image source={img.src} style={[s.cardImg, { height, width: Math.round(height * img.ratio) }]} resizeMode="cover" accessibilityIgnoresInvertColors />
            {/* Degradado verde a la izquierda para el texto; la foto no se oscurece al deseleccionar. */}
            <LinearGradient
              colors={['rgba(18,61,37,0.97)', 'rgba(18,61,37,0.86)', 'rgba(18,61,37,0.35)', 'rgba(18,61,37,0)']}
              locations={[0, 0.36, 0.58, 0.78]}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.cardBody}>
              <View style={[s.cardIcon, { backgroundColor: selected ? C.lime : 'rgba(255,255,255,0.16)', borderColor: selected ? C.lime : 'rgba(255,255,255,0.35)', transitionProperty: ['backgroundColor', 'borderColor'], ...TRANSITION } as object]}>
                {icon}
              </View>
              <View style={s.cardText}>
                <Text style={s.cardTitle} numberOfLines={2} maxFontSizeMultiplier={1.15}>{title}</Text>
                <Text style={s.cardDesc} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.85} maxFontSizeMultiplier={1.1}>{desc}</Text>
              </View>
            </View>
            {/* Indicador de selección (barra lima a la izquierda) */}
            <View style={[s.indicator, { opacity: selected ? 1 : 0, transform: [{ scaleY: selected ? 1 : 0.4 }], transitionProperty: ['opacity', 'transform'], ...TRANSITION } as object]} />
            <View style={[s.arrow, { backgroundColor: selected ? C.lime : 'rgba(255,255,255,0.2)', borderColor: selected ? C.lime : 'rgba(255,255,255,0.55)', transitionProperty: ['backgroundColor', 'borderColor'], ...TRANSITION } as object]}>
              <ArrowRight size={17} color={selected ? C.ink : C.white} strokeWidth={2.4} />
            </View>
            {locked && <View style={s.lock}><Lock size={12} color="#ffffff" /></View>}
          </View>
          {/* Borde lima sobre la foto (solo opacidad: no cambia el tamaño de la tarjeta) */}
          <View pointerEvents="none" style={[s.ring, { opacity: selected ? 1 : 0, transitionProperty: ['opacity'], ...TRANSITION } as object]} />
        </View>
      </PressableScale>
    </Reanimated.View>
  );
}

/**
 * Video de fondo: en bucle, sin sonido y sin controles. Solo se reproduce con la pestaña visible
 * (ahorra batería) y no se reproduce con "Reducir movimiento" (queda el póster fijo).
 *
 * Robustez (en algunos teléfonos a veces no arrancaba):
 * - Al volver a la app desde segundo plano o desde la cámara, el sistema lo pausa: se reanuda.
 * - Si se pidió reproducir mientras aún cargaba, se reproduce en cuanto está listo.
 * - Si el decodificador falla, se recarga hasta 3 veces; si sigue fallando, queda el póster.
 * - No pide el foco de audio (mixWithOthers): otra app con sonido ya no lo pausa.
 * - El video solo se muestra cuando de verdad está reproduciendo, así nunca se ve un cuadro negro:
 *   mientras tanto se ve el póster que está debajo.
 */
function HeroVideo({ playing }: { playing: boolean }) {
  const player = useVideoPlayer(VIDEO_HERO, p => {
    p.loop = true;
    p.muted = true;
    try { p.audioMixingMode = 'mixWithOthers'; } catch { /* no disponible en esta plataforma */ }
  });
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);
  const wantRef = useRef(playing);
  const retriesRef = useRef(0);
  const lastKickRef = useRef(0);
  wantRef.current = playing;

  const kick = useCallback(() => {
    if (!wantRef.current) return;
    lastKickRef.current = Date.now();
    try {
      // En web play() devuelve una promesa que falla si el navegador no puede decodificar el video.
      const r = player.play() as unknown;
      if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => {});
    } catch { /* se queda el póster */ }
  }, [player]);

  useEffect(() => {
    if (playing) kick();
    else { try { player.pause(); } catch { /* sin reproductor */ } }
  }, [playing, player, kick]);

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay') { retriesRef.current = 0; kick(); }
    if (status === 'error') {
      setShown(false);
      if (retriesRef.current < 3) {
        retriesRef.current += 1;
        setTimeout(() => { try { player.replace(VIDEO_HERO); } catch { setFailed(true); } }, 800 * retriesRef.current);
      } else setFailed(true);
    }
  });
  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (isPlaying) { setShown(true); return; }
    // Pausado por el sistema (llamada, otra app, pantalla apagada…) mientras debería reproducirse.
    if (wantRef.current && Date.now() - lastKickRef.current > 1500) setTimeout(kick, 600);
  });

  // Volver a la app: el sistema dejó el video en pausa.
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st === 'active') setTimeout(kick, 300); });
    return () => sub.remove();
  }, [kick]);

  if (failed) return null;
  return (
    <Reanimated.View pointerEvents="none" style={[s.heroImg, { opacity: shown ? 1 : 0, transitionProperty: ['opacity'], transitionDuration: 250, transitionTimingFunction: CSS_EASE_OUT } as object]}>
      {/* textureView en Android: respeta la opacidad del contenedor (SurfaceView la ignora y se vería negro). */}
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} surfaceType="textureView" />
    </Reanimated.View>
  );
}

export default function ScanHome({ isGuest, tokensValue, pendingCount, onPhoto, onWalk, onImport, onOpenScans, busyLabel = null }: Props) {
  const t = useTranslations(translations);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const isTablet = width >= 768;
  const contentW = isTablet ? Math.min(width - 64, 720) : width;
  const innerW = contentW - 36;
  const compact = height < 740;
  const narrow = width < 380;
  // Tarjetas de 105–125 dp de alto según el ancho disponible.
  const cardH = Math.round(Math.max(105, Math.min(125, innerW * 0.32)));
  // El video ocupa lo justo: encabezado, título, el lema y un respiro con la retícula de la cámara.
  const above = insets.top + 8 + 40 + 8 + (isTablet ? 60 : 46) + 22;        // encabezado + título + subtítulo
  const claimH = compact ? 56 : 64;
  const fade = 44;                                                          // donde el video se funde con el blanco
  // Respiro mínimo entre subtítulo y lema: así las tarjetas y el botón quedan sobre la barra de pestañas.
  const gap = isTablet ? 110 : compact ? 6 : 14;
  const heroH = above + gap + claimH + fade;

  // El video solo corre con la pestaña enfocada.
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));

  const [animateIn] = useState(() => !cardsShown && !reduced);
  useEffect(() => { cardsShown = true; }, []);

  const [source, setSource] = useState<ScanSource>('celular');
  const [phoneMode, setPhoneMode] = useState<PhoneMode>('recorrido');

  const pick = (next: ScanSource) => {
    if (next !== source) Haptics.selectionAsync().catch(() => {});
    setSource(next);
  };
  const pickMode = (next: PhoneMode) => {
    if (next !== phoneMode) Haptics.selectionAsync().catch(() => {});
    setPhoneMode(next);
  };

  // Lo que requiere cuenta: importar (se sube al servidor) y el recorrido.
  const needsAccount = source !== 'celular' || phoneMode === 'recorrido';
  const locked = isGuest && needsAccount;

  const action: 'walk' | 'photo' | 'import' = source !== 'celular' ? 'import' : phoneMode === 'foto' ? 'photo' : 'walk';
  const ctaLabel = action === 'walk' ? t('ctaWalk') : action === 'photo' ? t('ctaPhoto') : t('ctaImport');
  const caption = action === 'import' ? t('capImport') : action === 'walk' ? t('capWalk') : t('capPhoto');
  const CtaIcon = action === 'walk' ? Footprints : action === 'photo' ? Camera : ImageDown;

  const start = () => {
    if (locked || busyLabel) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (source === 'celular') (phoneMode === 'foto' ? onPhoto : onWalk)();
    else onImport(source);
  };

  const sources = [
    { key: 'dron' as const, icon: Plane, title: t('srcDrone'), desc: t('descDrone') },
    { key: 'camara' as const, icon: Video, title: t('srcAction'), desc: t('descAction') },
    { key: 'celular' as const, icon: Smartphone, title: t('srcPhone'), desc: t('descPhone') },
  ];

  // Barra de pestañas flotante + botón central que sobresale.
  const bottomSpace = (isTablet ? 82 + 24 : 72 + 18) + 28 + insets.bottom;

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomSpace }} showsVerticalScrollIndicator={false}>
        {/* ── Video de la huerta a lo ancho de la pantalla, detrás del encabezado ── */}
        <View style={[s.hero, { height: heroH }]} pointerEvents="none">
          <Image source={IMG_POSTER} style={s.heroImg} resizeMode="cover" accessibilityIgnoresInvertColors />
          {!reduced && <HeroVideo playing={focused} />}
          <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0)']} locations={[0, 0.32, 0.5]} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.42)', 'rgba(0,0,0,0.12)', 'rgba(255,255,255,0.7)', '#FFFFFF']}
            locations={[0.42, (heroH - fade - 4) / heroH, (heroH - fade * 0.6) / heroH, (heroH - fade * 0.25) / heroH, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/* retícula de la cámara */}
          <View style={[s.frame, { top: above + gap - 12, height: claimH + 20 }]}>
            <View style={[s.c, s.cTL]} /><View style={[s.c, s.cTR]} /><View style={[s.c, s.cBL]} /><View style={[s.c, s.cBR]} />
          </View>
        </View>

        <View style={[s.content, { width: contentW, paddingTop: insets.top + 8 }]}>
          <ScanHeader tokensValue={tokensValue} onImage />
          <Text style={[s.title, isTablet && s.titleTablet]} accessibilityRole="header">{t('title')}</Text>
          <Text style={s.subtitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{t('subtitle')}</Text>

          <View style={{ height: gap }} />
          <View style={[s.claimBox, { height: claimH }]} accessible accessibilityLabel={`${t('line1')} ${t('line2')}`}>
            <Text style={[s.claim, compact && s.claimCompact]} maxFontSizeMultiplier={1.1}>{t('line1')}</Text>
            <Text style={[s.claim, s.claimLime, compact && s.claimCompact]} maxFontSizeMultiplier={1.1}>{t('line2')}</Text>
          </View>
          <View style={{ height: fade - 22 }} />

          {/* ── Fuentes de captura: tarjetas panorámicas apiladas ── */}
          <View style={s.cards} accessibilityRole="radiogroup">
            {sources.map((src, i) => {
              const Icon = src.icon;
              const on = source === src.key;
              const lockedSrc = isGuest && src.key !== 'celular';
              return (
                <SourceCard
                  key={src.key}
                  kind={src.key}
                  index={i}
                  animateIn={animateIn}
                  icon={<Icon size={18} color={on ? C.ink : C.white} />}
                  title={src.title}
                  desc={src.desc}
                  selected={on}
                  locked={lockedSrc}
                  onPress={() => pick(src.key)}
                  height={cardH}
                  a11y={`${src.title}. ${src.desc}${lockedSrc ? `, ${t('needsAccount')}` : ''}${on ? `, ${t('selected')}` : ''}`}
                />
              );
            })}
          </View>

          {/* Modos del celular, o la nota de importación (misma altura: nada salta) */}
          <View style={s.modeZone}>
            {source === 'celular' ? (
              <Reanimated.View key="modes" entering={reduced ? undefined : ROW_IN} exiting={reduced ? undefined : ROW_OUT} style={s.modes} accessibilityRole="radiogroup">
                {(['recorrido', 'foto'] as PhoneMode[]).map(m => {
                  const on = phoneMode === m;
                  const ModeIcon = m === 'recorrido' ? Footprints : Camera;
                  return (
                    <PressableScale
                      key={m}
                      onPress={() => pickMode(m)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${m === 'recorrido' ? t('modeWalk') : t('modePhoto')}. ${m === 'recorrido' ? t('capWalk') : t('capPhoto')}`}
                      style={[s.mode, { flex: m === 'recorrido' ? 1.25 : 1 }, on && s.modeOn, { transitionProperty: ['backgroundColor', 'borderColor'], transitionDuration: 160, transitionTimingFunction: CSS_EASE_OUT } as object]}
                    >
                      {/* En pantallas angostas (≈360 pt) se omite el icono para que el texto quepa completo. */}
                      {!narrow && <ModeIcon size={15} color={on ? C.deep : SCAN.muted} />}
                      <Text style={[s.modeText, on && s.modeTextOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} maxFontSizeMultiplier={1.15}>
                        {m === 'recorrido' ? t('modeWalk') : t('modePhoto')}
                      </Text>
                      {isGuest && m === 'recorrido' && <Lock size={12} color={SCAN.muted} />}
                    </PressableScale>
                  );
                })}
              </Reanimated.View>
            ) : (
              <Reanimated.Text key="note" entering={reduced ? undefined : TEXT_IN} style={s.caption} numberOfLines={2} maxFontSizeMultiplier={1.15}>{caption}</Reanimated.Text>
            )}
          </View>

          {/* ── Acción principal (texto según fuente y modo) ── */}
          <PressableScale onPress={start} disabled={locked} accessibilityRole="button" accessibilityLabel={locked ? t('locked') : busyLabel ?? `${ctaLabel}. ${caption}`} accessibilityState={{ disabled: locked, busy: !!busyLabel }} style={s.ctaWrap}>
            <LinearGradient colors={locked ? ['#E2E8F0', '#CBD5E1'] : [...LIME_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cta}>
              {locked ? <Lock size={20} color={SCAN.inkSoft} /> : busyLabel ? <ActivityIndicator color={C.ink} /> : <CtaIcon size={22} color={C.ink} />}
              <Reanimated.Text key={locked ? 'locked' : busyLabel ? 'busy' : action} entering={reduced ? undefined : TEXT_IN}
                style={[s.ctaText, locked && { color: SCAN.inkSoft }, !!busyLabel && { fontSize: 16 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.15}>
                {locked ? t('locked') : busyLabel ?? ctaLabel}
              </Reanimated.Text>
              {!locked && <ChevronRight size={22} color={C.ink} />}
            </LinearGradient>
          </PressableScale>

          {!isGuest && (
            <PressableScale onPress={onOpenScans} accessibilityRole="button" accessibilityLabel={t('myScans')} style={s.secondary}>
              <History size={18} color={C.deep} />
              <Text style={s.secondaryText} maxFontSizeMultiplier={1.2}>{t('myScans')}</Text>
              {pendingCount > 0 && (
                <View style={s.badge}><Text style={s.badgeText}>{t('pending', { count: pendingCount })}</Text></View>
              )}
            </PressableScale>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SCAN.bg },
  content: { alignSelf: 'center', paddingHorizontal: 18 },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 38, lineHeight: 46, letterSpacing: -1.2, color: '#ffffff', marginTop: 8, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 10 },
  titleTablet: { fontSize: 50, lineHeight: 60 },
  subtitle: { fontFamily: 'Poppins_400Regular', fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.92)', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 8 },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', backgroundColor: '#E2E8F0' },
  // Ancho/alto explícitos: absoluteFill en <Image> amplía la foto en web.
  heroImg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  frame: { position: 'absolute', left: '6%', right: '6%' },
  c: { position: 'absolute', width: 22, height: 22, borderColor: 'rgba(255,255,255,0.9)' },
  cTL: { top: 0, left: 0, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderTopLeftRadius: 6 },
  cTR: { top: 0, right: 0, borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopRightRadius: 6 },
  cBL: { bottom: 0, left: 0, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderBottomLeftRadius: 6 },
  cBR: { bottom: 0, right: 0, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomRightRadius: 6 },
  claimBox: { justifyContent: 'flex-end', paddingLeft: 22 },
  claim: { fontFamily: 'Poppins_700Bold', fontSize: 28, lineHeight: 32, letterSpacing: -0.7, color: SCAN.onPhoto, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 10 },
  claimLime: { color: C.lime },
  claimCompact: { fontSize: 23, lineHeight: 27 },

  cards: { gap: 11 },
  // Sombra en la vista exterior, recorte en la interior (la sombra no se recorta).
  card: { borderRadius: 24, backgroundColor: C.deep, shadowColor: C.deep, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  cardClip: { flex: 1, borderRadius: 24, overflow: 'hidden' },
  cardImg: { position: 'absolute', top: 0, right: 0 },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, borderWidth: 2, borderColor: C.lime },
  cardBody: { position: 'absolute', top: 0, bottom: 0, left: 18, width: '62%', flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontFamily: 'Poppins_700Bold', fontSize: 17, lineHeight: 21, color: C.white, letterSpacing: -0.2 },
  cardDesc: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,0.86)' },
  indicator: { position: 'absolute', left: 0, top: '28%', bottom: '28%', width: 4, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: C.lime },
  arrow: { position: 'absolute', right: 12, bottom: 12, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  lock: { position: 'absolute', top: 10, right: 12, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },

  modeZone: { marginTop: 12, minHeight: 48, justifyContent: 'center' },
  modes: { flexDirection: 'row', gap: 10, minHeight: 48 },
  mode: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: SCAN.line, backgroundColor: C.white },
  modeOn: { backgroundColor: '#ECFCCB', borderColor: C.lime },
  modeText: { flexShrink: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: SCAN.muted },
  modeTextOn: { color: C.deep },
  caption: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 19, color: SCAN.muted },
  ctaWrap: { marginTop: 12, borderRadius: 22, shadowColor: '#65A30D', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, height: 58, borderRadius: 22, paddingHorizontal: 20 },
  ctaText: { flex: 1, textAlign: 'center', fontFamily: 'Poppins_700Bold', fontSize: 18, color: C.ink },
  secondary: {
    marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 46,
    borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: C.white,
  },
  secondaryText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14.5, color: C.ink },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#E0F2FE', borderWidth: 1, borderColor: '#7DD3FC' },
  badgeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#0369A1' },
});
