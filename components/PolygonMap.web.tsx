import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import type * as Location from 'expo-location';
import { TranslationResource, useTranslations } from '../context/LanguageContext';

const translations: TranslationResource = {
  mapTitle: { es: 'Mapa para delimitar la huerta', en: 'Map for outlining the orchard' },
};

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
<html><head><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<link rel="stylesheet" href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">
 <style>*{box-sizing:border-box}html,body,#leaflet-map,#gl-map{height:100%;width:100%;margin:0}#leaflet-map,#gl-map{position:absolute;inset:0;background:#dbe9df}#leaflet-map{z-index:1}#gl-map{z-index:0;visibility:hidden}.leaflet-control{box-shadow:0 1px 5px rgba(12,63,53,.25)!important}.leaflet-editing-icon{background:#fff!important;border:2px solid rgba(255,255,255,.95)!important;width:12px!important;height:12px!important;margin-left:-6px!important;margin-top:-6px!important;border-radius:50%!important;box-shadow:0 1px 4px rgba(22,28,18,.55)!important}.first-vertex{background:#7040c5!important;border:2px solid #fff!important;width:14px!important;height:14px!important;margin-left:-7px!important;margin-top:-7px!important;border-radius:50%!important;box-shadow:0 1px 6px rgba(62,29,120,.65)!important}</style>
</head><body><div id="leaflet-map"></div><div id="gl-map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js"></script>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script>
  var map=L.map('leaflet-map',{zoomControl:${preview ? 'false' : 'true'},attributionControl:true,dragging:${preview ? 'false' : 'true'},touchZoom:${preview ? 'false' : 'true'},scrollWheelZoom:${preview ? 'false' : 'true'},doubleClickZoom:${preview ? 'false' : 'true'},boxZoom:${preview ? 'false' : 'true'},keyboard:${preview ? 'false' : 'true'} }).setView([${latitude},${longitude}],16);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'}).addTo(map);
var drawn=new L.FeatureGroup();map.addLayer(drawn);
var vertexDecorations=L.layerGroup().addTo(map);
var polygonOptions={allowIntersection:false,showArea:true,shapeOptions:{color:'#ffffff',weight:3,opacity:.96,fillColor:'#b9c4a2',fillOpacity:.72}};
var activeDrawer=null;
  var activeEditor=null;
  var glMap=null;
  var glReady=false;
  var perspectiveRequested=false;
  function applyDottedFill(layer){setTimeout(function(){var path=layer&&layer._path;if(!path)return;var svg=path.ownerSVGElement;if(!svg)return;var patternId='avotex-orchard-dots';if(!svg.querySelector('#'+patternId)){var ns='http://www.w3.org/2000/svg';var defs=svg.querySelector('defs')||document.createElementNS(ns,'defs');if(!defs.parentNode)svg.insertBefore(defs,svg.firstChild);var pattern=document.createElementNS(ns,'pattern');pattern.setAttribute('id',patternId);pattern.setAttribute('width','6');pattern.setAttribute('height','6');pattern.setAttribute('patternUnits','userSpaceOnUse');var background=document.createElementNS(ns,'rect');background.setAttribute('width','6');background.setAttribute('height','6');background.setAttribute('fill','#bcc6a6');background.setAttribute('fill-opacity','.76');pattern.appendChild(background);[[1.5,1.5,1.1],[4.5,4.5,.95]].forEach(function(dotData){var dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',String(dotData[0]));dot.setAttribute('cy',String(dotData[1]));dot.setAttribute('r',String(dotData[2]));dot.setAttribute('fill','#68459b');dot.setAttribute('fill-opacity','.94');pattern.appendChild(dot);});defs.appendChild(pattern);}path.setAttribute('fill','url(#'+patternId+')');path.setAttribute('fill-opacity','1');},0);}
  function updateDecorations(points){vertexDecorations.clearLayers();if(!points||points.length<3)return;var step=Math.max(1,Math.ceil(points.length/8));var visible=points.filter(function(_,index){return index%step===0;});var activeIndex=Math.max(0,Math.floor(visible.length*.66));visible.forEach(function(point,index){L.circleMarker([point.latitude,point.longitude],{radius:index===activeIndex?5:4,color:'#ffffff',weight:2,fillColor:index===activeIndex?'#7040c5':'#ffffff',fillOpacity:1,interactive:false}).addTo(vertexDecorations);});}
  function showLeafletMap(){document.getElementById('gl-map').style.visibility='hidden';document.getElementById('leaflet-map').style.display='block';setTimeout(function(){map.invalidateSize();},0);}
  function showPerspectiveMap(){if(!glReady)return;document.getElementById('leaflet-map').style.display='none';document.getElementById('gl-map').style.visibility='visible';setTimeout(function(){if(glMap)glMap.resize();},0);}
  function ensurePerspectiveMap(){if(glMap)return true;if(initialPoints.length<3||typeof maplibregl==='undefined')return false;var coordinates=initialPoints.map(function(point){return [point.longitude,point.latitude];});coordinates.push(coordinates[0]);var bounds=coordinates.reduce(function(box,coordinate){return box.extend(coordinate);},new maplibregl.LngLatBounds(coordinates[0],coordinates[0]));try{glMap=new maplibregl.Map({container:'gl-map',center:[${longitude},${latitude}],zoom:14,pitch:72,maxPitch:85,bearing:-14,attributionControl:false,style:{version:8,sources:{esri:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19}},layers:[{id:'satellite',type:'raster',source:'esri'}]}});}catch(error){glMap=null;showLeafletMap();return false;}glMap.getCanvas().addEventListener('webglcontextlost',function(){glReady=false;showLeafletMap();});glMap.on('error',function(){if(!glReady)showLeafletMap();});glMap.on('load',function(){try{var canvas=document.createElement('canvas');canvas.width=8;canvas.height=8;var context=canvas.getContext('2d');context.fillStyle='rgba(188,198,166,.78)';context.fillRect(0,0,8,8);context.fillStyle='rgba(104,69,155,.95)';[[2,2],[6,6]].forEach(function(dot){context.beginPath();context.arc(dot[0],dot[1],1.25,0,Math.PI*2);context.fill();});glMap.addImage('orchard-dots',context.getImageData(0,0,8,8));glMap.addSource('orchard',{type:'geojson',data:{type:'Feature',geometry:{type:'Polygon',coordinates:[coordinates]}}});glMap.addLayer({id:'orchard-fill',type:'fill',source:'orchard',paint:{'fill-pattern':'orchard-dots','fill-opacity':.96}});glMap.addLayer({id:'orchard-outline',type:'line',source:'orchard',paint:{'line-color':'#ffffff','line-width':3}});var pointFeatures=initialPoints.filter(function(_,index){return index%Math.max(1,Math.ceil(initialPoints.length/8))===0;}).map(function(point,index,array){return {type:'Feature',properties:{active:index===Math.floor(array.length*.66)},geometry:{type:'Point',coordinates:[point.longitude,point.latitude]}};});glMap.addSource('orchard-points',{type:'geojson',data:{type:'FeatureCollection',features:pointFeatures}});glMap.addLayer({id:'orchard-points',type:'circle',source:'orchard-points',paint:{'circle-radius':['case',['get','active'],6,4.5],'circle-color':['case',['get','active'],'#7040c5','#ffffff'],'circle-stroke-color':'#ffffff','circle-stroke-width':2}});glMap.fitBounds(bounds,{padding:{top:125,bottom:145,left:70,right:70},maxZoom:16,duration:0});glMap.easeTo({pitch:72,bearing:-14,zoom:Math.max(11,glMap.getZoom()-.9),duration:900});glReady=true;if(perspectiveRequested)showPerspectiveMap();}catch(error){glReady=false;showLeafletMap();}});return true;}
  function setPerspective(enabled){perspectiveRequested=Boolean(enabled);if(!perspectiveRequested){showLeafletMap();return;}showLeafletMap();ensurePerspectiveMap();if(glReady)showPerspectiveMap();}
  function markFirstVertex(){setTimeout(function(){var vertices=document.querySelectorAll('.leaflet-marker-pane .leaflet-editing-icon');vertices.forEach(function(v){v.classList.remove('first-vertex');});if(vertices.length){vertices[0].classList.add('first-vertex');}},0);}
function sendPoints(points){window.parent.postMessage({source:'avotex-polygon-map',type:'polygon',points:points},'*');}
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
  window.addEventListener('message',function(event){if(event.data?.source!=='avotex-mapping-controls')return;if(event.data.action==='draw')startDrawing();if(event.data.action==='draw-fresh')startFreshDrawing();if(event.data.action==='edit')editDrawing();if(event.data.action==='finish-edit')finishEditing();if(event.data.action==='clear')clearDrawing();if(event.data.action==='perspective')setPerspective(event.data.enabled);});
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
  const t = useTranslations(translations);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const html = buildMapHTML(location.coords.latitude, location.coords.longitude, initialPolygon, preview);

  useImperativeHandle(ref, () => ({
    startDrawing: () => iframeRef.current?.contentWindow?.postMessage({ source: 'avotex-mapping-controls', action: 'draw' }, '*'),
    startFreshDrawing: () => iframeRef.current?.contentWindow?.postMessage({ source: 'avotex-mapping-controls', action: 'draw-fresh' }, '*'),
    editDrawing: () => iframeRef.current?.contentWindow?.postMessage({ source: 'avotex-mapping-controls', action: 'edit' }, '*'),
    finishEditing: () => iframeRef.current?.contentWindow?.postMessage({ source: 'avotex-mapping-controls', action: 'finish-edit' }, '*'),
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

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ source: 'avotex-mapping-controls', action: 'perspective', enabled: perspective }, '*');
  }, [perspective]);

  return (
    <iframe
      ref={iframeRef}
      title={t('mapTitle')}
      srcDoc={html}
      style={styles.map}
      allow="geolocation"
      onLoad={() => iframeRef.current?.contentWindow?.postMessage({ source: 'avotex-mapping-controls', action: 'perspective', enabled: perspective }, '*')}
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