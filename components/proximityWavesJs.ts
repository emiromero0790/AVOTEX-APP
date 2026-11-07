/**
 * Ondas de alerta de lejanía, dentro del mapa de Mapeo (WebView nativo e iframe web).
 *
 * Ancladas al terreno con la proyección del propio mapa:
 * - Vista 3D (MapLibre GL): cada onda es un círculo GEOGRÁFICO (centro de la huerta + radio en metros,
 *   64 puntos). En cada cuadro esos puntos se proyectan con `glMap.project()` —la cámara real, con
 *   zoom, giro e inclinación— y se dibujan en un lienzo transparente justo encima del satélite
 *   (debajo de la etiqueta de la huerta, sin eventos). Se usa lienzo y no una capa `circle` porque
 *   MapLibre recorta los círculos grandes en los bordes de cada tesela, y así el mapa no tiene que
 *   volver a pintarse en cada cuadro. También se redibuja en el evento `render` del mapa, para no
 *   quedarse un cuadro atrás al arrastrar.
 * - Vista 2D (Leaflet): tres `L.circle` (radio en metros) en un panel propio sin eventos.
 *
 * Tres ondas escalonadas de 2.8 s: nacen cerca del centro de la huerta, crecen con curva de salida,
 * se desvanecen y reinician. El ciclo usa requestAnimationFrame y se detiene por completo al
 * desactivar la alerta o al ocultarse la página. Con movimiento reducido: anillos fijos.
 *
 * Requiere en el ámbito global: map, drawn, initialPoints, L, y opcionalmente glMap / maplibregl.
 */
export const PROXIMITY_WAVES_JS = `
var AVX_WAVE={cv:null,cvMap:null,active:false,reduced:false,raf:0,period:2800,count:3,center:null,r0:30,r1:300,circles:[],pane:null};
function avxWavePoints(){var pts=null;try{drawn.eachLayer(function(l){if(!pts&&l instanceof L.Polygon){pts=l.getLatLngs()[0].map(function(p){return {latitude:p.lat,longitude:p.lng};});}});}catch(e){}return (pts&&pts.length>=3)?pts:initialPoints;}
function avxWaveGeometry(){var pts=avxWavePoints();if(!pts||pts.length<3)return false;
  var lat0=pts[0].latitude,k=Math.cos(lat0*Math.PI/180),M=111320;var a=0,cx=0,cy=0;
  for(var i=0;i<pts.length;i++){var p=pts[i],q=pts[(i+1)%pts.length];var x1=(p.longitude-pts[0].longitude)*k*M,y1=(p.latitude-lat0)*M,x2=(q.longitude-pts[0].longitude)*k*M,y2=(q.latitude-lat0)*M;var c=x1*y2-x2*y1;a+=c;cx+=(x1+x2)*c;cy+=(y1+y2)*c;}
  if(Math.abs(a)<1e-6){cx=0;cy=0;pts.forEach(function(p){cx+=(p.longitude-pts[0].longitude)*k*M;cy+=(p.latitude-lat0)*M;});cx/=pts.length;cy/=pts.length;}else{cx/=(3*a);cy/=(3*a);}
  var center={latitude:lat0+cy/M,longitude:pts[0].longitude+cx/(k*M)};var R=0;
  pts.forEach(function(p){var dx=(p.longitude-center.longitude)*k*M,dy=(p.latitude-center.latitude)*M;R=Math.max(R,Math.sqrt(dx*dx+dy*dy));});
  R=Math.max(R,35);AVX_WAVE.center=center;AVX_WAVE.r0=R*0.35;AVX_WAVE.r1=R*2.35;return true;}
function avxGlCanvas(){if(typeof glMap==='undefined'||!glMap)return null;if(AVX_WAVE.cv&&AVX_WAVE.cvMap===glMap)return AVX_WAVE.cv;
  var holder=glMap.getCanvasContainer(),base=glMap.getCanvas();var cv=document.createElement('canvas');
  cv.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';
  holder.insertBefore(cv,base.nextSibling);AVX_WAVE.cv=cv;AVX_WAVE.cvMap=glMap;
  glMap.on('render',function(){if(AVX_WAVE.active)avxDrawGl(performance.now());});return cv;}
function avxGlClear(){if(AVX_WAVE.cv){var c=AVX_WAVE.cv.getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,AVX_WAVE.cv.width,AVX_WAVE.cv.height);}}
function avxDrawGl(now){var cv=avxGlCanvas();if(!cv||!AVX_WAVE.center)return;var el=document.getElementById('gl-map');if(el.style.visibility!=='visible')return;
  var dpr=window.devicePixelRatio||1,W=el.clientWidth,H=el.clientHeight;if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}
  var c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
  var lat=AVX_WAVE.center.latitude,lng=AVX_WAVE.center.longitude,k=Math.cos(lat*Math.PI/180),M=111320;
  for(var i=0;i<AVX_WAVE.count;i++){var w=avxWaveAt(i,now);if(w.o<=0.01)continue;c.beginPath();var ok=true;
    for(var j=0;j<=64;j++){var a=j/64*Math.PI*2;var q=glMap.project([lng+Math.cos(a)*w.r/(k*M),lat+Math.sin(a)*w.r/M]);if(!isFinite(q.x)||!isFinite(q.y)){ok=false;break;}if(j===0)c.moveTo(q.x,q.y);else c.lineTo(q.x,q.y);}
    if(!ok)continue;c.closePath();
    c.fillStyle='rgba(255,69,69,'+(0.24*w.o)+')';c.fill();
    c.lineJoin='round';
    c.strokeStyle='rgba(255,69,69,'+(0.13*w.o)+')';c.lineWidth=16;c.stroke();
    c.strokeStyle='rgba(255,69,69,'+(0.26*w.o)+')';c.lineWidth=7;c.stroke();
    c.strokeStyle='rgba(255,110,100,'+w.o+')';c.lineWidth=2.6;c.stroke();}}
function avxLeafletEnsure(){if(!AVX_WAVE.center)return;if(!AVX_WAVE.pane){AVX_WAVE.pane=map.createPane('avxWaves');AVX_WAVE.pane.style.zIndex=350;AVX_WAVE.pane.style.pointerEvents='none';AVX_WAVE.pane.style.filter='drop-shadow(0 0 6px rgba(255,69,69,.85))';}
  AVX_WAVE.circles.forEach(function(c){map.removeLayer(c);});AVX_WAVE.circles=[0,1,2].map(function(){return L.circle([AVX_WAVE.center.latitude,AVX_WAVE.center.longitude],{pane:'avxWaves',radius:AVX_WAVE.r0,interactive:false,color:'#FF5A4F',weight:3,opacity:0,fillColor:'#FF4545',fillOpacity:0}).addTo(map);});}
function avxLeafletHide(){AVX_WAVE.circles.forEach(function(c){map.removeLayer(c);});AVX_WAVE.circles=[];}
function avxWaveAt(i,now){var t=AVX_WAVE.reduced?(i+1)/(AVX_WAVE.count+1):(((now/AVX_WAVE.period)+i/AVX_WAVE.count)%1);
  var e=1-Math.pow(1-t,2.2);var r=AVX_WAVE.r0+(AVX_WAVE.r1-AVX_WAVE.r0)*e;
  var o=AVX_WAVE.reduced?(0.85-0.22*i):Math.min(1,t/0.1)*(1-Math.pow(t,1.8));return {r:r,o:o};}
function avxWaveFrame(now){if(!AVX_WAVE.active)return;
  var lfVis=document.getElementById('leaflet-map').style.display!=='none';
  avxDrawGl(now);
  if(lfVis||AVX_WAVE.reduced){for(var i=0;i<AVX_WAVE.count;i++){var w=avxWaveAt(i,now);var c=AVX_WAVE.circles[i];if(c){c.setRadius(w.r);c.setStyle({opacity:w.o,fillOpacity:w.o*0.24});}}}
  AVX_WAVE.raf=0;if(document.hidden)return;
  if(!AVX_WAVE.reduced){AVX_WAVE.raf=requestAnimationFrame(avxWaveFrame);}
  /* movimiento reducido: anillos fijos; solo se reintenta (cada 0.5 s) hasta que exista la vista 3D */
  else if(!AVX_WAVE.cv&&typeof glMap!=='undefined'&&glMap){setTimeout(function(){if(AVX_WAVE.active&&!AVX_WAVE.raf)avxWaveFrame(performance.now());},500);}}
function setProximityAlert(on,reduced){on=Boolean(on);AVX_WAVE.reduced=Boolean(reduced);
  if(AVX_WAVE.raf){cancelAnimationFrame(AVX_WAVE.raf);AVX_WAVE.raf=0;}
  if(!on||!avxWaveGeometry()){AVX_WAVE.active=false;avxGlClear();avxLeafletHide();return;}
  AVX_WAVE.active=true;avxLeafletEnsure();AVX_WAVE.raf=requestAnimationFrame(avxWaveFrame);}
document.addEventListener('visibilitychange',function(){if(!document.hidden&&AVX_WAVE.active&&!AVX_WAVE.raf){AVX_WAVE.raf=requestAnimationFrame(avxWaveFrame);}});
`;
