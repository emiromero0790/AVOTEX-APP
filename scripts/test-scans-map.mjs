/**
 * Prueba del mapa de Mis escaneos (MapLibre) en Chromium con WebGL por software.
 *
 *   node scripts/test-scans-map.mjs            # requiere red (CDN + mosaicos) y playwright con Chromium
 *   MAP_TEST_SCREENSHOT=/tmp/mapa node scripts/test-scans-map.mjs   # guarda capturas
 *
 * Construye el HTML real con esbuild, lo sirve desde un iframe con URL blob (como la app web) y comprueba:
 * datos enviados ANTES de que cargue el mapa, fuentes vectoriales nítidas, huerta/árboles/ruta/pines, toques
 * (hallazgo y foto → mensaje «point»), cambio de base sin recrear fuentes, 2D/3D y encuadre de un recorrido.
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avx-map-'));
execSync(`npx -y esbuild@0.24.0 components/scansMapHtml.ts --bundle --platform=node --outfile=${tmp}/map.cjs --log-level=warning`, { cwd: root, stdio: 'inherit' });
const html = require(`${tmp}/map.cjs`).buildScansMapHtml().replace('var map = new maplibregl.Map', 'var map = window.__m = new maplibregl.Map');
const page = `<!doctype html><body style="margin:0"><iframe id="f" style="width:400px;height:860px;border:0"></iframe><script>
window.msgs=[];addEventListener('message',e=>{try{msgs.push(JSON.parse(e.data))}catch(_){}});
document.getElementById('f').src=URL.createObjectURL(new Blob([${JSON.stringify(html).replace(/<\//g, '<\\/')}],{type:'text/html'}));</script>`;
const srv = http.createServer((_, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(page); }).listen(0);
await new Promise(r => srv.on('listening', r));

const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await browser.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: Number(process.env.MAP_TEST_DPR || 2) });
const errors = [];
p.on('pageerror', e => errors.push(e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/`);
await p.waitForFunction(() => document.getElementById('f').contentWindow.avx, null, { timeout: 60000 });
const f = p.frames().find(x => x !== p.mainFrame());
const fail = m => { throw new Error(m); };

// Datos ANTES de la carga del mapa: deben dibujarse al cargar.
await f.evaluate(() => {
  const O = [19.4205, -102.0605];
  const P = (dy, dx) => ({ lat: O[0] + dy * 0.000009, lng: O[1] + dx * 0.0000095 });
  const orchard = [P(-60, -70), P(70, -80), P(85, 60), P(-50, 75)];
  const route = []; let t = 1700000000000;
  for (let row = 0; row < 5; row++) {
    const y = -40 + row * 22, xs = row % 2 ? [55, -55] : [-55, 55];
    for (let k = 0; k <= 10; k++) { route.push({ ...P(y, xs[0] + (xs[1] - xs[0]) * k / 10), t }); t += 6000 + (k % 3) * 2500; }
  }
  window.__route = route;
  avx.setPad({ top: 110, bottom: 300, left: 16, right: 70 });
  avx.setData({ orchards: [{ id: 'o1', name: 'A', points: orchard }], scans: [{ id: 'r1', kind: 'recorrido', status: 'listo', ...route[0] }], routes: [{ id: 'r1', points: route }], zones: [], focusOrchard: null, fitKey: 'a', show: { orchards: true, routes: true, photos: true, findings: true }, reduced: true });
  avx.select('r1');
  avx.setDetail({ id: 'r1', route, orchard, speedRange: [0, 5], photos: [{ id: 'p1', lat: route[4].lat, lng: route[4].lng, n: 1 }], findings: [{ id: 'h1', cat: 'enfermo', lat: route[30].lat, lng: route[30].lng }] }, true);
});
await f.waitForFunction(() => window.__m.getSource('detail') && window.__m.loaded(), null, { timeout: 60000 });
await p.waitForTimeout(4000);

const r = await f.evaluate(async () => {
  const m = window.__m, n = id => m.getSource(id)._data.features.length;
  const out = { zoom: m.getZoom(), pitch: m.getPitch(), detail: n('detail'), endpoints: n('endpoints'), findings: n('findings'), photos: n('photos'), trees: n('trees'), orchards: n('orchards') };
  out.vector = m.getStyle().sources.openmaptiles.type;
  out.rasterVisibleInDark = m.getStyle().layers.filter(l => l.type === 'raster' && l.layout?.visibility !== 'none').length;
  out.iconRatio = m.getImage('pin-start')?.pixelRatio;
  out.treesVisible3D = m.getLayoutProperty('trees', 'visibility');
  const src = m.getSource('detail');
  for (const l of ['satelite', 'hibrido', 'estandar', 'zonas', 'oscuro']) avx.setLayer(l);
  out.sameSource = m.getSource('detail') === src;
  for (const s of ['tiempo', 'velocidad', 'clasica']) { avx.setRouteStyle(s); await new Promise(r => requestAnimationFrame(r)); out['grad_' + s] = m.getPaintProperty('detail-line', 'line-gradient').length; }
  avx.setPerspective(false); await new Promise(r => setTimeout(r, 100));
  out.pitch2D = m.getPitch(); out.trees2D = m.getLayoutProperty('trees', 'visibility');
  avx.setPerspective(true); avx.fit(); await new Promise(r => setTimeout(r, 300));
  out.pitch3D = m.getPitch();
  const hit = m.project([window.__route[30].lng, window.__route[30].lat]);
  out.findingXY = [hit.x, hit.y - 18];
  const ph = m.project([window.__route[4].lng, window.__route[4].lat]);
  out.photoXY = [ph.x, ph.y];
  return out;
});
// Toques: el cuerpo del pin del hallazgo (sobre la coordenada) y el punto de la foto.
await p.mouse.click(r.findingXY[0], r.findingXY[1]);
await p.mouse.click(r.photoXY[0], r.photoXY[1]);
await p.waitForTimeout(300);
const msgs = await p.evaluate(() => window.msgs.filter(m => m.type === 'point'));
if (process.env.MAP_TEST_SCREENSHOT) await p.screenshot({ path: process.env.MAP_TEST_SCREENSHOT + '-mapa.png' });
console.log(JSON.stringify({ ...r, taps: msgs }, null, 1));

if (r.detail !== 1 || r.endpoints !== 2 || r.findings !== 1 || r.photos !== 1) fail('Faltan datos del recorrido en el mapa');
if (!r.trees || r.treesVisible3D !== 'visible' || r.trees2D !== 'none') fail('Árboles 3D incorrectos');
if (r.vector !== 'vector' || r.rasterVisibleInDark) fail('La base oscura debe ser vectorial');
if (r.iconRatio !== 3) fail('Iconos de baja resolución');
if (!r.sameSource) fail('Cambiar de base recreó las fuentes');
if (r.grad_tiempo < 6 || r.grad_velocidad < 6 || r.grad_clasica < 6) fail('Degradado de ruta ausente');
if (r.pitch2D !== 0 || Math.abs(r.pitch3D - 55) > 0.5) fail('Cambio 2D/3D incorrecto');
if (r.zoom < 16.5) fail('Encuadre demasiado lejano: ' + r.zoom);
if (!msgs.some(m => m.kind === 'finding' && m.id === 'h1') || !msgs.some(m => m.kind === 'photo' && m.id === 'p1')) fail('Los toques en hallazgo/foto no responden');
if (errors.length) fail(errors.join('; '));
console.log('OK');
await browser.close(); srv.close();
