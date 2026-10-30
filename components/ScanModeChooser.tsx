import React, { useEffect } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { ArrowRight, Camera, Check, CloudUpload, Coins, Lock, Route, ScanLine, Trees, WifiOff, Wifi, Zap } from 'lucide-react-native';
import { TranslationResource, useTranslations } from '../context/LanguageContext';
import { AiAnalyzeIllustration, ChestMountIllustration, WalkPathIllustration } from './scan/ScanIllustrations';

// Fotos de Pexels (licencia Pexels: uso comercial libre). Ver assets/images/escanear/CREDITOS.md
const IMG_AVOCADO_TREE = require('../assets/images/escanear/foto-aguacate-arbol.jpg');
const IMG_ORCHARD_WALK = require('../assets/images/escanear/recorrido-huerta.jpg');

const PURPLE = '#44227C';
const PURPLE_SOFT = '#6D28D9';
const GREEN = '#0f766e';

const translations: TranslationResource = {
  title: { es: 'Escanear', en: 'Scan' },
  subtitle: { es: '¿Cómo quieres analizar tu cultivo?', en: 'How do you want to analyze your crop?' },
  tokens: { es: 'Tokens disponibles', en: 'Available tokens' },
  // Foto individual
  photoTitle: { es: 'Foto individual', en: 'Single photo' },
  photoBody: {
    es: 'Apunta a un fruto, toma una fotografía y recibe un diagnóstico en segundos.',
    en: 'Point at a fruit, take a photo and get a diagnosis in seconds.',
  },
  photoFeat1: { es: 'Resultado al instante', en: 'Instant result' },
  photoFeat2: { es: 'Requiere internet', en: 'Needs internet' },
  photoCta: { es: 'Abrir cámara', en: 'Open camera' },
  // Recorrido inteligente
  walkTitle: { es: 'Recorrido inteligente', en: 'Smart field walk' },
  walkBadge: { es: 'Captura automática', en: 'Automatic capture' },
  walkBody: {
    es: 'Recorre tu huerta mientras AVOTEX captura y analiza automáticamente imágenes de tus árboles.',
    en: 'Walk your orchard while AVOTEX automatically captures and analyzes images of your trees.',
  },
  walkFeat1: { es: 'Captura automática', en: 'Automatic capture' },
  walkFeat2: { es: 'Selección inteligente de fotografías', en: 'Smart photo selection' },
  walkFeat3: { es: 'Sin internet durante la captura', en: 'No internet needed while capturing' },
  walkFeat4: { es: 'Se analiza al recuperar la conexión', en: 'Analyzed once you are back online' },
  walkCta: { es: 'Iniciar recorrido', en: 'Start walk' },
  walkLocked: { es: 'Crea una cuenta para usarlo', en: 'Create an account to use it' },
  pendingOne: { es: '1 recorrido pendiente de subir', en: '1 walk waiting to upload' },
  pendingMany: { es: '{count} recorridos pendientes de subir', en: '{count} walks waiting to upload' },
  pendingPhotos: { es: '{count} fotografías guardadas en tu celular', en: '{count} photos saved on your phone' },
  // ¿Cómo funciona?
  howTitle: { es: '¿Cómo funciona el recorrido?', en: 'How does the walk work?' },
  how1Title: { es: 'Coloca tu teléfono', en: 'Mount your phone' },
  how1Body: { es: 'Fija tu teléfono al pecho o casco con la cámara orientada hacia los árboles.', en: 'Attach your phone to your chest or helmet with the camera facing the trees.' },
  how2Title: { es: 'Recorre tu huerta', en: 'Walk your orchard' },
  how2Body: { es: 'Camina normalmente mientras AVOTEX captura fotografías automáticamente.', en: 'Walk normally while AVOTEX captures photos automatically.' },
  how3Title: { es: 'Analiza con IA', en: 'Analyze with AI' },
  how3Body: { es: 'Las imágenes seleccionadas se procesan para detectar posibles enfermedades.', en: 'Selected images are processed to detect possible diseases.' },
  // ¿Cuál elijo?
  whichTitle: { es: '¿Cuál elijo?', en: 'Which one?' },
  whichPhoto: { es: 'Para revisar un fruto o árbol en particular.', en: 'To check one particular fruit or tree.' },
  whichWalk: { es: 'Para revisar muchos árboles mientras recorres tu huerta.', en: 'To check many trees while you walk your orchard.' },
};

type Props = {
  isGuest: boolean;
  /** Tokens disponibles ya formateados (ej. "4,800"), o null si aún no se conocen. */
  tokensValue: string | null;
  pendingWalks: number;
  pendingPhotos: number;
  onPhoto: () => void;
  onWalk: () => void;
};

// ───────────────────────── piezas visuales ─────────────────────────

/** Tarjeta que se hunde un poco al tocarla. */
function PressableCard({ onPress, disabled, label, style, children }: {
  onPress?: () => void; disabled?: boolean; label: string; style?: object; children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Reanimated.View style={[style, anim]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 18, stiffness: 260 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 200 }); }}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        accessibilityLabel={label}
        style={{ flex: 1 }}
      >
        {children}
      </Pressable>
    </Reanimated.View>
  );
}

/** Foto de aguacates en el árbol con un teléfono que encuadra el fruto (captura manual). */
function PhotoVisual({ height }: { height: number }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    y.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduce, y]);
  const phoneH = height - 26;
  const phoneW = phoneH * 0.52;
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: 18 + y.value * (phoneH * 0.62) }] }));

  return (
    <View style={[v.media, { height }]}>
      <Image source={IMG_AVOCADO_TREE} style={v.mediaImg} resizeMode="cover" accessibilityIgnoresInvertColors />
      <LinearGradient
        colors={['rgba(68,34,124,0)', 'rgba(68,34,124,0.25)', 'rgba(46,26,87,0.78)']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Teléfono: muestra el mismo aguacate ampliado dentro del visor */}
      <View style={[v.phone, { width: phoneW, height: phoneH }]}>
        <View style={v.phoneScreen}>
          <Image
            source={IMG_AVOCADO_TREE}
            style={{ position: 'absolute', width: phoneW * 3.4, height: phoneW * 3.4 * (7 / 12), left: -phoneW * 1.55, top: -phoneH * 0.02 }}
            resizeMode="cover"
          />
          <View style={v.reticle}>
            <View style={[v.rc, v.rcTL]} /><View style={[v.rc, v.rcTR]} />
            <View style={[v.rc, v.rcBL]} /><View style={[v.rc, v.rcBR]} />
          </View>
          <Reanimated.View style={[v.scanLine, lineStyle]}>
            <LinearGradient colors={['rgba(196,181,253,0)', 'rgba(196,181,253,0.95)', 'rgba(196,181,253,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Reanimated.View>
          <View style={v.shutter}><View style={v.shutterInner} /></View>
        </View>
        <View style={v.notch} />
      </View>
    </View>
  );
}

/** Agricultor recorriendo su huerta: ruta con puntos de captura y el teléfono al pecho. */
function WalkVisual({ height, locked }: { height: number; locked: boolean }) {
  const reduce = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduce || locked) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false);
  }, [reduce, locked, pulse]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.85 * (1 - pulse.value), transform: [{ scale: 0.5 + pulse.value * 1.5 }] }));

  return (
    <View style={[v.media, { height }]}>
      <Image source={IMG_ORCHARD_WALK} style={v.mediaImg} resizeMode="cover" accessibilityIgnoresInvertColors />
      <LinearGradient
        colors={['rgba(15,118,110,0.10)', 'rgba(15,118,110,0.18)', 'rgba(17,94,89,0.85)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Ruta y puntos de captura sobre el surco */}
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 320 187" preserveAspectRatio="xMidYMid slice">
        <Path d="M120 187 C 140 168, 150 158, 160 146 S 172 128, 168 118" stroke="#ffffff" strokeOpacity={0.95} strokeWidth={3.2} strokeLinecap="round" strokeDasharray="1.5 8" fill="none" />
        {[[126, 182], [146, 160], [162, 140]].map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={4.4} fill="#34d399" stroke="#ffffff" strokeWidth={1.8} />
        ))}
      </Svg>
      {!locked && (
        <View pointerEvents="none" style={v.pulseAnchor}>
          <Reanimated.View style={[v.pulseRing, ring]} />
          <View style={v.pulseDot}><Camera size={11} color={GREEN} /></View>
        </View>
      )}
      {/* Detalle: teléfono sujeto al pecho */}
      <View style={v.inset}>
        <ChestMountIllustration size={62} />
      </View>
    </View>
  );
}

function Feature({ icon, label, dark, inline }: { icon: React.ReactNode; label: string; dark?: boolean; inline?: boolean }) {
  return (
    <View style={[s.feature, inline && s.featureInline]}>
      <View style={[s.featureIcon, dark ? s.featureIconDark : s.featureIconLight]}>{icon}</View>
      <Text style={[s.featureText, dark && s.featureTextDark]}>{label}</Text>
    </View>
  );
}

// ───────────────────────── pantalla ─────────────────────────

export default function ScanModeChooser({ isGuest, tokensValue, pendingWalks, pendingPhotos, onPhoto, onWalk }: Props) {
  const t = useTranslations(translations);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const how = [
    { n: '01', title: t('how1Title'), body: t('how1Body'), art: <ChestMountIllustration size={isTablet ? 76 : 60} /> },
    { n: '02', title: t('how2Title'), body: t('how2Body'), art: <WalkPathIllustration size={isTablet ? 76 : 60} /> },
    { n: '03', title: t('how3Title'), body: t('how3Body'), art: <AiAnalyzeIllustration size={isTablet ? 76 : 60} /> },
  ];

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.content, isTablet && s.contentTablet, { paddingTop: insets.top + (isTablet ? 40 : 24) }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Encabezado */}
      <Reanimated.View entering={FadeInUp.duration(450)} style={s.header}>
        <Text style={[s.title, isTablet && s.titleTablet]}>{t('title')}</Text>
        <Text style={[s.subtitle, isTablet && s.subtitleTablet]}>{t('subtitle')}</Text>
        {tokensValue ? (
          <View style={s.tokens} accessibilityLabel={`${tokensValue} ${t('tokens')}`}>
            <View style={s.tokensIcon}><Coins size={14} color="#b45309" /></View>
            <Text style={s.tokensValue}>{tokensValue}</Text>
            <Text style={s.tokensLabel}>{t('tokens')}</Text>
          </View>
        ) : null}
      </Reanimated.View>

      <View style={[s.cards, isTablet && s.cardsTablet]}>
        {/* ── Foto individual (manual, morado) ── */}
        <Reanimated.View entering={FadeInUp.delay(90).duration(500)} style={isTablet ? s.colPhoto : undefined}>
          <PressableCard onPress={onPhoto} label={`${t('photoTitle')}. ${t('photoBody')}`} style={[s.cardShadow, s.photoShadow, { flex: 1 }]}>
            <View style={[s.card, s.photoCard]}>
              <PhotoVisual height={isTablet ? 200 : 152} />
              <View style={s.body}>
                <View style={s.titleRow}>
                  <View style={[s.titleIcon, { backgroundColor: '#EDE9FE' }]}><Camera size={19} color={PURPLE} /></View>
                  <Text style={[s.cardTitle, { color: '#2E1A57' }]}>{t('photoTitle')}</Text>
                </View>
                <Text style={[s.cardBody, { color: '#4B3A6B' }]}>{t('photoBody')}</Text>
                <View style={s.featuresRow}>
                  <Feature inline icon={<Zap size={13} color={PURPLE_SOFT} />} label={t('photoFeat1')} />
                  <Feature inline icon={<Wifi size={13} color={PURPLE_SOFT} />} label={t('photoFeat2')} />
                </View>
                <View style={[s.cta, { backgroundColor: PURPLE }]}>
                  <Text style={s.ctaText}>{t('photoCta')}</Text>
                  <ArrowRight size={18} color="#ffffff" />
                </View>
              </View>
            </View>
          </PressableCard>
        </Reanimated.View>

        {/* ── Recorrido inteligente (automático, verde, destacado) ── */}
        <Reanimated.View entering={FadeInUp.delay(170).duration(500)} style={isTablet ? s.colWalk : undefined}>
          <PressableCard
            onPress={isGuest ? undefined : onWalk}
            disabled={isGuest}
            label={`${t('walkTitle')}. ${isGuest ? t('walkLocked') : t('walkBody')}`}
            style={[s.cardShadow, s.walkShadow, { flex: 1 }]}
          >
            <LinearGradient colors={['#0f766e', '#115e59', '#134e4a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
              <View>
                <WalkVisual height={isTablet ? 250 : 196} locked={isGuest} />
                <View style={s.mediaBadge}>
                  <ScanLine size={13} color="#a7f3d0" />
                  <Text style={s.mediaBadgeText}>{t('walkBadge')}</Text>
                </View>
                {isGuest && (
                  <View style={s.lockOverlay}><View style={s.lockCircle}><Lock size={22} color={GREEN} /></View></View>
                )}
              </View>
              <View style={s.body}>
                <View style={s.titleRow}>
                  <View style={[s.titleIcon, { backgroundColor: '#d1fae5' }]}><Trees size={19} color={GREEN} /></View>
                  <Text style={[s.cardTitle, s.walkTitle, { color: '#ffffff' }]}>{t('walkTitle')}</Text>
                </View>
                <Text style={[s.cardBody, { color: 'rgba(236,253,245,0.92)' }]}>{t('walkBody')}</Text>
                <View style={s.featuresGrid}>
                  <Feature dark icon={<Route size={13} color="#a7f3d0" />} label={t('walkFeat1')} />
                  <Feature dark icon={<Check size={13} color="#a7f3d0" />} label={t('walkFeat2')} />
                  <Feature dark icon={<WifiOff size={13} color="#a7f3d0" />} label={t('walkFeat3')} />
                  <Feature dark icon={<CloudUpload size={13} color="#a7f3d0" />} label={t('walkFeat4')} />
                </View>
                {pendingWalks > 0 && !isGuest && (
                  <View style={s.pending}>
                    <CloudUpload size={16} color="#713f12" />
                    <View style={{ flex: 1 }}>
                      <Text style={s.pendingTitle}>{pendingWalks === 1 ? t('pendingOne') : t('pendingMany', { count: pendingWalks })}</Text>
                      {pendingPhotos > 0 && <Text style={s.pendingSub}>{t('pendingPhotos', { count: pendingPhotos.toLocaleString() })}</Text>}
                    </View>
                  </View>
                )}
                <View style={[s.cta, { backgroundColor: isGuest ? 'rgba(255,255,255,0.16)' : '#ffffff' }]}>
                  <Text style={[s.ctaText, { color: isGuest ? '#d1fae5' : GREEN }]}>{isGuest ? t('walkLocked') : t('walkCta')}</Text>
                  {!isGuest && <ArrowRight size={18} color={GREEN} />}
                </View>
              </View>
            </LinearGradient>
          </PressableCard>
        </Reanimated.View>
      </View>

      {/* ── ¿Cómo funciona? ── */}
      <Reanimated.View entering={FadeInUp.delay(240).duration(500)} style={s.section}>
        <Text style={s.sectionTitle}>{t('howTitle')}</Text>
        <View style={[s.howList, isTablet && s.howListTablet]}>
          {how.map(step => (
            <View key={step.n} style={[s.howItem, isTablet && s.howItemTablet]}>
              <View style={s.howArt}>{step.art}</View>
              <View style={[s.howText, isTablet && s.howTextTablet]}>
                <Text style={s.howNum}>{step.n}</Text>
                <Text style={s.howTitle}>{step.title}</Text>
                <Text style={s.howBody}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </Reanimated.View>

      {/* ── ¿Cuál elijo? ── */}
      <Reanimated.View entering={FadeInUp.delay(300).duration(500)} style={s.section}>
        <Text style={s.sectionTitle}>{t('whichTitle')}</Text>
        <View style={s.which}>
          <View style={[s.whichItem, { backgroundColor: '#F5F3FF', borderColor: '#EDE9FE' }]}>
            <View style={[s.whichIcon, { backgroundColor: '#EDE9FE' }]}><Camera size={16} color={PURPLE} /></View>
            <Text style={[s.whichName, { color: PURPLE }]}>{t('photoTitle')}</Text>
            <Text style={s.whichBody}>{t('whichPhoto')}</Text>
          </View>
          <View style={[s.whichItem, { backgroundColor: '#F0FDFA', borderColor: '#CCFBF1' }]}>
            <View style={[s.whichIcon, { backgroundColor: '#CCFBF1' }]}><Trees size={16} color={GREEN} /></View>
            <Text style={[s.whichName, { color: GREEN }]}>{t('walkTitle')}</Text>
            <Text style={s.whichBody}>{t('whichWalk')}</Text>
          </View>
        </View>
      </Reanimated.View>
    </ScrollView>
  );
}

// ───────────────────────── estilos ─────────────────────────

const v = StyleSheet.create({
  media: { overflow: 'hidden', borderRadius: 22, backgroundColor: '#1f2937' },
  mediaImg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  phone: {
    position: 'absolute', right: 18, top: 13,
    borderRadius: 18, padding: 4, backgroundColor: '#111827',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
    transform: [{ rotate: '4deg' }],
  },
  phoneScreen: { flex: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center' },
  notch: { position: 'absolute', top: 8, alignSelf: 'center', width: 26, height: 5, borderRadius: 3, backgroundColor: '#111827' },
  reticle: { position: 'absolute', top: '18%', left: '16%', right: '16%', bottom: '30%' },
  rc: { position: 'absolute', width: 14, height: 14, borderColor: '#ffffff' },
  rcTL: { top: 0, left: 0, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderTopLeftRadius: 5 },
  rcTR: { top: 0, right: 0, borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopRightRadius: 5 },
  rcBL: { bottom: 0, left: 0, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderBottomLeftRadius: 5 },
  rcBR: { bottom: 0, right: 0, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomRightRadius: 5 },
  scanLine: { position: 'absolute', top: 0, left: 8, right: 8, height: 2.5, borderRadius: 2, overflow: 'hidden' },
  shutter: { position: 'absolute', bottom: 9, width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#ffffff' },
  // Sobre el pecho del agricultor de la foto: ahí va el teléfono que captura.
  pulseAnchor: { position: 'absolute', left: '53.2%', top: '43%', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#ffffff' },
  pulseDot: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  inset: {
    position: 'absolute', right: 12, top: 12, width: 70, height: 70, borderRadius: 35,
    backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 18, paddingBottom: 140, gap: 22 },
  contentTablet: { maxWidth: 1080, width: '100%', alignSelf: 'center', paddingHorizontal: 32 },
  header: { gap: 4 },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 36, lineHeight: 42, letterSpacing: -1.1, color: '#0A0A0A' },
  titleTablet: { fontSize: 46, lineHeight: 52 },
  subtitle: { fontFamily: 'Poppins_400Regular', fontSize: 15, color: '#52606D' },
  subtitleTablet: { fontSize: 18 },
  tokens: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 10,
    paddingLeft: 5, paddingRight: 14, paddingVertical: 5, borderRadius: 999,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
  },
  tokensIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  tokensValue: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: '#78350F' },
  tokensLabel: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, color: '#92400E' },
  cards: { gap: 16 },
  cardsTablet: { flexDirection: 'row', alignItems: 'stretch' },
  colPhoto: { flex: 1 },
  colWalk: { flex: 1.25 },
  cardShadow: { borderRadius: 28, shadowOffset: { width: 0, height: 12 }, shadowRadius: 22, elevation: 5 },
  photoShadow: { shadowColor: '#6D28D9', shadowOpacity: 0.13 },
  walkShadow: { shadowColor: '#0f766e', shadowOpacity: 0.22 },
  card: { flex: 1, borderRadius: 28, padding: 8, overflow: 'hidden' },
  photoCard: { backgroundColor: '#F7F3FF', borderWidth: 1, borderColor: '#EDE9FE' },
  body: { flex: 1, paddingHorizontal: 10, paddingTop: 14, paddingBottom: 8, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontFamily: 'Poppins_700Bold', fontSize: 20, letterSpacing: -0.3 },
  walkTitle: { fontSize: 22 },
  cardBody: { fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 21 },
  featuresRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, columnGap: 12 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: '45%', flexShrink: 1 },
  featureInline: { minWidth: 0 },
  featureIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  featureIconLight: { backgroundColor: '#EDE9FE' },
  featureIconDark: { backgroundColor: 'rgba(255,255,255,0.12)' },
  featureText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#4B3A6B', flexShrink: 1 },
  featureTextDark: { color: '#ecfdf5', fontSize: 11.5 },
  mediaBadge: {
    position: 'absolute', left: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(6,45,36,0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  mediaBadgeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#ecfdf5' },
  lockOverlay: { ...StyleSheet.absoluteFill, borderRadius: 22, backgroundColor: 'rgba(6,45,36,0.45)', alignItems: 'center', justifyContent: 'center' },
  lockCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF3C7', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  pendingTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: '#713f12' },
  pendingSub: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, color: '#92400e' },
  cta: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16 },
  ctaText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#ffffff' },
  section: { gap: 12 },
  sectionTitle: { fontFamily: 'Poppins_700Bold', fontSize: 18, color: '#0f172a', letterSpacing: -0.2 },
  howList: { gap: 10 },
  howListTablet: { flexDirection: 'row' },
  howItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  howItemTablet: { flex: 1, flexDirection: 'column', alignItems: 'flex-start', padding: 14 },
  howArt: { width: 60, alignItems: 'center' },
  howText: { flex: 1, gap: 1 },
  howTextTablet: { flex: 0 },
  howNum: { fontFamily: 'Poppins_700Bold', fontSize: 11, color: '#14b8a6', letterSpacing: 1 },
  howTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#0f172a' },
  howBody: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 17, color: '#52606D' },
  which: { flexDirection: 'row', gap: 10 },
  whichItem: { flex: 1, borderRadius: 18, padding: 12, gap: 6, borderWidth: 1 },
  whichIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  whichName: { fontFamily: 'Poppins_600SemiBold', fontSize: 13 },
  whichBody: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 17, color: '#334155' },
});
