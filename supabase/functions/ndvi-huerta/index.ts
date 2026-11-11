/**
 * ndvi-huerta — mapa de vigor (NDVI) de una huerta con Sentinel-2 L2A de Microsoft Planetary Computer.
 *
 * No necesita cuenta ni claves: usa la API pública STAC y la Data API (TiTiler) de Planetary Computer.
 *
 * POST { outline: [{ lat, lng }, ...] }
 *   → { ok: true, date, image (PNG base64), bounds, stats: { mean, min, max, validPct }, source }
 *   → { ok: false, reason: 'bad-request' | 'too-large' | 'no-clear-image' | 'upstream' }
 *
 * Cómo funciona:
 *  1. STAC: imágenes Sentinel-2 de los últimos 75 días que cubren la huerta, de la más reciente a la más vieja.
 *  2. Estadística dentro del contorno (por imagen, en lotes): qué parte de la huerta se vio despejada según la
 *     capa SCL (4 vegetación, 5 sin vegetación, 6 agua, 7 sin clasificar; fuera nubes, sombras, nieve) y el NDVI
 *     medio de los píxeles despejados. Se elige la más reciente con ≥ 60 % despejado (si ninguna, la mejor ≥ 30 %).
 *  3. PNG de esa imagen a su resolución real (10 m por píxel), de la caja de la huerta más un margen de 15 m, SIN
 *     recortar: NDVI coloreado con la escala de la app y nubes transparentes. La app la estira con interpolación
 *     suave (gradientes entre píxeles en vez de cuadros) y la recorta al contorno con un clip-path nítido.
 *
 * Datos: Copernicus Sentinel-2 (libres, también para uso comercial), servidos por Microsoft Planetary Computer.
 * Planetary Computer no tiene acuerdo de servicio: si falla, la app muestra «No se pudo cargar el mapa de vigor».
 */
import { encodeBase64 } from '@std/encoding/base64';

const PC = 'https://planetarycomputer.microsoft.com/api';
const COLLECTION = 'sentinel-2-l2a';
const DAYS = 75;
const MAX_POINTS = 600;
const MAX_AREA_HA = 3000;
const MAX_CANDIDATES = 8;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CLEAR = '(SCL==4)|(SCL==5)|(SCL==6)|(SCL==7)';
const NDVI = '(B08-B04)/(B08+B04)';
// Estadística: [despejado (0/1), NDVI·despejado] → media de lo primero = fracción despejada;
// media de lo segundo ÷ fracción = NDVI medio de los píxeles despejados.
const STATS_EXPR = `where(${CLEAR},1,0);where(${CLEAR},${NDVI},0)`;
// Imagen: nubes = −2 → al reescalar −1..1 → 0..255 caen en 0, que la paleta deja transparente.
const IMG_EXPR = `where(${CLEAR},${NDVI},-2)`;

// Misma escala que services/indices.ts (NDVI): rojo suelo desnudo → verde vegetación densa.
const STOPS: [number, [number, number, number]][] = [
  [0.0, [0xe5, 0x53, 0x3f]], [0.2, [0xf0, 0x8a, 0x32]], [0.4, [0xd9, 0xd2, 0x4a]],
  [0.6, [0x86, 0xd4, 0x5a]], [0.8, [0x2b, 0xbf, 0x6a]], [1.0, [0x0f, 0x8f, 0x4e]],
];
function rampColor(v: number): [number, number, number] {
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [a, ca] = STOPS[i], [b, cb] = STOPS[i + 1];
    if (v <= b) { const f = Math.max(0, (v - a) / (b - a)); return [0, 1, 2].map(j => Math.round(ca[j] + (cb[j] - ca[j]) * f)) as [number, number, number]; }
  }
  return STOPS[STOPS.length - 1][1];
}
// Paleta por intervalos (una paleta de 256 colores hace la URL demasiado larga: error 414).
// 0 = nube/sin dato (transparente) · 1–127 = NDVI < 0 (gris) · 128–255 = NDVI 0..1 en 32 tramos.
const COLORMAP = JSON.stringify([
  [[0, 1], [0, 0, 0, 0]],
  [[1, 128], [0x64, 0x74, 0x8b, 255]],
  ...Array.from({ length: 32 }, (_, k) => {
    const lo = 128 + k * 4, hi = k < 31 ? lo + 4 : 256;
    const v = ((lo + hi) / 2 - 127.5) / 127.5;
    return [[lo, hi], [...rampColor(Math.min(1, Math.max(0, v))), 255]];
  }),
]);

type LatLng = { lat: number; lng: number };
type Stat = { mean?: number; min?: number; max?: number; valid_percent?: number };
type Candidate = { id: string; date: string; clear: number; mean: number; min: number | null; max: number | null };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function statsFor(item: { id: string; date: string }, feature: unknown): Promise<Candidate | null> {
  const q = new URLSearchParams({ collection: COLLECTION, item: item.id, expression: STATS_EXPR, asset_as_band: 'true' });
  const res = await fetch(`${PC}/data/v1/item/statistics?${q}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(feature),
  });
  if (!res.ok) return null;
  const j = await res.json();
  const st = Object.values((j?.properties?.statistics ?? {}) as Record<string, Stat>);
  if (st.length < 2) return null;
  const [clearSt, ndviSt] = st;
  // Si la imagen no cubre toda la huerta (borde de la franja), valid_percent < 100.
  const clear = (clearSt.mean ?? 0) * ((clearSt.valid_percent ?? 100) / 100);
  if (!(clear > 0) || !Number.isFinite(ndviSt.mean)) return null;
  const mean = (ndviSt.mean as number) / (clearSt.mean as number);
  const all = (clearSt.mean ?? 0) >= 0.999;
  return { id: item.id, date: item.date, clear: Math.min(1, clear), mean, min: all ? ndviSt.min ?? null : null, max: all ? ndviSt.max ?? null : null };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, reason: 'bad-request' }, 405);

  let outline: LatLng[];
  try {
    const body = await req.json();
    outline = (Array.isArray(body?.outline) ? body.outline : [])
      .map((p: { lat?: unknown; lng?: unknown }) => ({ lat: Number(p?.lat), lng: Number(p?.lng) }))
      .filter((p: LatLng) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) < 85 && Math.abs(p.lng) <= 180);
  } catch {
    return json({ ok: false, reason: 'bad-request' }, 400);
  }
  if (outline.length < 3 || outline.length > MAX_POINTS) return json({ ok: false, reason: 'bad-request' }, 400);

  const ring = outline.map(p => [p.lng, p.lat]);
  const [fx, fy] = ring[0], [lx, ly] = ring[ring.length - 1];
  if (fx !== lx || fy !== ly) ring.push([fx, fy]);
  const lats = outline.map(p => p.lat), lngs = outline.map(p => p.lng);
  const south = Math.min(...lats), north = Math.max(...lats), west = Math.min(...lngs), east = Math.max(...lngs);
  const k = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const mPerDeg = 111320;
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  const areaHa = (Math.abs(area) / 2) * mPerDeg * mPerDeg * k / 10000;
  if (areaHa > MAX_AREA_HA) return json({ ok: false, reason: 'too-large' });
  const geometry = { type: 'Polygon', coordinates: [ring] };
  const feature = { type: 'Feature', properties: {}, geometry };

  try {
    // 1) Imágenes recientes sobre la huerta.
    const to = new Date(), from = new Date(to.getTime() - DAYS * 86400000);
    const search = await fetch(`${PC}/stac/v1/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collections: [COLLECTION],
        intersects: geometry,
        datetime: `${from.toISOString()}/${to.toISOString()}`,
        query: { 'eo:cloud_cover': { lt: 85 } },
        sortby: [{ field: 'datetime', direction: 'desc' }],
        limit: 20,
      }),
    });
    if (!search.ok) return json({ ok: false, reason: 'upstream', detail: `stac ${search.status}` });
    const found = (await search.json())?.features ?? [];
    const items: { id: string; date: string }[] = found
      .map((f: { id: string; properties?: { datetime?: string } }) => ({ id: f.id, date: String(f.properties?.datetime ?? '').slice(0, 10) }))
      .filter((x: { id: string; date: string }) => x.id && x.date)
      .slice(0, MAX_CANDIDATES);
    if (!items.length) return json({ ok: false, reason: 'no-clear-image' });

    // 2) Estadística en lotes de 4 (de la más reciente a la más vieja), hasta hallar una despejada.
    let pick: Candidate | null = null;
    const seen: Candidate[] = [];
    for (let i = 0; i < items.length && !pick; i += 4) {
      const batch = await Promise.all(items.slice(i, i + 4).map(it => statsFor(it, feature).catch(() => null)));
      for (const c of batch) { if (c) seen.push(c); if (!pick && c && c.clear >= 0.6) pick = c; }
    }
    if (!pick) pick = [...seen].sort((a, b) => b.clear - a.clear).find(c => c.clear >= 0.3) ?? null;
    if (!pick) return json({ ok: false, reason: 'no-clear-image' });

    // 3) Imagen de la caja de la huerta + 15 m de margen, a ~10 m por píxel (resolución real del dato).
    const padLat = 15 / mPerDeg, padLng = 15 / (mPerDeg * k);
    const bS = south - padLat, bN = north + padLat, bW = west - padLng, bE = east + padLng;
    const wM = (bE - bW) * mPerDeg * k, hM = (bN - bS) * mPerDeg;
    const width = Math.min(512, Math.max(4, Math.round(wM / 10)));
    const height = Math.min(512, Math.max(4, Math.round(hM / 10)));
    const q = new URLSearchParams({
      collection: COLLECTION, item: pick.id, expression: IMG_EXPR, asset_as_band: 'true',
      rescale: '-1,1', colormap: COLORMAP,
    });
    const img = await fetch(`${PC}/data/v1/item/bbox/${bW},${bS},${bE},${bN}/${width}x${height}.png?${q}`);
    if (!img.ok) return json({ ok: false, reason: 'upstream', detail: `image ${img.status}` });
    const image = encodeBase64(new Uint8Array(await img.arrayBuffer()));
    return json({
      ok: true,
      date: pick.date,
      image,
      bounds: { south: bS, west: bW, north: bN, east: bE },
      stats: { mean: pick.mean, min: pick.min, max: pick.max, validPct: Math.round(pick.clear * 100) },
      source: 'Copernicus Sentinel-2 L2A · Microsoft Planetary Computer',
    });
  } catch (e) {
    return json({ ok: false, reason: 'upstream', detail: String((e as Error)?.message ?? e) });
  }
});
