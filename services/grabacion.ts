/**
 * Grabaciones: un video ya grabado (celular, dron o GoPro) se convierte en un escaneo SIN GPS.
 *
 * 1. Se toman fotos del video, repartidas a lo largo de su duración (frameTimes).
 * 2. El agricultor borra las que no sirven y arrastra cada foto a la zona de la huerta de donde viene
 *    (las mismas zonas A–D que muestra Satélite: services/satZones.ts).
 * 3. Se guarda como un recorrido local de tipo «grabacion» (las fotos llevan su zona y no llevan GPS)
 *    y se sube con la misma cola que los recorridos (services/recorridos.ts). El procesador no une
 *    fotos de zonas distintas y guarda la zona en cada hallazgo.
 *
 * La división en zonas se guarda junto con la grabación (recorridos.zonas): si después la huerta se
 * vuelve a dibujar, la grabación sigue mostrando las zonas que se usaron al clasificar.
 */
import { buildOrchardGeometry, type LatLng, type ZoneColor, type ZoneId } from './satZones';
import { createLocal, saveLocal, storePhoto, type Fuente, type RecorridoLocal } from './recorridos';

export type ZonaSnapshot = { id: ZoneId; color: ZoneColor; ring: LatLng[]; label: LatLng; share: number };

/** Mismos colores que la vista Satélite (components/satMapHtml.ts → ZONE_PALETTE). */
export const ZONE_UI: Record<ZoneColor, { fill: string; line: string; ink: string; soft: string }> = {
  cyan: { fill: '#22D3EE', line: '#0891B2', ink: '#053B45', soft: 'rgba(34,211,238,0.16)' },
  yellow: { fill: '#FACC15', line: '#CA8A04', ink: '#3F2D04', soft: 'rgba(250,204,21,0.18)' },
  pink: { fill: '#F472B6', line: '#DB2777', ink: '#4A0D2C', soft: 'rgba(244,114,182,0.16)' },
  green: { fill: '#84CC16', line: '#4D7C0F', ink: '#1A2E05', soft: 'rgba(132,204,22,0.18)' },
};

/** Una foto cada ~3 s de video; mínimo 4 y máximo 30 (las cortas no se quedan sin fotos y las largas no saturan). */
export const SECONDS_PER_FRAME = 3;
export const MIN_FRAMES = 4;
export const MAX_FRAMES = 30;
/** Videos más largos se aceptan, pero se reparten las 30 fotos en todo el video. */
export const MAX_VIDEO_MIN = 20;

/** Momentos (ms) del video donde se toma cada foto, repartidos y sin pegar al inicio ni al final. */
export function frameTimes(durationMs: number): number[] {
  const d = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
  if (!d) return Array.from({ length: 6 }, (_, i) => 500 + i * 1500); // duración desconocida: primeros ~8 s
  const n = Math.max(MIN_FRAMES, Math.min(MAX_FRAMES, Math.round(d / 1000 / SECONDS_PER_FRAME)));
  const margin = Math.min(400, d * 0.05);
  const span = Math.max(0, d - 2 * margin);
  return Array.from({ length: n }, (_, i) => Math.round(margin + (n === 1 ? span / 2 : (span * i) / (n - 1))));
}

/** Zonas de la huerta tal como las dibuja Satélite (redondeadas a ~10 cm). null si la huerta no admite zonas. */
export function zonasDeHuerta(coordinates: unknown, huertaId: string): ZonaSnapshot[] | null {
  const g = buildOrchardGeometry(coordinates, huertaId);
  if (!g.ok || !g.zones.length) return null;
  const r = (p: LatLng) => ({ lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 });
  return g.zones.map(z => ({ id: z.id, color: z.color, ring: z.ring.map(r), label: r(z.label), share: Math.round(z.share * 10) / 10 }));
}

/** Lee la copia guardada en recorridos.zonas (tolerante a datos viejos o dañados). */
export function parseZonas(raw: unknown): ZonaSnapshot[] {
  const list = Array.isArray(raw) ? raw : [];
  const ok = (p: unknown): p is LatLng => !!p && typeof p === 'object' && Number.isFinite((p as LatLng).lat) && Number.isFinite((p as LatLng).lng);
  return list.flatMap(z => {
    const o = z as Partial<ZonaSnapshot>;
    if (!o || !['A', 'B', 'C', 'D'].includes(String(o.id)) || !Array.isArray(o.ring)) return [];
    const ring = o.ring.filter(ok);
    if (ring.length < 3) return [];
    const color = (['cyan', 'yellow', 'pink', 'green'].includes(String(o.color)) ? o.color : 'green') as ZoneColor;
    return [{ id: o.id as ZoneId, color, ring, label: ok(o.label) ? o.label : ring[0], share: Number(o.share) || 0 }];
  });
}

export const zoneColorOf = (zonas: ZonaSnapshot[], id: string | null | undefined): ZoneColor | null =>
  zonas.find(z => z.id === id)?.color ?? null;

/**
 * Lugares para dibujar `n` hallazgos DENTRO de una zona (las fotos de un video no tienen GPS: solo se sabe la zona).
 * Determinista (siempre los mismos puntos), repartidos por la zona, lejos del borde y de la etiqueta de la zona.
 */
export function puntosEnZona(ring: LatLng[], label: LatLng, n: number): LatLng[] {
  if (n <= 0 || ring.length < 3) return [];
  const lat0 = ring.reduce((a, p) => a + p.lat, 0) / ring.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  // Coordenadas planas (x = lng corregida por latitud) para medir distancias.
  const xy = (p: LatLng): [number, number] => [p.lng * k, p.lat];
  const poly = ring.map(xy);
  const inside = (x: number, y: number) => {
    let r = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi) r = !r;
    }
    return r;
  };
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const size = Math.max(maxX - minX, maxY - minY);
  const L = xy(label);
  // Rejilla fina; se quedan los puntos con margen al borde (los 4 vecinos también dentro).
  const G = 24, m = size * 0.06, cands: [number, number][] = [];
  for (let i = 0; i <= G; i++) for (let j = 0; j <= G; j++) {
    const x = minX + ((maxX - minX) * i) / G, y = minY + ((maxY - minY) * j) / G;
    if (inside(x, y) && inside(x + m, y) && inside(x - m, y) && inside(x, y + m) && inside(x, y - m)) cands.push([x, y]);
  }
  const pool = cands.length ? cands : [L];
  const d2 = (a: [number, number], b: [number, number]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  // Muestreo del punto más lejano: cada hallazgo se aleja de los anteriores y de la etiqueta.
  const chosen: [number, number][] = [];
  const near = (c: [number, number]) => Math.min(d2(c, L) * 0.6, ...chosen.map(q => d2(c, q)));
  for (let t = 0; t < n; t++) {
    let best = pool[0], bestD = -1;
    for (const c of pool) { const d = near(c); if (d > bestD) { bestD = d; best = c; } }
    chosen.push(best);
  }
  return chosen.map(([x, y]) => ({ lat: y, lng: x / k }));
}

export type FrameAsignado = { uri: string; timeMs: number; zona: ZoneId | null };

/**
 * Guarda la grabación en el celular (igual que un recorrido terminado) para subirla.
 * Las fotos se mueven a la carpeta del escaneo; su hora es la de ahora + su momento en el video
 * (el video no trae GPS ni una hora confiable de cada cuadro).
 */
export async function guardarGrabacion(input: {
  userEmail: string;
  /** null: el agricultor eligió «No asignar a ninguna huerta». */
  huertaId: string | null;
  fuente: Fuente;
  zonas: ZonaSnapshot[] | null;
  frames: FrameAsignado[];
}): Promise<RecorridoLocal> {
  const base = Date.now();
  let rec = await createLocal(input.userEmail, input.huertaId, input.fuente);
  rec = { ...rec, tipo: 'grabacion', zonas: input.zonas };
  const fotos = [];
  const ordered = [...input.frames].sort((a, b) => a.timeMs - b.timeMs);
  for (const f of ordered) {
    const foto = await storePhoto({ ...rec, fotos }, f.uri, null, new Date(base + f.timeMs).toISOString());
    fotos.push({ ...foto, zona: f.zona });
  }
  const last = ordered.length ? ordered[ordered.length - 1].timeMs : 0;
  rec = { ...rec, fotos, estado: 'guardado', iniciadoAt: new Date(base).toISOString(), terminadoAt: new Date(base + last).toISOString() };
  await saveLocal(rec);
  return rec;
}
