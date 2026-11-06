/**
 * Escanear — pantalla principal (fondo blanco, como el resto de la app).
 *
 * Tarjeta fotográfica de huerta con capas de visión artificial y tres fuentes de captura:
 * - Dron y GoPro/cámara de acción: importación de fotos desde la galería (no hay conexión directa
 *   con ningún fabricante; ver services/importar.ts).
 * - Celular: Foto individual y Recorrido inteligente (los flujos existentes).
 *
 * Movimiento (skill animate-expo): pestaña de uso frecuente, así que nada entra animado al abrirla.
 * Seleccionar fuente: borde y sombra con transición de 180 ms + Haptics.selectionAsync. Un solo bucle
 * (el punto de detección). Reducir movimiento: sin bucle ni escalas.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Reanimated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Camera, Check, ChevronRight, Footprints, History, Lock, Plane, ScanLine, Smartphone, Video } from 'lucide-react-native';
import { TranslationResource, useTranslations } from '../context/LanguageContext';
import ScanHeader from './scan/ScanHeader';
import { CSS_EASE_OUT, EASE_OUT, PressableScale } from './scan/motion';
import { CARD_SHADOW, LIME_GRADIENT, SCAN } from './scan/theme';

// Fotografías de Pexels (licencia libre, uso comercial). Ver assets/images/escanear/CREDITOS.md
// Video de dron sobre una huerta (Pexels 13779417, sin audio) y su primer cuadro como póster.
const VIDEO_HERO = require('../assets/videos/huerta-dron.mp4');
const IMG_POSTER = require('../assets/images/escanear/huerta-dron-poster.jpg');
const IMG_DRONE = require('../assets/images/escanear/fuente-dron.jpg');
const IMG_ACTION = require('../assets/images/escanear/fuente-gopro.jpg');
const IMG_PHONE = require('../assets/images/escanear/fuente-celular.jpg');

const CAPTION_IN = FadeIn.duration(200).easing(EASE_OUT);
const ROW_IN = FadeInDown.duration(220).easing(EASE_OUT);
const ROW_OUT = FadeOut.duration(140);
const CARD_H = 146;
const CARD_H_SHORT = 112;

export type ScanSource = 'dron' | 'camara' | 'celular';
type PhoneMode = 'recorrido' | 'foto';

const translations: TranslationResource = {
  title: { es: 'Escanear', en: 'Scan' },
  subtitle: { es: 'Explora tu cultivo con inteligencia artificial', en: 'Explore your crop with artificial intelligence' },
  line1: { es: 'Una huerta.', en: 'One orchard.' },
  line2: { es: 'Cualquier cámara.', en: 'Any camera.' },
  srcDrone: { es: 'Dron', en: 'Drone' },
  srcAction: { es: 'GoPro /\nCámara de acción', en: 'GoPro /\nAction camera' },
  srcPhone: { es: 'Celular', en: 'Phone' },
  capDrone: { es: 'Importa fotos aéreas de tu galería. Se ubican con su GPS.', en: 'Import aerial photos from your gallery. Placed by their GPS.' },
  capAction: { es: 'Importa fotos de tu GoPro o cámara de acción, por recorrido.', en: 'Import photos from your GoPro or action camera, per walk.' },
  capWalk: { es: 'Camina tu huerta: el celular toma las fotos solo, sin internet.', en: 'Walk your orchard: the phone takes the photos, offline.' },
  capPhoto: { es: 'Toma una foto de un fruto, hoja o árbol y recibe el diagnóstico.', en: 'Take a photo of a fruit, leaf or tree and get a diagnosis.' },
  modeWalk: { es: 'Recorrido inteligente', en: 'Smart walk' },
  modePhoto: { es: 'Foto individual', en: 'Single photo' },
  start: { es: 'Iniciar escaneo', en: 'Start scan' },
  locked: { es: 'Crea una cuenta para usarlo', en: 'Create an account to use it' },
  myScans: { es: 'Ver mis escaneos', en: 'View my scans' },
  pending: { es: '{count} sin subir', en: '{count} not uploaded' },
  selected: { es: 'seleccionado', en: 'selected' },
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
};

/** Tarjeta de fuente de captura: fotografía real, icono y nombre. */
function SourceCard({ image, icon, label, selected, locked, onPress, a11y, height }: {
  image: number; icon: React.ReactNode; label: string; selected: boolean; locked: boolean; onPress: () => void; a11y: string; height: number;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={a11y} style={s.cardWrap}>
      <View
        style={[
          s.card,
          {
            height,
            borderColor: selected ? SCAN.lime : SCAN.line,
            shadowOpacity: selected ? 0.35 : 0.1,
            transitionProperty: ['borderColor', 'shadowOpacity'],
            transitionDuration: 180,
            transitionTimingFunction: CSS_EASE_OUT,
          } as object,
        ]}
      >
        <View style={s.cardClip}>
          <Image source={image} style={s.cardImg} resizeMode="cover" accessibilityIgnoresInvertColors />
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.78)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
          <View style={s.cardBody}>
            <View style={[s.cardIcon, selected && s.cardIconOn]}>{icon}</View>
            <Text style={s.cardLabel} numberOfLines={3}>{label}</Text>
          </View>
          {selected && (
            <Reanimated.View entering={FadeIn.duration(160)} style={s.check}><Check size={13} color={SCAN.limeInk} strokeWidth={3} /></Reanimated.View>
          )}
          {locked && <View style={s.lock}><Lock size={12} color="#ffffff" /></View>}
        </View>
      </View>
    </PressableScale>
  );
}

/**
 * Video de fondo: en bucle, sin sonido y sin controles. Solo se reproduce con la pestaña visible
 * (ahorra batería) y no se reproduce con "Reducir movimiento" (queda el póster fijo).
 */
function HeroVideo({ playing }: { playing: boolean }) {
  const player = useVideoPlayer(VIDEO_HERO, p => {
    p.loop = true;
    p.muted = true;
  });
  useEffect(() => {
    try {
      // En web play() devuelve una promesa que falla si el navegador no puede decodificar el video:
      // en ese caso queda el póster debajo, sin error.
      const r = playing ? (player.play() as unknown) : (player.pause() as unknown);
      if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => {});
    } catch { /* se queda el póster */ }
  }, [playing, player]);
  return <VideoView player={player} style={s.heroImg} contentFit="cover" nativeControls={false} />;
}

export default function ScanHome({ isGuest, tokensValue, pendingCount, onPhoto, onWalk, onImport, onOpenScans }: Props) {
  const t = useTranslations(translations);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const isTablet = width >= 768;
  const contentW = isTablet ? Math.min(width - 64, 720) : width;
  const compact = height < 740;
  const narrow = width < 380;
  // Pantallas bajas (≈ iPhone SE): tarjetas más cortas para que los botones queden sobre la barra.
  const cardH = height < 700 ? CARD_H_SHORT : CARD_H;
  // Todo debe caber sobre la barra de pestañas flotante: el video de arriba toma el espacio que sobra.
  const tabZone = (isTablet ? 82 + 24 : 72 + 18) + insets.bottom + 18;
  const above = insets.top + 8 + 40 + 8 + (isTablet ? 60 : 46) + 22;        // encabezado + título + subtítulo
  const claimH = compact ? 56 : 64;
  const fade = 56;                                                          // donde el video se funde con el blanco
  const below = 12 + cardH + 12 + 48 + 12 + 58 + 10 + 48;                   // fuentes + modo/nota + botones
  const gap = Math.max(48, Math.min(isTablet ? 320 : 240, height - tabZone - above - claimH - fade - below));
  const heroH = above + gap + claimH + fade;

  // El video solo corre con la pestaña enfocada.
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));

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

  const caption = source === 'dron' ? t('capDrone') : source === 'camara' ? t('capAction') : phoneMode === 'recorrido' ? t('capWalk') : t('capPhoto');

  const start = () => {
    if (locked) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (source === 'celular') (phoneMode === 'foto' ? onPhoto : onWalk)();
    else onImport(source);
  };

  const sources = useMemo(() => [
    { key: 'dron' as const, image: IMG_DRONE, icon: <Plane size={17} color="#ffffff" />, label: t('srcDrone') },
    { key: 'camara' as const, image: IMG_ACTION, icon: <Video size={17} color="#ffffff" />, label: t('srcAction') },
    { key: 'celular' as const, image: IMG_PHONE, icon: <Smartphone size={17} color="#ffffff" />, label: t('srcPhone') },
  ], [t]);

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
          <View style={[s.frame, { top: above + 10, height: Math.max(36, gap - 20) }]}>
            <View style={[s.c, s.cTL]} /><View style={[s.c, s.cTR]} /><View style={[s.c, s.cBL]} /><View style={[s.c, s.cBR]} />
          </View>
        </View>

        <View style={[s.content, { width: contentW, paddingTop: insets.top + 8 }]}>
          <ScanHeader tokensValue={tokensValue} onImage />
          <Text style={[s.title, isTablet && s.titleTablet]} accessibilityRole="header">{t('title')}</Text>
          <Text style={s.subtitle} numberOfLines={1}>{t('subtitle')}</Text>

          <View style={{ height: gap }} />
          <View style={{ height: claimH, justifyContent: 'flex-end' }} accessible accessibilityLabel={`${t('line1')} ${t('line2')}`}>
            <Text style={[s.claim, compact && s.claimCompact]}>{t('line1')}</Text>
            <Text style={[s.claim, s.claimLime, compact && s.claimCompact]}>{t('line2')}</Text>
          </View>
          <View style={{ height: fade - 22 }} />

          {/* ── Fuentes de captura ── */}
          <View style={s.cards} accessibilityRole="radiogroup">
            {sources.map(src => (
              <SourceCard
                key={src.key}
                image={src.image}
                icon={src.icon}
                label={src.label}
                selected={source === src.key}
                locked={isGuest && src.key !== 'celular'}
                onPress={() => pick(src.key)}
                height={cardH}
                a11y={`${src.label.replace('\n', ' ')}${source === src.key ? `, ${t('selected')}` : ''}`}
              />
            ))}
          </View>

          {source === 'celular' ? (
            <Reanimated.View entering={reduced ? undefined : ROW_IN} exiting={reduced ? undefined : ROW_OUT} style={s.modes}>
              {(['recorrido', 'foto'] as PhoneMode[]).map(m => {
                const on = phoneMode === m;
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
                    {!narrow && (m === 'recorrido' ? <Footprints size={15} color={on ? SCAN.limeInk : SCAN.muted} /> : <Camera size={15} color={on ? SCAN.limeInk : SCAN.muted} />)}
                    <Text style={[s.modeText, on && s.modeTextOn]} numberOfLines={1}>{m === 'recorrido' ? t('modeWalk') : t('modePhoto')}</Text>
                    {isGuest && m === 'recorrido' && <Lock size={12} color={SCAN.muted} />}
                  </PressableScale>
                );
              })}
            </Reanimated.View>
          ) : (
            <Reanimated.Text key={caption} entering={reduced ? undefined : CAPTION_IN} style={s.caption} numberOfLines={2}>{caption}</Reanimated.Text>
          )}

          {/* ── Acciones ── */}
          <PressableScale onPress={start} disabled={locked} accessibilityRole="button" accessibilityState={{ disabled: locked }} accessibilityLabel={locked ? t('locked') : `${t('start')}. ${caption}`} style={s.ctaWrap}>
            <LinearGradient colors={locked ? ['#E2E8F0', '#CBD5E1'] : [...LIME_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cta}>
              {locked ? <Lock size={20} color={SCAN.inkSoft} /> : <ScanLine size={22} color={SCAN.limeInk} />}
              <Text style={[s.ctaText, locked && { color: SCAN.inkSoft }]}>{locked ? t('locked') : t('start')}</Text>
              {!locked && <ChevronRight size={22} color={SCAN.limeInk} />}
            </LinearGradient>
          </PressableScale>

          {!isGuest && (
            <PressableScale onPress={onOpenScans} accessibilityRole="button" accessibilityLabel={t('myScans')} style={s.secondary}>
              <History size={18} color={SCAN.ink} />
              <Text style={s.secondaryText}>{t('myScans')}</Text>
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
  // Tarjeta fotográfica: sombra en la vista exterior, recorte en la interior (la sombra no se recorta).
  hero: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', backgroundColor: '#E2E8F0' },
  // Ancho/alto explícitos: absoluteFill en <Image> amplía la foto en web.
  heroImg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  frame: { position: 'absolute', left: '6%', right: '6%' },
  c: { position: 'absolute', width: 24, height: 24, borderColor: 'rgba(255,255,255,0.9)' },
  cTL: { top: 0, left: 0, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderTopLeftRadius: 6 },
  cTR: { top: 0, right: 0, borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopRightRadius: 6 },
  cBL: { bottom: 0, left: 0, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderBottomLeftRadius: 6 },
  cBR: { bottom: 0, right: 0, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomRightRadius: 6 },
  claim: { fontFamily: 'Poppins_700Bold', fontSize: 28, lineHeight: 32, letterSpacing: -0.7, color: SCAN.onPhoto, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 10 },
  claimLime: { color: '#BEF264' },
  claimCompact: { fontSize: 23, lineHeight: 27 },
  cards: { flexDirection: 'row', gap: 10 },
  cardWrap: { flex: 1 },
  card: { borderRadius: 22, borderWidth: 2, backgroundColor: '#E2E8F0', shadowColor: SCAN.lime, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardClip: { flex: 1, borderRadius: 20, overflow: 'hidden' },
  cardImg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  cardBody: { position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center', gap: 5, paddingHorizontal: 6 },
  cardIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  cardIconOn: { backgroundColor: 'rgba(132,204,22,0.85)', borderColor: '#ffffff' },
  cardLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, lineHeight: 15, color: '#ffffff', textAlign: 'center' },
  check: { position: 'absolute', top: 7, right: 7, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: SCAN.limeBright },
  lock: { position: 'absolute', top: 7, left: 7, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modes: { flexDirection: 'row', gap: 10, marginTop: 12, height: 48 },
  mode: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: SCAN.line, backgroundColor: SCAN.surface },
  modeOn: { backgroundColor: SCAN.limeSoft, borderColor: SCAN.lime },
  modeText: { flexShrink: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: SCAN.muted },
  modeTextOn: { color: SCAN.limeInk },
  caption: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 19, color: SCAN.muted, marginTop: 12, height: 48 },
  ctaWrap: { marginTop: 12, borderRadius: 22, shadowColor: SCAN.lime, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, height: 58, borderRadius: 22, paddingHorizontal: 20 },
  ctaText: { flex: 1, textAlign: 'center', fontFamily: 'Poppins_700Bold', fontSize: 18, color: SCAN.limeInk },
  secondary: {
    marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 48,
    borderRadius: 20, borderWidth: 1.5, borderColor: SCAN.line, backgroundColor: SCAN.card,
  },
  secondaryText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: SCAN.ink },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#E0F2FE', borderWidth: 1, borderColor: '#7DD3FC' },
  badgeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#0369A1' },
});
