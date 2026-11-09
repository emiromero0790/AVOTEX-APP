import type { ScansMapData, ScansMapDetail, ScansMapLayer, ScansMapPoint, ScansMapRouteStyle } from './scansMapHtml';

export type ScansMapEvent =
  | { type: 'select'; id: string }
  | { type: 'orchard'; id: string }
  | { type: 'point'; kind: 'photo' | 'finding'; id: string }
  | { type: 'clear' };

export type ScansMapProps = {
  data: ScansMapData;
  selectedId: string | null;
  /** Ruta, puntos de captura y hallazgos del escaneo elegido. */
  detail: ScansMapDetail | null;
  /** Punto activo dentro del detalle (foto u hallazgo). */
  point: { kind: 'photo' | 'finding'; id: string } | null;
  user: ScansMapPoint | null;
  layer: ScansMapLayer;
  /** Estilo de la ruta (clásica, velocidad, tiempo o calor). */
  routeStyle?: ScansMapRouteStyle;
  onEvent: (e: ScansMapEvent) => void;
  onError?: () => void;
};

export type ScansMapHandle = {
  zoom: (delta: 1 | -1) => void;
  fit: () => void;
  flyToUser: () => void;
};

export function parseMapEvent(raw: unknown): ScansMapEvent | null {
  const m = raw as { type?: string; id?: unknown; kind?: unknown };
  if (!m || typeof m !== 'object') return null;
  if ((m.type === 'select' || m.type === 'orchard') && typeof m.id === 'string') return { type: m.type, id: m.id };
  if (m.type === 'point' && (m.kind === 'photo' || m.kind === 'finding') && typeof m.id === 'string') return { type: 'point', kind: m.kind, id: m.id };
  if (m.type === 'clear') return { type: 'clear' };
  return null;
}
