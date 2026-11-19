import type { LatLng } from '../services/satZones';
import type { ZoneEditorData } from './zoneEditorHtml';

export type ZoneEditorMapHandle = {
  /** La línea que se acaba de trazar no divide nada: se pinta en rojo y se desvanece. */
  reject: () => void;
  fit: () => void;
  zoom: (delta: number) => void;
};

export type ZoneEditorMapProps = {
  data: ZoneEditorData;
  onCut: (cut: { a: LatLng; b: LatLng }) => void;
  onSelect: (index: number | null) => void;
  onError?: () => void;
};
