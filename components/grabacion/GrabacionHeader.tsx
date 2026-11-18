/**
 * Encabezado del flujo «Subir grabación» → «Ubica tus fotos» (y «Revisa tus fotos»).
 *
 * Dos piezas para que el video no se reinicie entre pasos:
 * - <HeaderVideoBackdrop>: el video de fondo. Se monta UNA vez en la raíz de la pantalla (mismo lugar del árbol en todos
 *   los pasos), así el reproductor y la vista no se recrean al avanzar y el fondo no parpadea.
 * - <GrabacionHeader>: título, flecha, logo, paso y subtítulo, transparentes, encima del video. Mide su alto y se lo
 *   pasa al fondo con onHeight.
 *
 * El video arranca desde el inicio al enfocar la pantalla, se repite, va sin audio y sin controles, y se pausa al salir
 * del flujo o al mandar la app a segundo plano. Con «Reducir movimiento» se queda el primer fotograma fijo.
 */
import React, { useEffect, useState } from 'react';
import { AppState, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';
import { ArrowLeft } from 'lucide-react-native';
import { PressableScale } from '../scan/motion';

const VIDEO = require('../../assets/images/grabacion/avotex-header-carga.mp4');
/** Primer fotograma del mismo video: respaldo mientras carga y fondo fijo con «Reducir movimiento». */
/** El mismo logotipo del encabezado de Escanear. */
const WORDMARK = require('../../assets/images/escanear/avotex-wordmark.png');
const POSTER = require('../../assets/images/grabacion/avotex-header-carga-poster.jpg');
/** Proporción del video (2160×960). */
const RATIO = 2160 / 960;
/** Color del lado izquierdo del video: rellena lo que quede a la izquierda en pantallas anchas. */
export const HEADER_VIDEO_BG = '#01251B';
/** El teléfono empieza en ~64 % del ancho del video y la nube termina en ~96 %: se corre el video a la derecha lo que sobra. */
const PHONE_START = 0.64;
const RIGHT_SPARE = 0.03;

/** Caja del video: alto del encabezado, ancho por proporción, anclada a la derecha (teléfono y nube siempre visibles). */
function videoBox(headerH: number) {
  const w = headerH * RATIO;
  return { width: w, height: headerH, right: -w * RIGHT_SPARE };
}

/** Desde qué x empieza el teléfono en la pantalla; el texto se queda a su izquierda. */
export function phoneLeft(screenW: number, headerH: number) {
  const b = videoBox(headerH);
  return screenW - b.width - b.right + b.width * PHONE_START;
}

export function HeaderVideoBackdrop({ height }: { height: number }) {
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [firstFrame, setFirstFrame] = useState(false);
  const player = useVideoPlayer(VIDEO, p => { p.loop = true; p.muted = true; p.volume = 0; });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  // El fotograma de respaldo se ve hasta que el video tiene imagen (o si falla la carga: status 'error').
  const ready = firstFrame || status === 'readyToPlay';

  useEffect(() => {
    const sub = AppState.addEventListener('change', st => setActive(st === 'active'));
    return () => sub.remove();
  }, []);

  // Al entrar al flujo: desde el inicio. Al salir (otra pestaña/pantalla) se pausa.
  useEffect(() => {
    if (reduced) { player.pause(); return; }
    if (focused) player.replay(); // desde el inicio y reproduce
    else player.pause();
  }, [focused, reduced, player]);

  // Segundo plano: pausa; al volver, sigue donde iba.
  useEffect(() => {
    if (reduced || !focused) return;
    if (active) player.play(); else player.pause();
  }, [active, focused, reduced, player]);

  const h = Math.max(height, 1);
  const box = videoBox(h);
  return (
    <View pointerEvents="none" style={[st.backdrop, { height: h }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={POSTER} resizeMode="cover" style={[st.media, box]} accessibilityIgnoresInvertColors />
      {!reduced && (
        <VideoView
          player={player}
          nativeControls={false}
          contentFit="cover"
          allowsPictureInPicture={false}
          fullscreenOptions={{ enable: false }}
          playsInline
          surfaceType="textureView"
          useExoShutter={false}
          onFirstFrameRender={() => setFirstFrame(true)}
          style={[st.media, box, { opacity: ready ? 1 : 0 }]}
        />
      )}
      {/* Sombra a la izquierda para que el texto blanco se lea sobre cualquier fotograma. */}
      <LinearGradient
        colors={['rgba(1,30,22,0.78)', 'rgba(1,30,22,0.42)', 'rgba(1,30,22,0)']}
        locations={[0, 0.42, 0.7]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

type HeaderProps = {
  topInset: number;
  stepLabel: string | null;
  title: string;
  subtitle: string;
  brand: string;
  backLabel: string;
  onBack: () => void;
  /** Alto medido del encabezado, para dimensionar el video de fondo. */
  height: number;
  onHeight: (h: number) => void;
};

export default function GrabacionHeader({ topInset, stepLabel, title, subtitle, brand, backLabel, onBack, height, onHeight }: HeaderProps) {
  const { width } = useWindowDimensions();
  // El texto no se mete bajo el teléfono: el ancho disponible acaba donde empieza.
  const textW = height ? Math.max(150, Math.min(width - 40, phoneLeft(width, height) - 28)) : undefined;
  // En pantallas angostas el título baja de tamaño para que una palabra como «grabación» quepa completa junto al teléfono.
  const fs = textW ? Math.max(24, Math.min(31, textW / 5.3)) : 31;
  return (
    <View style={[st.header, { paddingTop: topInset + 8 }]} onLayout={e => onHeight(Math.round(e.nativeEvent.layout.height))}>
      <View style={st.brandRow}>
        <PressableScale onPress={onBack} accessibilityRole="button" accessibilityLabel={backLabel} hitSlop={8} style={st.backBtn}>
          <ArrowLeft size={20} color="#FFFFFF" />
        </PressableScale>
        <Image source={WORDMARK} style={st.logo} resizeMode="contain" accessibilityRole="image" accessibilityLabel={brand} />
      </View>
      {stepLabel ? <View style={st.stepPill}><Text style={st.stepText}>{stepLabel}</Text></View> : null}
      <View style={{ width: textW }}>
        <Text style={[st.title, { fontSize: fs, lineHeight: Math.round(fs * 1.17) }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.15} accessibilityRole="header">{title}</Text>
        <Text style={st.sub} numberOfLines={2}>{subtitle}</Text>
      </View>
    </View>
  );
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 1 } };

const st = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', backgroundColor: HEADER_VIDEO_BG },
  media: { position: 'absolute', top: 0 },
  header: { paddingHorizontal: 20, paddingBottom: 40, backgroundColor: 'transparent' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', marginRight: 2 },
  // Mismo tamaño que en Escanear (ScanHeader).
  logo: { width: 124, height: 124 * 139 / 600 },
  stepPill: { alignSelf: 'flex-start', backgroundColor: '#BEF264', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4, marginBottom: 8 },
  stepText: { fontFamily: 'Poppins_700Bold', fontSize: 13, color: '#14231A' },
  // Misma fuente y peso que los títulos sobre imagen de Inicio y Escanear: Poppins Bold cursiva.
  title: { fontFamily: 'Poppins_700Bold', fontStyle: 'italic', fontSize: 31, lineHeight: 36, letterSpacing: -0.8, color: '#FFFFFF', ...shadow },
  sub: { fontFamily: 'Poppins_400Regular', fontSize: 14.5, color: 'rgba(255,255,255,0.86)', marginTop: 2, ...shadow },
});
