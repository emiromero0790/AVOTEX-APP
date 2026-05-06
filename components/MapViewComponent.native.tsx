import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';

export default function MapViewComponent({
  location,
  errorMsg,
}: {
  location: any;
  errorMsg: string | null;
}) {
  if (!location || !location.coords) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>
          {errorMsg ?? 'Cargando ubicación 🥑...'}
        </Text>
      </View>
    );
  }

  const { latitude, longitude } = location.coords;

  if (typeof latitude !== 'number' || isNaN(latitude) ||
      typeof longitude !== 'number' || isNaN(longitude)) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Ubicación no disponible</Text>
      </View>
    );
  }

  return (
    <View style={styles.mapContainer}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        <Marker coordinate={{ latitude, longitude }} pinColor="#16a34a" />
        <Circle
          center={{ latitude, longitude }}
          radius={40}
          strokeColor="#16a34a"
          fillColor="rgba(167,243,208,0.3)"
          strokeWidth={2}
        />
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
    backgroundColor: '#d1fae5',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    height: 200,
    marginHorizontal: 24,
    marginTop: -5,
    borderRadius: 24,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 10,
    color: '#166534',
    textAlign: 'center',
    fontSize: 13,
  },
});