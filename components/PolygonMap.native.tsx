import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { WebView } from 'react-native-webview';

function buildPolygonHTML(lat: number, lng: number, offset: number): string {
  const coords = JSON.stringify([
    [lat - offset, lng - offset],
    [lat + offset, lng - offset],
    [lat + offset, lng + offset],
    [lat - offset, lng + offset],
  ]);

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
      }).setView([${lat}, ${lng}], 16);

      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
      }).addTo(map);

      var polygonCoords = ${coords};
      L.polygon(polygonCoords, {
        color: '#00ff00',
        fillColor: 'rgba(0,255,0,0.25)',
        fillOpacity: 1,
        weight: 2.5
      }).addTo(map);

      var icon = L.divIcon({
        html: '<div style="background:#16a34a;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>',
        className: '',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });
      L.marker([${lat}, ${lng}], { icon: icon }).addTo(map);

      setTimeout(function(){ map.invalidateSize(); }, 300);
    };
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
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        mixedContentMode="always"
        onError={(e) => console.log('WebView error:', e.nativeEvent)}
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
    backgroundColor: '#d1fae5',
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
    color: '#166534',
    fontWeight: '500',
    textAlign: 'center',
    fontSize: 13,
  },
});
