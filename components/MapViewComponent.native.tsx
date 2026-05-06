import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';

function buildMapHTML(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    #map {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    window.onload = function() {
      var map = L.map('map', {
        zoomControl: false,
        attributionControl: false
      }).setView([${lat}, ${lng}], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      var icon = L.divIcon({
        html: '<div style="background:#16a34a;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      L.marker([${lat}, ${lng}], { icon: icon }).addTo(map);
      L.circle([${lat}, ${lng}], {
        radius: 40,
        color: '#16a34a',
        fillColor: '#a7f3d0',
        fillOpacity: 0.4,
        weight: 2
      }).addTo(map);

      setTimeout(function(){ map.invalidateSize(); }, 300);
    };
  </script>
</body>
</html>`;
}

export default function MapViewComponent({ location, errorMsg }: { location: any; errorMsg: string | null }) {
  if (!location || !location.coords) {
    return (
      <View style={styles.mapContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.mapLoadingText}>
          {errorMsg ? errorMsg : 'Cargando ubicación 🥑...'}
        </Text>
      </View>
    );
  }

  const { latitude, longitude } = location.coords;

  if (typeof latitude !== 'number' || isNaN(latitude) || typeof longitude !== 'number' || isNaN(longitude)) {
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
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        allowsInlineMediaPlayback={true}
        mixedContentMode="always"
        onError={(e) => console.log('WebView error:', e.nativeEvent)}
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
    backgroundColor: '#d1fae5',
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
    color: '#166534',
    textAlign: 'center',
    fontSize: 13,
  },
});
