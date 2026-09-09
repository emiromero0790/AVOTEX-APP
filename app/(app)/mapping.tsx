import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Location from 'expo-location';
import PolygonMap from '../../components/PolygonMap';

const FALLBACK_LOCATION = {
  coords: {
    latitude: 19.7026,
    longitude: -101.1924,
    altitude: null,
    accuracy: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: Date.now(),
};

export default function Mapping() {
  const { width } = useWindowDimensions();
  const [location, setLocation] = useState<Location.LocationObject>(FALLBACK_LOCATION);
  const [notice, setNotice] = useState<string | null>('Buscando tu ubicación. Mientras tanto puedes delimitar sobre el mapa.');

  useEffect(() => {
    let active = true;

    const requestLocation = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        if (permission.status !== 'granted') {
          setNotice('Usando una ubicación aproximada. Puedes dibujar tu huerta sobre el mapa.');
          return;
        }
        const current = await Location.getCurrentPositionAsync({});
        if (active) {
          setLocation(current);
          setNotice(null);
        }
      } catch {
        if (active) setNotice('No pudimos obtener tu ubicación. Mostramos Morelia como referencia.');
      }
    };

    requestLocation();
    return () => {
      active = false;
    };
  }, []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: width < 768 ? 132 : 72 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>AVOTEX / CAMPO</Text>
          <Text style={styles.title}>Delimita tu huerta</Text>
          <Text style={styles.subtitle}>Toca los puntos en el mapa para dibujar el contorno de tu huerta.</Text>
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <PolygonMap location={location} />
        <Pressable
          accessibilityRole="button"
          onPress={() => undefined}
          style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
        >
          <Text style={styles.saveButtonText}>Guardar delimitación</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4faf5' },
  content: { flexGrow: 1, paddingTop: 42, paddingHorizontal: 20 },
  inner: { width: '100%', maxWidth: 1160, alignSelf: 'center' },
  header: { marginBottom: 24, paddingHorizontal: 2 },
  eyebrow: { color: '#4a9a7d', fontSize: 11, fontWeight: '800', letterSpacing: 2.1, marginBottom: 12 },
  title: { color: '#123f35', fontSize: 36, lineHeight: 42, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { color: '#6f8980', fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 480 },
  notice: {
    color: '#477268',
    backgroundColor: '#e5f3eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 13,
  },
  saveButton: {
    minHeight: 54,
    marginTop: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d756b',
    shadowColor: '#0d756b',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  saveButtonPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  saveButtonText: { color: '#f5fff8', fontSize: 16, fontWeight: '800', letterSpacing: 0.1 },
});