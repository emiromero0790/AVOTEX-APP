import React from 'react';
import { StyleSheet } from 'react-native';
import type * as Location from 'expo-location';

export type PolygonMapProps = {
  location: Location.LocationObject;
};

function buildMapHTML(latitude: number, longitude: number): string {
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<link rel="stylesheet" href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css">
<style>html,body,#map{height:100%;width:100%;margin:0}#map{background:#dbe9df}.leaflet-control{box-shadow:0 1px 5px rgba(12,63,53,.25)!important}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js"></script>
<script>
var map=L.map('map',{zoomControl:true,attributionControl:true}).setView([${latitude},${longitude}],16);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'}).addTo(map);
var drawn=new L.FeatureGroup();map.addLayer(drawn);
var drawControl=new L.Control.Draw({position:'topleft',draw:{polyline:false,rectangle:false,circle:false,circlemarker:false,marker:false,polygon:{allowIntersection:false,showArea:true,shapeOptions:{color:'#ecfff3',weight:3,fillColor:'#19a681',fillOpacity:.42}}},edit:{featureGroup:drawn,remove:true}});
map.addControl(drawControl);
map.on(L.Draw.Event.CREATED,function(e){drawn.clearLayers();drawn.addLayer(e.layer);});
</script></body></html>`;
}

export default function PolygonMap({ location }: PolygonMapProps) {
  const html = buildMapHTML(location.coords.latitude, location.coords.longitude);
  return (
    <iframe
      title="Mapa para delimitar la huerta"
      srcDoc={html}
      style={styles.map}
      allow="geolocation"
    />
  );
}

const styles = StyleSheet.create({
  map: {
    display: 'block',
    width: '100%',
    height: 520,
    border: 0,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#dbe9df',
  } as unknown as object,
});