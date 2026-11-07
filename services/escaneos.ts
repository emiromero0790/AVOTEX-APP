/**
 * Datos de "Mis escaneos": hallazgos, puntos de captura y fotos individuales.
 * Solo se leen columnas que existen; las opcionales (migración 20261107) tienen respaldo.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { supabase } from '../supabaseConfig';
import { distanceMeters, isHealthy, type PuntoRuta } from './recorridos';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const BUCKET = 'recorridos';

export type LatLng = { lat: number; lng: number };

export function validCoord(lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

// ───────────────────────── hallazgos ─────────────────────────

export type HallazgoMapa = {
  id: string;
  recorrido_id: string;
  huerta_id: string | null;
  tomada_at: string;
  lat: number | null;
  lng: number | null;
  fruto: string;
  estado: string;
  confianza: number;
  miniatura_path: string | null;
};

/**
 * Categoría visual de un hallazgo, derivada solo de lo que devolvió el modelo:
 * - revisar: confianza menor a 60 % (resultado incierto).
 * - sano: estado saludable.
 * - enfermo: cualquier otro estado del modelo (posible enfermedad).
 * - otro: el modelo indicó que no era un fruto.
 */
export type CategoriaHallazgo = 'sano' | 'enfermo' | 'revisar' | 'otro';
export const UMBRAL_CONFIANZA = 0.6;

export function categoria(h: Pick<HallazgoMapa, 'fruto' | 'estado' | 'confianza'>): CategoriaHallazgo {
  const f = (h.fruto ?? '').toLowerCase().replace(/\s/g, '');
  if (f === 'nofruta' || f === 'notafruit') return 'otro';
  if (typeof h.confianza === 'number' && h.confianza < UMBRAL_CONFIANZA) return 'revisar';
  return isHealthy(h.estado ?? '') ? 'sano' : 'enfermo';
}

export async function listUserHallazgos(userEmail: string): Promise<HallazgoMapa[]> {
  const { data, error } = await supabase
    .from('hallazgos')
    .select('id,recorrido_id,huerta_id,tomada_at,lat,lng,fruto,estado,confianza,miniatura_path')
    .eq('user_email', userEmail)
    .order('tomada_at', { ascending: true })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as HallazgoMapa[];
}

// ───────────────────────── puntos de captura ─────────────────────────

export type FotoPunto = { id: string; lat: number; lng: number; orden: number; tomada_at: string; uri?: string | null };

/** Fotos de un recorrido con GPS válido, en orden de captura (las originales ya no se pueden ver). */
export async function listRecorridoFotos(recorridoId: string): Promise<FotoPunto[]> {
  const { data, error } = await supabase
    .from('recorrido_fotos')
    .select('id,lat,lng,orden,tomada_at')
    .eq('recorrido_id', recorridoId)
    .order('tomada_at', { ascending: true })
    .limit(1500);
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string; lat: number | null; lng: number | null; orden: number; tomada_at: string }>)
    .filter(f => validCoord(f.lat, f.lng))
    .map(f => ({ id: f.id, lat: f.lat as number, lng: f.lng as number, orden: f.orden, tomada_at: f.tomada_at }));
}

// ───────────────────────── recorridos ─────────────────────────

export function cleanRoute(ruta: PuntoRuta[] | null | undefined): LatLng[] {
  return (ruta ?? []).filter(p => validCoord(p?.lat, p?.lng)).map(p => ({ lat: p.lat, lng: p.lng }));
}

export function routeMeters(points: LatLng[]): number {
  let m = 0;
  for (let i = 1; i < points.length; i++) m += distanceMeters(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  return m;
}

export function durationMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60000) : null;
}

// ───────────────────────── fotos individuales (tabla scans) ─────────────────────────

export type SingleScan = {
  id: string | null;
  fruto: string | null;
  label: string | null;
  score: number | null;
  created_at: string;
  lat: number | null;
  lng: number | null;
  imagen_path: string | null;
  huerta_id: string | null;
};

const SCAN_BASE = 'fruto,label,score,created_at';
const SCAN_EXTRA = 'id,lat,lng,imagen_path,huerta_id';

function missingColumn(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === '42703' || error.code === 'PGRST204' || /column/i.test(String(error.message)));
}

/** Lee las fotos individuales; sin las migraciones 20261107 / 20261108, sin ubicación, imagen o huerta. */
export async function listSingleScans(userId: string, limit = 60): Promise<SingleScan[]> {
  const q = (cols: string) => supabase.from('scans').select(cols).eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
  let { data, error } = await q(`${SCAN_BASE},${SCAN_EXTRA}`);
  if (missingColumn(error)) ({ data, error } = await q(`${SCAN_BASE},huerta_id`));
  if (missingColumn(error)) ({ data, error } = await q(SCAN_BASE));
  if (error) throw error;
  return ((data ?? []) as unknown as Array<Partial<SingleScan> & { created_at: string }>).map(r => ({
    id: r.id ?? null,
    fruto: r.fruto ?? null,
    label: r.label ?? null,
    score: typeof r.score === 'number' ? r.score : null,
    created_at: r.created_at,
    lat: validCoord(r.lat, r.lng) ? (r.lat as number) : null,
    lng: validCoord(r.lat, r.lng) ? (r.lng as number) : null,
    imagen_path: r.imagen_path ?? null,
    huerta_id: r.huerta_id ?? null,
  }));
}

/** Miniatura privada del bucket (carpetas con política de lectura: hallazgos/ y escaneos/). */
export function storageImage(path: string) {
  return {
    uri: `${SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${path}`,
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  };
}

/** Sube la foto de un escaneo individual a escaneos/<uid>/<archivo>.jpg. Devuelve null si no se pudo. */
export async function uploadScanImage(userId: string, uri: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || Platform.OS === 'web') return null;
  const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  const path = `escaneos/${safeUid}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.jpg`;
  try {
    const res = await FileSystem.uploadAsync(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'image/jpeg' },
    });
    return res.status >= 200 && res.status < 300 ? path : null;
  } catch {
    return null;
  }
}

/**
 * Guarda un escaneo individual en `scans`, conservando las columnas de siempre (user_email, label,
 * score, created_at, user_id, fruto) y agregando:
 * - huerta_id (migración 20261108): la huerta decidida antes de la captura, o null.
 * - lat, lng, precision_m, imagen_path (migración opcional 20261107), solo si existen.
 * Si una migración no se ha ejecutado, se reintenta sin esas columnas, en capas, para no perder
 * la huerta por falta de las columnas de ubicación. Nunca inventa coordenadas.
 */
export async function insertSingleScan(
  base: Record<string, unknown>,
  extra: { lat?: number | null; lng?: number | null; precision_m?: number | null; imagen_path?: string | null; huerta_id?: string | null },
) {
  const location: Record<string, unknown> = {};
  if (validCoord(extra.lat, extra.lng)) Object.assign(location, { lat: extra.lat, lng: extra.lng, precision_m: extra.precision_m ?? null });
  if (extra.imagen_path) location.imagen_path = extra.imagen_path;
  const huerta = 'huerta_id' in extra ? { huerta_id: extra.huerta_id ?? null } : {};
  const attempts = [
    { ...base, ...huerta, ...location },
    { ...base, ...huerta },
    { ...base },
  ].filter((row, k, all) => k === 0 || Object.keys(row).length !== Object.keys(all[k - 1]).length);
  let res = await supabase.from('scans').insert([attempts[0]]);
  for (let k = 1; k < attempts.length && missingColumn(res.error); k++) {
    if (k === attempts.length - 1 && extra.huerta_id) console.warn('[scans] falta la columna huerta_id (migración 20261108): se guardó sin huerta');
    res = await supabase.from('scans').insert([attempts[k]]);
  }
  return res;
}

// ───────────────────────── detalle de un hallazgo ─────────────────────────

export type HallazgoDetalle = HallazgoMapa & {
  confianza_fruto: number | null;
  fotos_en_grupo: number;
  created_at: string;
};

/** Un hallazgo por su id, solo si pertenece al usuario (filtra también por user_email). */
export async function getHallazgo(id: string, userEmail: string): Promise<HallazgoDetalle | null> {
  const { data, error } = await supabase
    .from('hallazgos')
    .select('id,recorrido_id,huerta_id,tomada_at,lat,lng,fruto,estado,confianza,confianza_fruto,fotos_en_grupo,miniatura_path,created_at')
    .eq('id', id)
    .eq('user_email', userEmail)
    .maybeSingle();
  if (error) throw error;
  return (data as HallazgoDetalle | null) ?? null;
}
