import type { ScansMapData, ScansMapFinding, ScansMapLayer, ScansMapPoint } from './scansMapHtml';

export type ScansMapProps = {
  data: ScansMapData;
  selectedId: string | null;
  /** Ruta y hallazgos del escaneo seleccionado (si los tiene). */
  detail: { route: ScansMapPoint[]; findings: ScansMapFinding[] } | null;
  user: ScansMapPoint | null;
  layer: ScansMapLayer;
  onSelect: (id: string | null) => void;
  onError?: () => void;
};

export type ScansMapHandle = {
  zoom: (delta: 1 | -1) => void;
  flyToSelected: () => void;
  flyToUser: () => void;
  fitAll: () => void;
};
