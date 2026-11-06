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
import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Reanimated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Camera, Check, ChevronRight, Footprints, History, Lock, Plane, ScanLine, Smartphone, Video } from 'lucide-react-native';
import { TranslationResource, useTranslations } from '../context/LanguageContext';
import ScanHeader from './scan/ScanHeader';
import { CSS_EASE_OUT, EASE_OUT, PressableScale, PulseRing } from './scan/motion';
import { CARD_SHADOW, LIME_GRADIENT, SCAN } from './scan/theme';

// Fotografías de Pexels (licencia libre, uso comercial). Ver assets/images/escanear/CREDITOS.md
const IMG_HERO = require('../assets/images/escanear/hero-huerta.jpg');
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
  aiTag: { es: 'Visión IA', en: 'AI vision' },
  srcDrone: { es: 'Dron', en: 'Drone' },
  srcAction: { es: 'GoPro /\nCámara de acción', en: 'GoPro /\nAction camera' },
  srcPhone: { es: 'Celular', en: 'Phone' },
  capDrone: { es: 'Importa fotos aéreas de tu galería. Se ubican con su GPS.', en: 'Import aerial photos from your gallery. Placed by their GPS.' },
  capAction: { es: 'Importa fotos de tu GoPro o cámara de acción, por recorrido.', en: 'Import photos from your GoPro or action camera, per walk.' },
  capWalk: { es: 'Camina tu huerta: el celular toma las fotos solo, sin internet.', en: 'Walk your orchard: the phone takes the photos, offline.' },
  capPhoto: { es: 'Toma una foto de un fruto, hoja o árbol y recibe el diagnóstico.', en: 'Take a photo of a fruit, leaf or tree and get a diagnosis.' },
  modeWalk: { es: 'Recorrido inteligente', en: 'Smart walk' },
  modePhoto: { es: 'Foto individual', en: 'Single photo' },
  reticleDrone: { es: 'Vista aérea', en: 'Aerial view' },
  reticleAction: { es: 'Cámara de acción', en: 'Action camera' },
  reticlePhone: { es: 'Cámara del celular', en: 'Phone camera' },
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

export default function ScanHome({ isGuest, tokensValue, pendingCount, onPhoto, onWalk, onImport, onOpenScans }: Props) {
  const t = useTranslations(translations);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const isTablet = width >= 768;
  const contentW = isTablet ? Math.min(width - 64, 720) : width;
  const compact = height < 740;
  // Pantallas bajas (≈ iPhone SE): tarjetas más cortas para que los botones queden sobre la barra.
  const cardH = height < 700 ? CARD_H_SHORT : CARD_H;
  // Todo debe caber sobre la barra de pestañas flotante: la tarjeta fotográfica toma lo que sobra.
  const tabZone = (isTablet ? 82 + 24 : 72 + 18) + insets.bottom + 18;
  const above = insets.top + 8 + 40 + 8 + (isTablet ? 60 : 46) + 22 + 14;   // encabezado + título + subtítulo
  const below = 12 + cardH + 10 + 44 + 12 + 58 + 10 + 48;                    // fuentes + modo/nota + botones
  const heroH = Math.max(compact ? 150 : 180, Math.min(isTablet ? 460 : 360, height - tabZone - above - below));

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
  const reticleLabel = source === 'dron' ? t('reticleDrone') : source === 'camara' ? t('reticleAction') : t('reticlePhone');

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
        <View style={[s.content, { width: contentW, paddingTop: insets.top + 8 }]}>
          <ScanHeader tokensValue={tokensValue} />
          <Text style={[s.title, isTablet && s.titleTablet]} accessibilityRole="header">{t('title')}</Text>
          <Text style={s.subtitle} numberOfLines={1}>{t('subtitle')}</Text>

          {/* ── Tarjeta fotográfica con capas de visión ── */}
          <View style={[s.hero, { height: heroH }]} accessible accessibilityLabel={`${t('line1')} ${t('line2')}`}>
            <View style={s.heroClip} pointerEvents="none">
              <Image source={IMG_HERO} style={s.heroImg} resizeMode="cover" accessibilityIgnoresInvertColors />
              <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.7)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
              {/* trayectoria del vuelo/recorrido sobre la huerta */}
              <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
                <Path d="M -4 34 C 22 22, 52 22, 104 30" stroke="rgba(255,255,255,0.7)" strokeWidth={0.3} strokeDasharray="0.6 1.6" fill="none" />
              </Svg>
              {/* retícula general */}
              <View style={[s.frame, { top: 14, height: heroH * 0.52 }]}>
                <View style={[s.c, s.cTL]} /><View style={[s.c, s.cTR]} /><View style={[s.c, s.cBL]} /><View style={[s.c, s.cBR]} />
              </View>
              {/* detección sobre una copa */}
              <View style={[s.detect, { top: 14 + heroH * 0.2, height: Math.max(40, heroH * 0.24) }]}>
                <View style={s.detectFill} />
                <View style={[s.c2, s.cTL]} /><View style={[s.c2, s.cTR]} /><View style={[s.c2, s.cBL]} /><View style={[s.c2, s.cBR]} />
                <View style={s.detectDot}>
                  <PulseRing size={30} color={SCAN.limeBright} />
                  <View style={s.dot} />
                </View>
                <View style={s.aiTagWrap}>
                  <Reanimated.View key={reticleLabel} entering={reduced ? undefined : CAPTION_IN} style={s.aiTag}>
                    <ScanLine size={11} color={SCAN.limeInk} />
                    <Text style={s.aiTagText} numberOfLines={1}>{t('aiTag')} · {reticleLabel}</Text>
                  </Reanimated.View>
                </View>
              </View>
              <View style={s.claimBox}>
                <Text style={[s.claim, compact && s.claimCompact]}>{t('line1')}</Text>
                <Text style={[s.claim, s.claimLime, compact && s.claimCompact]}>{t('line2')}</Text>
              </View>
            </View>
          </View>

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
                    style={[s.mode, on && s.modeOn, { transitionProperty: ['backgroundColor', 'borderColor'], transitionDuration: 160, transitionTimingFunction: CSS_EASE_OUT } as object]}
                  >
                    {m === 'recorrido' ? <Footprints size={15} color={on ? SCAN.limeInk : SCAN.muted} /> : <Camera size={15} color={on ? SCAN.limeInk : SCAN.muted} />}
                    <Text style={[s.modeText, on && s.modeTextOn]}>{m === 'recorrido' ? t('modeWalk') : t('modePhoto')}</Text>
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
  title: { fontFamily: 'Poppins_700Bold', fontSize: 38, lineHeight: 46, letterSpacing: -1.2, color: SCAN.ink, marginTop: 8 },
  titleTablet: { fontSize: 50, lineHeight: 60 },
  subtitle: { fontFamily: 'Poppins_400Regular', fontSize: 15, lineHeight: 22, color: '#52606D' },
  // Tarjeta fotográfica: sombra en la vista exterior, recorte en la interior (la sombra no se recorta).
  hero: { marginTop: 14, borderRadius: 28, backgroundColor: '#E2E8F0', ...CARD_SHADOW },
  heroClip: { flex: 1, borderRadius: 28, overflow: 'hidden' },
  // Ancho/alto explícitos: absoluteFill en <Image> amplía la foto en web.
  heroImg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  frame: { position: 'absolute', left: '6%', right: '6%' },
  c: { position: 'absolute', width: 24, height: 24, borderColor: 'rgba(255,255,255,0.9)' },
  c2: { position: 'absolute', width: 14, height: 14, borderColor: SCAN.limeBright },
  cTL: { top: 0, left: 0, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderTopLeftRadius: 6 },
  cTR: { top: 0, right: 0, borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopRightRadius: 6 },
  cBL: { bottom: 0, left: 0, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderBottomLeftRadius: 6 },
  cBR: { bottom: 0, right: 0, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomRightRadius: 6 },
  detect: { position: 'absolute', right: '12%', width: '30%' },
  detectFill: { ...StyleSheet.absoluteFill, borderRadius: 6, backgroundColor: 'rgba(168,232,62,0.24)', borderWidth: 1, borderColor: 'rgba(190,242,100,0.7)' },
  detectDot: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', width: 10, height: 10, marginLeft: -5, marginTop: -5, left: 0, top: 0, borderRadius: 5, backgroundColor: SCAN.limeBright, borderWidth: 2, borderColor: '#ffffff' },
  // La etiqueta se alinea a la derecha del recuadro y puede ser más ancha que él (una sola línea).
  aiTagWrap: { position: 'absolute', right: 0, top: -24, width: 240, alignItems: 'flex-end' },
  aiTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: SCAN.limeBright },
  aiTagText: { fontFamily: 'Poppins_600SemiBold', fontSize: 10, color: SCAN.limeInk },
  claimBox: { position: 'absolute', left: 18, right: 18, bottom: 14 },
  claim: { fontFamily: 'Poppins_700Bold', fontSize: 27, lineHeight: 31, letterSpacing: -0.7, color: SCAN.onPhoto },
  claimLime: { color: '#BEF264' },
  claimCompact: { fontSize: 23, lineHeight: 27 },
  cards: { flexDirection: 'row', gap: 10, marginTop: 12 },
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
  modes: { flexDirection: 'row', gap: 8, marginTop: 10, height: 44 },
  mode: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, borderWidth: 1, borderColor: SCAN.line, backgroundColor: SCAN.surface },
  modeOn: { backgroundColor: SCAN.limeSoft, borderColor: SCAN.lime },
  modeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: SCAN.muted },
  modeTextOn: { color: SCAN.limeInk },
  caption: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 19, color: SCAN.muted, marginTop: 10, height: 44 },
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
