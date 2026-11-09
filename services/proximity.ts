/**
 * Proximidad del usuario a una huerta (polígono real guardado en `huertas.coordinates`,
 * puntos `{ latitude, longitude }`).
 *
 * Se mide la distancia al BORDE del polígono, no al centro: una huerta grande o irregular puede
 * tener el centro lejos aunque el usuario esté junto a la cerca. Los cálculos son geodésicos locales:
 * los puntos se proyectan a metros alrededor del usuario (equirectangular), lo que da un error
 * despreciable a las distancias que importan aquí (cientos de metros a algunos km).
 *
 * La precisión del GPS se respeta: solo se declara "lejos" cuando incluso en el mejor caso
 * (distancia − precisión) se supera el umbral. Con histéresis para que no parpadee cerca del límite.
 */
export type GeoPoint = { latitude: number; longitude: number };
export type GpsFix = { latitude: number; longitude: number; accuracy: number | null };

/** Radio permitido alrededor del borde de la huerta. */
export const PROXIMITY_RADIUS_M = 100;
/** Histéresis: la alerta se activa por encima de ON y se apaga por debajo de OFF. */
export const PROXIMITY_ON_M = 110;
export const PROXIMITY_OFF_M = 90;
/** Con una precisión peor que esta no se puede afirmar que el usuario está cerca. */
export const MAX_USABLE_ACCURACY_M = 75;

export type ProximityState = 'inside' | 'near' | 'far' | 'imprecise' | 'unknown';
export type Proximity = { state: ProximityState; distanceM: number | null; accuracyM: number | null };

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function validPoint(p: { latitude?: unknown; longitude?: unknown } | null | undefined): p is GeoPoint {
  const lat = p?.latitude, lng = p?.longitude;
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

/**
 * Lee `huertas.coordinates` en cualquiera de los formatos que existen en la base:
 * objetos `{ latitude, longitude }` (los que guarda la app), `{ lat, lng }` o pares `[lat, lng]`
 * (mismo criterio que el procesador, processor/nucleo.py). También acepta el JSON como texto.
 */
export function normalizePolygon(raw: unknown): GeoPoint[] {
  let list = raw;
  if (typeof list === 'string') { try { list = JSON.parse(list); } catch { return []; } }
  if (!Array.isArray(list)) return [];
  const out: GeoPoint[] = [];
  for (const c of list) {
    let lat: unknown, lng: unknown;
    if (Array.isArray(c) && c.length >= 2) { lat = c[0]; lng = c[1]; }
    else if (c && typeof c === 'object') {
      const o = c as Record<string, unknown>;
      lat = o.latitude ?? o.lat; lng = o.longitude ?? o.lng;
    }
    const p = { latitude: Number(lat), longitude: Number(lng) };
    if (lat != null && lng != null && validPoint(p)) out.push(p);
  }
  return out;
}

/** Polígono limpio (sin puntos inválidos ni cierre repetido). null si no forma un área. */
export function cleanPolygon(points: GeoPoint[] | null | undefined): GeoPoint[] | null {
  const ring = normalizePolygon(points ?? []);
  if (ring.length > 1) {
    const a = ring[0], b = ring[ring.length - 1];
    if (a.latitude === b.latitude && a.longitude === b.longitude) ring.pop();
  }
  return ring.length >= 3 ? ring : null;
}

/** Punto dentro del polígono (ray casting en lat/lng; válido para huertas, que no cruzan el antimeridiano). */
export function pointInPolygon(p: GeoPoint, ring: GeoPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.latitude > p.latitude) !== (b.latitude > p.latitude)
      && p.longitude < ((b.longitude - a.longitude) * (p.latitude - a.latitude)) / (b.latitude - a.latitude) + a.longitude) {
      inside = !inside;
    }
  }
  return inside;
}

/** Distancia mínima en metros de `p` al perímetro del polígono. */
export function distanceToBoundaryM(p: GeoPoint, ring: GeoPoint[]): number {
  const k = Math.cos(rad(p.latitude));
  const xy = (q: GeoPoint) => [rad(q.longitude - p.longitude) * k * R, rad(q.latitude - p.latitude) * R] as const;
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = xy(ring[i]);
    const [bx, by] = xy(ring[(i + 1) % ring.length]);
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const cx = ax + t * dx, cy = ay + t * dy;
    best = Math.min(best, Math.hypot(cx, cy));
  }
  return best;
}

/**
 * Estado de proximidad.
 * - inside: GPS dentro del polígono (no se alerta, aunque la precisión sea mala).
 * - far: aun restando la precisión, el usuario queda más allá del umbral.
 * - near: fuera, pero dentro del radio con una lectura confiable.
 * - imprecise: la precisión del GPS no permite decidir (no se alerta).
 * - unknown: sin lectura válida o sin polígono.
 *
 * `wasFar` aplica la histéresis; `firstReading` usa el umbral base (100 m) en la primera evaluación.
 */
export function evaluateProximity(polygon: GeoPoint[] | null | undefined, fix: GpsFix | null, opts: { wasFar: boolean; firstReading: boolean }): Proximity {
  const ring = cleanPolygon(polygon);
  if (!ring || !fix || !validPoint(fix)) return { state: 'unknown', distanceM: null, accuracyM: fix?.accuracy ?? null };
  const acc = typeof fix.accuracy === 'number' && Number.isFinite(fix.accuracy) && fix.accuracy >= 0 ? fix.accuracy : null;
  if (pointInPolygon(fix, ring)) return { state: 'inside', distanceM: 0, accuracyM: acc };
  const d = distanceToBoundaryM(fix, ring);
  // Sin dato de precisión no se puede afirmar nada con seguridad.
  if (acc === null) return { state: 'imprecise', distanceM: d, accuracyM: null };
  const lower = d - acc;
  const threshold = opts.wasFar ? PROXIMITY_OFF_M : opts.firstReading ? PROXIMITY_RADIUS_M : PROXIMITY_ON_M;
  if (lower > threshold) return { state: 'far', distanceM: d, accuracyM: acc };
  // "Cerca" solo con una lectura confiable cuya distancia estimada cae dentro del radio;
  // si la estimación queda fuera pero la precisión no permite confirmarlo, no se afirma nada.
  if (acc <= MAX_USABLE_ACCURACY_M && d <= Math.max(threshold, PROXIMITY_RADIUS_M)) return { state: 'near', distanceM: d, accuracyM: acc };
  return { state: 'imprecise', distanceM: d, accuracyM: acc };
}
