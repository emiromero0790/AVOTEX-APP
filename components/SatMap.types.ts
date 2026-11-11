import type { SatLayer, SatMapData, SatNdviOverlay } from './satMapHtml';
import type { ZoneId } from '../services/satZones';

export type SatMapProps = {
  data: SatMapData | null;
  layer: SatLayer;
  /** Mapa de vigor (NDVI) de Sentinel-2; se ve solo en la capa «Satélite». */
  ndvi?: SatNdviOverlay;
  selectedZone: ZoneId | null;
  onSelectZone: (id: ZoneId | null) => void;
  onError?: () => void;
};

export type SatMapHandle = {
  zoom: (delta: 1 | -1) => void;
  fit: () => void;
};

export const ZONE_IDS = ['A', 'B', 'C', 'D'] as const;
export const isZoneId = (v: unknown): v is ZoneId => typeof v === 'string' && (ZONE_IDS as readonly string[]).includes(v);
