/**
 * Mapa del editor de zonas (Mapeo › Editar › Editar zonas). Leaflet + imágenes de Esri, como Satélite.
 *
 * - Muestra el contorno real de la huerta, las zonas A–D calculadas en la app (services/satZones.ts)
 *   y las líneas de corte que las forman.
 * - Un dedo: traza una línea nueva (se manda a la app con {type:'cut', a, b}; la app decide si divide).
 * - Dos dedos: acercar/alejar. El mapa no se arrastra para que el trazo no lo mueva.
 * - Un toque sobre una línea la selecciona ({type:'select', index}); un toque fuera la deselecciona.
 * Los datos llegan por window.avz.setData(...) sin recargar el mapa.
 */
import type { LatLng, ZoneColor, ZoneId } from '../services/satZones';
import { ZONE_PALETTE } from './satMapHtml';
import { safeJsonValue as safeJson } from './safeJson';

export type ZoneEditorData = {
  /** Cambia al abrir otra huerta: el mapa vuelve a encuadrar. */
  key: string;
  outline: LatLng[];
  zones: { id: ZoneId; color: ZoneColor; ring: LatLng[]; label: LatLng; share: number }[];
  cuts: { a: LatLng; b: LatLng }[];
  selected: number | null;
  /** Zonas tapadas por controles flotantes: el encuadre las evita. */
  pad: { top: number; right: number; bottom: number; left: number };
};

export type ZoneEditorMessage =
  | { type: 'ready' }
  | { type: 'error' }
  | { type: 'cut'; a: LatLng; b: LatLng }
  | { type: 'select'; index: number | null };

export function parseZoneEditorMessage(raw: unknown): ZoneEditorMessage | null {
  let m: unknown = raw;
  if (typeof m === 'string') { try { m = JSON.parse(m); } catch { return null; } }
  if (!m || typeof m !== 'object') return null;
  const o = m as Record<string, unknown>;
  const pt = (v: unknown): LatLng | null => {
    const p = v as { lat?: unknown; lng?: unknown } | null;
    return p && typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng)
      ? { lat: p.lat, lng: p.lng } : null;
  };
  if (o.type === 'ready' || o.type === 'error') return { type: o.type };
  if (o.type === 'cut') { const a = pt(o.a), b = pt(o.b); return a && b ? { type: 'cut', a, b } : null; }
  if (o.type === 'select') return { type: 'select', index: typeof o.index === 'number' && o.index >= 0 ? o.index : null };
  return null;
}

export function buildZoneEditorHtml(): string {
  const palette = safeJson(ZONE_PALETTE);
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
html,body,#map{height:100%;width:100%;margin:0;background:#0b1f17;overscroll-behavior:none}
#map{touch-action:none;-webkit-user-select:none;user-select:none}
.leaflet-container{background:#0b1f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-tap-highlight-color:transparent;cursor:crosshair}
.leaflet-control-attribution{background:rgba(6,20,15,.6)!important;color:#a7b8ad!important;font-size:8px;border-radius:6px 0 0 0}
.zl{transform:translate(-50%,-50%);white-space:nowrap;padding:4px 10px;border-radius:12px;font-size:13px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none}
.zl small{font-weight:600;opacity:.8;margin-left:3px;font-size:11px}
.reject{animation:reject .55s ease-out forwards}
@keyframes reject{0%{opacity:1}100%{opacity:0}}
</style></head>
<body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
var PAL=${palette};
function post(m){var s=JSON.stringify(m);try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else if(window.parent!==window)window.parent.postMessage(s,'*');}catch(e){}}
if(typeof L==='undefined'){post({type:'error'});return;}
var map=L.map('map',{zoomControl:false,attributionControl:true,zoomSnap:.25,dragging:false,doubleClickZoom:false,boxZoom:false,keyboard:false,scrollWheelZoom:true,touchZoom:true,tap:false}).setView([19.4,-102.05],15);
map.attributionControl.setPrefix(false);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:18,maxZoom:21,attribution:'Imágenes © Esri'}).addTo(map);
map.createPane('zones').style.zIndex=410;map.getPane('zones').style.pointerEvents='none';
map.createPane('cuts').style.zIndex=430;map.getPane('cuts').style.pointerEvents='none';
map.createPane('draw').style.zIndex=440;map.getPane('draw').style.pointerEvents='none';
var zoneLayer=L.layerGroup().addTo(map),cutLayer=L.layerGroup().addTo(map),drawLayer=L.layerGroup().addTo(map);
var data=null,lastKey=null;
function ll(p){return[p.lat,p.lng];}
function fit(){if(!data||data.outline.length<3)return;var p=data.pad||{top:0,right:0,bottom:0,left:0};
  map.fitBounds(L.latLngBounds(data.outline.map(ll)),{paddingTopLeft:[p.left+16,p.top+16],paddingBottomRight:[p.right+16,p.bottom+16],maxZoom:20,animate:false});}
function draw(){
  zoneLayer.clearLayers();cutLayer.clearLayers();
  if(!data)return;
  data.zones.forEach(function(z){var c=PAL[z.color];
    L.polygon(z.ring.map(ll),{pane:'zones',color:c.line,weight:1.5,opacity:.9,fillColor:c.fill,fillOpacity:.32,interactive:false}).addTo(zoneLayer);
    L.marker(ll(z.label),{pane:'zones',interactive:false,keyboard:false,icon:L.divIcon({className:'',iconSize:[0,0],html:'<div class="zl" style="background:'+c.label+';color:'+c.ink+'">Zona '+z.id+' <small>'+Math.round(z.share)+'%</small></div>'})}).addTo(zoneLayer);
  });
  if(data.outline.length>=3){var o=data.outline.map(ll);
    L.polygon(o,{pane:'zones',color:'#000',opacity:.35,weight:6,fill:false,interactive:false}).addTo(zoneLayer);
    L.polygon(o,{pane:'zones',color:'#ffffff',opacity:.95,weight:2.5,fill:false,interactive:false}).addTo(zoneLayer);}
  data.cuts.forEach(function(c,i){var sel=data.selected===i;var pts=[ll(c.a),ll(c.b)];
    L.polyline(pts,{pane:'cuts',color:'#000',opacity:.45,weight:sel?9:6,interactive:false}).addTo(cutLayer);
    L.polyline(pts,{pane:'cuts',color:sel?'#B9F62F':'#ffffff',weight:sel?5:3,dashArray:sel?null:'10 8',interactive:false}).addTo(cutLayer);
    [c.a,c.b].forEach(function(p){L.circleMarker(ll(p),{pane:'cuts',radius:sel?7:5,color:'#000',weight:1.5,fillColor:sel?'#B9F62F':'#ffffff',fillOpacity:1,interactive:false}).addTo(cutLayer);});
  });
}
// ── Trazo con un dedo; dos dedos = zoom (se cancela el trazo) ──
var el=map.getContainer(),pointers={},start=null,cur=null,preview=null,drawing=false;
function count(){return Object.keys(pointers).length;}
function pt(e){var r=el.getBoundingClientRect();return L.point(e.clientX-r.left,e.clientY-r.top);}
function clearPreview(){if(preview){drawLayer.removeLayer(preview.halo);drawLayer.removeLayer(preview.line);preview=null;}}
function cancel(){drawing=false;start=null;cur=null;clearPreview();}
el.addEventListener('pointerdown',function(e){pointers[e.pointerId]=1;
  if(count()>1){cancel();return;}
  if(e.button!==undefined&&e.button!==0)return;
  drawing=true;start=pt(e);cur=start;},true);
el.addEventListener('pointermove',function(e){if(!drawing||count()>1)return;cur=pt(e);
  if(start.distanceTo(cur)<6)return;
  var a=map.containerPointToLatLng(start),b=map.containerPointToLatLng(cur);
  if(!preview){preview={halo:L.polyline([a,b],{pane:'draw',color:'#000',opacity:.45,weight:8,interactive:false}).addTo(drawLayer),
    line:L.polyline([a,b],{pane:'draw',color:'#B9F62F',weight:4,interactive:false}).addTo(drawLayer)};}
  else{preview.halo.setLatLngs([a,b]);preview.line.setLatLngs([a,b]);}
  e.preventDefault();},true);
function end(e){var was=drawing&&count()===1;delete pointers[e.pointerId];
  if(!was){if(count()===0)cancel();return;}
  var s=start,c=cur||start;drawing=false;
  if(s.distanceTo(c)>=24){var a=map.containerPointToLatLng(s),b=map.containerPointToLatLng(c);
    post({type:'cut',a:{lat:a.lat,lng:a.lng},b:{lat:b.lat,lng:b.lng}});
    // La vista previa se queda hasta que la app responda (setData si se acepta, reject si no).
  }else{clearPreview();tap(c);}
  start=null;cur=null;}
el.addEventListener('pointerup',end,true);
el.addEventListener('pointercancel',function(e){delete pointers[e.pointerId];cancel();},true);
function segDist(p,a,b){var dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;return p.distanceTo(L.point(a.x+t*dx,a.y+t*dy));}
function tap(p){if(!data)return;var best=-1,bd=22;
  data.cuts.forEach(function(c,i){var d=segDist(p,map.latLngToContainerPoint(ll(c.a)),map.latLngToContainerPoint(ll(c.b)));if(d<bd){bd=d;best=i;}});
  post({type:'select',index:best>=0?best:null});}
window.avz={
  setData:function(d){data=d;clearPreview();draw();if(d.key!==lastKey){lastKey=d.key;fit();}},
  reject:function(){if(!preview)return;var p=preview;preview=null;
    p.line.setStyle({color:'#F87171'});var e1=p.line.getElement(),e2=p.halo.getElement();
    if(e1)e1.classList.add('reject');if(e2)e2.classList.add('reject');
    setTimeout(function(){drawLayer.removeLayer(p.line);drawLayer.removeLayer(p.halo);},560);},
  fit:fit,
  zoom:function(d){map.setZoom(map.getZoom()+d);}
};
post({type:'ready'});
})();
</script></body></html>`;
}
