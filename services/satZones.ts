/**
 * Zonas ilustrativas de Datos Satelitales.
 *
 * Divide el polígono REAL de una huerta en cuatro zonas geométricas (A–D) para la vista de capas.
 * - Son una subdivisión visual del terreno, no mediciones: no llevan NDVI ni niveles de riesgo.
 * - Son estables: la semilla sale del id de la huerta, así que cada huerta conserva su composición.
 * - Siempre quedan dentro del perímetro: cada zona es el polígono recortado por semiplanos.
 * - Las coordenadas guardadas no se modifican; solo se leen.
 */

export type LatLng = { lat: number; lng: number };
export type ZoneId = 'A' | 'B' | 'C' | 'D';
export type ZoneColor = 'cyan' | 'yellow' | 'pink' | 'green';

export type Zone = {
  id: ZoneId;
  color: ZoneColor;
  /** Contorno de la zona (puede incluir puentes de ancho cero si la huerta es cóncava). */
  ring: LatLng[];
  /** Punto interior para la etiqueta. */
  label: LatLng;
  areaM2: number;
  /** Porcentaje de la huerta (0–100). */
  share: number;
  /** Líneas de surco recortadas a la zona. */
  rows: [LatLng, LatLng][];
};

export type OrchardGeometry =
  | { ok: true; outline: LatLng[]; zones: Zone[]; marks: [LatLng, LatLng][]; areaM2: number; zonesNote: null }
  | { ok: true; outline: LatLng[]; zones: []; marks: []; areaM2: number; zonesNote: 'self-intersecting' | 'too-small' }
  | { ok: false; reason: 'no-points' };

export const ZONE_ORDER: ZoneId[] = ['A', 'B', 'C', 'D'];
export const ZONE_COLOR: Record<ZoneId, ZoneColor> = { A: 'cyan', B: 'yellow', C: 'pink', D: 'green' };

type P = { x: number; y: number };

// ───────────────────────── Lectura de coordenadas ─────────────────────────

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function readPoint(v: unknown): LatLng | null {
  if (Array.isArray(v) && v.length >= 2) {
    // GeoJSON: [lng, lat]
    const lng = num(v[0]), lat = num(v[1]);
    return lat === null || lng === null ? null : { lat, lng };
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const lat = num(o.latitude ?? o.lat);
    const lng = num(o.longitude ?? o.lng ?? o.lon);
    return lat === null || lng === null ? null : { lat, lng };
  }
  return null;
}

/**
 * Interpreta `huertas.coordinates`. El formato de la app es [{ latitude, longitude }, ...]
 * (ver supabase/migrations/20260911_create_huertas.sql); también acepta {lat,lng}, pares GeoJSON
 * [lng,lat] y un objeto GeoJSON Polygon, por si hay filas antiguas o cargadas a mano.
 */
export function parseCoordinates(raw: unknown): LatLng[] {
  let list: unknown = raw;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { return []; }
  }
  if (list && typeof list === 'object' && !Array.isArray(list)) {
    const g = list as { type?: string; coordinates?: unknown };
    if (g.type === 'Polygon' && Array.isArray(g.coordinates)) list = g.coordinates[0];
  }
  if (!Array.isArray(list)) return [];
  const out: LatLng[] = [];
  for (const item of list) {
    const p = readPoint(item);
    if (!p || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) continue;
    const prev = out[out.length - 1];
    if (prev && prev.lat === p.lat && prev.lng === p.lng) continue;
    out.push(p);
  }
  // Anillo cerrado: se quita el punto repetido del final.
  if (out.length > 1) {
    const a = out[0], b = out[out.length - 1];
    if (a.lat === b.lat && a.lng === b.lng) out.pop();
  }
  return out;
}

// ───────────────────────── Proyección local (metros) ─────────────────────────

function projector(points: LatLng[]) {
  const lat0 = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng0 = points.reduce((s, p) => s + p.lng, 0) / points.length;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110540;
  return {
    to: (p: LatLng): P => ({ x: (p.lng - lng0) * kx, y: (p.lat - lat0) * ky }),
    from: (p: P): LatLng => ({ lat: lat0 + p.y / ky, lng: lng0 + p.x / kx }),
  };
}

// ───────────────────────── Utilidades geométricas ─────────────────────────

export function signedArea(poly: P[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}
const area = (poly: P[]) => Math.abs(signedArea(poly));

function segmentsCross(a: P, b: P, c: P, d: P): boolean {
  const o = (p: P, q: P, r: P) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** ¿El contorno se cruza a sí mismo? (aristas no contiguas que se intersectan) */
export function selfIntersects(poly: P[]): boolean {
  const n = poly.length;
  if (n > 400) return false; // contornos muy densos: se confía en la validación de la base (ST_IsValid)
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(a, b, poly[j], poly[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** Recorta el polígono al semiplano n·p <= c (Sutherland–Hodgman). */
function clipHalf(poly: P[], nx: number, ny: number, c: number): P[] {
  const out: P[] = [];
  const f = (p: P) => nx * p.x + ny * p.y - c;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const fp = f(p), fq = f(q);
    if (fp <= 0) out.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq);
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
  }
  // Quita vértices repetidos seguidos.
  return out.filter((p, i) => {
    const q = out[(i + 1) % out.length];
    return out.length < 2 || Math.abs(p.x - q.x) > 1e-9 || Math.abs(p.y - q.y) > 1e-9;
  });
}

/** Corta el polígono con una recta de ángulo `theta` que deja `fraction` del área de un lado. */
function splitByArea(poly: P[], theta: number, fraction: number): [P[], P[]] {
  const nx = Math.cos(theta), ny = Math.sin(theta);
  const proj = poly.map(p => nx * p.x + ny * p.y);
  let lo = Math.min(...proj), hi = Math.max(...proj);
  const total = area(poly);
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (area(clipHalf(poly, nx, ny, mid)) / total < fraction) lo = mid; else hi = mid;
  }
  const c = (lo + hi) / 2;
  return [clipHalf(poly, nx, ny, c), clipHalf(poly, -nx, -ny, -c)];
}

function pointInPoly(p: P, poly: P[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distToSegment(p: P, a: P, b: P): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Punto interior más alejado del borde (búsqueda en rejilla): sirve para colocar la etiqueta. */
function labelPoint(poly: P[]): P {
  const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  let best: P | null = null, bestD = -1;
  const N = 22;
  for (let i = 1; i < N; i++) {
    for (let j = 1; j < N; j++) {
      const p = { x: minX + ((maxX - minX) * i) / N, y: minY + ((maxY - minY) * j) / N };
      if (!pointInPoly(p, poly)) continue;
      let d = Infinity;
      for (let k = 0; k < poly.length; k++) d = Math.min(d, distToSegment(p, poly[k], poly[(k + 1) % poly.length]));
      if (d > bestD) { bestD = d; best = p; }
    }
  }
  if (best) return best;
  const a = signedArea(poly) || 1;
  let cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f; cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

/** Rectas paralelas (ángulo `theta`, separación `gap`) recortadas al polígono, incluso si es cóncavo. */
function hatch(poly: P[], theta: number, gap: number, limit: number): [P, P][] {
  const dx = Math.cos(theta), dy = Math.sin(theta); // dirección de la recta
  const nx = -dy, ny = dx; // normal
  const proj = poly.map(p => nx * p.x + ny * p.y);
  const lo = Math.min(...proj), hi = Math.max(...proj);
  const out: [P, P][] = [];
  for (let c = lo + gap / 2; c < hi && out.length < limit; c += gap) {
    const ts: number[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const fa = nx * a.x + ny * a.y - c, fb = nx * b.x + ny * b.y - c;
      if ((fa < 0 && fb >= 0) || (fa >= 0 && fb < 0)) {
        const t = fa / (fa - fb);
        const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        ts.push(dx * x + dy * y);
      }
    }
    ts.sort((a, b) => a - b);
    for (let k = 0; k + 1 < ts.length; k += 2) {
      if (ts[k + 1] - ts[k] < gap * 0.4) continue;
      const at = (t: number): P => ({ x: nx * c + dx * t, y: ny * c + dy * t });
      out.push([at(ts[k]), at(ts[k + 1])]);
    }
  }
  return out;
}

// ───────────────────────── Semilla estable ─────────────────────────

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ángulo de la arista más larga: los surcos suelen ir paralelos a un lindero. */
function dominantAngle(poly: P[]): number {
  let best = 0, len = -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l > len) { len = l; best = Math.atan2(b.y - a.y, b.x - a.x); }
  }
  return best;
}

// ───────────────────────── Partición ─────────────────────────

function partition(poly: P[], seedKey: string): P[][] {
  const rand = mulberry32(hashString(seedKey));
  const total = area(poly);
  const base = dominantAngle(poly);
  let best: P[][] = [];
  let bestScore = -1;
  for (let attempt = 0; attempt < 14; attempt++) {
    // Primer corte diagonal respecto al lindero principal; luego un corte en cada mitad con otro ángulo.
    const t1 = base + Math.PI / 2 + (rand() - 0.5) * 1.1;
    const f1 = 0.4 + rand() * 0.22;
    const [p1, p2] = splitByArea(poly, t1, f1);
    const t2 = t1 + (rand() < 0.5 ? 1 : -1) * (0.55 + rand() * 0.6);
    const t3 = t1 + (rand() < 0.5 ? 1 : -1) * (0.45 + rand() * 0.7);
    const [a, b] = p1.length >= 3 ? splitByArea(p1, t2, 0.36 + rand() * 0.28) : [[], []];
    const [c, d] = p2.length >= 3 ? splitByArea(p2, t3, 0.36 + rand() * 0.28) : [[], []];
    const parts = [a, b, c, d];
    // Puntuación: la zona más chica debe ser al menos ~9 % de la huerta.
    const minShare = Math.min(...parts.map(p => (p.length >= 3 ? area(p) : 0))) / total;
    if (minShare > bestScore) { bestScore = minShare; best = parts; }
    if (minShare >= 0.09) break;
  }
  return best.filter(p => p.length >= 3 && area(p) / total > 0.01);
}

/**
 * Geometría para la vista de capas: contorno real + zonas ilustrativas estables.
 * @param seedKey id de la huerta (la composición depende solo de este valor y del contorno).
 */
export function buildOrchardGeometry(rawCoordinates: unknown, seedKey: string): OrchardGeometry {
  const outline = parseCoordinates(rawCoordinates);
  if (outline.length < 3) return { ok: false, reason: 'no-points' };
  const pr = projector(outline);
  let poly = outline.map(pr.to);
  const total = area(poly);
  if (selfIntersects(poly)) return { ok: true, outline, zones: [], marks: [], areaM2: total, zonesNote: 'self-intersecting' };
  if (total < 25) return { ok: true, outline, zones: [], marks: [], areaM2: total, zonesNote: 'too-small' };
  if (signedArea(poly) < 0) poly = [...poly].reverse();

  const parts = partition(poly, seedKey);
  const size = Math.sqrt(total);
  const gap = Math.max(2.2, size / 30);
  const base = dominantAngle(poly);
  const rand = mulberry32(hashString(`${seedKey}:rows`));

  // Orden de lectura: de norte a sur y de oeste a este, como en la referencia (A arriba).
  const withLabel = parts.map(p => ({ p, l: labelPoint(p) }));
  withLabel.sort((u, v) => (Math.abs(u.l.y - v.l.y) > size * 0.12 ? v.l.y - u.l.y : u.l.x - v.l.x));

  const zones: Zone[] = withLabel.slice(0, 4).map(({ p, l }, i) => {
    const id = ZONE_ORDER[i];
    // Surcos paralelos al lindero o perpendiculares, según la zona (estable por huerta).
    const theta = base + (rand() < 0.5 ? 0 : Math.PI / 2) + (rand() - 0.5) * 0.18;
    const a = area(p);
    return {
      id,
      color: ZONE_COLOR[id],
      ring: p.map(pr.from),
      label: pr.from(l),
      areaM2: a,
      share: (a / total) * 100,
      rows: hatch(p, theta, gap, 90).map(([u, v]) => [pr.from(u), pr.from(v)] as [LatLng, LatLng]),
    };
  });

  // Retícula de "+" sobre la huerta (marcas de muestreo visual, como en la referencia).
  const marks: [LatLng, LatLng][] = [];
  const step = Math.max(6, size / 9);
  const arm = Math.max(0.9, step * 0.09);
  const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
  for (let x = Math.min(...xs) + step / 2; x < Math.max(...xs); x += step) {
    for (let y = Math.min(...ys) + step / 2; y < Math.max(...ys); y += step) {
      const c = { x, y };
      if (!pointInPoly(c, poly)) continue;
      marks.push([pr.from({ x: x - arm, y }), pr.from({ x: x + arm, y })]);
      marks.push([pr.from({ x, y: y - arm }), pr.from({ x, y: y + arm })]);
      if (marks.length > 360) break;
    }
  }

  return { ok: true, outline, zones, marks, areaM2: total, zonesNote: null };
}

/** Exportado para pruebas. */
export const __test = { partition, clipHalf, area, pointInPoly, hashString };
