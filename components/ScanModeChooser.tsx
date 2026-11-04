import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { ArrowRight, Camera, CloudUpload, Coins, Lock, ScanLine, Sparkles, WifiOff, Wifi, Zap } from 'lucide-react-native';
import { TranslationResource, useTranslations } from '../context/LanguageContext';
import { AiAnalyzeIllustration, ChestMountIllustration, WalkPathIllustration } from './scan/ScanIllustrations';
import { PressableScale, PulseRing } from './scan/motion';

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
  photoIdeal: { es: 'Para revisar un fruto o árbol en particular.', en: 'To check one particular fruit or tree.' },
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
  walkIdeal: { es: 'Ideal para revisar muchos árboles', en: 'Best for checking many trees' },
  walkChip1: { es: 'Sin internet', en: 'Offline' },
  walkChip2: { es: 'Selección automática', en: 'Auto selection' },
  walkChip3: { es: 'Análisis con IA', en: 'AI analysis' },
  pendingHint: { es: 'Se suben al abrir el recorrido con conexión.', en: 'They upload when you open the walk online.' },
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

/** Agricultor recorriendo su huerta: ruta con puntos de captura y un pulso sobre el teléfono al pecho. */
function WalkVisual({ height, locked }: { height: number; locked: boolean }) {
  return (
    <View style={[v.media, { height }]}>
      <Image source={IMG_ORCHARD_WALK} style={v.mediaImg} resizeMode="cover" accessibilityIgnoresInvertColors />
      <LinearGradient
        colors={['rgba(4,47,46,0.35)', 'rgba(15,118,110,0.05)', 'rgba(4,47,46,0.55)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Ruta y puntos de captura sobre el surco */}
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 320 187" preserveAspectRatio="xMidYMid slice">
        <Path d="M120 187 C 140 168, 150 158, 160 146 S 172 128, 168 118" stroke="#ffffff" strokeOpacity={0.95} strokeWidth={3.2} strokeLinecap="round" strokeDasharray="1.5 8" fill="none" />
        {[[126, 182], [146, 160], [162, 140]].map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={4.4} fill="#34d399" stroke="#ffffff" strokeWidth={1.8} />
        ))}
      </Svg>
      {/* Única animación continua de la pantalla: indica que la cámara del pecho captura sola. */}
      {!locked && (
        <View pointerEvents="none" style={v.pulseAnchor}>
          <PulseRing size={34} color="#ffffff" />
          <View style={v.pulseDot}><Camera size={11} color={GREEN} /></View>
        </View>
      )}
      <View style={v.inset}>
        <ChestMountIllustration size={58} />
      </View>
    </View>
  );
}

/** Miniatura del modo manual: aguacate en el árbol con el encuadre de la cámara. */
function PhotoThumb({ size }: { size: number }) {
  return (
    <View style={[v.thumb, { width: size, height: size }]}>
      <Image source={IMG_AVOCADO_TREE} style={v.mediaImg} resizeMode="cover" accessibilityIgnoresInvertColors />
      <LinearGradient colors={['rgba(46,26,87,0)', 'rgba(46,26,87,0.45)']} style={StyleSheet.absoluteFill} />
      <View style={v.reticle}>
        <View style={[v.rc, v.rcTL]} /><View style={[v.rc, v.rcTR]} />
        <View style={[v.rc, v.rcBL]} /><View style={[v.rc, v.rcBR]} />
      </View>
      <View style={v.thumbShutter}><Camera size={14} color={PURPLE} /></View>
    </View>
  );
}

function Chip({ icon, label, dark }: { icon: React.ReactNode; label: string; dark?: boolean }) {
  return (
    <View style={[s.chip, dark ? s.chipDark : s.chipLight]}>
      {icon}
      <Text style={[s.chipText, dark ? s.chipTextDark : s.chipTextLight]} numberOfLines={1}>{label}</Text>
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
    { n: '01', title: t('how1Title'), body: t('how1Body'), art: <ChestMountIllustration size={isTablet ? 72 : 54} /> },
    { n: '02', title: t('how2Title'), body: t('how2Body'), art: <WalkPathIllustration size={isTablet ? 72 : 54} /> },
    { n: '03', title: t('how3Title'), body: t('how3Body'), art: <AiAnalyzeIllustration size={isTablet ? 72 : 54} /> },
  ];

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.content, isTablet && s.contentTablet, { paddingTop: insets.top + (isTablet ? 36 : 20) }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Encabezado: sin animación de entrada, es una pestaña que se visita muchas veces al día. */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <Text style={[s.title, isTablet && s.titleTablet]}>{t('title')}</Text>
          {tokensValue ? (
            <View style={s.tokens} accessibilityLabel={`${tokensValue} ${t('tokens')}`}>
              <Coins size={14} color="#b45309" />
              <Text style={s.tokensValue}>{tokensValue}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[s.subtitle, isTablet && s.subtitleTablet]}>{t('subtitle')}</Text>
      </View>

      <View style={[s.cards, isTablet && s.cardsTablet]}>
        {/* ── Recorrido inteligente: modo principal, verde ── */}
        <PressableScale
          onPress={isGuest ? undefined : onWalk}
          disabled={isGuest}
          accessibilityRole="button"
          accessibilityState={{ disabled: isGuest }}
          accessibilityLabel={`${t('walkTitle')}. ${isGuest ? t('walkLocked') : t('walkBody')}`}
          style={[s.walkShadow, isTablet && s.colWalk]}
        >
          <LinearGradient colors={['#0f766e', '#115e59', '#134e4a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.walkCard}>
            <View>
              <WalkVisual height={isTablet ? 270 : 220} locked={isGuest} />
              <View style={s.mediaBadge}>
                <ScanLine size={13} color="#a7f3d0" />
                <Text style={s.mediaBadgeText}>{t('walkBadge')}</Text>
              </View>
              {isGuest && (
                <View style={s.lockOverlay}><View style={s.lockCircle}><Lock size={22} color={GREEN} /></View></View>
              )}
            </View>
            <View style={s.walkBody}>
              <View>
                <Text style={s.walkIdeal}>{t('walkIdeal')}</Text>
                <Text style={s.walkTitle}>{t('walkTitle')}</Text>
              </View>
              <Text style={s.walkText}>{t('walkBody')}</Text>
              <View style={s.chips}>
                <Chip dark icon={<WifiOff size={12} color="#a7f3d0" />} label={t('walkChip1')} />
                <Chip dark icon={<ScanLine size={12} color="#a7f3d0" />} label={t('walkChip2')} />
                <Chip dark icon={<Sparkles size={12} color="#a7f3d0" />} label={t('walkChip3')} />
              </View>
              {pendingWalks > 0 && !isGuest && (
                <View style={s.pending}>
                  <View style={s.pendingIcon}><CloudUpload size={16} color="#713f12" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pendingTitle}>{pendingWalks === 1 ? t('pendingOne') : t('pendingMany', { count: pendingWalks })}</Text>
                    <Text style={s.pendingSub}>
                      {pendingPhotos > 0 ? `${t('pendingPhotos', { count: pendingPhotos.toLocaleString() })} · ` : ''}{t('pendingHint')}
                    </Text>
                  </View>
                </View>
              )}
              <View style={[s.cta, isGuest ? s.ctaLocked : s.ctaWalk]}>
                <Text style={[s.ctaText, { color: isGuest ? '#d1fae5' : GREEN }]}>{isGuest ? t('walkLocked') : t('walkCta')}</Text>
                {!isGuest && <ArrowRight size={18} color={GREEN} />}
              </View>
            </View>
          </LinearGradient>
        </PressableScale>

        {/* ── Foto individual: modo manual, morado, compacto ── */}
        <PressableScale
          onPress={onPhoto}
          accessibilityRole="button"
          accessibilityLabel={`${t('photoTitle')}. ${t('photoBody')}`}
          style={[s.photoShadow, isTablet && s.colPhoto]}
        >
          <View style={[s.photoCard, isTablet && s.photoCardTablet]}>
            <PhotoThumb size={isTablet ? 180 : 108} />
            <View style={s.photoBody}>
              <View style={s.titleRow}>
                <View style={s.titleIcon}><Camera size={16} color={PURPLE} /></View>
                <Text style={s.photoTitle}>{t('photoTitle')}</Text>
              </View>
              <Text style={s.photoText}>{t('photoIdeal')}</Text>
              <View style={s.chips}>
                <Chip icon={<Zap size={12} color={PURPLE_SOFT} />} label={t('photoFeat1')} />
                <Chip icon={<Wifi size={12} color={PURPLE_SOFT} />} label={t('photoFeat2')} />
              </View>
              <View style={s.photoCta}>
                <Text style={s.photoCtaText}>{t('photoCta')}</Text>
                <ArrowRight size={16} color="#ffffff" />
              </View>
            </View>
          </View>
        </PressableScale>
      </View>

      {/* ── ¿Cómo funciona el recorrido? ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>{t('howTitle')}</Text>
        <View style={[s.howList, isTablet && s.howListTablet]}>
          {how.map((step, i) => (
            <View key={step.n} style={[s.howItem, isTablet && s.howItemTablet]}>
              <View style={s.howArt}>{step.art}</View>
              <View style={[s.howText, isTablet && s.howTextTablet]}>
                <Text style={s.howNum}>{step.n}</Text>
                <Text style={s.howTitle}>{step.title}</Text>
                <Text style={s.howBody}>{step.body}</Text>
              </View>
              {!isTablet && i < how.length - 1 && <View style={s.howLine} />}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// ───────────────────────── estilos ─────────────────────────

const v = StyleSheet.create({
  media: { overflow: 'hidden', borderRadius: 22, backgroundColor: '#1f2937' },
  // Ancho/alto explícitos: absoluteFill en <Image> amplía la foto en web.
  mediaImg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  // Sobre el pecho del agricultor de la foto: ahí va el teléfono que captura.
  pulseAnchor: { position: 'absolute', left: '53.2%', top: '43%', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  pulseDot: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  inset: {
    position: 'absolute', right: 12, top: 12, width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  thumb: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#2E1A57' },
  reticle: { position: 'absolute', top: '20%', left: '20%', right: '20%', bottom: '28%' },
  rc: { position: 'absolute', width: 12, height: 12, borderColor: '#ffffff' },
  rcTL: { top: 0, left: 0, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderTopLeftRadius: 4 },
  rcTR: { top: 0, right: 0, borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopRightRadius: 4 },
  rcBL: { bottom: 0, left: 0, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderBottomLeftRadius: 4 },
  rcBR: { bottom: 0, right: 0, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomRightRadius: 4 },
  thumbShutter: { position: 'absolute', bottom: 8, alignSelf: 'center', width: 26, height: 26, borderRadius: 13, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 16, paddingBottom: 140, gap: 20 },
  contentTablet: { maxWidth: 1080, width: '100%', alignSelf: 'center', paddingHorizontal: 32 },
  header: { gap: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 34, lineHeight: 40, letterSpacing: -1.1, color: '#0A0A0A' },
  titleTablet: { fontSize: 46, lineHeight: 52 },
  subtitle: { fontFamily: 'Poppins_400Regular', fontSize: 15, color: '#52606D' },
  subtitleTablet: { fontSize: 18 },
  tokens: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
  },
  tokensValue: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: '#78350F' },
  cards: { gap: 14 },
  cardsTablet: { flexDirection: 'row', alignItems: 'stretch' },
  colWalk: { flex: 1.35 },
  colPhoto: { flex: 1 },
  // Recorrido
  walkShadow: { borderRadius: 28, shadowColor: '#0f766e', shadowOpacity: 0.24, shadowOffset: { width: 0, height: 14 }, shadowRadius: 24, elevation: 6 },
  walkCard: { flex: 1, borderRadius: 28, padding: 8, overflow: 'hidden' },
  mediaBadge: {
    position: 'absolute', left: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(6,45,36,0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  mediaBadgeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#ecfdf5' },
  walkIdeal: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#a7f3d0', letterSpacing: 0.2 },
  walkTitle: { fontFamily: 'Poppins_700Bold', fontSize: 26, lineHeight: 32, letterSpacing: -0.6, color: '#ffffff' },
  walkBody: { flex: 1, paddingHorizontal: 10, paddingTop: 14, paddingBottom: 8, gap: 12 },
  walkText: { fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 21, color: 'rgba(236,253,245,0.92)' },
  lockOverlay: { ...StyleSheet.absoluteFill, borderRadius: 22, backgroundColor: 'rgba(6,45,36,0.45)', alignItems: 'center', justifyContent: 'center' },
  lockCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF3C7', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 9 },
  pendingIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center' },
  pendingTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 12.5, color: '#713f12' },
  pendingSub: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, lineHeight: 16, color: '#92400e' },
  cta: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 18 },
  ctaWalk: { backgroundColor: '#ffffff' },
  ctaLocked: { backgroundColor: 'rgba(255,255,255,0.16)' },
  ctaText: { fontFamily: 'Poppins_700Bold', fontSize: 15.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  chipDark: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  chipLight: { backgroundColor: '#EDE9FE' },
  chipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11.5 },
  chipTextDark: { color: '#ecfdf5' },
  chipTextLight: { color: '#4B3A6B' },
  // Foto individual
  photoShadow: { borderRadius: 24, shadowColor: '#6D28D9', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 10 }, shadowRadius: 18, elevation: 4 },
  photoCard: { flex: 1, flexDirection: 'row', gap: 12, padding: 8, borderRadius: 24, backgroundColor: '#F7F3FF', borderWidth: 1, borderColor: '#EDE9FE' },
  photoCardTablet: { flexDirection: 'column' },
  photoBody: { flex: 1, gap: 7, paddingVertical: 4, paddingRight: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' },
  photoTitle: { flex: 1, fontFamily: 'Poppins_700Bold', fontSize: 17, color: '#2E1A57', letterSpacing: -0.2 },
  photoText: { fontFamily: 'Poppins_400Regular', fontSize: 12.5, lineHeight: 18, color: '#4B3A6B' },
  photoCta: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'stretch', paddingVertical: 10, borderRadius: 14, backgroundColor: PURPLE },
  photoCtaText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#ffffff' },
  // ¿Cómo funciona?
  section: { gap: 12 },
  sectionTitle: { fontFamily: 'Poppins_700Bold', fontSize: 18, color: '#0f172a', letterSpacing: -0.2 },
  howList: { gap: 0 },
  howListTablet: { flexDirection: 'row', gap: 12 },
  howItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  howItemTablet: { flex: 1, flexDirection: 'column', alignItems: 'flex-start', padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0' },
  howArt: { width: 54, alignItems: 'center' },
  howLine: { position: 'absolute', left: 26, bottom: -8, width: 2, height: 16, borderRadius: 1, backgroundColor: '#ccfbf1' },
  howText: { flex: 1, gap: 1 },
  howTextTablet: { flex: 0 },
  howNum: { fontFamily: 'Poppins_700Bold', fontSize: 11, color: '#14b8a6', letterSpacing: 1 },
  howTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#0f172a' },
  howBody: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 17, color: '#52606D' },
});
