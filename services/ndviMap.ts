/**
 * Mapa de vigor (NDVI) de una huerta, de Sentinel-2 vía la función de Supabase `ndvi-huerta`
 * (supabase/functions/ndvi-huerta). Las claves de Copernicus viven en el servidor, nunca en la app.
 *
 * Se guarda en el celular 24 h por huerta y contorno: Sentinel-2 pasa cada ~5 días, así que no hace falta
 * pedirlo cada vez (y se cuida la cuota gratuita de Copernicus).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseConfig';
import type { LatLng } from './satZones';

export type NdviMap = {
  ok: true;
  /** Fecha de la imagen (AAAA-MM-DD, UTC). */
  date: string;
  /** PNG en base64, ya coloreado y recortado al contorno (transparente fuera y en nubes). */
  image: string;
  bounds: { south: number; west: number; north: number; east: number };
  stats: { mean: number; min: number; max: number; validPct: number };
  source: string;
};
export type NdviFailure = { ok: false; reason: 'not-configured' | 'no-clear-image' | 'too-large' | 'bad-request' | 'upstream' | 'offline' };
export type NdviResult = NdviMap | NdviFailure;

const TTL_MS = 24 * 3600 * 1000;
const KEY = 'avotex.ndvi.v1.';

// Huella corta del contorno: si el usuario lo redibuja en Mapeo, se pide de nuevo.
function hashOutline(outline: LatLng[]): string {
  let h = 2166136261;
  for (const p of outline) {
    const s = `${p.lat.toFixed(6)},${p.lng.toFixed(6)};`;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  }
  return (h >>> 0).toString(36);
}

export async function loadNdviMap(huertaId: string, outline: LatLng[], opts: { force?: boolean } = {}): Promise<NdviResult> {
  const key = `${KEY}${huertaId}.${hashOutline(outline)}`;
  if (!opts.force) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const c = JSON.parse(raw) as { at: number; data: NdviResult };
        // Un resultado bueno vale 24 h; «sin imagen despejada» se reintenta antes (6 h).
        const ttl = c.data.ok ? TTL_MS : 6 * 3600 * 1000;
        if (Date.now() - c.at < ttl && (c.data.ok || c.data.reason === 'no-clear-image')) return c.data;
      }
    } catch { /* caché dañada: se pide de nuevo */ }
  }
  try {
    const { data, error } = await supabase.functions.invoke('ndvi-huerta', { body: { outline } });
    if (error || !data) {
      // Función no desplegada todavía (404) u otro fallo del servidor.
      const status = (error as { context?: { status?: number } } | null)?.context?.status;
      return { ok: false, reason: status === 404 ? 'not-configured' : 'upstream' };
    }
    const result = data as NdviResult;
    if (result.ok || result.reason === 'no-clear-image') {
      AsyncStorage.setItem(key, JSON.stringify({ at: Date.now(), data: result })).catch(() => {});
    }
    return result;
  } catch {
    return { ok: false, reason: 'offline' };
  }
}
