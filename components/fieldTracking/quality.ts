/**
 * Niveles de calidad de Field Tracking 3D. El recorrido (cámara, captura, GPS) siempre tiene prioridad:
 * el visualizador empieza en el nivel que el teléfono aguanta y baja solo si detecta tirones.
 */
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Battery from 'expo-battery';

export type FieldQuality = 'high' | 'reduced' | 'light' | 'off';

export type QualitySpec = {
  /** Fotogramas por segundo de la escena (no de la cámara). */
  fps: number;
  /** Filas de árboles dinámicos (índices de TREE_ROWS_X). */
  treeRows: number[];
  /** Árboles por fila. */
  treeSlots: number;
  /** Líneas transversales de la cuadrícula que se desplazan. */
  crossLines: number;
  /** Destellos que recorren la trayectoria. */
  flow: boolean;
  /** Líneas longitudinales exteriores de la cuadrícula. */
  outerGrid: boolean;
};

export const QUALITY: Record<Exclude<FieldQuality, 'off'>, QualitySpec> = {
  high: { fps: 20, treeRows: [0, 1], treeSlots: 7, crossLines: 14, flow: true, outerGrid: true },
  reduced: { fps: 15, treeRows: [0], treeSlots: 6, crossLines: 10, flow: false, outerGrid: true },
  // Modo ligero: personaje, camino y trayectoria; sin árboles dinámicos (quedan las filas lejanas del fondo).
  light: { fps: 10, treeRows: [], treeSlots: 0, crossLines: 7, flow: false, outerGrid: false },
};

export const DOWNGRADE: Record<FieldQuality, FieldQuality> = { high: 'reduced', reduced: 'light', light: 'off', off: 'off' };

const GB = 1024 ** 3;

let cached: Promise<FieldQuality> | null = null;

/**
 * Nivel inicial según memoria, año del equipo y batería. Nunca lanza: ante la duda, «reduced».
 * Se calcula una vez por sesión: al girar el teléfono el panel se vuelve a montar y no debe esperar otra vez a la
 * batería (hasta 1.5 s) para dibujar al agricultor.
 */
export function initialQuality(): Promise<FieldQuality> {
  if (!cached) cached = computeInitialQuality();
  return cached;
}

async function computeInitialQuality(): Promise<FieldQuality> {
  let q: FieldQuality = 'high';
  try {
    const mem = Device.totalMemory;
    const year = Device.deviceYearClass;
    if (mem != null && mem > 0) {
      if (mem < 2.5 * GB) q = 'light';
      else if (mem < 3.5 * GB) q = 'reduced';
    }
    if (year != null && year > 0 && year < 2017) q = q === 'high' ? 'reduced' : q;
  } catch { q = 'reduced'; }
  if (Platform.OS !== 'web') {
    try {
      const p = await Promise.race([
        Battery.getPowerStateAsync(),
        new Promise<null>(r => setTimeout(() => r(null), 1500)),
      ]);
      if (p) {
        const unplugged = p.batteryState !== Battery.BatteryState.CHARGING && p.batteryState !== Battery.BatteryState.FULL;
        if (p.lowPowerMode) q = 'light';
        else if (unplugged && p.batteryLevel >= 0 && p.batteryLevel < 0.15) q = 'light';
      }
    } catch { /* sin dato de batería */ }
  }
  return q;
}
