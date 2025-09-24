import React from 'react';
import { View, StyleSheet, Platform, ActivityIndicator, Text } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

export default function MapViewComponent({ location, errorMsg }) {
  // Si no hay ubicación todavía
  if (!location || !location.coords) {
    return (
      <View style={styles.mapContainer}>
        <ActivityIndicator size="large" color="#4CAF50"/>
        <Text style={styles.mapLoadingText}>
          {errorMsg ? errorMsg : 'Obteniendo ubicación...'}
        </Text>
      </View>
    );
  }

  const { latitude, longitude } = location.coords ?? {};

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
        provider={Platform.OS === 'android' ? PROVIDER_DEFAULT : null}
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
        {/* Renderizamos Marker solo si coords son válidas */}
        {isValidCoords && (
          <Marker coordinate={{ latitude, longitude }} title="Tu Ubicación" />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 200,
    marginHorizontal: 24,
    marginVertical: 24,
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
