import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { WebView } from 'react-native-webview';

function buildPolygonHTML(lat: number, lng: number, offset: number): string {
  const coords = [
    [lat - offset, lng - offset],
    [lat + offset, lng - offset],
    [lat + offset, lng + offset],
    [lat - offset, lng + offset],
  ];
  const coordsJson = JSON.stringify(coords);

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
      .setView([${lat}, ${lng}], 16);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19
    }).addTo(map);

    var polygonCoords = ${coordsJson};
    L.polygon(polygonCoords, {
      color: 'rgba(0,255,0,0.9)',
      fillColor: 'rgba(0,255,0,0.3)',
      weight: 2
    }).addTo(map);

    var icon = L.divIcon({
      html: '<div style="background:#16a34a;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>',
      className: '',
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
    L.marker([${lat}, ${lng}], { icon: icon }).addTo(map);
  </script>
</body>
</html>`;
}

export default function PolygonMap({ location, errorMsg, offset }: { location: any; errorMsg: string | null; offset: number }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (location?.coords) {
      const { latitude, longitude } = location.coords;
      setHtml(buildPolygonHTML(latitude, longitude, offset));
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
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    backgroundColor: '#e0e0e0',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
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
