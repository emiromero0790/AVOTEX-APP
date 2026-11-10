#!/usr/bin/env node
/**
 * Genera los recursos de AVOTEX Field Tracking 3D (assets/field-tracking/).
 *
 * Uso:
 *   node scripts/field-tracking/render.mjs --three <ruta a node_modules/three> --models <carpeta con los .glb> [--preview <png>]
 *
 * Requisitos (solo en la máquina que genera los recursos, NO en la app):
 *   - three@0.170.0 instalado en cualquier carpeta (npm i three@0.170.0).
 *   - Playwright con Chromium.
 *   - Modelos CC0 de Quaternius (ver assets/field-tracking/CREDITOS.md):
 *       Farmer.glb (Ultimate Modular Men Pack), CommonTree_1/2/5.glb (Ultimate Nature Pack).
 *
 * La app no carga three.js ni modelos: usa las imágenes generadas aquí y proyecta la escena en vivo con
 * la misma cámara virtual (scene.config.json).
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const threeDir = path.resolve(arg('--three', 'node_modules/three'));
const modelsDir = path.resolve(arg('--models', 'models'));
const previewOut = arg('--preview', null);
const outDir = path.join(repo, 'assets/field-tracking');

const types = { '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.html': 'text/html' };
function serve(dir, rel) {
  const p = path.join(dir, rel);
  if (!p.startsWith(dir) || !fs.existsSync(p)) return { status: 404, body: 'not found' };
  return { status: 200, body: fs.readFileSync(p), contentType: types[path.extname(p)] ?? 'application/octet-stream' };
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.error('[page error]', e.message));
await page.route('http://fieldtracking.local/**', route => {
  const u = new URL(route.request().url());
  const p = decodeURIComponent(u.pathname);
  if (p === '/' || p === '/render.html') return route.fulfill(serve(here, 'render.html'));
  if (p.startsWith('/three/')) return route.fulfill(serve(threeDir, p.slice(7)));
  if (p.startsWith('/models/')) return route.fulfill(serve(modelsDir, p.slice(8)));
  if (p.startsWith('/cfg/')) return route.fulfill(serve(here, p.slice(5)));
  return route.fulfill({ status: 404, body: 'not found' });
});
await page.goto('http://fieldtracking.local/render.html');
await page.waitForFunction('window.READY === true', null, { timeout: 60000 });
const res = await page.evaluate(() => window.run());
await browser.close();

const write = (name, dataUrl) => {
  const b64 = dataUrl.split(',')[1];
  fs.writeFileSync(path.join(outDir, name), Buffer.from(b64, 'base64'));
};
fs.mkdirSync(outDir, { recursive: true });
write('farmer-walk.png', res.character.sheet);
if (previewOut) write(path.relative(outDir, path.resolve(previewOut)), res.character.preview);
res.trees.forEach((t, i) => write(`tree-${i + 1}.png`, t.png));
write('field-bg.jpg', res.bg.png);

const cfg = JSON.parse(fs.readFileSync(path.join(here, 'scene.config.json'), 'utf8'));
delete cfg.comment;
const meta = {
  generatedBy: 'scripts/field-tracking/render.mjs',
  camera: cfg,
  farmer: res.character.meta,
  trees: res.trees.map(t => t.meta),
};
fs.writeFileSync(path.join(outDir, 'field-scene.json'), JSON.stringify(meta, null, 2) + '\n');
console.log(JSON.stringify(meta, null, 2));
