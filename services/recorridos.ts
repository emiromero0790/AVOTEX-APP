/**
 * Recorridos con IA.
 *
 * Durante el recorrido la app toma fotos automáticas con GPS y las guarda EN EL CELULAR
 * (funciona sin internet). Cuando hay conexión, las sube a Supabase Storage y marca el
 * recorrido como "pendiente"; el procesador (processor/, GitHub Actions) las pasa al
 * modelo y guarda los hallazgos. Al terminar, el usuario recibe una notificación.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../supabaseConfig';

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const BUCKET = 'recorridos';
const STORAGE_KEY = 'avotex_recorridos_v1';
const UPLOAD_PREF_KEY = 'avotex_recorridos_datos_moviles';

/** Una foto cada tantos metros recorridos (el procesador vuelve a filtrar a 2.5 m). */
export const CAPTURE_EVERY_M = 2.5;
/** Sin GPS, una foto cada tantos segundos. */
export const CAPTURE_EVERY_S_WITHOUT_GPS = 3;
/** Tope por recorrido (~3 km caminando). */
export const MAX_PHOTOS = 1200;

export type FotoLocal = {
  id: string;
  uri: string;
  tomadaAt: string;
  lat: number | null;
  lng: number | null;
  precision: number | null;
  subida: boolean;
};

export type PuntoRuta = { lat: number; lng: number; t: string };

export type EstadoLocal = 'grabando' | 'guardado' | 'subiendo' | 'enviado';

export type RecorridoLocal = {
  localId: string;
  userEmail: string;
  huertaId: string | null;
  iniciadoAt: string;
  terminadoAt: string | null;
  fotos: FotoLocal[];
  ruta: PuntoRuta[];
  remoteId: string | null;
  estado: EstadoLocal;
  error?: string | null;
};

export type EstadoRemoto = 'subiendo' | 'pendiente' | 'procesando' | 'listo' | 'error';

export type RecorridoRemoto = {
  id: string;
  user_email: string;
  huerta_id: string | null;
  estado: EstadoRemoto;
  iniciado_at: string;
  terminado_at: string | null;
  fotos_total: number;
  fotos_analizadas: number;
  hallazgos_total: number;
  ruta: PuntoRuta[];
  procesado_at: string | null;
  error: string | null;
  created_at: string;
};

export type Hallazgo = {
  id: string;
  recorrido_id: string;
  huerta_id: string | null;
  tomada_at: string;
  lat: number | null;
  lng: number | null;
  fruto: string;
  estado: string;
  confianza: number;
  fotos_en_grupo: number;
  miniatura_path: string | null;
};

// ───────────────────────── utilidades ─────────────────────────

export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function routeDistanceMeters(ruta: PuntoRuta[]): number {
  let total = 0;
  for (let i = 1; i < ruta.length; i++) total += distanceMeters(ruta[i - 1].lat, ruta[i - 1].lng, ruta[i].lat, ruta[i].lng);
  return total;
}

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function dirFor(localId: string): string {
  return `${FileSystem.documentDirectory}recorridos/${localId}/`;
}

const HEALTHY = ['saludable', 'healthy', 'sano', 'fresh', 'fresco'];
export function isHealthy(estado: string): boolean {
  const e = estado.toLowerCase();
  return HEALTHY.some(h => e.includes(h));
}

/** Imagen privada del bucket: se pide con la clave pública y la política "ver miniaturas". */
export function thumbnailSource(path: string) {
  return {
    uri: `${SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${path}`,
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  };
}

// ───────────────────────── almacenamiento local ─────────────────────────

async function readAll(): Promise<RecorridoLocal[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as RecorridoLocal[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function writeAll(list: RecorridoLocal[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export async function listLocal(userEmail: string): Promise<RecorridoLocal[]> {
  return (await readAll())
    .filter(r => r.userEmail === userEmail && r.estado !== 'enviado')
    .sort((a, b) => b.iniciadoAt.localeCompare(a.iniciadoAt));
}

export async function saveLocal(rec: RecorridoLocal): Promise<void> {
  const all = await readAll();
  const i = all.findIndex(r => r.localId === rec.localId);
  if (i >= 0) all[i] = rec; else all.push(rec);
  await writeAll(all);
}

export async function createLocal(userEmail: string, huertaId: string | null): Promise<RecorridoLocal> {
  const rec: RecorridoLocal = {
    localId: newId(),
    userEmail,
    huertaId,
    iniciadoAt: new Date().toISOString(),
    terminadoAt: null,
    fotos: [],
    ruta: [],
    remoteId: null,
    estado: 'grabando',
    error: null,
  };
  await FileSystem.makeDirectoryAsync(dirFor(rec.localId), { intermediates: true });
  await saveLocal(rec);
  return rec;
}

/** Mueve la foto de la caché de la cámara a la carpeta del recorrido (no se borra al cerrar la app). */
export async function storePhoto(
  rec: RecorridoLocal,
  tempUri: string,
  coords: { lat: number; lng: number; precision: number | null } | null,
): Promise<FotoLocal> {
  const id = String(rec.fotos.length + 1).padStart(4, '0');
  const uri = `${dirFor(rec.localId)}${id}.jpg`;
  await FileSystem.moveAsync({ from: tempUri, to: uri });
  return {
    id,
    uri,
    tomadaAt: new Date().toISOString(),
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    precision: coords?.precision ?? null,
    subida: false,
  };
}

export async function deleteLocal(rec: RecorridoLocal): Promise<void> {
  await FileSystem.deleteAsync(dirFor(rec.localId), { idempotent: true });
  await writeAll((await readAll()).filter(r => r.localId !== rec.localId));
}

/** Recorridos que quedaron "grabando" porque la app se cerró: se guardan para subirlos. */
export async function recoverInterrupted(userEmail: string): Promise<void> {
  const all = await readAll();
  let changed = false;
  for (const r of all) {
    if (r.userEmail === userEmail && (r.estado === 'grabando' || r.estado === 'subiendo')) {
      r.estado = 'guardado';
      r.terminadoAt = r.terminadoAt ?? (r.fotos[r.fotos.length - 1]?.tomadaAt ?? r.iniciadoAt);
      changed = true;
    }
  }
  if (changed) await writeAll(all);
}

export async function getMobileDataAllowed(): Promise<boolean> {
  return (await AsyncStorage.getItem(UPLOAD_PREF_KEY)) === '1';
}

export async function setMobileDataAllowed(allowed: boolean): Promise<void> {
  await AsyncStorage.setItem(UPLOAD_PREF_KEY, allowed ? '1' : '0');
}

// ───────────────────────── subida ─────────────────────────

/** Puntos de la ruta separados al menos 2 m (menos datos, mismo dibujo). */
function simplifyRoute(ruta: PuntoRuta[]): PuntoRuta[] {
  const out: PuntoRuta[] = [];
  for (const p of ruta) {
    const last = out[out.length - 1];
    if (!last || distanceMeters(last.lat, last.lng, p.lat, p.lng) >= 2) out.push(p);
  }
  return out;
}

async function uploadPhoto(remoteId: string, foto: FotoLocal): Promise<string> {
  const path = `fotos/${remoteId}/${foto.id}.jpg`;
  const res = await FileSystem.uploadAsync(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, foto.uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'image/jpeg',
    },
  });
  // 409 / "Duplicate": ya se había subido en un intento anterior.
  if (res.status >= 200 && res.status < 300) return path;
  if (res.status === 409 || /duplicate|already exists/i.test(res.body ?? '')) return path;
  throw new Error(`No se pudo subir la foto (${res.status})`);
}

/**
 * Sube un recorrido guardado. Si se corta, se puede volver a llamar: continúa con las
 * fotos que faltan. Al final queda "pendiente" para el procesador y se borran las fotos locales.
 */
export async function uploadRecorrido(
  rec: RecorridoLocal,
  onProgress?: (done: number, total: number) => void,
): Promise<RecorridoLocal> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Falta la configuración de Supabase');
  // Copia propia de las fotos: se marcan como subidas sin tocar el estado de la pantalla.
  let current: RecorridoLocal = { ...rec, fotos: rec.fotos.map(f => ({ ...f })), estado: 'subiendo', error: null };
  await saveLocal(current);

  try {
    if (!current.remoteId) {
      // La tabla recorridos exige que el usuario exista en "users" (igual que huertas).
      const { error: userError } = await supabase
        .from('users')
        .upsert({ user_email: current.userEmail, tokens: 0 }, { onConflict: 'user_email', ignoreDuplicates: true });
      if (userError) throw userError;
      const { data, error } = await supabase
        .from('recorridos')
        .insert({
          user_email: current.userEmail,
          huerta_id: current.huertaId,
          estado: 'subiendo',
          iniciado_at: current.iniciadoAt,
          terminado_at: current.terminadoAt,
          fotos_total: current.fotos.length,
          ruta: simplifyRoute(current.ruta),
        })
        .select('id')
        .single();
      if (error) throw error;
      current = { ...current, remoteId: data.id as string };
      await saveLocal(current);
    }
    const remoteId = current.remoteId as string;

    const total = current.fotos.length;
    let done = current.fotos.filter(f => f.subida).length;
    onProgress?.(done, total);
    let pendingRows: Array<Record<string, unknown>> = [];

    const flushRows = async () => {
      if (!pendingRows.length) return;
      const { error } = await supabase
        .from('recorrido_fotos')
        .upsert(pendingRows, { onConflict: 'recorrido_id,storage_path', ignoreDuplicates: true });
      if (error) throw error;
      pendingRows = [];
      await saveLocal(current);
    };

    for (let i = 0; i < current.fotos.length; i++) {
      const foto = current.fotos[i];
      if (foto.subida) continue;
      const path = await uploadPhoto(remoteId, foto);
      pendingRows.push({
        recorrido_id: remoteId,
        storage_path: path,
        tomada_at: foto.tomadaAt,
        lat: foto.lat,
        lng: foto.lng,
        precision_m: foto.precision,
        orden: i,
      });
      current.fotos[i] = { ...foto, subida: true };
      done += 1;
      onProgress?.(done, total);
      if (pendingRows.length >= 20) await flushRows();
    }
    await flushRows();

    const { error: finishError } = await supabase
      .from('recorridos')
      .update({ estado: 'pendiente', fotos_total: total, ruta: simplifyRoute(current.ruta) })
      .eq('id', remoteId);
    if (finishError) throw finishError;

    // Ya están en la nube: se libera el espacio del celular.
    await FileSystem.deleteAsync(dirFor(current.localId), { idempotent: true });
    current = { ...current, estado: 'enviado', fotos: current.fotos.map(f => ({ ...f, uri: '' })) };
    await saveLocal(current);
    return current;
  } catch (e) {
    const message = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    current = { ...current, estado: 'guardado', error: message };
    await saveLocal(current);
    throw e;
  }
}

// ───────────────────────── resultados ─────────────────────────

export async function listRemote(userEmail: string): Promise<RecorridoRemoto[]> {
  const { data, error } = await supabase
    .from('recorridos')
    .select('id,user_email,huerta_id,estado,iniciado_at,terminado_at,fotos_total,fotos_analizadas,hallazgos_total,ruta,procesado_at,error,created_at')
    .eq('user_email', userEmail)
    .neq('estado', 'subiendo')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as RecorridoRemoto[];
}

export async function getRemote(id: string, userEmail: string): Promise<RecorridoRemoto | null> {
  const { data, error } = await supabase
    .from('recorridos')
    .select('id,user_email,huerta_id,estado,iniciado_at,terminado_at,fotos_total,fotos_analizadas,hallazgos_total,ruta,procesado_at,error,created_at')
    .eq('id', id)
    .eq('user_email', userEmail)
    .maybeSingle();
  if (error) throw error;
  return (data as RecorridoRemoto) ?? null;
}

export async function listHallazgos(recorridoId: string, userEmail: string): Promise<Hallazgo[]> {
  const { data, error } = await supabase
    .from('hallazgos')
    .select('id,recorrido_id,huerta_id,tomada_at,lat,lng,fruto,estado,confianza,fotos_en_grupo,miniatura_path')
    .eq('recorrido_id', recorridoId)
    .eq('user_email', userEmail)
    .order('tomada_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Hallazgo[];
}
