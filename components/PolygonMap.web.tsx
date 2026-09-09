import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import type * as Location from 'expo-location';

export type PolygonMapProps = {
  location: Location.LocationObject;
  onPolygonChange?: (points: Array<{ latitude: number; longitude: number }>) => void;
};

function buildMapHTML(latitude: number, longitude: number): string {
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<link rel="stylesheet" href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css">
<style>*{box-sizing:border-box}html,body,#map{height:100%;width:100%;margin:0}#map{background:#dbe9df}.leaflet-control{box-shadow:0 1px 5px rgba(12,63,53,.25)!important}.map-actions{position:absolute;top:12px;right:12px;z-index:1000;display:flex;gap:9px}.map-button{width:48px;height:48px;display:grid;place-items:center;border:1px solid rgba(15,23,42,.10);border-radius:16px;padding:0;background:rgba(255,255,255,.96);box-shadow:0 5px 16px rgba(15,23,42,.22);cursor:pointer}.map-button svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.draw-button{color:#176B62}.clear-button{color:#DC5148}.map-button:hover{background:#f8fafc}.map-button:active{transform:scale(.94)}</style>
</head><body><div id="map"></div><div class="map-actions"><button id="drawButton" class="map-button draw-button" type="button" aria-label="Dibujar polígono" title="Dibujar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/><path d="m15 5 3 3"/></svg></button><button id="clearButton" class="map-button clear-button" type="button" aria-label="Borrar polígono" title="Borrar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 21-4-4L15 5a2.83 2.83 0 0 1 4 4L7 21Z"/><path d="m6 14 4 4"/><path d="M7 21h13"/></svg></button></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js"></script>
<script>
var map=L.map('map',{zoomControl:true,attributionControl:true}).setView([${latitude},${longitude}],16);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'}).addTo(map);
var drawn=new L.FeatureGroup();map.addLayer(drawn);
var polygonOptions={allowIntersection:false,showArea:true,shapeOptions:{color:'#ecfff3',weight:3,fillColor:'#19a681',fillOpacity:.42}};
var drawControl=new L.Control.Draw({position:'topleft',draw:false,edit:{featureGroup:drawn,edit:true,remove:false}});
map.addControl(drawControl);
var activeDrawer=null;
function sendPoints(points){window.parent.postMessage({source:'avotex-polygon-map',type:'polygon',points:points},'*');}
function startDrawing(){if(activeDrawer){activeDrawer.disable();}activeDrawer=new L.Draw.Polygon(map,polygonOptions);activeDrawer.enable();}
function clearDrawing(){if(activeDrawer){activeDrawer.disable();activeDrawer=null;}drawn.clearLayers();sendPoints([]);}
document.getElementById('drawButton').addEventListener('click',function(event){event.preventDefault();event.stopPropagation();startDrawing();});
document.getElementById('clearButton').addEventListener('click',function(event){event.preventDefault();event.stopPropagation();clearDrawing();});
map.on(L.Draw.Event.CREATED,function(e){
  activeDrawer=null;
  drawn.clearLayers();drawn.addLayer(e.layer);
  var points=e.layer.getLatLngs()[0].map(function(point){return {latitude:point.lat,longitude:point.lng};});
  sendPoints(points);
});
</script></body></html>`;
}

export default function PolygonMap({ location, onPolygonChange }: PolygonMapProps) {
  const html = buildMapHTML(location.coords.latitude, location.coords.longitude);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message?.source === 'avotex-polygon-map' && message.type === 'polygon' && Array.isArray(message.points)) {
        onPolygonChange?.(message.points);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onPolygonChange]);

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