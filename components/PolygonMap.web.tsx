import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import type * as Location from 'expo-location';

export type PolygonMapProps = {
  location: Location.LocationObject;
  onPolygonChange?: (points: Array<{ latitude: number; longitude: number }>) => void;
  initialPolygon?: Array<{ latitude: number; longitude: number }>;
  preview?: boolean;
};

export type PolygonMapHandle = {
  startDrawing: () => void;
  clearDrawing: () => void;
};

function buildMapHTML(
  latitude: number,
  longitude: number,
  initialPolygon: Array<{ latitude: number; longitude: number }> = [],
  preview = false,
): string {
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<link rel="stylesheet" href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css">
<style>*{box-sizing:border-box}html,body,#map{height:100%;width:100%;margin:0}#map{background:#dbe9df}.leaflet-control{box-shadow:0 1px 5px rgba(12,63,53,.25)!important}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js"></script>
<script>
var map=L.map('map',{zoomControl:${preview ? 'false' : 'true'},attributionControl:true}).setView([${latitude},${longitude}],16);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'}).addTo(map);
var drawn=new L.FeatureGroup();map.addLayer(drawn);
var polygonOptions={allowIntersection:false,showArea:true,shapeOptions:{color:'#ecfff3',weight:3,fillColor:'#19a681',fillOpacity:.42}};
var activeDrawer=null;
function sendPoints(points){window.parent.postMessage({source:'avotex-polygon-map',type:'polygon',points:points},'*');}
function startDrawing(){if(activeDrawer){activeDrawer.disable();}activeDrawer=new L.Draw.Polygon(map,polygonOptions);activeDrawer.enable();}
function clearDrawing(){if(activeDrawer){activeDrawer.disable();activeDrawer=null;}drawn.clearLayers();sendPoints([]);}
var initialPoints=${JSON.stringify(initialPolygon)};
if(initialPoints.length>=3){
  var initialLayer=L.polygon(initialPoints.map(function(point){return [point.latitude,point.longitude];}),polygonOptions.shapeOptions);
  drawn.addLayer(initialLayer);
  map.fitBounds(initialLayer.getBounds(),{padding:[28,28],maxZoom:19});
}
window.addEventListener('message',function(event){if(event.data?.source!=='avotex-mapping-controls')return;if(event.data.action==='draw')startDrawing();if(event.data.action==='clear')clearDrawing();});
map.on(L.Draw.Event.CREATED,function(e){
  activeDrawer=null;
  drawn.clearLayers();drawn.addLayer(e.layer);
  var points=e.layer.getLatLngs()[0].map(function(point){return {latitude:point.lat,longitude:point.lng};});
  sendPoints(points);
});
</script></body></html>`;
}

const PolygonMap = forwardRef<PolygonMapHandle, PolygonMapProps>(({ location, onPolygonChange, initialPolygon = [], preview = false }, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const html = buildMapHTML(location.coords.latitude, location.coords.longitude, initialPolygon, preview);

  useImperativeHandle(ref, () => ({
    startDrawing: () => iframeRef.current?.contentWindow?.postMessage({ source: 'avotex-mapping-controls', action: 'draw' }, '*'),
    clearDrawing: () => iframeRef.current?.contentWindow?.postMessage({ source: 'avotex-mapping-controls', action: 'clear' }, '*'),
  }), []);

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
      ref={iframeRef}
      title="Mapa para delimitar la huerta"
      srcDoc={html}
      style={styles.map}
      allow="geolocation"
    />
  );
});

PolygonMap.displayName = 'PolygonMap';
export default PolygonMap;

const styles = StyleSheet.create({
  map: {
    display: 'block',
    width: '100%',
    height: '100%',
    border: 0,
    overflow: 'hidden',
    backgroundColor: '#dbe9df',
  } as unknown as object,
});