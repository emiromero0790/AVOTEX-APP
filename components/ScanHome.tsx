/**
 * Escanear — pantalla principal (fondo blanco, como el resto de la app).
 *
 * Orden (el celular es la forma principal de escanear):
 * 1. Héroe con foto de la huerta al atardecer: marca, anillo de tokens, título y lema.
 * 2. Selector de cámara: Celular (la principal, tarjeta más grande) y, justo debajo, el botón principal y
 *    Ver mis escaneos; después Dron y GoPro. Se elige una y luego se pulsa el botón: las tres inician el mismo
 *    recorrido inteligente; Dron y GoPro solo cambian la animación del agricultor.
 *    Invitado: Tomar fotografía (foto individual) y «Recorrido inteligente» con candado; al tocarlo se explica
 *    que se desbloquea al crear una cuenta o suscribirse a un plan de pago. Dron y GoPro aparecen con candado.
 *
 * Movimiento (skill animate-expo): entrada escalonada de las tarjetas solo la primera vez (260 ms, salida
 * fuerte); cambio de modo con transiciones de color de 160 ms + Haptics.selectionAsync; el texto del botón
 * cambia con un fundido. Reducir movimiento: sin entradas ni escalas.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Reanimated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { Camera, Check, ChevronRight, Footprints, History, Lock, Plane, ScanLine, Smartphone, Video } from 'lucide-react-native';
import { TranslationResource, useTranslations } from '../context/LanguageContext';
import ScanHeader from './scan/ScanHeader';
import { CSS_EASE_OUT, EASE_OUT, PressableScale } from './scan/motion';
import { LIME_GRADIENT, SCAN } from './scan/theme';

// Huerta de aguacate al atardecer (proporcionada por AVOTEX).
const IMG_HERO = require('../assets/images/escanear/hero-escanear.jpg');
// Imágenes de las tarjetas (proporcionadas por AVOTEX). El dispositivo está a la derecha de cada foto:
// la imagen se alinea a la derecha de la tarjeta y lo que sobra queda bajo el degradado de la izquierda.
const CARD_IMAGES = {
  dron: { src: require('../assets/images/escanear/avotex_card_dron.jpg'), ratio: 1640 / 208 },
  camara: { src: require('../assets/images/escanear/avotex_card_gopro.jpg'), ratio: 1545 / 202 },
  celular: { src: require('../assets/images/escanear/avotex_card_celular.jpg'), ratio: 1570 / 218 },
} as const;

const C = { deep: '#123D25', lime: '#A3E635', teal: '#14B8A6', white: '#FFFFFF', ink: '#14231A' } as const;

const TEXT_IN = FadeIn.duration(180).easing(EASE_OUT);
const cardIn = (i: number) => FadeInDown.duration(260).delay(60 + i * 70).easing(EASE_OUT);

// Las tarjetas entran escalonadas solo la primera vez (la pestaña se visita muchas veces al día).
let cardsShown = false;

export type ScanSource = 'dron' | 'camara' | 'celular';

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
  capWalk: { es: 'Camina tu huerta: el celular toma las fotos solo, sin internet.', en: 'Walk your orchard: the phone takes the photos, offline.' },
  capPhoto: { es: 'Toma una foto de un fruto, hoja o árbol y recibe el diagnóstico.', en: 'Take a photo of a fruit, leaf or tree and get a diagnosis.' },
  modeWalk: { es: 'Recorrido inteligente', en: 'Smart walk' },
  modePhoto: { es: 'Foto individual', en: 'Single photo' },
  ctaWalk: { es: 'Iniciar recorrido', en: 'Start walk' },
  ctaPhoto: { es: 'Tomar fotografía', en: 'Take photo' },
  ctaWalkDrone: { es: 'Iniciar recorrido con dron', en: 'Start walk with drone' },
  ctaWalkGopro: { es: 'Iniciar recorrido con GoPro', en: 'Start walk with GoPro' },
  capDrone: { es: 'Recorrido inteligente en modo dron: tu dron te acompaña en la animación.', en: 'Smart walk in drone mode: your drone follows you in the animation.' },
  capGopro: { es: 'Recorrido inteligente en modo GoPro: con tu casco y GoPro en la animación.', en: 'Smart walk in GoPro mode: with your helmet and GoPro in the animation.' },
  locked: { es: 'Crea una cuenta para usarlo', en: 'Create an account to use it' },
  unlockTitle: { es: 'Recorrido inteligente bloqueado', en: 'Smart walk is locked' },
  unlockBody: { es: 'Se desbloquea al crear una cuenta o al suscribirte a un plan de pago. Con él caminas tu huerta y el celular toma las fotos solo.', en: 'Unlock it by creating an account or subscribing to a paid plan. Walk your orchard and the phone takes the photos for you.' },
  account: { es: 'Crear cuenta', en: 'Create account' },
  plans: { es: 'Ver planes', en: 'See plans' },
  myScans: { es: 'Ver mis escaneos', en: 'View my scans' },
  pending: { es: '{count} sin subir', en: '{count} not uploaded' },
  selected: { es: 'seleccionado', en: 'selected' },
  needsAccount: { es: 'requiere cuenta', en: 'requires an account' },
};

type Props = {
  isGuest: boolean;
  /** Tokens que quedan (users.tokens × 100); null = cargando. */
  tokensRemaining: number | null;
  email?: string | null;
  /** Escaneos guardados en el celular que aún no se suben. */
  pendingCount: number;
  /** Foto individual: solo para invitados (con cuenta se toma dentro del recorrido). */
  onPhoto?: () => void;
  /** Recorrido inteligente; «modo» solo cambia la animación del agricultor. */
  onWalk: (modo?: 'dron' | 'gopro') => void;
  onOpenScans: () => void;
  /** Mientras se verifica la huerta por GPS: el botón muestra este texto y no responde. */
  busyLabel?: string | null;
};

/**
 * Tarjeta panorámica de fuente de captura (selector): foto a todo el fondo, texto nativo a la izquierda.
 * `large` (Celular) es más alta. La elegida lleva borde lima y check; las demás, un círculo vacío.
 * Movimiento: borde, check e icono cambian con transiciones de 160 ms (color/opacidad) y vibración ligera.
 */
function SourceCard({ kind, icon, title, desc, large, selected, locked, onPress, a11y, height, index, animateIn }: {
  kind: ScanSource; icon: (on: boolean) => React.ReactNode; title: string; desc: string; large?: boolean; selected: boolean; locked: boolean;
  onPress: () => void; a11y: string; height: number; index: number; animateIn: boolean;
}) {
  const img = CARD_IMAGES[kind];
  const fade = { transitionProperty: ['opacity', 'backgroundColor', 'borderColor'], transitionDuration: 160, transitionTimingFunction: CSS_EASE_OUT } as object;
  return (
    <Reanimated.View entering={animateIn ? cardIn(index) : undefined}>
      <PressableScale onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={a11y}>
        <View style={[s.card, large && s.cardFeatured, selected && s.cardOn, { height }]}>
          <View style={[s.cardClip, large && { borderRadius: 28 }]}>
            <Image source={img.src} style={[s.cardImg, { height, width: Math.round(height * img.ratio) }]} resizeMode="cover" accessibilityIgnoresInvertColors />
            <LinearGradient
              colors={['rgba(18,61,37,0.97)', 'rgba(18,61,37,0.86)', 'rgba(18,61,37,0.35)', 'rgba(18,61,37,0)']}
              locations={[0, 0.36, 0.58, 0.78]}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[s.cardBody, large && s.cardBodyFeatured]}>
              <View style={[s.cardIcon, large && s.cardIconLarge, selected ? s.cardIconOn : s.cardIconOff, fade]}>{icon(selected)}</View>
              <View style={s.cardText}>
                <Text style={[s.cardTitle, large && s.cardTitleFeatured]} numberOfLines={2} maxFontSizeMultiplier={1.15}>{title}</Text>
                <Text style={[s.cardDesc, large && s.cardDescFeatured]} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.85} maxFontSizeMultiplier={1.1}>{desc}</Text>
              </View>
            </View>
            {locked ? (
              <View style={s.lock}><Lock size={12} color="#ffffff" /></View>
            ) : (
              <View style={[s.radio, selected && s.radioOn, fade]}>{selected && <Check size={16} color={C.ink} strokeWidth={3} />}</View>
            )}
          </View>
          <View pointerEvents="none" style={[s.ring, large && { borderRadius: 28 }, { opacity: selected ? 1 : 0 }, fade]} />
        </View>
      </PressableScale>
    </Reanimated.View>
  );
}

export default function ScanHome({ isGuest, tokensRemaining, email = null, pendingCount, onPhoto, onWalk, onOpenScans, busyLabel = null }: Props) {
  const t = useTranslations(translations);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const isTablet = width >= 768;
  const contentW = isTablet ? Math.min(width - 64, 720) : width;
  const innerW = contentW - 36;
  const compact = height < 740;
  // Dron y GoPro: 96–112 dp. Celular, la principal: ~40 % más alta.
  const cardH = Math.round(Math.max(96, Math.min(112, innerW * 0.29)));
  const phoneH = Math.round(cardH * 1.4);
  // Héroe: encabezado + título (sobre el cielo, texto oscuro) y el lema sobre la huerta.
  const above = insets.top + 8 + 40 + 10 + (isTablet ? 64 : 54) + 22;
  const claimH = compact ? 62 : 72;
  const fade = 56;
  const gap = isTablet ? 120 : compact ? 34 : 64;
  const heroH = above + gap + claimH + fade;

  const [animateIn] = useState(() => !cardsShown && !reduced);
  useEffect(() => { cardsShown = true; }, []);

  const [lockedTap, setLockedTap] = useState(false);
  // Cámara elegida: Celular, Dron o GoPro. Las tres inician el mismo recorrido; solo cambia la animación.
  const [source, setSource] = useState<ScanSource>('celular');
  // Invitado: tocó «Recorrido inteligente» (bloqueado) → se explica cómo desbloquearlo.
  const [walkInfo, setWalkInfo] = useState(false);

  // Con cuenta: solo recorrido (la foto individual se toma con «Tomar foto» dentro del recorrido).
  // Invitado: solo foto individual; el recorrido aparece con candado.
  const ctaLabel = isGuest ? t('ctaPhoto') : source === 'dron' ? t('ctaWalkDrone') : source === 'camara' ? t('ctaWalkGopro') : t('ctaWalk');
  const caption = isGuest ? t('capPhoto') : source === 'dron' ? t('capDrone') : source === 'camara' ? t('capGopro') : t('capWalk');

  const start = () => {
    if (busyLabel) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (isGuest) onPhoto?.();
    else onWalk(source === 'dron' ? 'dron' : source === 'camara' ? 'gopro' : undefined);
  };
  const pick = (next: ScanSource) => {
    // Dron y GoPro inician un recorrido: requieren cuenta.
    if (isGuest && next !== 'celular') { Haptics.selectionAsync().catch(() => {}); setLockedTap(true); return; }
    if (next !== source) Haptics.selectionAsync().catch(() => {});
    setSource(next);
  };
  const tapLockedWalk = () => {
    Haptics.selectionAsync().catch(() => {});
    setWalkInfo(v => !v);
  };


  const SOURCES = [
    { key: 'celular' as const, Icon: Smartphone, title: t('srcPhone'), desc: t('descPhone') },
    { key: 'dron' as const, Icon: Plane, title: t('srcDrone'), desc: t('descDrone') },
    { key: 'camara' as const, Icon: Video, title: t('srcAction'), desc: t('descAction') },
  ];
  const renderCard = (src: (typeof SOURCES)[number], i: number) => {
    const on = source === src.key;
    const locked = isGuest && src.key !== 'celular';
    const large = src.key === 'celular';
    return (
      <SourceCard
        key={src.key} kind={src.key} index={i} animateIn={animateIn} large={large} selected={on} locked={locked}
        height={large ? phoneH : cardH} title={src.title} desc={src.desc} onPress={() => pick(src.key)}
        icon={sel => <src.Icon size={large ? 22 : 18} color={sel ? C.ink : C.white} />}
        a11y={`${src.title}. ${src.desc}${locked ? `, ${t('needsAccount')}` : ''}${on ? `, ${t('selected')}` : ''}`}
      />
    );
  };

  // Barra de pestañas flotante + botón central que sobresale.
  const bottomSpace = (isTablet ? 82 + 24 : 72 + 18) + 28 + insets.bottom;

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomSpace }} showsVerticalScrollIndicator={false}>
        {/* ── Héroe: foto de la huerta; arriba se funde con el cielo para el título, abajo con el blanco ── */}
        <View style={[s.hero, { height: heroH }]} pointerEvents="none">
          <Image source={IMG_HERO} style={s.heroImg} resizeMode="cover" accessibilityIgnoresInvertColors />
          <LinearGradient
            colors={['rgba(255,255,255,0.96)', 'rgba(255,255,255,0.78)', 'rgba(255,255,255,0)']}
            locations={[0, (above - 30) / heroH, (above + 26) / heroH]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(5,25,10,0.38)', 'rgba(5,25,10,0.18)', 'rgba(255,255,255,0.75)', '#FFFFFF']}
            locations={[(above + 10) / heroH, (heroH - fade - 6) / heroH, (heroH - fade * 0.55) / heroH, (heroH - fade * 0.22) / heroH, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={[s.content, { width: contentW, paddingTop: insets.top + 8 }]}>
          <ScanHeader remaining={tokensRemaining} isGuest={isGuest} email={email} onImage />
          <View style={s.titleRow}>
            <View style={s.titleIcon}><ScanLine size={24} color={C.deep} strokeWidth={2.2} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, isTablet && s.titleTablet]} accessibilityRole="header">{t('title')}</Text>
              <Text style={s.subtitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{t('subtitle')}</Text>
            </View>
          </View>

          <View style={{ height: gap }} />
          <View style={[s.claimBox, { height: claimH }]} accessible accessibilityLabel={`${t('line1')} ${t('line2')}`}>
            <Text style={[s.claim, compact && s.claimCompact]} maxFontSizeMultiplier={1.1}>{t('line1')}</Text>
            <Text style={[s.claim, s.claimLime, compact && s.claimCompact]} maxFontSizeMultiplier={1.1}>{t('line2')}</Text>
            <Svg width={150} height={12} viewBox="0 0 150 12" style={s.swoosh}>
              <Path d="M3 9 C 40 2, 100 1, 147 5" stroke={C.lime} strokeWidth={4} strokeLinecap="round" fill="none" />
            </Svg>
          </View>
          <View style={{ height: fade - 30 }} />

          {/* ── Cámara: Celular (la principal, más grande) arriba; Dron y GoPro debajo de los botones. ── */}
          <View accessibilityRole="radiogroup">{renderCard(SOURCES[0], 0)}</View>

          <Text style={[s.caption, { marginTop: 14 }]} maxFontSizeMultiplier={1.15}>{caption}</Text>
          {/* ── Acción principal: recorrido (con cuenta) o foto individual (invitado) ── */}
          <PressableScale onPress={start} accessibilityRole="button" accessibilityLabel={busyLabel ?? `${ctaLabel}. ${caption}`} accessibilityState={{ busy: !!busyLabel }} style={s.ctaWrap}>
            <LinearGradient colors={[...LIME_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cta}>
              {busyLabel ? <ActivityIndicator color={C.ink} /> : isGuest ? <Camera size={22} color={C.ink} /> : <Footprints size={22} color={C.ink} />}
              <Reanimated.Text key={busyLabel ? 'busy' : isGuest ? 'photo' : 'walk'} entering={reduced ? undefined : TEXT_IN}
                style={[s.ctaText, !!busyLabel && { fontSize: 16 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.15}>
                {busyLabel ?? ctaLabel}
              </Reanimated.Text>
              <ChevronRight size={22} color={C.ink} />
            </LinearGradient>
          </PressableScale>

          {/* Invitado: el recorrido inteligente se ve, con candado; al tocarlo se explica cómo desbloquearlo. */}
          {isGuest && (
            <>
              <PressableScale onPress={tapLockedWalk} accessibilityRole="button" accessibilityState={{ expanded: walkInfo }}
                accessibilityLabel={`${t('modeWalk')}, ${t('needsAccount')}`} style={s.lockedBtn}>
                <Footprints size={18} color={SCAN.muted} />
                <Text style={s.lockedText} numberOfLines={1} maxFontSizeMultiplier={1.2}>{t('modeWalk')}</Text>
                <View style={s.lockBadge}><Lock size={13} color="#FFFFFF" /></View>
              </PressableScale>
              {walkInfo && (
                <Reanimated.View entering={reduced ? undefined : FadeInDown.duration(200).easing(EASE_OUT)} style={s.unlock}>
                  <Text style={s.unlockTitle}>{t('unlockTitle')}</Text>
                  <Text style={s.unlockBody}>{t('unlockBody')}</Text>
                  <View style={s.unlockRow}>
                    <PressableScale onPress={() => router.replace('/(auth)')} accessibilityRole="button" style={[s.unlockBtn, s.unlockPrimary]}>
                      <Text style={s.unlockPrimaryText}>{t('account')}</Text>
                    </PressableScale>
                    <PressableScale onPress={() => router.push('/(app)/plans')} accessibilityRole="button" style={s.unlockBtn}>
                      <Text style={s.unlockBtnText}>{t('plans')}</Text>
                    </PressableScale>
                  </View>
                </Reanimated.View>
              )}
            </>
          )}

          {!isGuest && (
            <PressableScale onPress={onOpenScans} accessibilityRole="button" accessibilityLabel={t('myScans')} style={s.secondary}>
              <History size={18} color={C.deep} />
              <Text style={s.secondaryText} maxFontSizeMultiplier={1.2}>{t('myScans')}</Text>
              {pendingCount > 0 && (
                <View style={s.badge}><Text style={s.badgeText}>{t('pending', { count: pendingCount })}</Text></View>
              )}
            </PressableScale>
          )}


          {/* Dron y GoPro: también se eligen aquí y se inician con el botón de arriba. */}
          <View style={[s.cards, { marginTop: 16 }]} accessibilityRole="radiogroup">
            {SOURCES.slice(1).map((src, i) => renderCard(src, i + 1))}
          </View>
          {isGuest && lockedTap && <Text style={[s.caption, { color: SCAN.inkSoft }]} maxFontSizeMultiplier={1.15}>{t('locked')}</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SCAN.bg },
  content: { alignSelf: 'center', paddingHorizontal: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  titleIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(236,252,203,0.92)', borderWidth: 1, borderColor: 'rgba(132,204,22,0.35)' },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 34, lineHeight: 40, letterSpacing: -1.1, color: '#0F2A18' },
  titleTablet: { fontSize: 46, lineHeight: 54 },
  subtitle: { fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 19, color: '#2F4A38', marginTop: -2 },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', backgroundColor: '#F1F5F9' },
  // Ancho/alto explícitos: absoluteFill en <Image> amplía la foto en web.
  heroImg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  claimBox: { justifyContent: 'flex-end', paddingLeft: 4 },
  claim: { fontFamily: 'Poppins_700Bold', fontStyle: 'italic', fontSize: 31, lineHeight: 35, letterSpacing: -0.8, color: SCAN.onPhoto, textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 12 },
  claimLime: { color: '#C8F560' },
  claimCompact: { fontSize: 26, lineHeight: 30 },
  swoosh: { marginTop: 4, marginLeft: 6 },

  cards: { gap: 10 },
  // Sombra en la vista exterior, recorte en la interior (la sombra no se recorta).
  card: { borderRadius: 24, backgroundColor: C.deep, shadowColor: C.deep, shadowRadius: 12, shadowOpacity: 0.12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  cardFeatured: { borderRadius: 28, shadowColor: '#4D7C0F', shadowOpacity: 0.32, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 7 },
  cardClip: { flex: 1, borderRadius: 24, overflow: 'hidden' },
  cardImg: { position: 'absolute', top: 0, right: 0 },
  cardOn: { shadowOpacity: 0.3 },
  radio: { position: 'absolute', right: 14, top: 14, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.75)', backgroundColor: 'rgba(0,0,0,0.15)' },
  radioOn: { backgroundColor: C.lime, borderColor: C.lime },
  cardIconLarge: { width: 48, height: 48, borderRadius: 16 },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 28, borderWidth: 2.5, borderColor: C.lime },
  cardBody: { position: 'absolute', top: 0, bottom: 0, left: 18, width: '62%', flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardBodyFeatured: { left: 20, width: '64%', gap: 14 },
  cardIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  cardIconOn: { backgroundColor: C.lime, borderColor: C.lime },
  cardIconOff: { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.35)' },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontFamily: 'Poppins_700Bold', fontSize: 16.5, lineHeight: 21, color: C.white, letterSpacing: -0.2 },
  cardTitleFeatured: { fontSize: 23, lineHeight: 28, letterSpacing: -0.5 },
  cardDesc: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,0.86)' },
  cardDescFeatured: { fontSize: 13, lineHeight: 18 },
  lock: { position: 'absolute', top: 10, right: 12, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },

  caption: { marginTop: 8, fontFamily: 'Poppins_400Regular', fontSize: 12.5, lineHeight: 18, color: SCAN.muted },
  ctaWrap: { marginTop: 12, borderRadius: 22, shadowColor: '#65A30D', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, height: 58, borderRadius: 22, paddingHorizontal: 20 },
  ctaText: { flex: 1, textAlign: 'center', fontFamily: 'Poppins_700Bold', fontSize: 18, color: C.ink },
  lockedBtn: {
    marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 50,
    borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', backgroundColor: SCAN.surface,
  },
  lockedText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: SCAN.muted },
  lockBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#64748B' },
  unlock: { marginTop: 10, padding: 14, gap: 6, borderRadius: 18, backgroundColor: '#F7FEE7', borderWidth: 1, borderColor: '#D9F99D' },
  unlockTitle: { fontFamily: 'Poppins_700Bold', fontSize: 14.5, color: C.deep },
  unlockBody: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 19, color: SCAN.inkSoft },
  unlockRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  unlockBtn: { flex: 1, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: SCAN.line },
  unlockPrimary: { backgroundColor: C.deep, borderColor: C.deep },
  unlockPrimaryText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: '#FFFFFF' },
  unlockBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13.5, color: C.ink },
  secondary: {
    marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 46,
    borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: C.white,
  },
  secondaryText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14.5, color: C.ink },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#E0F2FE', borderWidth: 1, borderColor: '#7DD3FC' },
  badgeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#0369A1' },
});
