/**
 * Resolución de huerta ANTES de una captura (Foto individual y Recorrido inteligente).
 *
 * 1. Huertas del usuario (`huertas` filtradas por su correo).
 * 2. Ubicación GPS actual y su precisión.
 * 3. Punto dentro del polígono real (`huertas.coordinates`; nunca el centro ni un radio).
 * 4. Una sola huerta, con la lectura bien adentro → se asigna sola.
 *    Cualquier duda (fuera, varias huertas, GPS impreciso o sin permiso) → selección manual.
 *
 * El resultado se decide una vez y se conserva durante toda la captura: no se vuelve a calcular
 * después de tomar la foto ni al procesar el recorrido.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { listOrchards, type Orchard } from './orchards';
import { cleanPolygon, distanceToBoundaryM, pointInPolygon } from './proximity';
import { withTimeout } from './timeout';

/** Peor precisión aceptada para asignar sola una huerta. */
export const MAX_AUTO_ACCURACY_M = 30;
const GPS_TIMEOUT_MS = 9000;
/** Llamadas que deberían ser instantáneas (estado del GPS, permisos ya dados). */
const QUICK_MS = 4000;
/** Diálogo de permiso: el usuario puede tardar; si el sistema nunca lo muestra, no se espera para siempre. */
const DIALOG_MS = 30000;
/** Huertas desde Supabase: en campo puede no haber señal. */
const ORCHARDS_MS = 6000;
const cacheKey = (email: string) => `avx_huertas_cache_${email}`;

/**
 * Huertas del usuario con respaldo sin conexión: si Supabase no responde a tiempo, se usa la última
 * lista guardada en el celular (el recorrido funciona sin internet y la huerta se puede elegir igual).
 */
async function loadOrchards(userEmail: string): Promise<Orchard[]> {
  const fresh = await withTimeout(listOrchards(userEmail).then(list => list as Orchard[] | null), ORCHARDS_MS, null);
  if (fresh) {
    AsyncStorage.setItem(cacheKey(userEmail), JSON.stringify(fresh)).catch(() => {});
    return fresh;
  }
  const raw = await withTimeout(AsyncStorage.getItem(cacheKey(userEmail)), QUICK_MS, null);
  if (raw) { try { return JSON.parse(raw) as Orchard[]; } catch { /* caché dañada */ } }
  throw new Error('No se pudieron cargar las huertas');
}

export type ManualReason =
  | 'outside'       // fuera de todas las huertas
  | 'no-permission' // sin permiso de ubicación
  | 'gps-off'       // ubicación del sistema desactivada
  | 'no-fix'        // sin lectura GPS válida
  | 'imprecise'     // la precisión no permite afirmar en qué huerta está
  | 'overlap'       // el punto cae en varias huertas
  | 'no-orchards'   // el usuario no tiene huertas
  | 'load-error';   // no se pudieron leer las huertas

export type HuertaResolution =
  | { kind: 'auto'; huerta: Orchard; orchards: Orchard[]; accuracyM: number }
  | { kind: 'manual'; reason: ManualReason; orchards: Orchard[]; candidates: string[]; accuracyM: number | null };

export type GpsFix = { latitude: number; longitude: number; accuracy: number | null };

/**
 * Decisión pura (sin GPS ni red): qué huerta contiene la lectura. Exportada para probarla.
 * Auto solo si el punto está en UNA huerta y a más de `accuracy` metros de su borde.
 */
export function decideHuerta(orchards: Orchard[], fix: GpsFix | null): HuertaResolution {
  if (!orchards.length) return { kind: 'manual', reason: 'no-orchards', orchards, candidates: [], accuracyM: fix?.accuracy ?? null };
  if (!fix) return { kind: 'manual', reason: 'no-fix', orchards, candidates: [], accuracyM: null };
  const acc = typeof fix.accuracy === 'number' && Number.isFinite(fix.accuracy) ? fix.accuracy : null;
  const point = { latitude: fix.latitude, longitude: fix.longitude };
  const inside = orchards.filter(o => {
    const ring = cleanPolygon(o.coordinates);
    return !!ring && pointInPolygon(point, ring);
  });
  if (inside.length > 1) return { kind: 'manual', reason: 'overlap', orchards, candidates: inside.map(o => o.id), accuracyM: acc };
  if (inside.length === 0) {
    // Fuera de todas: con precisión conocida y todas las huertas más lejos que el error, es seguro.
    const nearest = Math.min(...orchards.map(o => { const r = cleanPolygon(o.coordinates); return r ? distanceToBoundaryM(point, r) : Infinity; }));
    return { kind: 'manual', reason: acc !== null && nearest > acc ? 'outside' : 'imprecise', orchards, candidates: [], accuracyM: acc };
  }
  if (acc === null || acc > MAX_AUTO_ACCURACY_M) {
    return { kind: 'manual', reason: 'imprecise', orchards, candidates: inside.map(o => o.id), accuracyM: acc };
  }
  const ring = cleanPolygon(inside[0].coordinates)!;
  // Pegado al borde, el círculo de error cruza la cerca: no se afirma que está adentro.
  if (distanceToBoundaryM(point, ring) < acc) {
    return { kind: 'manual', reason: 'imprecise', orchards, candidates: [inside[0].id], accuracyM: acc };
  }
  return { kind: 'auto', huerta: inside[0], orchards, accuracyM: acc };
}

/** Lectura GPS actual (con permiso). null si no hay una en GPS_TIMEOUT_MS. */
async function currentFix(): Promise<GpsFix | null> {
  const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), GPS_TIMEOUT_MS));
  try {
    const pos = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), timeout]);
    if (pos) return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null };
  } catch { /* se intenta la última conocida */ }
  try {
    const last = await withTimeout(Location.getLastKnownPositionAsync({ maxAge: 30000, requiredAccuracy: MAX_AUTO_ACCURACY_M }), QUICK_MS, null);
    if (last) return { latitude: last.coords.latitude, longitude: last.coords.longitude, accuracy: last.coords.accuracy ?? null };
  } catch { /* sin lectura */ }
  return null;
}

/**
 * Resuelve la huerta de la captura que el usuario está por iniciar.
 * `orchards` evita volver a consultarlas si la pantalla ya las tiene.
 * Nunca lanza: ante cualquier fallo devuelve selección manual con el motivo.
 */
export async function resolveScanHuerta(userEmail: string, orchards?: Orchard[]): Promise<HuertaResolution> {
  let list: Orchard[];
  try {
    list = orchards?.length ? orchards : await loadOrchards(userEmail);
  } catch {
    return { kind: 'manual', reason: 'load-error', orchards: [], candidates: [], accuracyM: null };
  }
  // Solo huertas del mismo usuario (defensa extra si la lista vino de otro lado).
  list = list.filter(o => o.user_email === userEmail);
  if (!list.length) return decideHuerta(list, null);

  try {
    const enabled = await withTimeout(Location.hasServicesEnabledAsync(), QUICK_MS, true);
    if (!enabled) return { kind: 'manual', reason: 'gps-off', orchards: list, candidates: [], accuracyM: null };
    let perm = await withTimeout(Location.getForegroundPermissionsAsync(), QUICK_MS, null);
    if (perm && !perm.granted && perm.canAskAgain !== false) perm = await withTimeout(Location.requestForegroundPermissionsAsync(), DIALOG_MS, null);
    if (!perm?.granted) return { kind: 'manual', reason: 'no-permission', orchards: list, candidates: [], accuracyM: null };
  } catch {
    return { kind: 'manual', reason: 'no-fix', orchards: list, candidates: [], accuracyM: null };
  }
  return decideHuerta(list, await currentFix());
}
