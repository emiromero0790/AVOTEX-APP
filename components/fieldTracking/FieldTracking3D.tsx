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
import { AppState, StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeIn, FadeOut, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { MapPinOff, Pause, SignalLow } from 'lucide-react-native';

import { useTranslations, type TranslationResource } from '../../context/LanguageContext';
import type { FieldMotion, GpsQuality } from '../../services/fieldMotion';
import { EASE_OUT } from '../scan/motion';
import FieldScene from './FieldScene';
import { FARMER, VIEW_H, VIEW_W } from './projection';
import { DOWNGRADE, initialQuality, type FieldQuality } from './quality';

const translations: TranslationResource = {
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
  /** Distancia real del recorrido, ya formateada (para lectores de pantalla). */
  distanceLabel: string;
  /** Tamaño del espacio que ocupa (dp). La escena lo llena recortando al centro, sin deformarse. */
  width: number;
  height: number;
  /** Altura del panel (0–1) donde queda el centro del agricultor. Por omisión, la escena se centra. */
  focus?: number;
};

/**
 * Siempre visible durante el recorrido: no se puede minimizar ni ocultar. El agricultor camina siempre
 * (velocidad base) y acelera con la velocidad real del usuario. Para cuidar la cámara y la captura, la calidad
 * puede bajar sola hasta «light», pero nunca se apaga por rendimiento.
 */
function FieldTracking3DImpl({ motion, paused, distanceLabel, width, height, focus }: Props) {
  const t = useTranslations(translations);
  const reduced = useReducedMotion();

  // Escena de VIEW_W × VIEW_H escalada para cubrir el espacio («cover»), centrada.
  const scale = Math.max(width / VIEW_W, height / VIEW_H);
  const offX = (width - VIEW_W * scale) / 2;
  // Con «focus» se desplaza la escena para dejar al agricultor a esa altura, sin dejar huecos (sigue cubriendo).
  const charCY = (FARMER.y + FARMER.frameH / 2) * scale;
  const minOffY = height - VIEW_H * scale;
  const offY = focus == null ? minOffY / 2 : Math.min(0, Math.max(minOffY, focus * height - charCY));

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
  // Solo si las imágenes no cargan o el render falla queda el panel sin escena (con el estado).
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
      style={[styles.panel, { width, height }]}
      pointerEvents="none"
      accessible
      accessibilityLabel={t('a11y', { d: distanceLabel })}
    >
      {quality && !failed && width > 0 && height > 0 && (
        <SceneBoundary onError={onFail}>
          <View style={{ position: 'absolute', left: offX, top: offY, width: VIEW_W, height: VIEW_H, transform: [{ scale }], transformOrigin: 'left top' }}>
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
      {status && (
        <Reanimated.View key={status} entering={CHIP_IN} exiting={CHIP_OUT} style={styles.chip}>
          {status === 'paused' ? <Pause size={10} color="#171a20" fill="#171a20" /> : status === 'gpsNone' ? <MapPinOff size={11} color="#e82127" /> : <SignalLow size={12} color="#b7791f" strokeWidth={2.6} />}
          <Text style={styles.chipText}>{t(status)}</Text>
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
  panel: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#e9ecef' },
  chip: {
    position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#ffffff',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#171a20' },
});

export default memo(FieldTracking3DImpl);
