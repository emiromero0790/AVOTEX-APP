/**
 * Mapa de Inicio (recuadro «Mapa» y su vista ampliada).
 *
 * Usa el mismo mapa que Mis escaneos (MapLibre con estilo vectorial propio, components/ScansMap), con la capa
 * «estándar» y solo el punto de la ubicación del usuario: sin escaneos, rutas ni simbología.
 * (Antes usaba Leaflet con mosaicos de CARTO, que ahora piden clave y mostraban «API Key Required».)
 */
import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { TranslationResource, useTranslations } from '../context/LanguageContext';
import ScansMap from './ScansMap';
import type { ScansMapData } from './scansMapHtml';

const translations: TranslationResource = {
  loading: { es: 'Cargando ubicación 🥑...', en: 'Loading location 🥑...' },
  unavailable: { es: 'Ubicación no disponible', en: 'Location unavailable' },
};

// Sin datos: solo la base del mapa y el punto del usuario.
const EMPTY: ScansMapData = {
  orchards: [], scans: [], routes: [], zones: [],
  focusOrchard: null, fitKey: 'inicio',
  show: { routes: false, photos: false, findings: false, orchards: false },
  reduced: false,
};
const PAD = { top: 12, right: 12, bottom: 12, left: 12 };
const noop = () => {};

type Props = {
  location: { coords?: { latitude?: number; longitude?: number } } | null | undefined;
  errorMsg: string | null;
  compact?: boolean;
};

export default function MapViewComponent({ location, errorMsg, compact = false }: Props) {
  const t = useTranslations(translations);
  const lat = location?.coords?.latitude;
  const lng = location?.coords?.longitude;
  const valid = typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng);
  // Se redondea (~1 m) para no volver a centrar el mapa con cada variación mínima de la ubicación.
  const user = useMemo(() => (valid ? { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 } : null), [valid, lat, lng]);

  if (!location?.coords) {
    return (
      <View style={[styles.loadingContainer, compact && styles.compactContainer]}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>{errorMsg ?? t('loading')}</Text>
      </View>
    );
  }
  if (!user) {
    return (
      <View style={[styles.loadingContainer, compact && styles.compactContainer]}>
        <Text style={styles.loadingText}>{t('unavailable')}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.mapContainer, compact && styles.compactContainer]}>
      <ScansMap
        data={EMPTY}
        selectedId={null}
        detail={null}
        point={null}
        user={user}
        layer="estandar"
        perspective={false}
        pad={PAD}
        centerOnUser
        onEvent={noop}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: { height: 200, marginHorizontal: 24, marginTop: -5, borderRadius: 24, overflow: 'hidden', elevation: 8, backgroundColor: '#e8eaed' },
  loadingContainer: {
    height: 200, marginHorizontal: 24, marginTop: -5, borderRadius: 24, backgroundColor: '#d1fae5',
    justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  loadingText: { marginTop: 10, color: '#166534', textAlign: 'center', fontSize: 13 },
  compactContainer: { width: '100%', height: '100%', marginHorizontal: 0, marginTop: 0, borderRadius: 0 },
});
