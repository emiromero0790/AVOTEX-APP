import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';

let MapView: any = null;
let Polygon: any = null;
let PROVIDER_GOOGLE: any = null;
let mapsAvailable = false;

try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Polygon = maps.Polygon;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
  mapsAvailable = true;
} catch (_e) {
  mapsAvailable = false;
}

const generatePolygonAround = (location: any, offset: number) => {
  const { latitude, longitude } = location.coords;
  return [
    { latitude: latitude - offset, longitude: longitude - offset },
    { latitude: latitude + offset, longitude: longitude - offset },
    { latitude: latitude + offset, longitude: longitude + offset },
    { latitude: latitude - offset, longitude: longitude + offset },
  ];
};

export default function PolygonMap({ location, errorMsg, offset }: { location: any; errorMsg: string | null; offset: number }) {
  const [mapRegion, setMapRegion] = useState<any>(null);

  useEffect(() => {
    if (location) {
      setMapRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: offset * 5,
        longitudeDelta: offset * 5,
      });
    }
  }, [location, offset]);

  if (!mapsAvailable) {
    return (
      <View style={[styles.mapContainer, styles.centered]}>
        <Text style={styles.errorText}>🗺️ El mapa no está disponible en Expo Go.{'\n'}Usa un desarrollo nativo.</Text>
      </View>
    );
  }

  if (!location || !mapRegion) {
    return (
      <View style={[styles.mapContainer, styles.centered]}>
        <Text style={styles.errorText}>{errorMsg || 'Cargando ubicación 🥑...'}</Text>
      </View>
    );
  }

  const dynamicPolygonCoords = generatePolygonAround(location, offset);

  return (
    <View style={styles.mapContainer}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        mapType="satellite"
        region={mapRegion}
      >
        <Polygon
          key={offset}
          coordinates={dynamicPolygonCoords}
          fillColor="rgba(0, 255, 0, 0.3)"
          strokeColor="rgba(0, 255, 0, 0.8)"
          strokeWidth={2}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    backgroundColor: '#e0e0e0',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    color: '#333',
    fontWeight: '500',
    textAlign: 'center',
    fontSize: 13,
  },
});
