/**
 * ndvi-huerta — mapa de vigor (NDVI) de una huerta con Sentinel-2 (Copernicus Data Space Ecosystem).
 *
 * POST { outline: [{ lat, lng }, ...] }
 *   → { ok: true, date, image (PNG base64), bounds, stats: { mean, min, max, validPct }, source }
 *   → { ok: false, reason: 'not-configured' | 'bad-request' | 'too-large' | 'no-clear-image' | 'upstream' }
 *
 * Cómo funciona (2 llamadas a Copernicus, ambas recortadas al contorno de la huerta):
 *  1. Statistical API, últimos 75 días por día: NDVI medio/mín/máx y cuántos píxeles se vieron despejados
 *     (sin nubes, sombras ni nieve según la capa SCL). Se elige la fecha más reciente con ≥ 60 % de la huerta
 *     despejada (si ninguna llega, la de mayor cobertura con ≥ 30 %).
 *  2. Process API de esa fecha: PNG coloreado con la misma escala de NDVI de la app; fuera del contorno y en
 *     nubes queda transparente. Se pide a 1.25 m por píxel (máx. 512 px) con remuestreo bicúbico para que se vea suave
 *     (el dato real sigue siendo de 10 m por píxel).
 *
 * Todo se pide en EPSG:3857 (Web Mercator), el mismo sistema del mapa de la app: la imagen encaja exacta con
 * L.imageOverlay sobre sus esquinas.
 *
 * Secretos (supabase secrets set …): CDSE_CLIENT_ID, CDSE_CLIENT_SECRET (cliente OAuth de
 * https://shapps.dataspace.copernicus.eu/dashboard → User settings → OAuth clients).
 * Datos: Copernicus Sentinel-2, libres y gratuitos incluso para uso comercial (atribución «Copernicus Sentinel data»).
 */
import { encodeBase64 } from '@std/encoding/base64';

const TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const STATS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/statistics';
const PROCESS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/process';
const CRS_3857 = 'http://www.opengis.net/def/crs/EPSG/0/3857';
const R = 6378137;
const DAYS = 75;
const MAX_POINTS = 600;
const MAX_AREA_HA = 3000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Píxel «despejado»: datos válidos y clase SCL de superficie (4 vegetación, 5 sin vegetación, 6 agua, 7 sin
// clasificar). Fuera: 0 sin datos, 1 saturado, 2 áreas oscuras, 3 sombra de nube, 8–10 nubes/cirros, 11 nieve.
const CLEAR = 's.dataMask===1&&(s.SCL===4||s.SCL===5||s.SCL===6||s.SCL===7)';

const STATS_SCRIPT = `//VERSION=3
function setup(){return{input:[{bands:["B04","B08","SCL","dataMask"]}],output:[{id:"ndvi",bands:1,sampleType:"FLOAT32"},{id:"dataMask",bands:1}]};}
function evaluatePixel(s){var clear=${CLEAR};var d=s.B08+s.B04;var v=d>0?(s.B08-s.B04)/d:0;return{ndvi:[v],dataMask:[clear?1:0]};}`;

// Misma escala que services/indices.ts (NDVI): rojo suelo desnudo → verde vegetación densa.
const VIS_SCRIPT = `//VERSION=3
function setup(){return{input:["B04","B08","SCL","dataMask"],output:{bands:4}};}
var viz=new ColorRampVisualizer([[0.0,0xE5533F],[0.2,0xF08A32],[0.4,0xD9D24A],[0.6,0x86D45A],[0.8,0x2BBF6A],[0.9,0x0F8F4E]]);
function evaluatePixel(s){if(!(${CLEAR}))return[0,0,0,0];var d=s.B08+s.B04;var v=d>0?(s.B08-s.B04)/d:0;var c=viz.process(v);return[c[0],c[1],c[2],1];}`;

type LatLng = { lat: number; lng: number };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const toMerc = (p: LatLng): [number, number] => [
  (R * p.lng * Math.PI) / 180,
  R * Math.log(Math.tan(Math.PI / 4 + (p.lat * Math.PI) / 360)),
];
const toLatLng = (x: number, y: number): LatLng => ({
  lat: ((2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180) / Math.PI,
  lng: ((x / R) * 180) / Math.PI,
});

// Token OAuth en memoria mientras la función siga viva (dura ~10 min).
let token: { value: string; until: number } | null = null;
async function getToken(id: string, secret: string): Promise<string> {
  if (token && Date.now() < token.until) return token.value;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  const j = await res.json();
  token = { value: j.access_token, until: Date.now() + Math.max(60, (j.expires_in ?? 600) - 60) * 1000 };
  return token.value;
}

type DayStat = { date: string; mean: number; min: number; max: number; valid: number };

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, reason: 'bad-request' }, 405);

  const id = Deno.env.get('CDSE_CLIENT_ID');
  const secret = Deno.env.get('CDSE_CLIENT_SECRET');
  if (!id || !secret) return json({ ok: false, reason: 'not-configured' });

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

  // Contorno en Web Mercator (anillo cerrado) y su caja.
  const ring = outline.map(toMerc);
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx !== lx || fy !== ly) ring.push([fx, fy]);
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  let areaMerc = 0;
  for (let i = 0; i < ring.length - 1; i++) areaMerc += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  areaMerc = Math.abs(areaMerc) / 2;
  const lat0 = outline.reduce((a, p) => a + p.lat, 0) / outline.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const areaHa = (areaMerc * k * k) / 10000;
  if (areaHa > MAX_AREA_HA) return json({ ok: false, reason: 'too-large' });
  const geometry = { type: 'Polygon', coordinates: [ring] };
  // Píxeles de 10 m reales dentro del contorno (en unidades de Mercator el píxel mide 10/k).
  const res10 = 10 / k;
  const expected = Math.max(1, areaMerc / (res10 * res10));

  try {
    const auth = { Authorization: `Bearer ${await getToken(id, secret)}`, 'Content-Type': 'application/json' };

    // 1) Estadística diaria → fecha despejada más reciente.
    const to = new Date();
    const from = new Date(to.getTime() - DAYS * 86400000);
    const statsRes = await fetch(STATS_URL, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        input: {
          bounds: { geometry, properties: { crs: CRS_3857 } },
          data: [{ type: 'sentinel-2-l2a', dataFilter: { maxCloudCoverage: 80 } }],
        },
        aggregation: {
          timeRange: { from: from.toISOString(), to: to.toISOString() },
          aggregationInterval: { of: 'P1D' },
          evalscript: STATS_SCRIPT,
          resx: res10,
          resy: res10,
        },
        calculations: { default: {} },
      }),
    });
    if (!statsRes.ok) return json({ ok: false, reason: 'upstream', detail: `stats ${statsRes.status}` });
    const stats = await statsRes.json();
    const days: DayStat[] = [];
    for (const d of stats?.data ?? []) {
      const st = d?.outputs?.ndvi?.bands?.B0?.stats;
      if (!st || d?.error) continue;
      const valid = (st.sampleCount ?? 0) - (st.noDataCount ?? 0);
      if (valid <= 0 || !Number.isFinite(st.mean)) continue;
      days.push({ date: String(d.interval.from).slice(0, 10), mean: st.mean, min: st.min, max: st.max, valid: Math.min(1, valid / expected) });
    }
    days.sort((a, b) => (a.date < b.date ? 1 : -1));
    const pick = days.find(d => d.valid >= 0.6) ?? [...days].sort((a, b) => b.valid - a.valid).find(d => d.valid >= 0.3);
    if (!pick) return json({ ok: false, reason: 'no-clear-image' });

    // 2) Imagen coloreada de esa fecha.
    const wM = (maxX - minX) * k, hM = (maxY - minY) * k;
    const scale = Math.min(512 / Math.max(wM / 1.25, hM / 1.25, 1), 1);
    const width = Math.max(32, Math.round((wM / 1.25) * scale));
    const height = Math.max(32, Math.round((hM / 1.25) * scale));
    const dayFrom = `${pick.date}T00:00:00Z`;
    const dayTo = `${pick.date}T23:59:59Z`;
    const imgRes = await fetch(PROCESS_URL, {
      method: 'POST',
      headers: { ...auth, Accept: 'image/png' },
      body: JSON.stringify({
        input: {
          bounds: { bbox: [minX, minY, maxX, maxY], geometry, properties: { crs: CRS_3857 } },
          data: [{
            type: 'sentinel-2-l2a',
            dataFilter: { timeRange: { from: dayFrom, to: dayTo }, mosaickingOrder: 'mostRecent' },
            processing: { upsampling: 'BICUBIC' },
          }],
        },
        output: { width, height, responses: [{ identifier: 'default', format: { type: 'image/png' } }] },
        evalscript: VIS_SCRIPT,
      }),
    });
    if (!imgRes.ok) return json({ ok: false, reason: 'upstream', detail: `process ${imgRes.status}` });
    const image = encodeBase64(new Uint8Array(await imgRes.arrayBuffer()));
    const sw = toLatLng(minX, minY), ne = toLatLng(maxX, maxY);
    return json({
      ok: true,
      date: pick.date,
      image,
      bounds: { south: sw.lat, west: sw.lng, north: ne.lat, east: ne.lng },
      stats: { mean: pick.mean, min: pick.min, max: pick.max, validPct: Math.round(pick.valid * 100) },
      source: 'Copernicus Sentinel-2 L2A',
    });
  } catch (e) {
    return json({ ok: false, reason: 'upstream', detail: String((e as Error)?.message ?? e) });
  }
});
