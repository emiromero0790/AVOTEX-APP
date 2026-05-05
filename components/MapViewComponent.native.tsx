import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';

let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;
let mapsAvailable = false;

try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
  mapsAvailable = true;
} catch (_e) {
  mapsAvailable = false;
}

export default function MapViewComponent({ location, errorMsg }: { location: any; errorMsg: string | null }) {
  if (!mapsAvailable) {
    return (
      <View style={styles.mapContainer}>
        <Text style={styles.mapLoadingText}>🗺️ El mapa no está disponible en Expo Go.{'\n'}Usa un desarrollo nativo.</Text>
      </View>
    );
  }

  if (!location || !location.coords) {
    return (
      <View style={styles.mapContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.mapLoadingText}>
          {errorMsg ? errorMsg : 'Cargando ubicación 🥑...'}
        </Text>
      </View>
    );
  }

  const { latitude, longitude } = location.coords;

  const isValidCoords =
    typeof latitude === 'number' &&
    !isNaN(latitude) &&
    typeof longitude === 'number' &&
    !isNaN(longitude);

  if (!isValidCoords) {
    return (
      <View style={styles.mapContainer}>
        <Text style={styles.mapLoadingText}>Ubicación no disponible</Text>
      </View>
    );
  }

  return (
    <View style={styles.mapContainer}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation={true}
        scrollEnabled={false}
        zoomEnabled={false}
      >
        <Marker coordinate={{ latitude, longitude }} title="Tu Ubicación" />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 200,
    marginHorizontal: 24,
    marginTop: -5,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 8,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapLoadingText: {
    marginTop: 10,
    fontFamily: 'Poppins_400Regular',
    color: '#666',
    textAlign: 'center',
    fontSize: 13,
  },
});
