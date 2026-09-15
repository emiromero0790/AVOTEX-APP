import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type * as Location from 'expo-location';

export type PolygonMapProps = {
  location: Location.LocationObject;
  onPolygonChange?: (points: Array<{ latitude: number; longitude: number }>) => void;
  initialPolygon?: Array<{ latitude: number; longitude: number }>;
  preview?: boolean;
};

export type PolygonMapHandle = {
  startDrawing: () => void;
  editDrawing: () => void;
  finishEditing: () => void;
  clearDrawing: () => void;
};

function buildMapHTML(
  latitude: number,
  longitude: number,
  initialPolygon: Array<{ latitude: number; longitude: number }> = [],
  preview = false,
): string {
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<link rel="stylesheet" href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css">
  <style>*{box-sizing:border-box}html,body,#map{height:100%;width:100%;margin:0}#map{background:#dbe9df}.leaflet-control{box-shadow:0 1px 5px rgba(12,63,53,.25)!important}.first-vertex{background:#e53935!important;border:3px solid #fff!important;width:18px!important;height:18px!important;margin-left:-9px!important;margin-top:-9px!important;border-radius:50%!important;box-shadow:0 2px 8px rgba(120,0,0,.5)!important}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js"></script>
<script>
  var map=L.map('map',{zoomControl:${preview ? 'false' : 'true'},attributionControl:true,tap:${preview ? 'false' : 'true'},dragging:${preview ? 'false' : 'true'},touchZoom:${preview ? 'false' : 'true'},scrollWheelZoom:${preview ? 'false' : 'true'},doubleClickZoom:${preview ? 'false' : 'true'},boxZoom:${preview ? 'false' : 'true'},keyboard:${preview ? 'false' : 'true'} }).setView([${latitude},${longitude}],16);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'}).addTo(map);
var drawn=new L.FeatureGroup();map.addLayer(drawn);
var polygonOptions={allowIntersection:false,showArea:true,shapeOptions:{color:'#ecfff3',weight:3,fillColor:'#19a681',fillOpacity:.42}};
var activeDrawer=null;
  var activeEditor=null;
  function markFirstVertex(){setTimeout(function(){var vertices=document.querySelectorAll('.leaflet-marker-pane .leaflet-editing-icon');vertices.forEach(function(v){v.classList.remove('first-vertex');});if(vertices.length){vertices[0].classList.add('first-vertex');}},0);}
function sendPoints(points){window.ReactNativeWebView.postMessage(JSON.stringify({type:'polygon',points:points}));}
  function startDrawing(){if(${preview ? 'true' : 'false'})return;if(activeEditor){activeEditor.disable();activeEditor=null;}if(activeDrawer){activeDrawer.disable();}activeDrawer=new L.Draw.Polygon(map,polygonOptions);activeDrawer.enable();}
  function editDrawing(){if(${preview ? 'true' : 'false'})return;if(activeDrawer){activeDrawer.disable();activeDrawer=null;}if(activeEditor){activeEditor.disable();activeEditor=null;}if(drawn.getLayers().some(function(layer){return layer instanceof L.Polygon;})){activeEditor=new L.EditToolbar.Edit(map,{featureGroup:drawn});activeEditor.enable();}}
  function finishEditing(){if(activeEditor){activeEditor.disable();activeEditor=null;}var layer=drawn.getLayers().find(function(item){return item instanceof L.Polygon;});if(layer){var points=layer.getLatLngs()[0].map(function(point){return {latitude:point.lat,longitude:point.lng};});sendPoints(points);}}
  function clearDrawing(){if(activeDrawer){activeDrawer.disable();activeDrawer=null;}if(activeEditor){activeEditor.disable();activeEditor=null;}drawn.clearLayers();sendPoints([]);}
var initialPoints=${JSON.stringify(initialPolygon)};
if(initialPoints.length>=3){
  var initialLayer=L.polygon(initialPoints.map(function(point){return [point.latitude,point.longitude];}),polygonOptions.shapeOptions);
  drawn.addLayer(initialLayer);
  map.fitBounds(initialLayer.getBounds(),{padding:[28,28],maxZoom:19});
}
map.on(L.Draw.Event.DRAWVERTEX,markFirstVertex);
map.on(L.Draw.Event.EDITSTART,markFirstVertex);
map.on(L.Draw.Event.EDITVERTEX,markFirstVertex);
map.on(L.Draw.Event.CREATED,function(e){
  activeDrawer=null;
  drawn.clearLayers();drawn.addLayer(e.layer);
  var points=e.layer.getLatLngs()[0].map(function(point){return {latitude:point.lat,longitude:point.lng};});
  sendPoints(points);
});
  map.on(L.Draw.Event.EDITED,function(e){
    e.layers.eachLayer(function(layer){
      if(layer instanceof L.Polygon){
        var points=layer.getLatLngs()[0].map(function(point){return {latitude:point.lat,longitude:point.lng};});
        sendPoints(points);
      }
    });
  });
</script></body></html>`;
}

const PolygonMap = forwardRef<PolygonMapHandle, PolygonMapProps>(({ location, onPolygonChange, initialPolygon = [], preview = false }, ref) => {
  const webViewRef = useRef<WebView>(null);
  const html = useMemo(
    () => buildMapHTML(location.coords.latitude, location.coords.longitude, initialPolygon, preview),
    [location.coords.latitude, location.coords.longitude, initialPolygon, preview],
  );

  useImperativeHandle(ref, () => ({
    startDrawing: () => webViewRef.current?.injectJavaScript('startDrawing(); true;'),
    editDrawing: () => webViewRef.current?.injectJavaScript('editDrawing(); true;'),
    finishEditing: () => webViewRef.current?.injectJavaScript('finishEditing(); true;'),
    clearDrawing: () => webViewRef.current?.injectJavaScript('clearDrawing(); true;'),
  }), []);

  return (
    <View style={styles.mapContainer}>
      <WebView
        ref={webViewRef}
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
});

PolygonMap.displayName = 'PolygonMap';
export default PolygonMap;

const styles = StyleSheet.create({
  mapContainer: { flex: 1, width: '100%', overflow: 'hidden', backgroundColor: '#dbe9df' },
  map: { flex: 1 },
});