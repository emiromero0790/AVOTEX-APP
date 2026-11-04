/** HTML del mapa de un recorrido (Leaflet + imágenes Esri, como el resto de la app). */
export type RecorridoMapPoint = { lat: number; lng: number };
export type RecorridoMapMarker = { id: string; lat: number; lng: number; healthy: boolean; label: string };

export type RecorridoMapProps = {
  route: RecorridoMapPoint[];
  markers: RecorridoMapMarker[];
  polygon?: RecorridoMapPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function buildRecorridoMapHtml(props: Pick<RecorridoMapProps, 'route' | 'markers' | 'polygon'>): string {
  const data = safeJson({ route: props.route, markers: props.markers, polygon: props.polygon ?? [] });
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#map{height:100%;width:100%;margin:0;background:#dbe9df}
.mk{width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45)}
.mk.bad{background:#dc2626}.mk.ok{background:#16a34a}
.mk.sel{transform:scale(1.45);box-shadow:0 0 0 4px rgba(255,255,255,.55),0 2px 8px rgba(0,0,0,.5)}
.leaflet-tooltip{font:600 11px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var D=${data};
var map=L.map('map',{zoomControl:true,attributionControl:true});
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'}).addTo(map);
var bounds=[];
if(D.polygon.length>2){var pg=L.polygon(D.polygon.map(function(p){return [p.lat,p.lng]}),{color:'#ffffff',weight:2,fillColor:'#34d399',fillOpacity:.15,dashArray:'6 6'}).addTo(map);bounds=bounds.concat(D.polygon.map(function(p){return [p.lat,p.lng]}));}
if(D.route.length>1){var ll=D.route.map(function(p){return [p.lat,p.lng]});L.polyline(ll,{color:'#0f766e',weight:7,opacity:.55}).addTo(map);L.polyline(ll,{color:'#a7f3d0',weight:3,opacity:.95}).addTo(map);bounds=bounds.concat(ll);
  L.circleMarker(ll[0],{radius:6,color:'#fff',weight:2,fillColor:'#0f766e',fillOpacity:1}).bindTooltip('Inicio').addTo(map);}
var markers={};
function send(msg){var s=JSON.stringify(msg);if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(s)}else if(window.parent){window.parent.postMessage(s,'*')}}
D.markers.forEach(function(m){var icon=L.divIcon({className:'',html:'<div class="mk '+(m.healthy?'ok':'bad')+'" id="mk-'+m.id+'"></div>',iconSize:[18,18],iconAnchor:[9,9]});
  var mk=L.marker([m.lat,m.lng],{icon:icon}).bindTooltip(m.label,{direction:'top',offset:[0,-10]}).addTo(map);
  mk.on('click',function(){send({type:'select',id:m.id})});markers[m.id]=mk;bounds.push([m.lat,m.lng]);});
if(bounds.length){map.fitBounds(bounds,{padding:[28,28],maxZoom:19})}else{map.setView([19.43,-99.13],5)}
window.selectHallazgo=function(id){document.querySelectorAll('.mk').forEach(function(e){e.classList.remove('sel')});var el=document.getElementById('mk-'+id);if(el)el.classList.add('sel');var mk=markers[id];if(mk){map.panTo(mk.getLatLng())}};
</script></body></html>`;
}
