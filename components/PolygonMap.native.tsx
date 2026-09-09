import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type * as Location from 'expo-location';

export type PolygonMapProps = {
  location: Location.LocationObject;
  onPolygonChange?: (points: Array<{ latitude: number; longitude: number }>) => void;
};

function buildMapHTML(latitude: number, longitude: number): string {
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<link rel="stylesheet" href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css">
<style>*{box-sizing:border-box}html,body,#map{height:100%;width:100%;margin:0}#map{background:#dbe9df}.leaflet-control{box-shadow:0 1px 5px rgba(12,63,53,.25)!important}.draw-button{position:absolute;top:12px;right:12px;z-index:1000;border:0;border-radius:12px;padding:12px 16px;background:#0d756b;color:#fff;font:700 15px system-ui;box-shadow:0 4px 12px rgba(0,0,0,.25);touch-action:manipulation}</style>
</head><body><div id="map"></div><button id="drawButton" class="draw-button" type="button">Dibujar</button>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js"></script>
<script>
var map=L.map('map',{zoomControl:true,attributionControl:true,tap:true,dragging:true}).setView([${latitude},${longitude}],16);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'}).addTo(map);
var drawn=new L.FeatureGroup();map.addLayer(drawn);
var polygonOptions={allowIntersection:false,showArea:true,shapeOptions:{color:'#ecfff3',weight:3,fillColor:'#19a681',fillOpacity:.42}};
var drawControl=new L.Control.Draw({position:'topleft',draw:{polyline:false,rectangle:false,circle:false,circlemarker:false,marker:false,polygon:polygonOptions},edit:{featureGroup:drawn,remove:true}});
map.addControl(drawControl);
function startDrawing(){new L.Draw.Polygon(map,polygonOptions).enable();}
document.getElementById('drawButton').addEventListener('click',function(event){event.preventDefault();event.stopPropagation();startDrawing();});
map.on(L.Draw.Event.CREATED,function(e){
  drawn.clearLayers();drawn.addLayer(e.layer);
  var points=e.layer.getLatLngs()[0].map(function(point){return {latitude:point.lat,longitude:point.lng};});
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'polygon',points:points}));
});
</script></body></html>`;
}

export default function PolygonMap({ location, onPolygonChange }: PolygonMapProps) {
  const html = useMemo(
    () => buildMapHTML(location.coords.latitude, location.coords.longitude),
    [location.coords.latitude, location.coords.longitude],
  );

  return (
    <View style={styles.mapContainer}>
      <WebView
        source={{ html }}
        style={styles.map}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        nestedScrollEnabled={false}
        bounces={false}
        allowsInlineMediaPlayback
        mixedContentMode="always"
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message.type === 'polygon' && Array.isArray(message.points)) {
              onPolygonChange?.(message.points);
            }
          } catch {
            // Ignore unrelated WebView messages.
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: { height: 450, width: '100%', borderRadius: 22, overflow: 'hidden', backgroundColor: '#dbe9df' },
  map: { flex: 1 },
});