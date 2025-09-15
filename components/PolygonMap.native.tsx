// archivo: components/PolygonMap.native.tsx

// --- 1. IMPORTAMOS useState y useEffect ---
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import MapView, { Polygon, PROVIDER_DEFAULT } from 'react-native-maps';

const generatePolygonAround = (location: any, offset: number) => {
  const { latitude, longitude } = location.coords;
  return [
    { latitude: latitude - offset, longitude: longitude - offset },
    { latitude: latitude + offset, longitude: longitude - offset },
    { latitude: latitude + offset, longitude: longitude + offset },
    { latitude: latitude - offset, longitude: longitude + offset },
  ];
};

export default function PolygonMap({ location, errorMsg, offset }) {
  // --- 2. CREAMOS UN ESTADO PARA CONTROLAR LA REGIÓN DEL MAPA ---
  const [mapRegion, setMapRegion] = useState(null);

  useEffect(() => {
    // Este efecto se ejecuta cuando la ubicación o el offset cambian
    if (location) {
      // Calculamos la nueva región (vista del mapa)
      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: offset * 5, // Hacemos que el zoom dependa del tamaño del polígono
        longitudeDelta: offset * 5,
      };
      setMapRegion(newRegion);
    }
  }, [location, offset]); // Se actualiza si 'location' o 'offset' cambian

  if (!location || !mapRegion) {
    return (
      <View style={[styles.mapContainer, styles.centered]}>
        <Text style={styles.errorText}>{errorMsg || 'Ubicación no disponible.'}</Text>
      </View>
    );
  }

  const dynamicPolygonCoords = generatePolygonAround(location, offset);

  return (
    <View style={styles.mapContainer}>
      <MapView
        provider={Platform.OS === 'android' ? PROVIDER_DEFAULT : null}
        style={styles.map}
        mapType="satellite"
        // --- 3. USAMOS 'region' EN LUGAR DE 'initialRegion' ---
        region={mapRegion}
      >
        <Polygon
          // --- 4. AÑADIMOS UNA 'key' PARA FORZAR LA ACTUALIZACIÓN ---
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
    backgroundColor: '#e0e0e0'
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#333',
    fontWeight: '500',
  }
});