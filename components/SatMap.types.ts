import type { SatLayer, SatMapData } from './satMapHtml';
import type { ZoneId } from '../services/satZones';

export type SatMapProps = {
  data: SatMapData | null;
  layer: SatLayer;
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
