/**
 * Importación de fotos de dron o de cámara de acción (GoPro y similares).
 *
 * No hay conexión directa con ningún fabricante: el usuario elige fotos de su galería
 * (las pasó del dron/cámara al celular). Cada importación se guarda como un escaneo local,
 * igual que un recorrido grabado con el celular, y usa la misma subida y el mismo procesador.
 *
 * Ubicación y fecha salen SOLO del EXIF de cada foto. Si una foto no tiene GPS, se guarda sin
 * ubicación (no se inventa ninguna).
 */
import type { ImagePickerAsset } from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { createLocal, deleteLocal, saveLocal, storePhoto, type Fuente, type PuntoRuta, type RecorridoLocal } from './recorridos';

/** Lado mayor con el que se guardan las fotos importadas: suficiente para el modelo y ligero de subir. */
const MAX_SIDE = 1600;
/** Tope por importación (igual que un recorrido). */
export const MAX_IMPORT = 600;

export type ImportedMeta = { lat: number | null; lng: number | null; takenAt: string | null };

// ───────────────────────── EXIF ─────────────────────────

type Exif = Record<string, unknown>;

/** Número desde los formatos que entregan iOS/Android: 19.5, "19.5", "19/1", [19,25,30], "19/1,25/1,3000/100". */
function toNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (Array.isArray(v)) return dmsToDecimal(v.map(toNumber));
  if (typeof v === 'string') {
    const parts = v.split(/[,\s]+/).filter(Boolean);
    if (parts.length >= 2) return dmsToDecimal(parts.map(toNumber));
    const frac = /^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(v.trim());
    if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function dmsToDecimal(parts: Array<number | null>): number | null {
  if (parts.some(p => p == null)) return null;
  const [d, m = 0, s = 0] = parts as number[];
  return Math.abs(d) + m / 60 + s / 3600;
}

function pick(exif: Exif, ...keys: string[]): unknown {
  const gps = (exif['{GPS}'] ?? exif.GPS ?? {}) as Exif;
  const ex = (exif['{Exif}'] ?? exif.Exif ?? {}) as Exif;
  for (const k of keys) {
    for (const src of [exif, gps, ex]) {
      if (src[k] != null && src[k] !== '') return src[k];
    }
  }
  return undefined;
}

/** "2026:06:19 10:42:07" (hora local de la cámara) → ISO. */
function parseExifDate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(v.trim());
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function readExif(exif: Exif | null | undefined): ImportedMeta {
  if (!exif) return { lat: null, lng: null, takenAt: null };
  let lat = toNumber(pick(exif, 'GPSLatitude', 'Latitude'));
  let lng = toNumber(pick(exif, 'GPSLongitude', 'Longitude'));
  const latRef = String(pick(exif, 'GPSLatitudeRef', 'LatitudeRef') ?? '').toUpperCase();
  const lngRef = String(pick(exif, 'GPSLongitudeRef', 'LongitudeRef') ?? '').toUpperCase();
  if (lat != null && latRef === 'S') lat = -Math.abs(lat);
  if (lng != null && lngRef === 'W') lng = -Math.abs(lng);
  const valid = lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  const takenAt = parseExifDate(pick(exif, 'DateTimeOriginal', 'DateTimeDigitized', 'DateTime'));
  return { lat: valid ? lat : null, lng: valid ? lng : null, takenAt };
}

// ───────────────────────── preparación ─────────────────────────

export type ImportSummary = { total: number; withGps: number; withDate: number };

export function summarize(assets: ImagePickerAsset[]): ImportSummary {
  let withGps = 0;
  let withDate = 0;
  for (const a of assets) {
    const m = readExif(a.exif as Exif | null | undefined);
    if (m.lat != null) withGps += 1;
    if (m.takenAt) withDate += 1;
  }
  return { total: assets.length, withGps, withDate };
}

/** Reduce la foto (manteniendo la proporción) y la guarda como JPEG en la caché. */
async function downscale(asset: ImagePickerAsset): Promise<string> {
  const longest = Math.max(asset.width || 0, asset.height || 0);
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (longest > MAX_SIDE) {
    if ((asset.width || 0) >= (asset.height || 0)) ctx.resize({ width: MAX_SIDE });
    else ctx.resize({ height: MAX_SIDE });
  }
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  return out.uri;
}

/**
 * Crea un escaneo local con las fotos elegidas. Las fotos se ordenan por fecha (EXIF) y,
 * sin fecha, por el orden de la galería; la ruta se arma solo con las que tienen GPS.
 */
export async function importPhotos(
  userEmail: string,
  fuente: Exclude<Fuente, 'celular'>,
  assets: ImagePickerAsset[],
  huertaId: string | null,
  onProgress?: (done: number, total: number) => void,
): Promise<RecorridoLocal> {
  const items = assets.slice(0, MAX_IMPORT).map((asset, index) => ({ asset, index, meta: readExif(asset.exif as Exif | null | undefined) }));
  items.sort((a, b) => {
    if (a.meta.takenAt && b.meta.takenAt) return a.meta.takenAt.localeCompare(b.meta.takenAt);
    return a.index - b.index;
  });

  const rec = await createLocal(userEmail, huertaId, fuente);
  try {
    // Sin fecha en EXIF: hora de importación separada 3 s entre fotos, solo para conservar el orden
    // (el procesador descarta fotos a menos de 2 s entre sí cuando no tienen GPS).
    const base = Date.now();
    let done = 0;
    onProgress?.(0, items.length);
    for (const it of items) {
      const uri = await downscale(it.asset);
      const coords = it.meta.lat != null && it.meta.lng != null ? { lat: it.meta.lat, lng: it.meta.lng, precision: null } : null;
      const tomadaAt = it.meta.takenAt ?? new Date(base + it.index * 3000).toISOString();
      const foto = await storePhoto(rec, uri, coords, tomadaAt);
      rec.fotos.push(foto);
      done += 1;
      onProgress?.(done, items.length);
      if (done % 10 === 0) await saveLocal(rec);
    }
    const ruta: PuntoRuta[] = rec.fotos
      .filter(f => f.lat != null && f.lng != null)
      .map(f => ({ lat: f.lat as number, lng: f.lng as number, t: f.tomadaAt }));
    rec.ruta = ruta;
    rec.iniciadoAt = rec.fotos[0]?.tomadaAt ?? rec.iniciadoAt;
    rec.terminadoAt = rec.fotos[rec.fotos.length - 1]?.tomadaAt ?? new Date().toISOString();
    rec.estado = 'guardado';
    await saveLocal(rec);
    return rec;
  } catch (e) {
    // Una importación a medias no se deja guardada.
    await deleteLocal(rec).catch(() => {});
    throw e;
  }
}
