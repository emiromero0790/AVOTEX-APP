/**
 * Escalas de los índices satelitales de `public.reportes`.
 *
 * Cada índice tiene dos rangos distintos:
 * - `math`: el rango que puede tomar por definición. Un valor fuera de él es un dato erróneo
 *   y se marca como tal (no se recorta ni se oculta).
 * - `bands`: rangos de interpretación agronómica general. Son orientativos: varían por cultivo,
 *   etapa fenológica y temporada, y se muestran como referencia, no como diagnóstico.
 *
 * Referencias generales: EOS Data Analytics (guías de NDVI, NDRE, MSAVI y NDMI) y Gitelson et al.
 * (2003) para el índice de clorofila Red-Edge (CIre / RECI = NIR / RedEdge − 1).
 */

export type IndexKey = 'ndvi' | 'ndre' | 'msavi' | 'reci' | 'ndmi';

export type Text2 = { es: string; en: string };
export type Band = { to: number; label: Text2; color: string };

export type IndexSpec = {
  key: IndexKey;
  name: string;
  /** Qué mide, en lenguaje sencillo. */
  measures: Text2;
  /** Rango matemático [min, max]; max = null si no tiene límite superior. */
  math: [number, number | null];
  /** Rango que dibuja el medidor. */
  display: [number, number];
  bands: Band[];
  digits: number;
};

const SLATE = '#64748B';
const RED = '#E5533F';
const ORANGE = '#F08A32';
const YELLOW = '#D9D24A';
const LIGHT_GREEN = '#86D45A';
const GREEN = '#2BBF6A';

export const INDEX_SPECS: Record<IndexKey, IndexSpec> = {
  ndvi: {
    key: 'ndvi', name: 'NDVI', measures: { es: 'Vigor y densidad de la vegetación', en: 'Vegetation vigor and density' },
    math: [-1, 1], display: [-1, 1], digits: 2,
    bands: [
      { to: 0, label: { es: 'Agua o sin vegetación', en: 'Water or no vegetation' }, color: SLATE },
      { to: 0.2, label: { es: 'Suelo desnudo', en: 'Bare soil' }, color: RED },
      { to: 0.4, label: { es: 'Vegetación escasa', en: 'Sparse vegetation' }, color: ORANGE },
      { to: 0.6, label: { es: 'Vegetación moderada', en: 'Moderate vegetation' }, color: YELLOW },
      { to: 1, label: { es: 'Vegetación densa', en: 'Dense vegetation' }, color: GREEN },
    ],
  },
  ndre: {
    key: 'ndre', name: 'NDRE', measures: { es: 'Clorofila y nitrógeno en el follaje', en: 'Leaf chlorophyll and nitrogen' },
    math: [-1, 1], display: [-1, 1], digits: 2,
    bands: [
      { to: 0, label: { es: 'Sin vegetación', en: 'No vegetation' }, color: SLATE },
      { to: 0.2, label: { es: 'Clorofila baja', en: 'Low chlorophyll' }, color: RED },
      { to: 0.35, label: { es: 'Clorofila moderada', en: 'Moderate chlorophyll' }, color: YELLOW },
      { to: 1, label: { es: 'Clorofila alta', en: 'High chlorophyll' }, color: GREEN },
    ],
  },
  msavi: {
    key: 'msavi', name: 'MSAVI', measures: { es: 'Vegetación corrigiendo el efecto del suelo', en: 'Vegetation, corrected for soil' },
    math: [-1, 1], display: [-1, 1], digits: 2,
    bands: [
      { to: 0, label: { es: 'Sin vegetación', en: 'No vegetation' }, color: SLATE },
      { to: 0.2, label: { es: 'Suelo desnudo', en: 'Bare soil' }, color: RED },
      { to: 0.4, label: { es: 'Cobertura inicial', en: 'Early cover' }, color: ORANGE },
      { to: 0.6, label: { es: 'En desarrollo', en: 'Developing' }, color: YELLOW },
      { to: 1, label: { es: 'Cobertura densa', en: 'Dense cover' }, color: GREEN },
    ],
  },
  reci: {
    key: 'reci', name: 'RECI', measures: { es: 'Contenido de clorofila (Red-Edge)', en: 'Chlorophyll content (red edge)' },
    math: [-1, null], display: [0, 8], digits: 2,
    bands: [
      { to: 1, label: { es: 'Clorofila baja', en: 'Low chlorophyll' }, color: RED },
      { to: 3, label: { es: 'Clorofila moderada', en: 'Moderate chlorophyll' }, color: YELLOW },
      { to: 8, label: { es: 'Clorofila alta', en: 'High chlorophyll' }, color: GREEN },
    ],
  },
  ndmi: {
    key: 'ndmi', name: 'NDMI', measures: { es: 'Humedad en el follaje', en: 'Canopy moisture' },
    math: [-1, 1], display: [-1, 1], digits: 2,
    bands: [
      { to: -0.2, label: { es: 'Estrés hídrico alto', en: 'High water stress' }, color: RED },
      { to: 0, label: { es: 'Humedad baja', en: 'Low moisture' }, color: ORANGE },
      { to: 0.2, label: { es: 'Humedad moderada', en: 'Moderate moisture' }, color: YELLOW },
      { to: 0.4, label: { es: 'Buena humedad', en: 'Good moisture' }, color: LIGHT_GREEN },
      { to: 1, label: { es: 'Humedad alta', en: 'High moisture' }, color: GREEN },
    ],
  },
};

export const INDEX_ORDER: IndexKey[] = ['ndvi', 'ndre', 'msavi', 'reci', 'ndmi'];

export type Reading =
  | { kind: 'missing' }
  | { kind: 'invalid'; value: number; range: string }
  | { kind: 'ok'; value: number; band: Band; bandIndex: number; /** 0–1 dentro del medidor */ position: number; beyond: 'low' | 'high' | null };

export function formatRange(spec: IndexSpec, lang: 'es' | 'en' = 'es'): string {
  const [lo, hi] = spec.math;
  const f = (n: number) => (n < 0 ? `−${Math.abs(n)}` : `${n}`);
  return hi === null ? `≥ ${f(lo)}` : `${f(lo)} ${lang === 'en' ? 'to' : 'a'} ${f(hi)}`;
}

/** Lee un valor tal como viene de la base. Nunca convierte null en 0. */
export function readIndex(spec: IndexSpec, raw: number | null | undefined): Reading {
  if (raw === null || raw === undefined || typeof raw !== 'number' || !Number.isFinite(raw)) return { kind: 'missing' };
  const [lo, hi] = spec.math;
  if (raw < lo || (hi !== null && raw > hi)) return { kind: 'invalid', value: raw, range: formatRange(spec) };
  const [dlo, dhi] = spec.display;
  const bandIndex = Math.max(0, spec.bands.findIndex(b => raw <= b.to));
  const band = spec.bands[raw > spec.bands[spec.bands.length - 1].to ? spec.bands.length - 1 : bandIndex];
  const beyond = raw < dlo ? 'low' : raw > dhi ? 'high' : null;
  const position = Math.max(0, Math.min(1, (raw - dlo) / (dhi - dlo)));
  return { kind: 'ok', value: raw, band, bandIndex: spec.bands.indexOf(band), position, beyond };
}

/** Segmentos del medidor: [inicio, fin] en 0–1 con su color. */
export function bandSegments(spec: IndexSpec): { from: number; to: number; color: string }[] {
  const [dlo, dhi] = spec.display;
  let start = dlo;
  return spec.bands.map(b => {
    const end = Math.min(b.to, dhi);
    const seg = { from: (start - dlo) / (dhi - dlo), to: (end - dlo) / (dhi - dlo), color: b.color };
    start = end;
    return seg;
  }).filter(s => s.to > s.from);
}

export function formatIndex(spec: IndexSpec, value: number): string {
  const s = value.toFixed(spec.digits);
  return value < 0 ? `−${s.slice(1)}` : s;
}
