import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Eraser, Pencil, Save } from 'lucide-react-native';
import PolygonMap, { PolygonMapHandle } from '../../components/PolygonMap';

type PolygonPoint = {
  latitude: number;
  longitude: number;
};

const SAVED_POLYGON_KEY = 'avotex_huerta_polygon';

export default function Mapping() {
  const mapRef = useRef<PolygonMapHandle>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [notice, setNotice] = useState<string | null>('Obteniendo tu ubicación precisa…');
  const [polygon, setPolygon] = useState<PolygonPoint[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const requestLocation = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        if (permission.status !== 'granted') {
          setNotice('Activa el permiso de ubicación para mostrar tu posición en el mapa.');
          return;
        }
        setNotice('Obteniendo tu ubicación precisa…');
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
        if (active) {
          setLocation(current);
          const accuracy = current.coords.accuracy;
          setNotice(
            typeof accuracy === 'number'
              ? `Ubicación lista · precisión aproximada de ${Math.round(accuracy)} m.`
              : 'Ubicación precisa lista.',
          );
        }
      } catch {
        if (active) setNotice('No pudimos obtener tu ubicación. Revisa que el GPS esté activo e inténtalo de nuevo.');
      }
    };

    requestLocation();
    return () => {
      active = false;
    };
  }, []);

  const savePolygon = async () => {
    if (polygon.length < 3 || saving) return;

    setSaving(true);
    try {
      await AsyncStorage.setItem(SAVED_POLYGON_KEY, JSON.stringify(polygon));
      setNotice(`Delimitación guardada correctamente (${polygon.length} puntos).`);
    } catch {
      setNotice('No pudimos guardar la delimitación. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.mapLayer}>
        {location ? (
          <PolygonMap
            ref={mapRef}
            location={location}
            onPolygonChange={(points: PolygonPoint[]) => {
              setPolygon(points);
              setNotice(points.length >= 3 ? 'Delimitación lista para guardar.' : 'Toca cada esquina de tu huerta.');
            }}
          />
        ) : (
          <View style={styles.locationLoading}>
            <View style={styles.locationLoadingIcon}>
              <ActivityIndicator size="large" color="#0D756B" />
            </View>
            <Text style={styles.locationLoadingTitle}>Buscando tu ubicación</Text>
            <Text style={styles.locationLoadingText}>Esperaremos una lectura precisa antes de mostrar el mapa.</Text>
          </View>
        )}
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.panelCopy}>
          <View>
            <Text style={styles.eyebrow}>DELIMITACIÓN</Text>
            <Text style={styles.title}>Delimita tu huerta</Text>
          </View>
          <View style={[styles.pointBadge, polygon.length >= 3 && styles.pointBadgeReady]}>
            <Text style={[styles.pointBadgeText, polygon.length >= 3 && styles.pointBadgeTextReady]}>
              {polygon.length} pts
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Toca los puntos del mapa para marcar el contorno de tu terreno.</Text>
        {notice ? <Text style={styles.notice} numberOfLines={2}>{notice}</Text> : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dibujar delimitación"
            accessibilityState={{ disabled: !location }}
            disabled={!location}
            onPress={() => {
              mapRef.current?.startDrawing();
              setNotice('Toca cada esquina de tu huerta y cierra la figura en el primer punto.');
            }}
            style={({ pressed }) => [
              styles.actionButton,
              !location && styles.actionButtonDisabled,
              pressed && styles.actionPressed,
            ]}
          >
            <Pencil size={20} color="#176B62" />
            <Text style={styles.actionLabel}>Dibujar</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Borrar delimitación"
            accessibilityState={{ disabled: !location || polygon.length === 0 }}
            disabled={!location || polygon.length === 0}
            onPress={() => {
              mapRef.current?.clearDrawing();
              setPolygon([]);
              setNotice('Delimitación borrada. Puedes comenzar de nuevo.');
            }}
            style={({ pressed }) => [
              styles.actionButton,
              (!location || polygon.length === 0) && styles.actionButtonDisabled,
              pressed && styles.actionPressed,
            ]}
          >
            <Eraser size={20} color="#D1534A" />
            <Text style={styles.actionLabel}>Borrar</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: polygon.length < 3 || saving }}
            disabled={polygon.length < 3 || saving}
            onPress={savePolygon}
            style={({ pressed }) => [
              styles.saveButton,
              polygon.length < 3 && styles.saveButtonDisabled,
              pressed && styles.saveButtonPressed,
            ]}
          >
            <Save size={20} color="#FFFFFF" />
            <Text style={styles.saveButtonText}>{saving ? 'Guardando…' : 'Guardar'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#dbe9df' },
  mapLayer: { ...StyleSheet.absoluteFill },
  bottomPanel: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 106,
    paddingHorizontal: 17,
    paddingTop: 16,
    paddingBottom: 14,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.97)',
    shadowColor: '#102D27',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 12,
  },
  panelCopy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: { color: '#5A8177', fontSize: 8, fontWeight: '800', letterSpacing: 1.6, marginBottom: 2 },
  title: { color: '#173E36', fontSize: 20, lineHeight: 25, fontWeight: '800', letterSpacing: -0.35 },
  subtitle: { color: '#687E78', fontSize: 11, lineHeight: 16, marginTop: 4 },
  pointBadge: {
    minWidth: 48,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#EEF3F1',
  },
  pointBadgeReady: { backgroundColor: '#DDF4EC' },
  pointBadgeText: { color: '#87928E', fontSize: 10, fontWeight: '700' },
  pointBadgeTextReady: { color: '#0D756B' },
  locationLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 38,
    backgroundColor: '#E9F3EF',
  },
  locationLoadingIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#173E36',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  locationLoadingTitle: { color: '#173E36', fontSize: 17, fontWeight: '800' },
  locationLoadingText: {
    maxWidth: 300,
    marginTop: 6,
    color: '#657D76',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  notice: {
    color: '#447168',
    fontSize: 9,
    lineHeight: 13,
    marginTop: 5,
  },
  actions: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginTop: 12 },
  actionButton: {
    width: 69,
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: '#F0F5F3',
  },
  actionPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  actionButtonDisabled: { opacity: 0.42 },
  actionLabel: { color: '#455E58', fontSize: 9, fontWeight: '700' },
  saveButtonDisabled: { opacity: 0.55 },
  saveButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d756b',
    shadowColor: '#0d756b',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  saveButtonPressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  saveButtonText: { color: '#f5fff8', fontSize: 13, fontWeight: '800', letterSpacing: 0.1 },
});