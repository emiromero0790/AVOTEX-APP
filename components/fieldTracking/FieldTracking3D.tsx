/**
 * AVOTEX Field Tracking 3D — panel flotante sobre la cámara del Recorrido inteligente.
 *
 * Es solo visualización: no toca la cámara, la captura automática, el GPS ni el almacenamiento.
 * Lee el estado de movimiento de FieldMotion (alimentado por el observador GPS que ya existe) y la distancia
 * real del recorrido (la de GpsTrack) que recibe como texto.
 *
 * Siempre visible (no se minimiza ni se oculta). Si algo falla dentro del visualizador (render, imágenes),
 * la barrera de errores deja el panel con la distancia y el estado, y el recorrido sigue igual.
 */
import React, { Component, memo, useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Reanimated, { FadeIn, FadeOut, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { MapPinOff, Pause, SignalLow } from 'lucide-react-native';

import { useTranslations, type TranslationResource } from '../../context/LanguageContext';
import type { FieldMotion, GpsQuality } from '../../services/fieldMotion';
import { EASE_OUT } from '../scan/motion';
import FieldScene from './FieldScene';
import { VIEW_H, VIEW_W } from './projection';
import { DOWNGRADE, initialQuality, type FieldQuality } from './quality';

const translations: TranslationResource = {
  title: { es: 'Recorrido', en: 'Walk' },
  paused: { es: 'Pausado', en: 'Paused' },
  gpsWeak: { es: 'GPS débil', en: 'Weak GPS' },
  gpsNone: { es: 'Sin ubicación', en: 'No location' },
  a11y: { es: 'Visualización 3D del recorrido. Distancia {d}.', en: '3D walk view. Distance {d}.' },
};

const PANEL_IN = FadeIn.duration(260).easing(EASE_OUT);
const CHIP_IN = FadeIn.duration(180).easing(EASE_OUT);
const CHIP_OUT = FadeOut.duration(140);

type Props = {
  motion: FieldMotion | null;
  paused: boolean;
  /** Distancia real del recorrido, ya formateada (la misma que la tarjeta «Distancia»). */
  distanceLabel: string;
  /** Distancia desde el borde superior de la pantalla (debajo de las píldoras de GPS/red). */
  top: number;
};

/**
 * Siempre visible durante el recorrido: no se puede minimizar ni ocultar. Para cuidar la cámara y la
 * captura, la calidad puede bajar sola hasta «light», pero nunca se apaga por rendimiento.
 */
function FieldTracking3DImpl({ motion, paused, distanceLabel, top }: Props) {
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

  // Calidad: inicial según el equipo; con tirones baja de nivel, pero nunca por debajo de «light».
  const [quality, setQuality] = useState<Exclude<FieldQuality, 'off'> | null>(null);
  useEffect(() => {
    let alive = true;
    const set = (q: FieldQuality) => { if (alive) setQuality(q === 'off' ? 'light' : q); };
    initialQuality().then(set).catch(() => set('reduced'));
    return () => { alive = false; };
  }, []);
  const onJank = useCallback(() => setQuality(q => {
    if (!q) return q;
    const next = DOWNGRADE[q];
    return next === 'off' ? 'light' : next;
  }), []);
  // Solo si las imágenes no cargan o el render falla queda el panel sin escena (con distancia y estado).
  const [failed, setFailed] = useState(false);
  const onFail = useCallback(() => setFailed(true), []);

  // Segundo plano: la escena se detiene por completo y se reanuda al volver.
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => setAppActive(st === 'active'));
    return () => sub.remove();
  }, []);

  const status: 'paused' | 'gpsNone' | 'gpsWeak' | null = paused ? 'paused' : gps === 'none' ? 'gpsNone' : gps === 'weak' ? 'gpsWeak' : null;

  return (
    <Reanimated.View
      entering={reduced ? FadeIn.duration(200) : PANEL_IN}
      style={[styles.panel, { top, width: panelW, height: panelH }]}
      pointerEvents="none"
      accessible
      accessibilityLabel={t('a11y', { d: distanceLabel })}
    >
      {quality && !failed && (
        <SceneBoundary onError={onFail}>
          <View style={{ width: VIEW_W, height: VIEW_H, transform: [{ scale }], transformOrigin: 'left top' }}>
            <FieldScene
              key={quality}
              targetSpeed={targetSpeed}
              targetCurvature={targetCurvature}
              running={appActive && !paused}
              quality={quality}
              onJank={onJank}
              onAssetError={onFail}
            />
          </View>
        </SceneBoundary>
      )}
      <View style={styles.header}>
        <View style={styles.headBar} />
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.headLabel}>{t('title')}</Text>
          <Text style={styles.headValue} numberOfLines={1} adjustsFontSizeToFit>{distanceLabel}</Text>
        </View>
      </View>
      {status && (
        <Reanimated.View key={status} entering={CHIP_IN} exiting={CHIP_OUT} style={[styles.chip, status === 'paused' ? styles.chipPaused : status === 'gpsNone' ? styles.chipNone : styles.chipWeak]}>
          {status === 'paused' ? <Pause size={10} color="#0f172a" fill="#0f172a" /> : status === 'gpsNone' ? <MapPinOff size={10} color="#fff" /> : <SignalLow size={12} color="#0f172a" strokeWidth={2.6} />}
          <Text style={[styles.chipText, status === 'gpsNone' && { color: '#fff' }]}>{t(status)}</Text>
        </Reanimated.View>
      )}
    </Reanimated.View>
  );
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
  header: { position: 'absolute', left: 12, top: 10, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  headBar: { width: 3, height: 26, borderRadius: 2, backgroundColor: '#3dffa8' },
  headLabel: { fontFamily: 'Poppins_400Regular', fontSize: 9.5, color: 'rgba(236,253,245,0.85)', lineHeight: 12 },
  headValue: { fontFamily: 'Poppins_700Bold', fontSize: 17, color: '#ecfdf5', lineHeight: 21 },
  chip: {
    position: 'absolute', bottom: 9, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  chipPaused: { backgroundColor: '#facc15' },
  chipWeak: { backgroundColor: '#fbbf24' },
  chipNone: { backgroundColor: 'rgba(220,38,38,0.92)' },
  chipText: { fontFamily: 'Poppins_600SemiBold', fontSize: 9.5, color: '#0f172a', lineHeight: 13 },
});

export default memo(FieldTracking3DImpl);
