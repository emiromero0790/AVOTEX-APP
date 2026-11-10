/**
 * AVOTEX Field Tracking 3D — panel flotante sobre la cámara del Recorrido inteligente.
 *
 * Es solo visualización: no toca la cámara, la captura automática, el GPS ni el almacenamiento.
 * Lee el estado de movimiento de FieldMotion (alimentado por el observador GPS que ya existe) y la distancia
 * real del recorrido (la de GpsTrack) que recibe como texto.
 *
 * Si algo falla dentro del visualizador (render, imágenes), la barrera de errores lo apaga y el recorrido
 * sigue igual.
 */
import React, { Component, memo, useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Reanimated, { FadeIn, FadeOut, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Footprints, MapPinOff, Minimize2, Pause, SignalLow, X } from 'lucide-react-native';

import { useTranslations, type TranslationResource } from '../../context/LanguageContext';
import type { FieldMotion, GpsQuality } from '../../services/fieldMotion';
import { EASE_OUT, PressableScale } from '../scan/motion';
import FieldScene from './FieldScene';
import { VIEW_H, VIEW_W } from './projection';
import { DOWNGRADE, initialQuality, type FieldQuality } from './quality';

export type FieldTrackingView = 'expanded' | 'minimized' | 'hidden';

const translations: TranslationResource = {
  title: { es: 'Recorrido', en: 'Walk' },
  paused: { es: 'Pausado', en: 'Paused' },
  gpsWeak: { es: 'GPS débil', en: 'Weak GPS' },
  gpsNone: { es: 'Sin ubicación', en: 'No location' },
  minimize: { es: 'Minimizar visualización 3D', en: 'Minimize 3D view' },
  hide: { es: 'Ocultar visualización 3D', en: 'Hide 3D view' },
  expand: { es: 'Mostrar visualización 3D del recorrido', en: 'Show 3D walk view' },
  a11y: { es: 'Visualización 3D del recorrido. Distancia {d}.', en: '3D walk view. Distance {d}.' },
};

const PANEL_IN = FadeIn.duration(260).easing(EASE_OUT);
const PANEL_OUT = FadeOut.duration(160);
const CHIP_IN = FadeIn.duration(180).easing(EASE_OUT);
const CHIP_OUT = FadeOut.duration(140);

type Props = {
  motion: FieldMotion | null;
  paused: boolean;
  /** Distancia real del recorrido, ya formateada (la misma que la tarjeta «Distancia»). */
  distanceLabel: string;
  view: FieldTrackingView;
  onViewChange: (v: FieldTrackingView) => void;
  /** Distancia desde el borde superior de la pantalla (debajo de las píldoras de GPS/red). */
  top: number;
};

function FieldTracking3DImpl({ motion, paused, distanceLabel, view, onViewChange, top }: Props) {
  const t = useTranslations(translations);
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();

  // Tamaño del panel: ~124 × 170 dp, adaptado a la pantalla (ancho 115–136 dp).
  const panelW = Math.round(Math.min(136, Math.max(112, width * 0.31)) * (height < 680 ? 0.9 : 1));
  const scale = panelW / VIEW_W;
  const panelH = Math.round(VIEW_H * scale);

  // Estado de movimiento → valores compartidos (se escriben ~1 vez por lectura GPS, no por fotograma).
  const targetSpeed = useSharedValue(0);
  const targetCurvature = useSharedValue(0);
  const [gps, setGps] = useState<GpsQuality>('none');
  useEffect(() => {
    if (!motion) return;
    return motion.subscribe(s => {
      targetSpeed.set(s.speed);
      targetCurvature.set(reduced ? 0 : s.curvature);
      setGps(prev => (prev === s.gps ? prev : s.gps));
    });
  }, [motion, reduced, targetSpeed, targetCurvature]);
  useEffect(() => { if (paused) targetSpeed.set(0); else if (motion) targetSpeed.set(motion.current.speed); }, [paused, motion, targetSpeed]);

  // Calidad: inicial según el equipo; baja sola si hay tirones o si una imagen falla.
  const [quality, setQuality] = useState<FieldQuality | null>(null);
  useEffect(() => {
    let alive = true;
    initialQuality().then(q => { if (alive) setQuality(q); }).catch(() => { if (alive) setQuality('reduced'); });
    return () => { alive = false; };
  }, []);
  const onJank = useCallback(() => setQuality(q => (q ? DOWNGRADE[q] : q)), []);
  const onAssetError = useCallback(() => setQuality('off'), []);
  const [crashed, setCrashed] = useState(false);

  // Segundo plano: la escena se detiene por completo.
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => setAppActive(st === 'active'));
    return () => sub.remove();
  }, []);

  const setView = useCallback((v: FieldTrackingView) => {
    Haptics.selectionAsync().catch(() => {});
    onViewChange(v);
  }, [onViewChange]);

  if (view === 'hidden') return null;

  const sceneOn = !crashed && quality != null && quality !== 'off';
  const status: 'paused' | 'gpsNone' | 'gpsWeak' | null = paused ? 'paused' : gps === 'none' ? 'gpsNone' : gps === 'weak' ? 'gpsWeak' : null;

  if (view === 'minimized' || !sceneOn) {
    // Botón compacto: distancia y estado, sin renderizador.
    return (
      <Reanimated.View entering={PANEL_IN} exiting={PANEL_OUT} style={[styles.miniWrap, { top }]} pointerEvents="box-none">
        <PressableScale
          style={styles.mini}
          onPress={() => (sceneOn ? setView('expanded') : undefined)}
          disabled={!sceneOn}
          accessibilityRole="button"
          accessibilityLabel={sceneOn ? t('expand') : t('a11y', { d: distanceLabel })}
        >
          <Footprints size={15} color="#5dffb6" />
          <Text style={styles.miniText} numberOfLines={1}>{distanceLabel}</Text>
          {status && <StatusDot status={status} />}
        </PressableScale>
      </Reanimated.View>
    );
  }

  return (
    <Reanimated.View
      entering={reduced ? FadeIn.duration(200) : PANEL_IN}
      exiting={PANEL_OUT}
      style={[styles.panel, { top, width: panelW, height: panelH }]}
      accessible
      accessibilityLabel={t('a11y', { d: distanceLabel })}
    >
      <SceneBoundary onError={() => setCrashed(true)}>
        <View style={{ width: VIEW_W, height: VIEW_H, transform: [{ scale }], transformOrigin: 'left top' }}>
          <FieldScene
            key={quality}
            targetSpeed={targetSpeed}
            targetCurvature={targetCurvature}
            running={appActive && !paused}
            quality={quality}
            onJank={onJank}
            onAssetError={onAssetError}
          />
        </View>
      </SceneBoundary>
      {/* Toque en la escena: minimizar. */}
      <PressableScale style={StyleSheet.absoluteFill} pressedScale={0.98} onPress={() => setView('minimized')} accessibilityRole="button" accessibilityLabel={t('minimize')}>
        <View style={styles.fill} />
      </PressableScale>
      <View style={styles.header} pointerEvents="none">
        <View style={styles.headBar} />
        <View>
          <Text style={styles.headLabel}>{t('title')}</Text>
          <Text style={styles.headValue} numberOfLines={1} adjustsFontSizeToFit>{distanceLabel}</Text>
        </View>
      </View>
      <View style={styles.tools}>
        <PressableScale style={styles.tool} onPress={() => setView('minimized')} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('minimize')}>
          <Minimize2 size={10} color="#d1fae5" />
        </PressableScale>
        <PressableScale style={styles.tool} onPress={() => setView('hidden')} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('hide')}>
          <X size={11} color="#d1fae5" />
        </PressableScale>
      </View>
      {status && (
        <Reanimated.View key={status} entering={CHIP_IN} exiting={CHIP_OUT} style={[styles.chip, status === 'paused' ? styles.chipPaused : status === 'gpsNone' ? styles.chipNone : styles.chipWeak]} pointerEvents="none">
          {status === 'paused' ? <Pause size={10} color="#0f172a" fill="#0f172a" /> : status === 'gpsNone' ? <MapPinOff size={10} color="#fff" /> : <SignalLow size={12} color="#0f172a" strokeWidth={2.6} />}
          <Text style={[styles.chipText, status === 'gpsNone' && { color: '#fff' }]}>{t(status)}</Text>
        </Reanimated.View>
      )}
    </Reanimated.View>
  );
}

function StatusDot({ status }: { status: 'paused' | 'gpsNone' | 'gpsWeak' }) {
  const color = status === 'paused' ? '#facc15' : status === 'gpsNone' ? '#f87171' : '#fbbf24';
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

/** Barrera de errores: un fallo del visualizador nunca llega al recorrido. */
class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) {
    console.warn('[fieldTracking] visualizador desactivado por un error', e);
    this.props.onError();
  }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Barrera exterior (también cubre hooks del panel). */
export class FieldTrackingGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn('[fieldTracking] panel desactivado por un error', e); }
  render() { return this.state.failed ? null : this.props.children; }
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    right: 12,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#07150f',
    borderWidth: 1.5,
    borderColor: 'rgba(94,234,212,0.55)',
  },
  fill: { flex: 1 },
  header: { position: 'absolute', left: 12, top: 10, right: 56, flexDirection: 'row', alignItems: 'center', gap: 6 },
  headBar: { width: 3, height: 26, borderRadius: 2, backgroundColor: '#3dffa8' },
  headLabel: { fontFamily: 'Poppins_400Regular', fontSize: 9.5, color: 'rgba(236,253,245,0.85)', lineHeight: 12 },
  headValue: { fontFamily: 'Poppins_700Bold', fontSize: 17, color: '#ecfdf5', lineHeight: 21 },
  tools: { position: 'absolute', right: 8, top: 9, flexDirection: 'row', gap: 4 },
  tool: {
    width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(4,16,13,0.6)', borderWidth: 1, borderColor: 'rgba(94,234,212,0.35)',
  },
  chip: {
    position: 'absolute', bottom: 9, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  chipPaused: { backgroundColor: '#facc15' },
  chipWeak: { backgroundColor: '#fbbf24' },
  chipNone: { backgroundColor: 'rgba(220,38,38,0.92)' },
  chipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 9.5, color: '#0f172a', lineHeight: 13 },
  miniWrap: { position: 'absolute', right: 12 },
  mini: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 12, borderRadius: 20,
    backgroundColor: 'rgba(7,21,15,0.82)', borderWidth: 1.5, borderColor: 'rgba(94,234,212,0.55)',
  },
  miniText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: '#ecfdf5' },
  dot: { width: 7, height: 7, borderRadius: 4 },
});

export default memo(FieldTracking3DImpl);
