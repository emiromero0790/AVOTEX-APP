import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { WebView } from 'react-native-webview';

const generatePolygonAround = (location: any, offset: number) => {
  const { latitude, longitude } = location.coords;
  return [
    [latitude - offset, longitude - offset],
    [latitude + offset, longitude - offset],
    [latitude + offset, longitude + offset],
    [latitude - offset, longitude + offset],
  ];
};

function buildMapHTML(lat: number, lng: number, offset: number, polygonCoords: number[][]): string {
  const coordsJS = JSON.stringify(polygonCoords);
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false })
      .setView([${lat}, ${lng}], 16);

    // Tiles satelital — sin API key
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19
    }).addTo(map);

    var coords = ${coordsJS};
    var latLngs = coords.map(function(c) { return [c[0], c[1]]; });

    L.polygon(latLngs, {
      color: 'rgba(0,255,0,0.8)',
      fillColor: 'rgba(0,255,0,0.3)',
      strokeWidth: 2,
      weight: 2
    }).addTo(map);

    map.fitBounds(latLngs);
  <\/script>
</body>
</html>`;
}

export default function PolygonMap({ location, errorMsg, offset }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (location?.coords) {
      const { latitude, longitude } = location.coords;
      const polygonCoords = generatePolygonAround(location, offset);
      setHtml(buildMapHTML(latitude, longitude, offset, polygonCoords));
    }
  }, [location, offset]);

  if (!location || !html) {
    return (
      <View style={[styles.mapContainer, styles.centered]}>
        <Text style={styles.errorText}>{errorMsg || 'Cargando ubicación 🥑...'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.mapContainer}>
      <WebView
        source={{ html }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        scrollEnabled={false}
        mixedContentMode="always"
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
    backgroundColor: '#e0e0e0',
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
  },
});