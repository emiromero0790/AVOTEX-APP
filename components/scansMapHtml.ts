/**
 * Mapa de "Mis escaneos" (Leaflet + imágenes satelitales Esri, la misma base que el resto de la app).
 *
 * Solo dibuja datos reales: polígonos de las huertas del usuario, marcadores en la ubicación
 * guardada de cada escaneo, la ruta y los hallazgos del escaneo seleccionado, y la ubicación
 * actual del usuario si dio permiso. El HTML se carga una vez; los datos se envían después con
 * window.avx.* para no recargar el mapa en cada cambio.
 */
export type ScansMapPoint = { lat: number; lng: number };
export type ScanStatus = 'listo' | 'proceso' | 'cola' | 'local' | 'error';
export type ScansMapMarker = { id: string; lat: number; lng: number; status: ScanStatus; n: number };
export type ScansMapPolygon = { id: string; name: string; points: ScansMapPoint[] };
export type ScansMapFinding = { lat: number; lng: number; healthy: boolean };
export type ScansMapLayer = 'satelite' | 'hibrido' | 'mapa';

export type ScansMapData = {
  polygons: ScansMapPolygon[];
  markers: ScansMapMarker[];
  /** Zonas tapadas por el encabezado y el panel: el encuadre las evita. */
  pad?: { top: number; bottom: number; right: number };
};

export const SCAN_STATUS_COLOR: Record<ScanStatus, string> = {
  listo: '#A3E635',
  proceso: '#FBBF24',
  cola: '#FCD34D',
  local: '#38BDF8',
  error: '#F87171',
};

export function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function buildScansMapHtml(): string {
  const colors = safeJson(SCAN_STATUS_COLOR);
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
html,body,#map{height:100%;width:100%;margin:0;background:#e5e7eb}
.leaflet-container{background:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.leaflet-control-attribution{background:rgba(255,255,255,.75)!important;color:#475569!important;font-size:9px}
.leaflet-control-attribution a{color:#334155!important}
.pin{position:relative;width:38px;height:46px;transform-origin:50% 100%;transition:transform .2s cubic-bezier(.23,1,.32,1)}
.pin .head{position:absolute;left:3px;top:0;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
  border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.45)}
.pin .ico{position:absolute;left:3px;top:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center}
.pin .num{position:absolute;left:0;right:0;top:36px;text-align:center;color:#fff;font-size:11px;font-weight:700;text-shadow:0 1px 3px rgba(0,0,0,.9)}
.pin.sel{transform:scale(1.25)}
.pin.sel::after{content:'';position:absolute;left:-6px;top:-6px;width:46px;height:46px;border-radius:50%;
  border:2px solid rgba(255,255,255,.85);animation:ring 1.6s cubic-bezier(.23,1,.32,1) infinite}
@keyframes ring{from{transform:scale(.6);opacity:.9}to{transform:scale(1.5);opacity:0}}
.me{width:18px;height:18px;border-radius:50%;background:#38bdf8;border:3px solid #fff;box-shadow:0 0 0 6px rgba(56,189,248,.25),0 2px 8px rgba(0,0,0,.45)}
.f{width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)}
.f.ok{background:#22c55e}.f.bad{background:#ef4444}
.zone{background:transparent;border:0;box-shadow:none;color:#ecfccb;font-size:11px;font-weight:700;text-shadow:0 1px 3px rgba(0,0,0,.9)}
.zone::before{display:none}
@media (prefers-reduced-motion: reduce){.pin.sel::after{animation:none}.pin{transition:none}}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
var COLORS=${colors};
function post(m){var s=JSON.stringify(m);try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else if(window.parent!==window)window.parent.postMessage(s,'*');}catch(e){}}
if(typeof L==='undefined'){post({type:'error',message:'leaflet'});return;}
var map=L.map('map',{zoomControl:false,attributionControl:true}).setView([19.4,-102.05],9);
var esri='Imágenes © Esri';
var layers={
  satelite:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:esri}),
  labels:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:19}),
  mapa:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Mapa © Esri'})
};
var current='satelite';layers.satelite.addTo(map);
var polyLayer=L.layerGroup().addTo(map),markerLayer=L.layerGroup().addTo(map),detailLayer=L.layerGroup().addTo(map),meLayer=L.layerGroup().addTo(map);
var markers={},data={polygons:[],markers:[]},selected=null,fitted=false,pad={top:0,bottom:0,right:0};
var leaf='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0b1a05" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>';
function pinHtml(m,sel){var c=COLORS[m.status]||'#fff';return '<div class="pin'+(sel?' sel':'')+'"><div class="head" style="background:'+c+'"></div><div class="ico">'+leaf+'</div><div class="num">'+m.n+'</div></div>';}
function icon(m,sel){return L.divIcon({className:'',html:pinHtml(m,sel),iconSize:[38,46],iconAnchor:[19,44]});}
function fitOpts(anim){return {paddingTopLeft:[24,pad.top+16],paddingBottomRight:[pad.right+16,pad.bottom+16],maxZoom:17,animate:anim};}
/* Centra un punto en la zona visible (entre el encabezado y el panel), no en el centro del mapa. */
function flyVisible(latlng,zoom){var z=Math.max(map.getZoom(),zoom);var p=map.project(latlng,z).add([pad.right/2,(pad.bottom-pad.top)/2]);map.flyTo(map.unproject(p,z),z,{duration:.8});}
function boundsOf(){var b=L.latLngBounds([]);data.polygons.forEach(function(p){p.points.forEach(function(q){b.extend([q.lat,q.lng]);});});data.markers.forEach(function(m){b.extend([m.lat,m.lng]);});return b;}
function draw(){
  polyLayer.clearLayers();markerLayer.clearLayers();markers={};
  data.polygons.forEach(function(p){if(p.points.length<3)return;
    var poly=L.polygon(p.points.map(function(q){return[q.lat,q.lng];}),{color:'#bef264',weight:2,opacity:.95,fillColor:'#84cc16',fillOpacity:.22});
    poly.bindTooltip(p.name,{permanent:true,direction:'center',className:'zone'});poly.addTo(polyLayer);});
  data.markers.forEach(function(m){var mk=L.marker([m.lat,m.lng],{icon:icon(m,m.id===selected),keyboard:false,zIndexOffset:m.id===selected?1000:0});
    mk.on('click',function(e){L.DomEvent.stopPropagation(e);post({type:'select',id:m.id});});mk.addTo(markerLayer);markers[m.id]={mk:mk,m:m};});
  if(!fitted){var b=boundsOf();if(b.isValid()){map.fitBounds(b,fitOpts(false));fitted=true;}}
}
map.on('click',function(){post({type:'clear'});});
window.avx={
  setData:function(d){data=d||{polygons:[],markers:[]};if(d&&d.pad)pad=d.pad;draw();},
  select:function(id,fly){var prev=selected;selected=id||null;
    if(prev&&markers[prev]){markers[prev].mk.setIcon(icon(markers[prev].m,false));markers[prev].mk.setZIndexOffset(0);}
    if(selected&&markers[selected]){var x=markers[selected];x.mk.setIcon(icon(x.m,true));x.mk.setZIndexOffset(1000);
      if(fly){flyVisible(L.latLng(x.m.lat,x.m.lng),17);}}
    if(!selected)detailLayer.clearLayers();},
  setDetail:function(route,findings){detailLayer.clearLayers();
    if(route&&route.length>1){L.polyline(route.map(function(p){return[p.lat,p.lng];}),{color:'#ffffff',weight:3,opacity:.9,dashArray:'2 8',lineCap:'round'}).addTo(detailLayer);}
    (findings||[]).forEach(function(f){L.marker([f.lat,f.lng],{icon:L.divIcon({className:'',html:'<div class="f '+(f.healthy?'ok':'bad')+'"></div>',iconSize:[12,12],iconAnchor:[6,6]}),interactive:false}).addTo(detailLayer);});},
  setLayer:function(name){if(!layers[name]&&name!=='hibrido')return;
    [layers.satelite,layers.labels,layers.mapa].forEach(function(l){if(map.hasLayer(l))map.removeLayer(l);});
    if(name==='mapa')layers.mapa.addTo(map);else{layers.satelite.addTo(map);if(name==='hibrido')layers.labels.addTo(map);}current=name;},
  zoom:function(d){d>0?map.zoomIn():map.zoomOut();},
  showUser:function(lat,lng,fly){meLayer.clearLayers();L.marker([lat,lng],{icon:L.divIcon({className:'',html:'<div class="me"></div>',iconSize:[18,18],iconAnchor:[9,9]}),interactive:false}).addTo(meLayer);
    if(fly)flyVisible(L.latLng(lat,lng),16);},
  fitAll:function(){var b=boundsOf();if(b.isValid())map.flyToBounds(b,Object.assign(fitOpts(true),{duration:.8}));}
};
post({type:'ready'});
})();
</script></body></html>`;
}
