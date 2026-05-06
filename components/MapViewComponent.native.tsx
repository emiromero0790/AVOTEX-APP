import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';

export default function MapViewComponent({ location, errorMsg }: { location: any; errorMsg: string | null }) {
  if (!location || !location.coords) {
    return (
      <View style={[styles.mapContainer, styles.centered]}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.mapLoadingText}>
          {errorMsg ? errorMsg : 'Cargando ubicación 🥑...'}
        </Text>
      </View>
    );
  }

  const { latitude, longitude } = location.coords;

  const isValidCoords =
    typeof latitude === 'number' && !isNaN(latitude) &&
    typeof longitude === 'number' && !isNaN(longitude);

  if (!isValidCoords) {
    return (
      <View style={[styles.mapContainer, styles.centered]}>
        <Text style={styles.mapLoadingText}>Ubicación no disponible</Text>
      </View>
    );
  }

  const mapUrl = `https://maps.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`;

  return (
    <View style={styles.mapContainer}>
      <WebView
        source={{ uri: mapUrl }}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        originWhitelist={['*']}
        startInLoadingState
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFillObject, styles.centered, { backgroundColor: '#e8f5e9' }]}>
            <ActivityIndicator size="large" color="#4CAF50" />
          </View>
        )}
      />
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
    backgroundColor: '#e8f5e9',
  },
  map: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  mapLoadingText: {
    marginTop: 10,
    fontFamily: 'Poppins_400Regular',
    color: '#666',
    textAlign: 'center',
    fontSize: 13,
  },
});
