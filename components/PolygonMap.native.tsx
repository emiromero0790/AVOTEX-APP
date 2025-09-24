import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapView, { Polygon, PROVIDER_GOOGLE } from 'react-native-maps';

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
  const [mapRegion, setMapRegion] = useState(null);

  useEffect(() => {
    if (location) {
      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: offset * 5,
        longitudeDelta: offset * 5,
      };
      setMapRegion(newRegion);
    }
  }, [location, offset]);

  if (!location || !mapRegion) {
    return (
      <View style={[styles.mapContainer, styles.centered]}>
        <Text style={styles.errorText}>{errorMsg || 'Cargando ubicaación 🥑...'}</Text>
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