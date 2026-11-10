/**
 * Cámara virtual de AVOTEX Field Tracking 3D.
 *
 * Es la misma cámara con la que se prerenderizaron el agricultor, los árboles y el fondo
 * (scripts/field-tracking/render.html): mismos metros, altura, inclinación y campo de visión. Por eso los
 * elementos dinámicos (camino, cuadrícula, trayectoria, árboles cercanos) proyectados aquí encajan en
 * perspectiva con los prerenderizados.
 *
 * Coordenadas del mundo: x lateral (+ derecha), y altura, z distancia hacia adelante desde la cámara (m).
 * Coordenadas de pantalla: dp dentro de una escena de VIEW_W × VIEW_H (se escala al tamaño real del panel).
 */
import scene from '../../assets/field-tracking/field-scene.json';

const cam = scene.camera;
export const VIEW_W = cam.viewW;
export const VIEW_H = cam.viewH;
export const CAM_H = cam.camHeight;
export const CHAR_Z = cam.charZ;
const PITCH = (cam.pitchDeg * Math.PI) / 180;
export const SIN_P = Math.sin(PITCH);
export const COS_P = Math.cos(PITCH);
export const CX = VIEW_W / 2;
export const CY = VIEW_H / 2;
/** Distancia focal en dp. */
export const F_PX = CY / Math.tan(((cam.fovDeg / 2) * Math.PI) / 180);
export const HORIZON_Y = CY - F_PX * Math.tan(PITCH);

export const FARMER = scene.farmer;
export const TREES = scene.trees;
export const TREE_ROWS_X = cam.treeRowsX;
export const TREE_SPACING = cam.treeSpacing;
export const DYNAMIC_TREE_Z = cam.dynamicTreeZ;

/** El camino empieza a curvarse un poco antes del agricultor (detrás de él sigue recto). */
const BEND_Z0 = CHAR_Z * 0.7;

/** Desplazamiento lateral del camino a la distancia z para una curvatura dada (parábola, limitada). */
export function bendX(z: number, curvature: number): number {
  'worklet';
  const dz = z - BEND_Z0;
  if (dz <= 0) return 0;
  const b = 0.5 * curvature * dz * dz;
  const lim = 0.32 * z;
  return b > lim ? lim : b < -lim ? -lim : b;
}

/** Profundidad (eje óptico) de un punto del suelo. */
export function depthOf(z: number, y = 0): number {
  'worklet';
  return (CAM_H - y) * SIN_P + z * COS_P;
}

export function screenX(x: number, z: number, y = 0): number {
  'worklet';
  return CX + (F_PX * x) / depthOf(z, y);
}

export function screenY(z: number, y = 0): number {
  'worklet';
  return CY - (F_PX * ((y - CAM_H) * COS_P + z * SIN_P)) / depthOf(z, y);
}

/** dp por metro a la distancia z. */
export function scaleAt(z: number, y = 0): number {
  'worklet';
  return F_PX / depthOf(z, y);
}

export function mod(a: number, m: number): number {
  'worklet';
  return ((a % m) + m) % m;
}

/** Pseudoaleatorio estable por árbol (tamaño y espejo varían sin cambiar de imagen). */
export function hash(n: number): number {
  'worklet';
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/** Polígono en el suelo: banda de ancho halfW(z) alrededor de la línea central (xc + curva). */
export function ribbon(zs: readonly number[], xc: number, halfW: number, curvature: number, taper = 0): string {
  'worklet';
  let left = '';
  let right = '';
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i];
    const c = xc + bendX(z, curvature);
    const hw = halfW * (1 - taper * (i / (zs.length - 1)));
    const y = screenY(z).toFixed(1);
    left += (i === 0 ? 'M' : 'L') + screenX(c - hw, z).toFixed(1) + ' ' + y;
    right = 'L' + screenX(c + hw, z).toFixed(1) + ' ' + y + right;
  }
  return left + right + 'Z';
}

/** Polilínea en el suelo a la distancia lateral x (sigue la curva del camino). */
export function groundLine(zs: readonly number[], x: number, curvature: number): string {
  'worklet';
  let d = '';
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i];
    d += (i === 0 ? 'M' : 'L') + screenX(x + bendX(z, curvature), z).toFixed(1) + ' ' + screenY(z).toFixed(1);
  }
  return d;
}
