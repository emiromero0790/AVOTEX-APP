/**
 * Mapa de Datos Satelitales (Leaflet + imágenes de Esri, la misma base que el resto de la app).
 *
 * Dibuja el perímetro REAL de la huerta y, encima, las zonas ilustrativas calculadas en la app
 * (services/satZones.ts): polígonos translúcidos, surcos, retícula de "+" y etiquetas "Zona A–D".
 * El HTML se carga una vez; los datos llegan después por window.avx.* para no recargar el mapa.
 */
import type { LatLng, ZoneColor, ZoneId } from '../services/satZones';
import { safeJson } from './scansMapHtml';

export type SatLayer = 'satelite' | 'zonas' | 'hibrido';

export type SatMapZone = {
  id: ZoneId;
  color: ZoneColor;
  ring: LatLng[];
  label: LatLng;
  rows: [LatLng, LatLng][];
  /** Texto corto para la vista híbrida (p. ej. "1.24 ha"). */
  areaText: string;
};

export type SatMapData = {
  /** Cambia al elegir otra huerta: el mapa vuela a ella y vuelve a trazar las zonas. */
  key: string;
  outline: LatLng[];
  zones: SatMapZone[];
  marks: [LatLng, LatLng][];
  /** Zonas tapadas por controles flotantes: el encuadre las evita. */
  pad: { top: number; right: number; bottom: number; left: number };
  reduced: boolean;
};

export const ZONE_PALETTE: Record<ZoneColor, { line: string; fill: string; label: string; ink: string }> = {
  cyan: { line: '#67E8F9', fill: '#22D3EE', label: '#5EEAD4', ink: '#042F2E' },
  yellow: { line: '#FDE047', fill: '#FACC15', label: '#FDE047', ink: '#3F2D04' },
  pink: { line: '#F9A8D4', fill: '#F472B6', label: '#F9A8D4', ink: '#4A0D2C' },
  green: { line: '#BEF264', fill: '#84CC16', label: '#BEF264', ink: '#1A2E05' },
};

export { safeJson };

export function buildSatMapHtml(): string {
  const palette = safeJson(ZONE_PALETTE);
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
html,body,#map{height:100%;width:100%;margin:0;background:#0b1f17}
.leaflet-container{background:#0b1f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-tap-highlight-color:transparent}
.leaflet-control-attribution{background:rgba(6,20,15,.6)!important;color:#a7b8ad!important;font-size:8px;border-radius:6px 0 0 0}
.leaflet-control-attribution a{color:#cfe0d4!important}
.shade{mix-blend-mode:multiply}
.zf{transition:fill-opacity .22s cubic-bezier(.23,1,.32,1),stroke-width .22s cubic-bezier(.23,1,.32,1),stroke-opacity .22s}
.in .zf,.in .zr,.in .zm{animation:fade .5s cubic-bezier(.23,1,.32,1) both}
.in .zr{animation-duration:.7s}
.draw{animation:draw 1s cubic-bezier(.77,0,.175,1) both}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes draw{to{stroke-dashoffset:0}}
.zlw{background:none;border:0}
.zl{position:absolute;transform:translate(-50%,-50%) scale(1);white-space:nowrap;padding:3px 7px;border-radius:6px;
  font-size:11px;font-weight:700;letter-spacing:.1px;box-shadow:0 2px 8px rgba(0,0,0,.35);
  transition:transform .2s cubic-bezier(.23,1,.32,1),box-shadow .2s;display:flex;align-items:center;gap:5px;cursor:pointer}
.zl small{font-weight:600;font-size:10px;opacity:.8}
.zl.sel{transform:translate(-50%,-50%) scale(1.12);box-shadow:0 0 0 2px #fff,0 4px 12px rgba(0,0,0,.45)}
.in .zl{animation:pop .35s cubic-bezier(.23,1,.32,1) both}
@keyframes pop{from{opacity:0;transform:translate(-50%,-50%) scale(.92)}to{opacity:1}}
.calm .zf,.calm .zr,.calm .zm,.calm .zl,.calm .draw{animation:none!important;transition:none!important}
@media (prefers-reduced-motion: reduce){.zf,.zr,.zm,.zl,.draw{animation:none!important;transition:none!important}}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
var PAL=${palette};
function post(m){var s=JSON.stringify(m);try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else if(window.parent!==window)window.parent.postMessage(s,'*');}catch(e){}}
if(typeof L==='undefined'){post({type:'error',message:'leaflet'});return;}
var map=L.map('map',{zoomControl:false,attributionControl:true,zoomSnap:.25}).setView([19.4,-102.05],14);
map.attributionControl.setPrefix(false);
var base='https://server.arcgisonline.com/ArcGIS/rest/services/';
var sat=L.tileLayer(base+'World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:18,maxZoom:20,attribution:'Imágenes © Esri'}).addTo(map);
var shade=L.tileLayer(base+'Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:16,maxZoom:20,opacity:.38,className:'shade',attribution:'Relieve © Esri'});
var labels=L.tileLayer(base+'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:18,maxZoom:20});
var roads=L.tileLayer(base+'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:18,maxZoom:20,opacity:.7});
map.createPane('zones').style.zIndex=410;
map.createPane('rows').style.zIndex=415;map.getPane('rows').style.pointerEvents='none';
map.createPane('outline').style.zIndex=430;map.getPane('outline').style.pointerEvents='none';
var zoneLayer=L.layerGroup(),rowLayer=L.layerGroup(),labelLayer=L.layerGroup(),outlineLayer=L.layerGroup().addTo(map);
var data=null,layer='zonas',selected=null,zonePaths={},zoneLabels={},lastKey=null;
function ll(p){return[p.lat,p.lng];}
function padOpts(){var p=(data&&data.pad)||{top:0,right:0,bottom:0,left:0};return{paddingTopLeft:[p.left+8,p.top+8],paddingBottomRight:[p.right+8,p.bottom+8],maxZoom:19};}
function bounds(){return data&&data.outline.length?L.latLngBounds(data.outline.map(ll)):null;}
function animOn(){return data&&!data.reduced;}
function styleFor(z){var c=PAL[z.color],sel=selected===z.id,dim=selected&&!sel;
  return{color:sel?'#ffffff':c.line,weight:sel?3:1.6,opacity:dim?.55:.95,fillColor:c.fill,fillOpacity:sel?.5:dim?.14:.36};}
function labelHtml(z){var c=PAL[z.color];var hy=layer==='hibrido';
  return '<div class="zl'+(selected===z.id?' sel':'')+'" style="background:'+c.label+';color:'+c.ink+'">Zona '+z.id+(hy?' <small>'+z.areaText+'</small>':'')+'</div>';}
function drawOutline(){outlineLayer.clearLayers();if(!data||data.outline.length<3)return;
  var pts=data.outline.map(ll);
  L.polygon(pts,{pane:'outline',color:'#000',opacity:.3,weight:6,fill:false,interactive:false}).addTo(outlineLayer);
  var line=L.polygon(pts,{pane:'outline',color:'#ffffff',weight:2.6,opacity:1,fill:false,interactive:false,lineJoin:'round'}).addTo(outlineLayer);
  var el=line.getElement&&line.getElement();
  if(el&&animOn()&&el.getTotalLength){var len=el.getTotalLength();el.style.strokeDasharray=len;el.style.strokeDashoffset=len;el.classList.add('draw');
    setTimeout(function(){el.style.strokeDasharray='';el.style.strokeDashoffset='';el.classList.remove('draw');},1100);}
}
function drawZones(animate){
  zoneLayer.clearLayers();rowLayer.clearLayers();labelLayer.clearLayers();zonePaths={};zoneLabels={};
  if(!data)return;
  var root=document.getElementById('map');
  root.classList.toggle('in',!!animate);
  data.zones.forEach(function(z,i){
    var c=PAL[z.color];
    var poly=L.polygon(z.ring.map(ll),Object.assign({pane:'zones',className:'zf',lineJoin:'round',bubblingMouseEvents:false},styleFor(z)));
    poly.on('click',function(e){L.DomEvent.stopPropagation(e);post({type:'select',id:z.id});});
    poly.addTo(zoneLayer);zonePaths[z.id]=poly;
    var el=poly.getElement&&poly.getElement();if(el&&animate)el.style.animationDelay=(250+i*110)+'ms';
    if(z.rows.length){var rows=L.polyline(z.rows.map(function(s){return[ll(s[0]),ll(s[1])];}),{pane:'rows',className:'zr',color:c.line,weight:1,opacity:.5,interactive:false}).addTo(rowLayer);
      var re=rows.getElement&&rows.getElement();if(re&&animate)re.style.animationDelay=(420+i*110)+'ms';}
    var mk=L.marker(ll(z.label),{icon:L.divIcon({className:'zlw',html:labelHtml(z),iconSize:[0,0]}),keyboard:false,zIndexOffset:500});
    mk.on('click',function(e){L.DomEvent.stopPropagation(e);post({type:'select',id:z.id});});
    mk.addTo(labelLayer);zoneLabels[z.id]={mk:mk,z:z};
    var le=mk.getElement&&mk.getElement();if(le&&animate){var inner=le.firstChild;if(inner)inner.style.animationDelay=(520+i*110)+'ms';}
  });
  if(data.marks.length){var m=L.polyline(data.marks.map(function(s){return[ll(s[0]),ll(s[1])];}),{pane:'rows',className:'zm',color:'#ffffff',weight:1.2,opacity:.55,interactive:false}).addTo(rowLayer);
    var me=m.getElement&&m.getElement();if(me&&animate)me.style.animationDelay='650ms';}
  if(animate)setTimeout(function(){root.classList.remove('in');},1600);
}
function applyLayer(){
  var zonesOn=layer!=='satelite';
  [zoneLayer,rowLayer,labelLayer].forEach(function(g){if(zonesOn&&!map.hasLayer(g))g.addTo(map);if(!zonesOn&&map.hasLayer(g))map.removeLayer(g);});
  var hy=layer==='hibrido';
  [shade,roads,labels].forEach(function(t){if(hy&&!map.hasLayer(t))t.addTo(map);if(!hy&&map.hasLayer(t))map.removeLayer(t);});
  Object.keys(zoneLabels).forEach(function(id){var x=zoneLabels[id];x.mk.setIcon(L.divIcon({className:'zlw',html:labelHtml(x.z),iconSize:[0,0]}));});
}
map.on('click',function(){post({type:'clear'});});
window.avx={
  setData:function(d){
    var fresh=!data||d.key!==lastKey;data=d;lastKey=d.key;
    document.getElementById('map').classList.toggle('calm',!!d.reduced);
    if(fresh)selected=null;
    var b=bounds();
    if(b&&fresh){if(animOn()&&map._loaded&&lastFit){map.flyToBounds(b,Object.assign(padOpts(),{duration:.8}));}else{map.fitBounds(b,padOpts());}lastFit=true;}
    drawOutline();drawZones(fresh&&animOn());applyLayer();
  },
  setLayer:function(name){if(name!=='satelite'&&name!=='zonas'&&name!=='hibrido')return;layer=name;applyLayer();},
  select:function(id){selected=id||null;
    if(!data)return;
    data.zones.forEach(function(z){var p=zonePaths[z.id];if(p){p.setStyle(styleFor(z));if(selected===z.id)p.bringToFront();}});
    Object.keys(zoneLabels).forEach(function(k){var x=zoneLabels[k];x.mk.setIcon(L.divIcon({className:'zlw',html:labelHtml(x.z),iconSize:[0,0]}));x.mk.setZIndexOffset(k===selected?900:500);});
  },
  zoom:function(d){d>0?map.zoomIn():map.zoomOut();},
  fit:function(){var b=bounds();if(b)map.flyToBounds(b,Object.assign(padOpts(),{duration:animOn()?.6:0.01}));}
};
var lastFit=false;
post({type:'ready'});
})();
</script></body></html>`;
}
