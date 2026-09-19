import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type * as Location from 'expo-location';

export type PolygonMapProps = {
  location: Location.LocationObject;
  onPolygonChange?: (points: Array<{ latitude: number; longitude: number }>) => void;
  initialPolygon?: Array<{ latitude: number; longitude: number }>;
  preview?: boolean;
  perspective?: boolean;
};

export type PolygonMapHandle = {
  startDrawing: () => void;
  startFreshDrawing: () => void;
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
  <style>*{box-sizing:border-box}html,body,#map{height:100%;width:100%;margin:0}#map{background:#dbe9df;perspective:850px;overflow:hidden}.leaflet-control{box-shadow:0 1px 5px rgba(12,63,53,.25)!important}.perspective-view .leaflet-tile-pane,.perspective-view .leaflet-overlay-pane,.perspective-view .leaflet-marker-pane,.perspective-view .leaflet-shadow-pane{transform:rotateX(34deg) scale(1.1)!important;transform-origin:50% 64%!important}.perspective-view:after{content:'';position:absolute;inset:0;z-index:450;pointer-events:none;background:linear-gradient(to bottom,rgba(10,22,12,.12),transparent 35%,rgba(241,246,231,.05))}.leaflet-editing-icon{background:#fff!important;border:2px solid rgba(255,255,255,.95)!important;width:12px!important;height:12px!important;margin-left:-6px!important;margin-top:-6px!important;border-radius:50%!important;box-shadow:0 1px 4px rgba(22,28,18,.55)!important}.first-vertex{background:#7040c5!important;border:2px solid #fff!important;width:14px!important;height:14px!important;margin-left:-7px!important;margin-top:-7px!important;border-radius:50%!important;box-shadow:0 1px 6px rgba(62,29,120,.65)!important}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js"></script>
<script>
  var map=L.map('map',{zoomControl:${preview ? 'false' : 'true'},attributionControl:true,tap:${preview ? 'false' : 'true'},dragging:${preview ? 'false' : 'true'},touchZoom:${preview ? 'false' : 'true'},scrollWheelZoom:${preview ? 'false' : 'true'},doubleClickZoom:${preview ? 'false' : 'true'},boxZoom:${preview ? 'false' : 'true'},keyboard:${preview ? 'false' : 'true'} }).setView([${latitude},${longitude}],16);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'}).addTo(map);
var drawn=new L.FeatureGroup();map.addLayer(drawn);
var vertexDecorations=L.layerGroup().addTo(map);
var polygonOptions={allowIntersection:false,showArea:true,shapeOptions:{color:'#ffffff',weight:3,opacity:.96,fillColor:'#b9c4a2',fillOpacity:.72}};
var activeDrawer=null;
  var activeEditor=null;
  function applyDottedFill(layer){setTimeout(function(){var path=layer&&layer._path;if(!path)return;var svg=path.ownerSVGElement;if(!svg)return;var patternId='avotex-orchard-dots';if(!svg.querySelector('#'+patternId)){var ns='http://www.w3.org/2000/svg';var defs=svg.querySelector('defs')||document.createElementNS(ns,'defs');if(!defs.parentNode)svg.insertBefore(defs,svg.firstChild);var pattern=document.createElementNS(ns,'pattern');pattern.setAttribute('id',patternId);pattern.setAttribute('width','6');pattern.setAttribute('height','6');pattern.setAttribute('patternUnits','userSpaceOnUse');var background=document.createElementNS(ns,'rect');background.setAttribute('width','6');background.setAttribute('height','6');background.setAttribute('fill','#bcc6a6');background.setAttribute('fill-opacity','.76');pattern.appendChild(background);[[1.5,1.5,1.1],[4.5,4.5,.95]].forEach(function(dotData){var dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',String(dotData[0]));dot.setAttribute('cy',String(dotData[1]));dot.setAttribute('r',String(dotData[2]));dot.setAttribute('fill','#68459b');dot.setAttribute('fill-opacity','.94');pattern.appendChild(dot);});defs.appendChild(pattern);}path.setAttribute('fill','url(#'+patternId+')');path.setAttribute('fill-opacity','1');},0);}
  function updateDecorations(points){vertexDecorations.clearLayers();if(!points||points.length<3)return;var step=Math.max(1,Math.ceil(points.length/8));var visible=points.filter(function(_,index){return index%step===0;});var activeIndex=Math.max(0,Math.floor(visible.length*.66));visible.forEach(function(point,index){L.circleMarker([point.latitude,point.longitude],{radius:index===activeIndex?5:4,color:'#ffffff',weight:2,fillColor:index===activeIndex?'#7040c5':'#ffffff',fillOpacity:1,interactive:false}).addTo(vertexDecorations);});}
  function setPerspective(enabled){document.getElementById('map').classList.toggle('perspective-view',Boolean(enabled));var layer=drawn.getLayers().find(function(item){return item instanceof L.Polygon;});if(enabled&&layer){map.fitBounds(layer.getBounds(),{paddingTopLeft:[62,95],paddingBottomRight:[62,110],maxZoom:17});setTimeout(function(){if(map.getZoom()>14)map.zoomOut(1);},120);}}
  function markFirstVertex(){setTimeout(function(){var vertices=document.querySelectorAll('.leaflet-marker-pane .leaflet-editing-icon');vertices.forEach(function(v){v.classList.remove('first-vertex');});if(vertices.length){vertices[0].classList.add('first-vertex');}},0);}
function sendPoints(points){window.ReactNativeWebView.postMessage(JSON.stringify({type:'polygon',points:points}));}
  function startDrawing(){if(${preview ? 'true' : 'false'})return;if(activeEditor){activeEditor.disable();activeEditor=null;}if(activeDrawer){activeDrawer.disable();}activeDrawer=new L.Draw.Polygon(map,polygonOptions);activeDrawer.enable();}
  function startFreshDrawing(){if(${preview ? 'true' : 'false'})return;if(activeEditor){activeEditor.disable();activeEditor=null;}if(activeDrawer){activeDrawer.disable();activeDrawer=null;}drawn.clearLayers();vertexDecorations.clearLayers();activeDrawer=new L.Draw.Polygon(map,polygonOptions);activeDrawer.enable();}
  function editDrawing(){if(${preview ? 'true' : 'false'})return;if(activeDrawer){activeDrawer.disable();activeDrawer=null;}if(activeEditor){activeEditor.disable();activeEditor=null;}vertexDecorations.clearLayers();if(drawn.getLayers().some(function(layer){return layer instanceof L.Polygon;})){activeEditor=new L.EditToolbar.Edit(map,{featureGroup:drawn});activeEditor.enable();}}
  function finishEditing(){if(activeEditor){activeEditor.disable();activeEditor=null;}var layer=drawn.getLayers().find(function(item){return item instanceof L.Polygon;});if(layer){var points=layer.getLatLngs()[0].map(function(point){return {latitude:point.lat,longitude:point.lng};});updateDecorations(points);sendPoints(points);}}
  function clearDrawing(){if(activeDrawer){activeDrawer.disable();activeDrawer=null;}if(activeEditor){activeEditor.disable();activeEditor=null;}drawn.clearLayers();vertexDecorations.clearLayers();sendPoints([]);}
var initialPoints=${JSON.stringify(initialPolygon)};
if(initialPoints.length>=3){
  var initialLayer=L.polygon(initialPoints.map(function(point){return [point.latitude,point.longitude];}),polygonOptions.shapeOptions);
  drawn.addLayer(initialLayer);
  applyDottedFill(initialLayer);
  updateDecorations(initialPoints);
  map.fitBounds(initialLayer.getBounds(),{padding:[28,28],maxZoom:19});
}
map.on(L.Draw.Event.DRAWVERTEX,markFirstVertex);
map.on(L.Draw.Event.EDITSTART,markFirstVertex);
map.on(L.Draw.Event.EDITVERTEX,markFirstVertex);
map.on(L.Draw.Event.CREATED,function(e){
  activeDrawer=null;
  drawn.clearLayers();drawn.addLayer(e.layer);
  applyDottedFill(e.layer);
  var points=e.layer.getLatLngs()[0].map(function(point){return {latitude:point.lat,longitude:point.lng};});
  updateDecorations(points);
  sendPoints(points);
});
  map.on(L.Draw.Event.EDITED,function(e){
    e.layers.eachLayer(function(layer){
      if(layer instanceof L.Polygon){
        applyDottedFill(layer);
        var points=layer.getLatLngs()[0].map(function(point){return {latitude:point.lat,longitude:point.lng};});
        updateDecorations(points);
        sendPoints(points);
      }
    });
  });
</script></body></html>`;
}

const PolygonMap = forwardRef<PolygonMapHandle, PolygonMapProps>(({ location, onPolygonChange, initialPolygon = [], preview = false, perspective = false }, ref) => {
  const webViewRef = useRef<WebView>(null);
  const html = useMemo(
    () => buildMapHTML(location.coords.latitude, location.coords.longitude, initialPolygon, preview),
    [location.coords.latitude, location.coords.longitude, initialPolygon, preview],
  );

  useImperativeHandle(ref, () => ({
    startDrawing: () => webViewRef.current?.injectJavaScript('startDrawing(); true;'),
    startFreshDrawing: () => webViewRef.current?.injectJavaScript('startFreshDrawing(); true;'),
    editDrawing: () => webViewRef.current?.injectJavaScript('editDrawing(); true;'),
    finishEditing: () => webViewRef.current?.injectJavaScript('finishEditing(); true;'),
    clearDrawing: () => webViewRef.current?.injectJavaScript('clearDrawing(); true;'),
  }), []);

  useEffect(() => {
    webViewRef.current?.injectJavaScript(`setPerspective(${perspective ? 'true' : 'false'}); true;`);
  }, [perspective]);

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
        onLoadEnd={() => webViewRef.current?.injectJavaScript(`setPerspective(${perspective ? 'true' : 'false'}); true;`)}
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