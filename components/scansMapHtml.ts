/**
 * Mapa de "Mis escaneos" (Leaflet + imágenes satelitales de Esri, la misma base que el resto de la app).
 *
 * Solo dibuja datos reales y cada cosa con su propio lenguaje visual:
 * - Huertas: perímetro real (tabla huertas) con su nombre.
 * - Escaneos: un pin por escaneo en su ubicación guardada (icono de ruta = recorrido, cámara = foto).
 * - Recorrido elegido: su ruta GPS (recorridos.ruta) con inicio, fin y dirección de avance; los puntos
 *   donde se tomó cada foto (recorrido_fotos.lat/lng) y los hallazgos (hallazgos.lat/lng) por categoría.
 * - Tu ubicación, si diste permiso.
 * El HTML se carga una vez; los datos llegan después con window.avx.* (no se recarga el WebView).
 */
import { safeJsonValue } from './safeJson';

export type ScansMapPoint = { lat: number; lng: number };
export type ScanStatus = 'listo' | 'proceso' | 'cola' | 'local' | 'error';
export type ScansMapLayer = 'satelite' | 'hibrido';
export type FindingCat = 'sano' | 'enfermo' | 'revisar' | 'otro';

export type ScansMapOrchard = { id: string; name: string; points: ScansMapPoint[] };
export type ScansMapScan = { id: string; kind: 'recorrido' | 'foto'; status: ScanStatus; lat: number; lng: number };
export type ScansMapDetail = {
  id: string;
  route: ScansMapPoint[];
  photos: { id: string; lat: number; lng: number; n: number }[];
  findings: { id: string; lat: number; lng: number; cat: FindingCat }[];
};

export type ScansMapData = {
  orchards: ScansMapOrchard[];
  scans: ScansMapScan[];
  /** Huerta resaltada (selector). */
  focusOrchard: string | null;
  /** Cambia cuando cambia lo que hay que encuadrar (huerta elegida o filtros). */
  fitKey: string;
  /** Zonas tapadas por el panel y los controles: el encuadre las evita. */
  pad: { top: number; right: number; bottom: number; left: number };
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
  enfermo: '#EF4444',
  revisar: '#F59E0B',
  otro: '#94A3B8',
};

export const safeJson = safeJsonValue;

export function buildScansMapHtml(): string {
  const colors = safeJson(SCAN_STATUS_COLOR);
  const fcolors = safeJson(FINDING_COLOR);
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
.orch{background:rgba(255,255,255,.88);border:0;border-radius:999px;box-shadow:0 1px 4px rgba(0,0,0,.25);color:#14532d;font-size:10.5px;font-weight:700;padding:2px 8px}
.orch::before{display:none}
.pin{position:relative;width:30px;height:38px;transform-origin:50% 100%;transition:transform .2s cubic-bezier(.23,1,.32,1),opacity .2s}
.pin .h{position:absolute;left:2px;top:0;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.4)}
.pin .i{position:absolute;left:2px;top:0;width:30px;height:30px;display:flex;align-items:center;justify-content:center;margin-left:-1px;margin-top:-1px}
.pin.sel{transform:scale(1.18)}
.pin.dim{opacity:.45}
.pin.sel::after{content:'';position:absolute;left:-5px;top:-6px;width:40px;height:40px;border-radius:50%;border:2px solid rgba(255,255,255,.9);animation:ring 1.6s cubic-bezier(.23,1,.32,1) infinite}
@keyframes ring{from{transform:scale(.6);opacity:.9}to{transform:scale(1.45);opacity:0}}
.se{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.45)}
.st{background:#0f766e}.en{background:#fff}
.ph{width:22px;height:22px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.4);border:1.5px solid #14b8a6;transition:transform .15s}
.ph.dot{width:10px;height:10px;border-width:2px}
.ph.on{transform:scale(1.35);border-color:#0f766e;box-shadow:0 0 0 3px rgba(20,184,166,.45),0 2px 6px rgba(0,0,0,.4)}
.fd{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 7px rgba(0,0,0,.45);transition:transform .15s}
.fd.on{transform:scale(1.3);box-shadow:0 0 0 3px rgba(255,255,255,.75),0 3px 9px rgba(0,0,0,.5)}
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
var COLORS=${colors},FC=${fcolors};
function post(m){var s=JSON.stringify(m);try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else if(window.parent!==window)window.parent.postMessage(s,'*');}catch(e){}}
if(typeof L==='undefined'){post({type:'error',message:'leaflet'});return;}
var map=L.map('map',{zoomControl:false,attributionControl:true,zoomSnap:.25}).setView([19.4,-102.05],9);
map.attributionControl.setPrefix(false);
L.control.scale({imperial:false,position:'bottomleft',maxWidth:110}).addTo(map);
var base='https://server.arcgisonline.com/ArcGIS/rest/services/';
var sat=L.tileLayer(base+'World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:18,maxZoom:20,attribution:'Imágenes © Esri'}).addTo(map);
var labels=L.tileLayer(base+'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:18,maxZoom:20});
var roads=L.tileLayer(base+'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:18,maxZoom:20,opacity:.75});
map.createPane('route').style.zIndex=440;
var orchLayer=L.layerGroup().addTo(map),scanLayer=L.layerGroup().addTo(map),detailLayer=L.layerGroup().addTo(map),meLayer=L.layerGroup().addTo(map);
var pendingFit=false,data=null,selected=null,detail=null,pins={},orchPolys={},pointMarkers={},activePoint=null,lastFitKey=null,loaded=false;
var I={
 route:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>',
 cam:function(c,s){return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="'+c+'" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';},
 nav:'<svg width="15" height="15" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',
 flag:'<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="1" width="1.6" height="14" fill="#111"/><g fill="#111"><rect x="4" y="2" width="3" height="3"/><rect x="10" y="2" width="3" height="3"/><rect x="7" y="5" width="3" height="3"/><rect x="13" y="5" width="1.5" height="3"/><rect x="4" y="8" width="3" height="3"/><rect x="10" y="8" width="3" height="3"/></g><rect x="3.6" y="2" width="11" height="9" fill="none" stroke="#111" stroke-width=".8"/></svg>',
 bug:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3 3 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>',
 leaf:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
 q:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
 x:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
 arrow:'<svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" stroke="#0f766e" stroke-width="2" stroke-linejoin="round"><path d="M12 3 20 20 12 15 4 20Z"/></svg>'
};
function ll(p){return[p.lat,p.lng];}
function anim(){return data&&!data.reduced;}
function padOpts(maxZ){var p=(data&&data.pad)||{top:0,right:0,bottom:0,left:0};return{paddingTopLeft:[p.left+20,p.top+20],paddingBottomRight:[p.right+20,p.bottom+20],maxZoom:maxZ||18};}
function go(b,maxZ){if(!b||!b.isValid())return;var o=padOpts(maxZ);if(anim()&&loaded){map.flyToBounds(b,Object.assign(o,{duration:.8}));}else{map.fitBounds(b,o);}loaded=true;}
function pinHtml(s,sel,dim){var c=COLORS[s.status]||'#fff';
  return '<div class="pin'+(sel?' sel':'')+(dim?' dim':'')+'"><div class="h" style="background:'+c+'"></div><div class="i">'+(s.kind==='foto'?I.cam('#fff',14):I.route)+'</div></div>';}
function pinIcon(s,sel,dim){return L.divIcon({className:'',html:pinHtml(s,sel,dim),iconSize:[30,38],iconAnchor:[15,36]});}
function scopeBounds(){var b=L.latLngBounds([]);if(!data)return b;
  if(data.focusOrchard){var o=data.orchards.filter(function(x){return x.id===data.focusOrchard;})[0];if(o)o.points.forEach(function(q){b.extend(ll(q));});}
  else{data.orchards.forEach(function(o){o.points.forEach(function(q){b.extend(ll(q));});});}
  data.scans.forEach(function(s){b.extend([s.lat,s.lng]);});return b;}
function drawOrchards(){orchLayer.clearLayers();orchPolys={};
  data.orchards.forEach(function(o){if(o.points.length<3)return;var on=data.focusOrchard===o.id,off=data.focusOrchard&&!on;
    var poly=L.polygon(o.points.map(ll),{color:on?'#d9f99d':'#a3e635',weight:on?3.2:2.2,opacity:off?.45:.95,fillColor:'#84cc16',fillOpacity:on?.16:off?.04:.1,lineJoin:'round',className:anim()?'fade':''});
    poly.bindTooltip(o.name,{permanent:true,direction:'center',className:'orch',opacity:off?.6:1});
    poly.on('click',function(e){L.DomEvent.stopPropagation(e);post({type:'orchard',id:o.id});});
    poly.addTo(orchLayer);orchPolys[o.id]=poly;});}
function drawScans(){scanLayer.clearLayers();pins={};
  data.scans.forEach(function(s,i){var sel=s.id===selected,dim=selected&&!sel;
    var m=L.marker([s.lat,s.lng],{icon:pinIcon(s,sel,dim),keyboard:false,zIndexOffset:sel?1000:0});
    m.on('click',function(e){L.DomEvent.stopPropagation(e);post({type:'select',id:s.id});});
    m.addTo(scanLayer);pins[s.id]={m:m,s:s};
    var el=m.getElement&&m.getElement();if(el&&anim()){el.firstChild.classList.add('in');el.firstChild.style.animationDelay=Math.min(i*30,400)+'ms';}});}
function bearing(a,b){var y=(b.lng-a.lng)*Math.cos((a.lat+b.lat)*Math.PI/360),x=b.lat-a.lat;return Math.atan2(y,x)*180/Math.PI;}
function dist(a,b){var dl=(b.lat-a.lat)*111320,dg=(b.lng-a.lng)*111320*Math.cos(a.lat*Math.PI/180);return Math.sqrt(dl*dl+dg*dg);}
function drawDetail(fit){detailLayer.clearLayers();pointMarkers={};activePoint=null;if(!detail)return;
  var b=L.latLngBounds([]),r=detail.route;
  if(r.length>1){
    L.polyline(r.map(ll),{pane:'route',color:'#ffffff',weight:8,opacity:.85,lineCap:'round',lineJoin:'round',interactive:false}).addTo(detailLayer);
    L.polyline(r.map(ll),{pane:'route',color:'#10b981',weight:4,opacity:1,lineCap:'round',lineJoin:'round',interactive:false,className:anim()?'fade':''}).addTo(detailLayer);
    // Dirección de avance: flechas repartidas a lo largo de la ruta real.
    var total=0,seg=[];for(var i=1;i<r.length;i++){var d=dist(r[i-1],r[i]);seg.push(d);total+=d;}
    var every=Math.max(total/7,15),acc=0,next=every;
    for(var k=1;k<r.length&&total>40;k++){acc+=seg[k-1];if(acc>=next&&acc<total-every*.4){next+=every;var deg=bearing(r[k-1],r[k]);
      L.marker(ll(r[k]),{icon:L.divIcon({className:'',html:'<div class="ar" style="transform:rotate('+deg+'deg)">'+I.arrow+'</div>',iconSize:[14,14],iconAnchor:[7,7]}),interactive:false,pane:'route'}).addTo(detailLayer);}}
    r.forEach(function(p){b.extend(ll(p));});
  }
  var many=detail.photos.length>45;
  detail.photos.forEach(function(p){var m=L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',html:'<div class="ph'+(many?' dot':'')+'">'+(many?'':I.cam('#0f766e',12))+'</div>',iconSize:many?[10,10]:[22,22],iconAnchor:many?[5,5]:[11,11]}),zIndexOffset:200});
    m.on('click',function(e){L.DomEvent.stopPropagation(e);post({type:'point',kind:'photo',id:p.id});});m.addTo(detailLayer);pointMarkers['photo:'+p.id]=m;b.extend([p.lat,p.lng]);});
  detail.findings.forEach(function(f){var ic=f.cat==='enfermo'?I.bug:f.cat==='sano'?I.leaf:f.cat==='revisar'?I.q:I.x;
    var m=L.marker([f.lat,f.lng],{icon:L.divIcon({className:'',html:'<div class="fd" style="background:'+FC[f.cat]+'">'+ic+'</div>',iconSize:[26,26],iconAnchor:[13,13]}),zIndexOffset:600});
    m.on('click',function(e){L.DomEvent.stopPropagation(e);post({type:'point',kind:'finding',id:f.id});});m.addTo(detailLayer);pointMarkers['finding:'+f.id]=m;b.extend([f.lat,f.lng]);});
  if(r.length>1){
    L.marker(ll(r[0]),{icon:L.divIcon({className:'',html:'<div class="se st">'+I.nav+'</div>',iconSize:[30,30],iconAnchor:[15,15]}),zIndexOffset:800,interactive:false}).addTo(detailLayer);
    L.marker(ll(r[r.length-1]),{icon:L.divIcon({className:'',html:'<div class="se en">'+I.flag+'</div>',iconSize:[30,30],iconAnchor:[15,15]}),zIndexOffset:800,interactive:false}).addTo(detailLayer);
  }
  // El pin del escaneo se oculta cuando su ruta o sus puntos ya lo representan.
  if(pins[detail.id]&&b.isValid())scanLayer.removeLayer(pins[detail.id].m);
  if(fit&&b.isValid())go(b,19);
}
map.on('click',function(){post({type:'clear'});});
window.avx={
  setData:function(d){var refit=!data||d.fitKey!==lastFitKey;data=d;lastFitKey=d.fitKey;
    document.getElementById('map').classList.toggle('calm',!!d.reduced);
    drawOrchards();drawScans();if(detail)drawDetail(false);
    if(refit){if(detail)pendingFit=true;else go(scopeBounds(),18);}},
  select:function(id){selected=id||null;if(!data)return;
    Object.keys(pins).forEach(function(k){var x=pins[k];x.m.setIcon(pinIcon(x.s,k===selected,selected&&k!==selected));x.m.setZIndexOffset(k===selected?1000:0);});
    if(!selected){detail=null;drawDetail(false);if(pendingFit){pendingFit=false;go(scopeBounds(),18);}}
    else if(pins[selected]&&!detail){var p=pins[selected].s,z=Math.max(map.getZoom(),17);var pt=map.project([p.lat,p.lng],z);var pd=data.pad;pt=pt.add([(pd.right-pd.left)/2,(pd.bottom-pd.top)/2]);
      if(anim())map.flyTo(map.unproject(pt,z),z,{duration:.7});else map.setView(map.unproject(pt,z),z);}},
  setDetail:function(d,fit){detail=d;if(data)drawScans();drawDetail(fit);if(!d&&pendingFit&&data){pendingFit=false;go(scopeBounds(),18);}},
  point:function(kind,id){if(activePoint){var el0=activePoint.getElement&&activePoint.getElement();if(el0&&el0.firstChild)el0.firstChild.classList.remove('on');}
    activePoint=id?pointMarkers[kind+':'+id]:null;if(!activePoint)return;var el=activePoint.getElement();if(el&&el.firstChild)el.firstChild.classList.add('on');
    var ll0=activePoint.getLatLng(),z=Math.max(map.getZoom(),18),pt=map.project(ll0,z),pd=data.pad;pt=pt.add([(pd.right-pd.left)/2,(pd.bottom-pd.top)/2]);
    if(anim())map.flyTo(map.unproject(pt,z),z,{duration:.6});else map.setView(map.unproject(pt,z),z);},
  setLayer:function(n){var hy=n==='hibrido';[labels,roads].forEach(function(t){if(hy&&!map.hasLayer(t))t.addTo(map);if(!hy&&map.hasLayer(t))map.removeLayer(t);});},
  zoom:function(d){d>0?map.zoomIn():map.zoomOut();},
  showUser:function(lat,lng,fly){meLayer.clearLayers();L.marker([lat,lng],{icon:L.divIcon({className:'',html:'<div class="me"></div>',iconSize:[16,16],iconAnchor:[8,8]}),interactive:false}).addTo(meLayer);
    if(fly){if(anim())map.flyTo([lat,lng],Math.max(map.getZoom(),17),{duration:.8});else map.setView([lat,lng],17);}},
  fit:function(){if(detail){var b=L.latLngBounds([]);detail.route.forEach(function(p){b.extend(ll(p));});detail.photos.forEach(function(p){b.extend([p.lat,p.lng]);});detail.findings.forEach(function(p){b.extend([p.lat,p.lng]);});if(b.isValid()){go(b,19);return;}}
    go(scopeBounds(),18);}
};
post({type:'ready'});
})();
</script></body></html>`;
}
