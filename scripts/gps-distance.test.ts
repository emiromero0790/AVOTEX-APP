/**
 * Simulaciones de la distancia del recorrido (services/gpsFilter.ts → GpsTrack).
 *
 *   node --experimental-transform-types scripts/gps-distance.test.ts
 *
 * Dos exigencias que se contraponen y deben cumplirse a la vez:
 *   - Quieto (5 min) no debe sumar metros por el «baile» del GPS.
 *   - Caminando debe medir cerca de la distancia real, también en teléfonos que no informan velocidad
 *     (Android devuelve speed = 0 en esas lecturas) y con precisión pobre bajo los árboles.
 * Cada caso se corre con 20 semillas de ruido; se reporta el peor y el promedio.
 */
import assert from 'node:assert/strict';
// Node ejecuta TypeScript directamente y exige la extensión .ts (tsc de la app no la permite).
// @ts-ignore
import { GpsTrack } from '../services/gpsFilter.ts';

const M = 111320, K = Math.cos((19.4 * Math.PI) / 180);
let seed = 1;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const g = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, rnd()))) * Math.cos(2 * Math.PI * rnd());

type SpeedMode = 'doppler' | 'android0' | 'null' | 'mixed';
const SEEDS = 20;

/**
 * Ruido realista: componente lento (sesgo por multitrayecto que deriva) + ruido blanco, como un GPS real
 * de teléfono. noise ≈ precisión / 2.
 */
function simulate(v: number, secs: number, acc: number, mode: SpeedMode, s: number) {
  seed = s;
  const t = new GpsTrack();
  const noise = acc / 2;
  let bx = 0, by = 0, moving = 0, steps = 0;
  for (let i = 0; i <= secs; i++) {
    bx = 0.95 * bx + g() * noise * 0.3; by = 0.95 * by + g() * noise * 0.3;
    const sp = mode === 'doppler' ? Math.max(0, v + g() * 0.12)
      : mode === 'android0' ? 0
      : mode === 'null' ? null
      : i % 3 === 0 ? Math.max(0, v + g() * 0.12) : 0; // mixed: a veces trae velocidad, a veces 0
    const r = t.push({
      lat: 19.4 + (v * i + by + g() * noise * 0.6) / M,
      lng: -102.05 + (bx + g() * noise * 0.6) / (M * K),
      acc: acc * (0.8 + 0.4 * rnd()), speed: sp, t: i * 1000,
    });
    if (r.accepted && r.step > 0) steps++;
    if (t.isMoving(i * 1000)) moving++;
  }
  return { meters: t.distance, movingFrac: moving / (secs + 1), steps };
}

/** Camina 30 s y luego se queda quieto `still` s (el caso típico: revisar un árbol). Metros sumados quieto. */
function walkThenStand(still: number, acc: number, mode: SpeedMode, s: number) {
  seed = s;
  const t = new GpsTrack();
  const noise = acc / 2;
  let bx = 0, by = 0, atStop = 0;
  for (let i = 0; i <= 30 + still; i++) {
    const walking = i <= 30;
    const y = Math.min(i, 30) * 1.2;
    bx = 0.95 * bx + g() * noise * 0.3; by = 0.95 * by + g() * noise * 0.3;
    const v = walking ? 1.2 : 0;
    const sp = mode === 'doppler' ? Math.max(0, v + g() * 0.12) : mode === 'android0' ? 0 : mode === 'null' ? null : i % 3 === 0 ? Math.max(0, v + g() * 0.12) : 0;
    t.push({ lat: 19.4 + (y + by + g() * noise * 0.6) / M, lng: -102.05 + (bx + g() * noise * 0.6) / (M * K), acc: acc * (0.8 + 0.4 * rnd()), speed: sp, t: i * 1000 });
    if (i === 34) atStop = t.distance; // margen de frenado
  }
  return t.distance - atStop;
}

function stats(v: number, secs: number, acc: number, mode: SpeedMode) {
  const runs = Array.from({ length: SEEDS }, (_, i) => simulate(v, secs, acc, mode, 1000 + i * 7919));
  const m = runs.map(r => r.meters);
  return {
    min: Math.min(...m), max: Math.max(...m), avg: m.reduce((a, b) => a + b, 0) / m.length,
    moving: runs.reduce((a, r) => a + r.movingFrac, 0) / runs.length,
  };
}

const rows: string[] = [];
let failed = 0;
function check(name: string, ok: boolean, detail: string) {
  rows.push(`  ${ok ? '✔' : '✘'} ${name.padEnd(62)} ${detail}`);
  if (!ok) failed++;
}

const MODES: SpeedMode[] = ['doppler', 'android0', 'null', 'mixed'];
const LABEL: Record<SpeedMode, string> = { doppler: 'Doppler real', android0: 'Android speed=0', null: 'sin velocidad', mixed: 'mixto 0/real' };

rows.push('Camina 30 s y se queda quieto 5 min revisando un árbol (metros sumados estando quieto):');
for (const acc of [5, 10, 20]) for (const mode of ['doppler', 'mixed'] as SpeedMode[]) {
  const m = Array.from({ length: SEEDS }, (_, i) => walkThenStand(300, acc, mode, 2000 + i * 104729));
  const worst = Math.max(...m), avg = m.reduce((a, b) => a + b, 0) / m.length;
  // Con velocidad Doppler demostrada, quieto no debe sumar (≤ 3 m con precisión ≤ 10 m; con ±20 m,
  // promedio ≤ 0.75 × precisión).
  const ok = acc <= 10 ? worst <= 3 : avg <= 0.75 * acc;
  check(`±${acc} m · ${LABEL[mode]}`, ok, `peor ${worst.toFixed(1)} m · prom ${avg.toFixed(1)} m`);
}

rows.push('Quieto 5 min sin velocidad utilizable (límite conocido: solo hay posición para decidir):');
for (const acc of [5, 10, 20]) for (const mode of ['android0', 'null'] as SpeedMode[]) {
  const r = stats(0, 300, acc, mode);
  // Ruido con deriva correlacionada (peor caso realista). Antes de este filtro sumaba ~1 200 m; la
  // versión anterior del filtro, 55–134 m en promedio con este mismo modelo. Exigencia: promedio ≤ 3.5×precisión.
  check(`±${acc} m · ${LABEL[mode]}`, r.avg <= 3.5 * acc, `peor ${r.max.toFixed(1)} m · prom ${r.avg.toFixed(1)} m`);
}

rows.push('Caminando a 1.2 m/s (nunca debe quedarse en 0; con buena precisión, cerca de la real):');
// [segundos, precisión, mínimo exigido en el peor caso, promedio mínimo exigido]
const WALKS: [number, number, number, number][] = [
  [15, 5, 0.35, 0.7],   // 18 m: el último tramo puede quedar sin cerrar al terminar
  [60, 5, 0.85, 0.9],
  [60, 10, 0.75, 0.85],
  [60, 20, 0.4, 0.75],  // bajo la copa de los árboles
  [60, 30, 0, 0.55],    // muy imprecisa: se mide, pero con poca exactitud
  [300, 8, 0.9, 0.95],
];
for (const [secs, acc, minOk, avgOk] of WALKS) for (const mode of MODES) {
  const real = 1.2 * secs;
  const r = stats(1.2, secs, acc, mode);
  const ok = r.min >= real * minOk && r.avg >= real * avgOk && r.max <= real * 1.35 && (acc > 20 || r.min > 0);
  check(`${real} m · ±${acc} m · ${LABEL[mode]}`, ok, `min ${(r.min / real * 100).toFixed(0)}% · prom ${(r.avg / real * 100).toFixed(0)}% · máx ${(r.max / real * 100).toFixed(0)}% · en movimiento ${(r.moving * 100).toFixed(0)}%`);
}

rows.push('Caminando lento a 0.6 m/s, 2 min:');
for (const mode of MODES) {
  const r = stats(0.6, 120, 6, mode);
  check(`72 m · ±6 m · ${LABEL[mode]}`, r.min >= 72 * 0.75 && r.max <= 72 * 1.25, `min ${(r.min / 72 * 100).toFixed(0)}% · prom ${(r.avg / 72 * 100).toFixed(0)}%`);
}

console.log('Distancia del recorrido — GpsTrack');
console.log(rows.join('\n'));
assert.equal(failed, 0, `${failed} caso(s) fuera de tolerancia`);
