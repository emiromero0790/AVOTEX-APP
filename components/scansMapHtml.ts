/**
 * Mapa de "Mis escaneos" (Leaflet + imágenes satelitales de Esri, la misma base que el resto de la app).
 *
 * Solo dibuja datos reales y cada cosa con su propio lenguaje visual:
 * - Huertas: perímetro real (huertas.coordinates) en verde lima con su nombre.
 * - Recorridos: todas las rutas GPS (recorridos.ruta) en teal tenue; la elegida, resaltada, con inicio
 *   (flecha), fin (bandera), dirección de avance y puntos de captura (recorrido_fotos.lat/lng).
 * - Hallazgos (hallazgos.lat/lng): forma y color por categoría — círculo coral (posible enfermedad),
 *   rombo ámbar (revisar), cuadro verde (saludable), punto gris (no es fruto).
 * - Pines y fotos cercanos se agrupan con un número; al acercar se separan.
 * - Capa "Zonas": subdivisión ILUSTRATIVA de cada huerta (services/satZones.ts), igual que en Satélite.
 * El HTML se carga una vez; los datos llegan con window.avx.* (no se recarga el WebView).
 */
import { safeJsonValue } from './safeJson';
import { ZONE_PALETTE } from './satMapHtml';

export type ScansMapPoint = { lat: number; lng: number };
export type ScanStatus = 'listo' | 'proceso' | 'cola' | 'local' | 'error';
export type ScansMapLayer = 'satelite' | 'hibrido' | 'zonas';
export type FindingCat = 'sano' | 'enfermo' | 'revisar' | 'otro';

export type ScansMapOrchard = { id: string; name: string; points: ScansMapPoint[] };
export type ScansMapScan = { id: string; kind: 'recorrido' | 'foto'; status: ScanStatus; lat: number; lng: number };
export type ScansMapRoute = { id: string; points: ScansMapPoint[] };
export type ScansMapZone = { key: string; label: string; color: string; ring: ScansMapPoint[]; at: ScansMapPoint };
export type ScansMapDetail = {
  id: string;
  route: ScansMapPoint[];
  photos: { id: string; lat: number; lng: number; n: number }[];
  findings: { id: string; lat: number; lng: number; cat: FindingCat }[];
  /** Perímetro de su huerta, para encuadrar el terreno junto con la ruta. */
  orchard: ScansMapPoint[];
};
export type ScansMapShow = { routes: boolean; photos: boolean; findings: boolean; orchards: boolean };

export type ScansMapData = {
  orchards: ScansMapOrchard[];
  /** Pines, del más reciente al más antiguo (al agrupar, se elige el más reciente). */
  scans: ScansMapScan[];
  routes: ScansMapRoute[];
  zones: ScansMapZone[];
  focusOrchard: string | null;
  /** Cambia cuando cambia lo que hay que encuadrar (huerta elegida o filtros). */
  fitKey: string;
  pad: { top: number; right: number; bottom: number; left: number };
  show: ScansMapShow;
  reduced: boolean;
};

export const SCAN_STATUS_COLOR: Record<ScanStatus, string> = {
  listo: '#22C55E',
  proceso: '#F59E0B',
  cola: '#F59E0B',
  local: '#0EA5E9',
  error: '#EF4444',
};

export const FINDING_COLOR: Record<FindingCat, string> = {
  sano: '#22C55E',
  enfermo: '#F2545B',
  revisar: '#F59E0B',
  otro: '#94A3B8',
};

export const safeJson = safeJsonValue;

export function buildScansMapHtml(): string {
  const colors = safeJson(SCAN_STATUS_COLOR);
  const fcolors = safeJson(FINDING_COLOR);
  const zpal = safeJson(ZONE_PALETTE);
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
html,body,#map{height:100%;width:100%;margin:0;background:#dfe7e1}
.leaflet-container{background:#dfe7e1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-tap-highlight-color:transparent}
.leaflet-control-attribution{background:rgba(255,255,255,.7)!important;color:#475569!important;font-size:8px;border-radius:6px 0 0 0}
.leaflet-control-attribution a{color:#334155!important}
.leaflet-control-scale{margin:0 0 10px 12px!important}
.leaflet-control-scale-line{border:2px solid #fff;border-top:0;color:#fff;background:transparent;font-size:10px;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,.8);box-shadow:0 1px 0 rgba(0,0,0,.25)}
.orch{background:rgba(255,255,255,.9);border:0;border-radius:999px;box-shadow:0 1px 4px rgba(0,0,0,.25);color:#365314;font-size:10.5px;font-weight:700;padding:2px 9px}
.orch::before{display:none}
.zl{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;padding:2px 7px;border-radius:6px;font-size:10.5px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.3)}
.pin{position:relative;width:30px;height:38px;transform-origin:50% 100%;transition:transform .2s cubic-bezier(.23,1,.32,1),opacity .2s}
.pin .h{position:absolute;left:2px;top:0;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.4)}
.pin .i{position:absolute;left:1px;top:-1px;width:30px;height:30px;display:flex;align-items:center;justify-content:center}
.pin.sel{transform:scale(1.18)}
.pin.dim{opacity:.4;transform:scale(.82)}
.pin.sel::after{content:'';position:absolute;left:-5px;top:-6px;width:40px;height:40px;border-radius:50%;border:2px solid rgba(255,255,255,.9);animation:ring 1.6s cubic-bezier(.23,1,.32,1) infinite}
@keyframes ring{from{transform:scale(.6);opacity:.9}to{transform:scale(1.45);opacity:0}}
.cl{min-width:30px;height:30px;padding:0 6px;box-sizing:border-box;border-radius:15px;display:flex;align-items:center;justify-content:center;gap:3px;background:#0f766e;color:#fff;font-size:12px;font-weight:800;border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.4)}
.cl.dim{opacity:.45}
.pc{min-width:22px;height:22px;padding:0 5px;box-sizing:border-box;border-radius:11px;display:flex;align-items:center;justify-content:center;background:#fff;color:#0f766e;font-size:11px;font-weight:800;border:2px solid #14b8a6;box-shadow:0 2px 6px rgba(0,0,0,.35)}
.se{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.45)}
.st{background:#0f766e}.en{background:#fff}
.ph{width:22px;height:22px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.4);border:1.5px solid #14b8a6;transition:transform .15s}
.ph.on{transform:scale(1.35);border-color:#0f766e;box-shadow:0 0 0 3px rgba(20,184,166,.45),0 2px 6px rgba(0,0,0,.4)}
.fd{width:26px;height:26px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 7px rgba(0,0,0,.45);transition:transform .15s;box-sizing:border-box}
.fd.c{border-radius:50%}.fd.q{border-radius:7px}.fd.d{transform:rotate(45deg);border-radius:5px;width:23px;height:23px}.fd.d svg{transform:rotate(-45deg)}.fd.o{width:18px;height:18px;border-radius:50%}
.fd.on{box-shadow:0 0 0 3px rgba(255,255,255,.8),0 3px 9px rgba(0,0,0,.5)}
.fd.c.on,.fd.q.on,.fd.o.on{transform:scale(1.3)}.fd.d.on{transform:rotate(45deg) scale(1.3)}
.ar{width:14px;height:14px;display:flex;align-items:center;justify-content:center}
.me{width:16px;height:16px;border-radius:50%;background:#38bdf8;border:3px solid #fff;box-shadow:0 0 0 6px rgba(56,189,248,.25),0 2px 8px rgba(0,0,0,.45)}
.in{animation:pop .3s cubic-bezier(.23,1,.32,1) both}
@keyframes pop{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
.fade{animation:fade .45s cubic-bezier(.23,1,.32,1) both}
@keyframes fade{from{opacity:0}to{opacity:1}}
.calm .pin,.calm .in,.calm .fade,.calm .pin.sel::after{animation:none!important;transition:none!important}
@media (prefers-reduced-motion: reduce){.pin,.in,.fade,.pin.sel::after{animation:none!important;transition:none!important}}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
var COLORS=${colors},FC=${fcolors},ZP=${zpal};
function post(m){var s=JSON.stringify(m);try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else if(window.parent!==window)window.parent.postMessage(s,'*');}catch(e){}}
if(typeof L==='undefined'){post({type:'error',message:'leaflet'});return;}
var MAXZ=22;
var map=L.map('map',{zoomControl:false,attributionControl:true,zoomSnap:.25,maxZoom:MAXZ}).setView([19.4,-102.05],9);
map.attributionControl.setPrefix(false);
L.control.scale({imperial:false,position:'bottomleft',maxWidth:110}).addTo(map);
var base='https://server.arcgisonline.com/ArcGIS/rest/services/';
// z18 existe en todas partes; más cerca se amplía (z19 falta en algunas zonas y sale un recuadro gris).
L.tileLayer(base+'World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:18,maxZoom:MAXZ,attribution:'Imágenes © Esri'}).addTo(map);
var labels=L.tileLayer(base+'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:18,maxZoom:MAXZ});
var roads=L.tileLayer(base+'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:18,maxZoom:MAXZ,opacity:.75});
map.createPane('zones').style.zIndex=405;
map.createPane('routes').style.zIndex=420;
map.createPane('route').style.zIndex=440;
var zoneLayer=L.layerGroup().addTo(map),orchLayer=L.layerGroup().addTo(map),routeLayer=L.layerGroup().addTo(map),scanLayer=L.layerGroup().addTo(map),
    detailLayer=L.layerGroup().addTo(map),photoLayer=L.layerGroup().addTo(map),meLayer=L.layerGroup().addTo(map);
var data=null,selected=null,detail=null,pointMarkers={},active=null,lastFitKey=null,loaded=false,pendingFit=false,popped={};
var I={
 route:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>',
 cam:function(c,s){return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="'+c+'" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';},
 nav:'<svg width="15" height="15" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',
 flag:'<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="1" width="1.6" height="14" fill="#111"/><g fill="#111"><rect x="4" y="2" width="3" height="3"/><rect x="10" y="2" width="3" height="3"/><rect x="7" y="5" width="3" height="3"/><rect x="13" y="5" width="1.5" height="3"/><rect x="4" y="8" width="3" height="3"/><rect x="10" y="8" width="3" height="3"/></g><rect x="3.6" y="2" width="11" height="9" fill="none" stroke="#111" stroke-width=".8"/></svg>',
 bug:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3 3 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>',
 leaf:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
 warn:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M12 6v8"/><path d="M12 18h.01"/></svg>',
 x:'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
 arrow:'<svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" stroke="#0f766e" stroke-width="2" stroke-linejoin="round"><path d="M12 3 20 20 12 15 4 20Z"/></svg>'
};
function ll(p){return[p.lat,p.lng];}
function anim(){return data&&!data.reduced;}
function show(k){return !data||!data.show||data.show[k]!==false;}
function padOpts(maxZ){var p=(data&&data.pad)||{top:0,right:0,bottom:0,left:0};return{paddingTopLeft:[p.left+20,p.top+20],paddingBottomRight:[p.right+20,p.bottom+20],maxZoom:maxZ||18};}
function minSpan(b,m){if(!b||!b.isValid())return b;var c=b.getCenter(),n=b.getNorthEast(),sw=b.getSouthWest();
  var h=(n.lat-sw.lat)*111320,w=(n.lng-sw.lng)*111320*Math.cos(c.lat*Math.PI/180);if(h>=m||w>=m)return b;
  var dl=m/2/111320,dg=m/2/(111320*Math.cos(c.lat*Math.PI/180));return L.latLngBounds([c.lat-dl,c.lng-dg],[c.lat+dl,c.lng+dg]);}
function go(b,maxZ){if(!b||!b.isValid())return;var o=padOpts(maxZ);if(anim()&&loaded){map.flyToBounds(b,Object.assign(o,{duration:.8}));}else{map.fitBounds(b,o);}loaded=true;}
function centerOn(latlng,minZ){var z=Math.max(map.getZoom(),minZ),pd=data.pad,pt=map.project(latlng,z).add([(pd.right-pd.left)/2,(pd.bottom-pd.top)/2]);
  if(anim())map.flyTo(map.unproject(pt,z),z,{duration:.6});else map.setView(map.unproject(pt,z),z);}
// Agrupa puntos que en pantalla quedan a menos de "px" píxeles (al zoom actual).
function cluster(items,px){var out=[];items.forEach(function(it){var p=map.latLngToLayerPoint([it.lat,it.lng]),hit=null;
  for(var i=0;i<out.length;i++){if(out[i].p.distanceTo(p)<px){hit=out[i];break;}}
  if(hit){hit.items.push(it);}else out.push({p:p,items:[it]});});return out;}
function boundsOf(items){var b=L.latLngBounds([]);items.forEach(function(i){b.extend([i.lat,i.lng]);});return b;}
function expandOrPick(items,pick){var b=boundsOf(items),n=b.getNorthEast(),s=b.getSouthWest(),span=map.distance(n,s);
  if(map.getZoom()>=MAXZ-.5||span<2){pick(items[0]);}else map.flyToBounds(b,Object.assign(padOpts(MAXZ),{duration:anim()?.6:.01}));}
function scopeBounds(){var b=L.latLngBounds([]);if(!data)return b;
  if(data.focusOrchard){var o=data.orchards.filter(function(x){return x.id===data.focusOrchard;})[0];if(o)o.points.forEach(function(q){b.extend(ll(q));});}
  else data.orchards.forEach(function(o){o.points.forEach(function(q){b.extend(ll(q));});});
  data.scans.forEach(function(s){b.extend([s.lat,s.lng]);});data.routes.forEach(function(r){r.points.forEach(function(q){b.extend(ll(q));});});return b;}
function drawZones(){zoneLayer.clearLayers();if(!data)return;
  data.zones.forEach(function(z){var c=ZP[z.color]||ZP.green;
    L.polygon(z.ring.map(ll),{pane:'zones',color:c.line,weight:1.4,opacity:.95,fillColor:c.fill,fillOpacity:.32,interactive:false,className:anim()?'fade':''}).addTo(zoneLayer);
    L.marker(ll(z.at),{icon:L.divIcon({className:'',html:'<div class="zl" style="background:'+c.label+';color:'+c.ink+'">'+z.label+'</div>',iconSize:[0,0]}),interactive:false,keyboard:false}).addTo(zoneLayer);});}
function drawOrchards(){orchLayer.clearLayers();if(!show('orchards'))return;
  data.orchards.forEach(function(o){if(o.points.length<3)return;var on=data.focusOrchard===o.id,off=data.focusOrchard&&!on;
    var poly=L.polygon(o.points.map(ll),{color:on?'#d9f99d':'#a3e635',weight:on?3.2:2.4,opacity:off?.45:1,fillColor:'#84cc16',fillOpacity:data.zones.length?0:(on?.16:off?.04:.12),lineJoin:'round',className:anim()?'fade':''});
    poly.bindTooltip(o.name,{permanent:true,direction:'center',className:'orch',opacity:off?.6:1});
    poly.on('click',function(e){L.DomEvent.stopPropagation(e);post({type:'orchard',id:o.id});});poly.addTo(orchLayer);});}
function drawRoutes(){routeLayer.clearLayers();if(!show('routes'))return;
  data.routes.forEach(function(r){if(r.points.length<2||(detail&&detail.id===r.id))return;
    var dim=!!selected;
    L.polyline(r.points.map(ll),{pane:'routes',color:'#ffffff',weight:5,opacity:dim?.25:.55,lineCap:'round',lineJoin:'round',interactive:false}).addTo(routeLayer);
    var line=L.polyline(r.points.map(ll),{pane:'routes',color:'#2dd4bf',weight:3,opacity:dim?.35:.9,lineCap:'round',lineJoin:'round'});
    line.on('click',function(e){L.DomEvent.stopPropagation(e);post({type:'select',id:r.id});});line.addTo(routeLayer);});}
function pinHtml(s,sel,dim){var c=COLORS[s.status]||'#fff';
  return '<div class="pin'+(sel?' sel':'')+(dim?' dim':'')+'"><div class="h" style="background:'+c+'"></div><div class="i">'+(s.kind==='foto'?I.cam('#fff',14):I.route)+'</div></div>';}
function drawScans(){scanLayer.clearLayers();if(!data)return;
  var list=data.scans.filter(function(s){return !(detail&&detail.id===s.id);});
  var sel=list.filter(function(s){return s.id===selected;}),rest=list.filter(function(s){return s.id!==selected;});
  cluster(rest,34).forEach(function(g){var s=g.items[0];
    var m=g.items.length>1
      ?L.marker([s.lat,s.lng],{icon:L.divIcon({className:'',html:'<div class="cl'+(selected?' dim':'')+'">'+I.route+g.items.length+'</div>',iconSize:[44,30],iconAnchor:[22,15]}),keyboard:false})
      :L.marker([s.lat,s.lng],{icon:L.divIcon({className:'',html:pinHtml(s,false,!!selected),iconSize:[30,38],iconAnchor:[15,36]}),keyboard:false});
    m.on('click',function(e){L.DomEvent.stopPropagation(e);if(g.items.length>1)expandOrPick(g.items,function(x){post({type:'select',id:x.id});});else post({type:'select',id:s.id});});
    m.addTo(scanLayer);popIn(m,'s:'+s.id+':'+g.items.length);});
  sel.forEach(function(s){var m=L.marker([s.lat,s.lng],{icon:L.divIcon({className:'',html:pinHtml(s,true,false),iconSize:[30,38],iconAnchor:[15,36]}),zIndexOffset:1000,keyboard:false});
    m.on('click',function(e){L.DomEvent.stopPropagation(e);post({type:'select',id:s.id});});m.addTo(scanLayer);});}
function popIn(m,key){if(!anim()||popped[key])return;popped[key]=1;var el=m.getElement&&m.getElement();if(el&&el.firstChild)el.firstChild.classList.add('in');}
function bearing(a,b){var y=(b.lng-a.lng)*Math.cos((a.lat+b.lat)*Math.PI/360),x=b.lat-a.lat;return Math.atan2(y,x)*180/Math.PI;}
function dist(a,b){return map.distance(ll(a),ll(b));}
function findingIcon(f){var on=active&&active.kind==='finding'&&active.id===f.id?' on':'';
  if(f.cat==='enfermo')return '<div class="fd c'+on+'" style="background:'+FC.enfermo+'">'+I.bug+'</div>';
  if(f.cat==='revisar')return '<div class="fd d'+on+'" style="background:'+FC.revisar+'">'+I.warn+'</div>';
  if(f.cat==='sano')return '<div class="fd q'+on+'" style="background:'+FC.sano+'">'+I.leaf+'</div>';
  return '<div class="fd o'+on+'" style="background:'+FC.otro+'">'+I.x+'</div>';}
function drawPhotos(){photoLayer.clearLayers();pointMarkers={};if(!detail)return;
  if(show('photos')){
    cluster(detail.photos,22).forEach(function(g){var p=g.items[0],m;
      if(g.items.length>1){m=L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',html:'<div class="pc">'+g.items.length+'</div>',iconSize:[26,22],iconAnchor:[13,11]}),zIndexOffset:300});
        m.on('click',function(e){L.DomEvent.stopPropagation(e);expandOrPick(g.items,function(x){post({type:'point',kind:'photo',id:x.id});});});}
      else{var on=active&&active.kind==='photo'&&active.id===p.id;
        m=L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',html:'<div class="ph'+(on?' on':'')+'">'+I.cam('#0f766e',12)+'</div>',iconSize:[22,22],iconAnchor:[11,11]}),zIndexOffset:on?900:300});
        m.on('click',function(e){L.DomEvent.stopPropagation(e);post({type:'point',kind:'photo',id:p.id});});pointMarkers['photo:'+p.id]=m;}
      m.addTo(photoLayer);popIn(m,'p:'+p.id+':'+g.items.length);});}
  if(show('findings')){
    detail.findings.forEach(function(f){var on=active&&active.kind==='finding'&&active.id===f.id;
      var m=L.marker([f.lat,f.lng],{icon:L.divIcon({className:'',html:findingIcon(f),iconSize:[26,26],iconAnchor:[13,13]}),zIndexOffset:on?950:600});
      m.on('click',function(e){L.DomEvent.stopPropagation(e);post({type:'point',kind:'finding',id:f.id});});m.addTo(photoLayer);pointMarkers['finding:'+f.id]=m;popIn(m,'f:'+f.id);});}}
function detailBounds(withOrchard){var b=L.latLngBounds([]);if(!detail)return b;
  detail.route.forEach(function(p){b.extend(ll(p));});detail.photos.forEach(function(p){b.extend([p.lat,p.lng]);});detail.findings.forEach(function(p){b.extend([p.lat,p.lng]);});
  // Si el recorrido cubre buena parte de su huerta, se encuadra el terreno completo (como en el boceto).
  if(withOrchard&&b.isValid()&&detail.orchard.length>2){var ob=L.latLngBounds(detail.orchard.map(ll));
    if(map.distance(b.getNorthEast(),b.getSouthWest())>map.distance(ob.getNorthEast(),ob.getSouthWest())*.3)b.extend(ob);}
  return b;}
function drawDetail(fit){detailLayer.clearLayers();if(!detail){photoLayer.clearLayers();pointMarkers={};return;}
  var r=detail.route;
  if(r.length>1){
    L.polyline(r.map(ll),{pane:'route',color:'#ffffff',weight:9,opacity:.9,lineCap:'round',lineJoin:'round',interactive:false}).addTo(detailLayer);
    L.polyline(r.map(ll),{pane:'route',color:'#14b8a6',weight:5,opacity:1,lineCap:'round',lineJoin:'round',interactive:false,className:anim()?'fade':''}).addTo(detailLayer);
    var total=0,seg=[];for(var i=1;i<r.length;i++){var d=dist(r[i-1],r[i]);seg.push(d);total+=d;}
    var every=Math.max(total/7,15),acc=0,next=every;
    for(var k=1;k<r.length&&total>40;k++){acc+=seg[k-1];if(acc>=next&&acc<total-every*.4){next+=every;
      L.marker(ll(r[k]),{icon:L.divIcon({className:'',html:'<div class="ar" style="transform:rotate('+bearing(r[k-1],r[k])+'deg)">'+I.arrow+'</div>',iconSize:[14,14],iconAnchor:[7,7]}),interactive:false,pane:'route'}).addTo(detailLayer);}}
    L.marker(ll(r[0]),{icon:L.divIcon({className:'',html:'<div class="se st">'+I.nav+'</div>',iconSize:[30,30],iconAnchor:[15,15]}),zIndexOffset:800,interactive:false}).addTo(detailLayer);
    L.marker(ll(r[r.length-1]),{icon:L.divIcon({className:'',html:'<div class="se en">'+I.flag+'</div>',iconSize:[30,30],iconAnchor:[15,15]}),zIndexOffset:800,interactive:false}).addTo(detailLayer);
  }
  drawPhotos();
  var b=detailBounds(true);if(fit&&b.isValid())go(minSpan(b,16),MAXZ);}
function redrawAll(){if(!data)return;drawZones();drawOrchards();drawRoutes();drawScans();drawDetail(false);}
map.on('zoomend',function(){if(!data)return;drawScans();drawPhotos();});
map.on('click',function(){post({type:'clear'});});
window.avx={
  setData:function(d){var refit=!data||d.fitKey!==lastFitKey;data=d;lastFitKey=d.fitKey;
    document.getElementById('map').classList.toggle('calm',!!d.reduced);
    redrawAll();
    if(refit){if(detail)pendingFit=true;else go(scopeBounds(),18);}},
  select:function(id){selected=id||null;if(!data)return;
    if(!selected){detail=null;active=null;}
    drawRoutes();drawScans();if(!selected){drawDetail(false);if(pendingFit){pendingFit=false;go(scopeBounds(),18);}}
    else if(!detail){var s=data.scans.filter(function(x){return x.id===selected;})[0];if(s)centerOn([s.lat,s.lng],19);}},
  setDetail:function(d,fit){detail=d;active=null;if(!data)return;drawRoutes();drawScans();drawDetail(fit);
    if(!d&&pendingFit){pendingFit=false;go(scopeBounds(),18);}},
  point:function(kind,id){active=id?{kind:kind,id:id}:null;drawPhotos();
    if(!active)return;var m=pointMarkers[kind+':'+id],f=null;
    if(!m&&detail){f=(kind==='photo'?detail.photos:detail.findings).filter(function(x){return x.id===id;})[0];}
    var at=m?m.getLatLng():f?L.latLng(f.lat,f.lng):null;if(at)centerOn(at,20);},
  setLayer:function(n){var hy=n==='hibrido';[labels,roads].forEach(function(t){if(hy&&!map.hasLayer(t))t.addTo(map);if(!hy&&map.hasLayer(t))map.removeLayer(t);});},
  zoom:function(d){d>0?map.zoomIn():map.zoomOut();},
  showUser:function(lat,lng,fly){meLayer.clearLayers();L.marker([lat,lng],{icon:L.divIcon({className:'',html:'<div class="me"></div>',iconSize:[16,16],iconAnchor:[8,8]}),interactive:false}).addTo(meLayer);
    if(fly){if(anim())map.flyTo([lat,lng],Math.max(map.getZoom(),17),{duration:.8});else map.setView([lat,lng],17);}},
  fit:function(){if(detail){var b=detailBounds(true);if(b.isValid()){go(minSpan(b,16),MAXZ);return;}}go(scopeBounds(),18);},
  invalidate:function(){map.invalidateSize();}
};
post({type:'ready'});
})();
</script></body></html>`;
}
