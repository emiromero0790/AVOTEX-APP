import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
// Cambiamos la importación para usar PROVIDER_GOOGLE explícitamente
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

export default function MapViewComponent({ location, errorMsg }) {
  if (!location || !location.coords) {
    return (
      <View style={styles.mapContainer}>
        <ActivityIndicator size="large" color="#4CAF50"/>
        <Text style={styles.mapLoadingText}>
          {errorMsg ? errorMsg : 'Cargando ubicaación 🥑...'}
        </Text>
      </View>
    );
  }

  const { latitude, longitude } = location.coords;

  // El chequeo de coordenadas válidas ya está bien implementado
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
        // Forzamos el uso de Google Maps en AMBAS plataformas (iOS y Android)
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
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapLoadingText: {
    marginTop: 10,
    fontFamily: 'Poppins_400Regular',
    color: '#666',
  },
});