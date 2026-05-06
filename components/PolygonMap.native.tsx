import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

export default function PolygonMap({ location, errorMsg, offset }: { location: any; errorMsg: string | null; offset: number }) {
  const [mapUrl, setMapUrl] = useState<string | null>(null);

  useEffect(() => {
    if (location?.coords) {
      const { latitude, longitude } = location.coords;
      const zoom = offset < 0.002 ? 17 : offset < 0.005 ? 16 : 15;
      setMapUrl(`https://maps.google.com/maps?q=${latitude},${longitude}&z=${zoom}&t=k&output=embed`);
    }
  }, [location, offset]);

  if (!location || !mapUrl) {
    return (
      <View style={[styles.mapContainer, styles.centered]}>
        <Text style={styles.errorText}>{errorMsg || 'Cargando ubicación 🥑...'}</Text>
      </View>
    );
  }

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
          <View style={[StyleSheet.absoluteFillObject, styles.centered, { backgroundColor: '#1a1a2e' }]}>
            <ActivityIndicator size="large" color="#4CAF50" />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    backgroundColor: '#1a1a2e',
  },
  map: {
    flex: 1,
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
