import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';

function buildMapHTML(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false })
      .setView([${lat}, ${lng}], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    var icon = L.divIcon({
      html: '<div style="background:#16a34a;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>',
      className: '',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
    L.marker([${lat}, ${lng}], { icon: icon }).addTo(map);
    L.circle([${lat}, ${lng}], { radius: 30, color: '#16a34a', fillColor: '#a7f3d0', fillOpacity: 0.35, weight: 2 }).addTo(map);
  </script>
</body>
</html>`;
}

export default function MapViewComponent({ location, errorMsg }: { location: any; errorMsg: string | null }) {
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
    typeof latitude === 'number' && !isNaN(latitude) &&
    typeof longitude === 'number' && !isNaN(longitude);

  if (!isValidCoords) {
    return (
      <View style={styles.mapContainer}>
        <Text style={styles.mapLoadingText}>Ubicación no disponible</Text>
      </View>
    );
  }

  return (
    <View style={styles.mapContainer}>
      <WebView
        source={{ html: buildMapHTML(latitude, longitude) }}
        style={styles.map}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        originWhitelist={['*']}
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
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  mapLoadingText: {
    marginTop: 10,
    fontFamily: 'Poppins_400Regular',
    color: '#666',
    textAlign: 'center',
    fontSize: 13,
  },
});
