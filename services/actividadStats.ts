/**
 * Estadísticas de Actividad → Resumen. Funciones puras (sin Supabase ni React) para poder probarlas.
 *
 * Unidad de análisis: un «análisis» es una foto que la IA analizó:
 *   - una foto individual (tabla scans), o
 *   - una foto analizada de un recorrido (tabla hallazgos: una fila por foto analizada).
 * Un recorrido NO es un análisis (es el contenedor de sus fotos) y no se cuenta aparte; las fotos de un
 * recorrido que no se analizaron (recorrido_fotos sin hallazgo) tampoco se cuentan.
 *
 * Estados (services/escaneos.ts → categoria): 'sano', 'revisar' (confianza < 60 %: el modelo no está seguro)
 * y 'enfermo' (el modelo detectó un problema con confianza suficiente). No existe en la base un criterio de
 * severidad: por eso la tarjeta se llama «Hallazgos que requieren atención» y no «críticos».
 */

export type Cat = 'sano' | 'revisar' | 'enfermo';
export type Rec = {
  source: 'foto' | 'recorrido';
  /** Cultivo normalizado en español (Aguacate, Limón…). */
  crop: string;
  cat: Cat;
  /** Confianza del modelo 0–1. */
  conf: number;
  /** ms */
  date: number;
  huertaId: string | null;
  /** Clase que devolvió el modelo (p. ej. «antracnosis», «saludable»). */
  label: string;
};

export type OrchardFilter = 'all' | 'none' | string;
export type PeriodKey = 7 | 30 | 90 | 180 | 365 | 'all';

export const PERIOD_DAYS: Record<Exclude<PeriodKey, 'all'>, number> = { 7: 7, 30: 30, 90: 90, 180: 180, 365: 365 };

export function sinceOf(period: PeriodKey, now = Date.now()): number {
  return period === 'all' ? 0 : now - PERIOD_DAYS[period] * 86400000;
}

export function matchOrchard(r: Pick<Rec, 'huertaId'>, f: OrchardFilter): boolean {
  return f === 'all' || (f === 'none' ? !r.huertaId : r.huertaId === f);
}

const pct = (n: number, total: number) => (total ? (n / total) * 100 : 0);

// ───────── Estado por huerta (distribución de análisis entre huertas) ─────────

export type ShareSlice = { key: string; id: string | null; name: string; count: number; pct: number; kind: 'orchard' | 'none' | 'other' };

/**
 * Reparte los análisis entre huertas. Hasta `maxSlices` huertas con nombre; el resto se agrupa en «Otras».
 * Los análisis sin huerta van en su propio segmento. Los porcentajes suman 100 (salvo redondeo de pantalla).
 */
export function orchardShare(recs: Rec[], names: Record<string, string>, labels: { none: string; other: string }, maxSlices = 4): ShareSlice[] {
  const total = recs.length;
  if (!total) return [];
  const by = new Map<string, number>();
  let none = 0;
  for (const r of recs) {
    if (!r.huertaId) none++;
    else by.set(r.huertaId, (by.get(r.huertaId) ?? 0) + 1);
  }
  const named = [...by.entries()].sort((a, b) => b[1] - a[1]);
  const head = named.slice(0, maxSlices);
  const tail = named.slice(maxSlices);
  const out: ShareSlice[] = head.map(([id, count]) => ({ key: id, id, name: names[id] ?? '—', count, pct: pct(count, total), kind: 'orchard' }));
  const otherCount = tail.reduce((a, [, c]) => a + c, 0);
  if (otherCount) out.push({ key: '__other', id: null, name: labels.other, count: otherCount, pct: pct(otherCount, total), kind: 'other' });
  if (none) out.push({ key: '__none', id: null, name: labels.none, count: none, pct: pct(none, total), kind: 'none' });
  return out;
}

// ───────── Frutas más analizadas ─────────

export type CropRow = { crop: string; count: number; pct: number; sano: number; revisar: number; enfermo: number };

export function cropRows(recs: Rec[]): CropRow[] {
  const total = recs.length;
  const by = new Map<string, CropRow>();
  for (const r of recs) {
    const row = by.get(r.crop) ?? { crop: r.crop, count: 0, pct: 0, sano: 0, revisar: 0, enfermo: 0 };
    row.count++;
    row[r.cat]++;
    by.set(r.crop, row);
  }
  return [...by.values()].map(r => ({ ...r, pct: pct(r.count, total) })).sort((a, b) => b.count - a.count || a.crop.localeCompare(b.crop));
}

// ───────── Detalle por cultivo: clases que devolvió el modelo ─────────

export type ClassRow = { key: string; label: string; count: number; pct: number; healthy: boolean; lowConfidence: boolean };

/**
 * Clases del modelo para un cultivo. Los resultados con confianza baja ('revisar') se agrupan aparte:
 * no se atribuyen a ninguna enfermedad porque el modelo no estaba seguro.
 */
export function classRows(recs: Rec[], crop: string, normalize: (s: string) => string): ClassRow[] {
  const items = recs.filter(r => r.crop === crop);
  const total = items.length;
  const by = new Map<string, ClassRow>();
  for (const r of items) {
    const low = r.cat === 'revisar';
    const key = low ? '__low' : r.cat === 'sano' ? '__healthy' : normalize(r.label) || '__unknown';
    const row = by.get(key) ?? { key, label: r.label, count: 0, pct: 0, healthy: r.cat === 'sano', lowConfidence: low };
    row.count++;
    by.set(key, row);
  }
  return [...by.values()].map(r => ({ ...r, pct: pct(r.count, total) }))
    // Problemas primero (de más a menos), luego confianza baja y al final saludable (base de la columna).
    .sort((a, b) => Number(a.healthy) - Number(b.healthy) || Number(a.lowConfidence) - Number(b.lowConfidence) || b.count - a.count);
}

// ───────── Serie temporal ─────────

export type Granularity = 'day' | 'week' | 'month';
export type Bucket = { start: number; end: number; count: number; label: string };

export function granularityOf(period: PeriodKey): Granularity {
  return period === 7 ? 'day' : period === 30 || period === 90 ? 'week' : 'month';
}

const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** Semana que empieza en lunes (hora local). */
const startOfWeek = (t: number) => { const d = new Date(startOfDay(t)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const startOfMonth = (t: number) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
const next = (t: number, g: Granularity) => {
  const d = new Date(t);
  if (g === 'day') d.setDate(d.getDate() + 1);
  else if (g === 'week') d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.getTime();
};

/**
 * Cuenta análisis por día, semana o mes en la zona horaria del teléfono. Los periodos sin actividad
 * aparecen con 0. «Todo el historial» va del primer análisis al actual (máximo 24 meses visibles).
 */
export function timeline(recs: Rec[], period: PeriodKey, fmt: (start: number, g: Granularity) => string, now = Date.now()): { g: Granularity; buckets: Bucket[] } {
  const g = granularityOf(period);
  const align = g === 'day' ? startOfDay : g === 'week' ? startOfWeek : startOfMonth;
  let from: number;
  if (period === 'all') {
    if (!recs.length) return { g, buckets: [] };
    const first = Math.min(...recs.map(r => r.date));
    from = align(Math.max(first, new Date(new Date(now).getFullYear(), new Date(now).getMonth() - 23, 1).getTime()));
  } else from = align(sinceOf(period, now));
  const buckets: Bucket[] = [];
  for (let t = from; t <= now && buckets.length < 60; t = next(t, g)) buckets.push({ start: t, end: next(t, g), count: 0, label: fmt(t, g) });
  for (const r of recs) {
    // Búsqueda binaria: los cubos están ordenados.
    let lo = 0, hi = buckets.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const b = buckets[mid];
      if (r.date < b.start) hi = mid - 1; else if (r.date >= b.end) lo = mid + 1; else { b.count++; break; }
    }
  }
  return { g, buckets };
}

// ───────── Hallazgos que requieren atención ─────────

export type Attention = {
  total: number;
  /** % sobre todos los análisis del conjunto. */
  pct: number;
  top: { label: string; count: number; pct: number }[];
  topCrop: { crop: string; count: number } | null;
  lowConfidence: number;
};

/** «Requiere atención» = el modelo detectó un problema con confianza suficiente (categoría 'enfermo'). */
export function attention(recs: Rec[], normalize: (s: string) => string): Attention {
  const bad = recs.filter(r => r.cat === 'enfermo');
  const byLabel = new Map<string, { label: string; count: number }>();
  const byCrop = new Map<string, number>();
  for (const r of bad) {
    const k = normalize(r.label) || '__unknown';
    const e = byLabel.get(k) ?? { label: r.label, count: 0 };
    e.count++;
    byLabel.set(k, e);
    byCrop.set(r.crop, (byCrop.get(r.crop) ?? 0) + 1);
  }
  const top = [...byLabel.values()].sort((a, b) => b.count - a.count).slice(0, 2).map(e => ({ ...e, pct: pct(e.count, bad.length) }));
  const crop = [...byCrop.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    total: bad.length,
    pct: pct(bad.length, recs.length),
    top,
    topCrop: crop ? { crop: crop[0], count: crop[1] } : null,
    lowConfidence: recs.filter(r => r.cat === 'revisar').length,
  };
}
