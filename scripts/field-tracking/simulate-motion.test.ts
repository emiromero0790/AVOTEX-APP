/**
 * Simulaciones del estado de movimiento de Field Tracking 3D (services/fieldMotion.ts).
 *
 *   node --experimental-strip-types scripts/field-tracking/simulate-motion.test.ts
 *
 * Alimenta lecturas sintéticas igual que recorrido.tsx: cada lectura pasa primero por GpsTrack (filtro real
 * de la distancia) y luego por FieldMotion. Ruido gaussiano reproducible (semilla fija).
 */
import assert from 'node:assert/strict';
// Node ejecuta TypeScript directamente y exige la extensión .ts (tsc de la app no la permite).
// @ts-ignore
import { GpsTrack } from '../../services/gpsFilter.ts';
// @ts-ignore
import { FieldMotion, type FieldMotionState } from '../../services/fieldMotion.ts';

const M_PER_DEG = 111320;
const LAT0 = 19.4, LNG0 = -102.05; // Uruapan (zona aguacatera)
const K = Math.cos((LAT0 * Math.PI) / 180);

let seed = 42;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const gauss = () => { const u = Math.max(1e-9, rnd()), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

type Sample = { t: number; x: number; y: number; acc: number; speed: number | null; heading: number | null; noise: number };

function run(samples: Sample[], opts: { tickUntil?: number } = {}) {
  const track = new GpsTrack();
  const fm = new FieldMotion(samples[0]?.t ?? 0);
  const log: { t: number; s: FieldMotionState }[] = [];
  let lastT = samples[0]?.t ?? 0;
  fm.subscribe(s => log.push({ t: lastT, s }));
  let nextTick = lastT + 1000;
  for (const p of samples) {
    while (nextTick <= p.t) { lastT = nextTick; fm.tick(nextTick); nextTick += 1000; }
    lastT = p.t;
    const lat = LAT0 + (p.y + gauss() * p.noise) / M_PER_DEG;
    const lng = LNG0 + (p.x + gauss() * p.noise) / (M_PER_DEG * K);
    const r = track.push({ lat, lng, acc: p.acc, speed: p.speed, t: p.t });
    fm.pushFix({ t: p.t, lat, lng, acc: p.acc, speed: track.lastSpeed, heading: p.heading, accepted: r.accepted, step: r.step, trackMoving: track.isMoving(p.t) });
  }
  const end = opts.tickUntil ?? lastT;
  while (nextTick <= end) { lastT = nextTick; fm.tick(nextTick); nextTick += 1000; }
  return { fm, track, log };
}

/** Recta hacia el norte a velocidad v (m/s) durante secs, 1 lectura/s. */
function straight(v: number, secs: number, o: Partial<Sample> & { t0?: number; y0?: number; dopplerNoise?: number } = {}) {
  const out: Sample[] = [];
  const t0 = o.t0 ?? 0, y0 = o.y0 ?? 0;
  for (let i = 0; i <= secs; i++) {
    const dn = o.dopplerNoise ?? 0.08;
    out.push({ t: t0 + i * 1000, x: 0, y: y0 + v * i, acc: o.acc ?? 5, noise: o.noise ?? 2,
      speed: o.speed === null ? null : Math.max(0, v + gauss() * dn), heading: v > 0 ? 0 : -1 });
  }
  return out;
}

const results: string[] = [];
function check(name: string, fn: () => void) {
  try { fn(); results.push(`  ✔ ${name}`); }
  catch (e) { results.push(`  ✘ ${name}\n      ${(e as Error).message}`); process.exitCode = 1; }
}
const movingFraction = (log: { t: number; s: FieldMotionState }[], from: number, to: number) => {
  // fracción del tiempo [from,to] en que el estado fue «moving»
  let cur: FieldMotionState | null = null, tPrev = from, on = 0;
  for (const e of log) {
    if (e.t > to) break;
    if (e.t >= from && cur) { on += cur.moving ? e.t - tPrev : 0; tPrev = e.t; }
    if (e.t < from) tPrev = from;
    cur = e.s;
  }
  if (cur?.moving) on += to - Math.max(tPrev, from);
  return on / (to - from);
};

check('1. Quieto con ruido ±5 m y Doppler bajo: nunca camina', () => {
  const s = straight(0, 300, { noise: 5, acc: 8, dopplerNoise: 0.15 });
  const { log, fm } = run(s);
  assert.equal(log.some(e => e.s.moving), false, 'el personaje empezó a caminar estando quieto');
  assert.equal(fm.current.speed, 0);
});

check('2. Quieto sin velocidad Doppler (teléfonos que no la dan): nunca camina', () => {
  const s = straight(0, 300, { noise: 4, acc: 8, speed: null });
  const { log } = run(s);
  assert.ok(movingFraction(log, 0, 300000) < 0.03, `en movimiento ${(movingFraction(log, 0, 300000) * 100).toFixed(1)}% del tiempo`);
});

check('3. Caminata lenta (0.6 m/s): camina con paso lento', () => {
  const { fm, log } = run(straight(0.6, 60));
  assert.equal(fm.current.moving, true);
  assert.ok(Math.abs(fm.current.speed - 0.6) < 0.15, `velocidad ${fm.current.speed.toFixed(2)}`);
  const first = log.find(e => e.s.moving)!;
  assert.ok(first.t <= 4000, `tardó ${first.t} ms en arrancar`);
});

check('4. Caminata normal (1.2 m/s): velocidad proporcional', () => {
  const { fm } = run(straight(1.2, 60));
  assert.ok(Math.abs(fm.current.speed - 1.2) < 0.15, `velocidad ${fm.current.speed.toFixed(2)}`);
});

check('5. Caminata rápida (2.6 m/s): paso más rápido pero limitado (sin carrera)', () => {
  const { fm } = run(straight(2.6, 40));
  assert.equal(fm.current.speed, 1.9);
});

check('6. Camina 30 s y se detiene: idle en ≤ 4 s', () => {
  const walk = straight(1.1, 30);
  const stop = straight(0, 30, { t0: 31000, y0: 33, dopplerNoise: 0.05 });
  const { log, fm } = run([...walk, ...stop]);
  const stoppedAt = log.find(e => e.t > 31000 && !e.s.moving)?.t ?? Infinity;
  assert.ok(stoppedAt - 31000 <= 4000, `se detuvo ${stoppedAt - 31000} ms después`);
  assert.equal(fm.current.moving, false);
});

check('7. GPS perdido mientras camina: se detiene a los ≤ 5 s y marca «sin ubicación» a los ≤ 10 s', () => {
  const { log } = run(straight(1.2, 20), { tickUntil: 35000 });
  const stopped = log.find(e => e.t > 20000 && !e.s.moving);
  const none = log.find(e => e.t > 20000 && e.s.gps === 'none');
  assert.ok(stopped && stopped.t - 20000 <= 5000, `detención a ${stopped?.t}`);
  assert.ok(none && none.t - 20000 <= 10000, `«none» a ${none?.t}`);
});

check('8. Precisión baja (±30 m): GPS débil y sin movimiento ficticio', () => {
  const s = straight(0, 60, { acc: 30, noise: 12, dopplerNoise: 0.4 });
  const { log, fm } = run(s);
  assert.equal(log.some(e => e.s.moving), false);
  assert.equal(fm.current.gps, 'weak');
});

check('9. Precisión media (±18 m) quieto con Doppler ruidoso: no arranca', () => {
  const s = straight(0, 120, { acc: 18, noise: 7, dopplerNoise: 0.35 });
  const { log } = run(s);
  assert.ok(movingFraction(log, 0, 120000) < 0.05, `en movimiento ${(movingFraction(log, 0, 120000) * 100).toFixed(1)}%`);
});

check('10. Salto brusco de 80 m: la velocidad visual no se dispara ni gira violentamente', () => {
  const a = straight(1.0, 20);
  const jump: Sample[] = [{ t: 21000, x: 80, y: 21, acc: 6, speed: 1.0, heading: 90, noise: 1 }];
  const b = straight(1.0, 20, { t0: 22000, y0: 22 });
  const { log } = run([...a, ...jump, ...b]);
  const maxSpeed = Math.max(...log.map(e => e.s.speed));
  const maxCurv = Math.max(...log.map(e => Math.abs(e.s.curvature)));
  assert.ok(maxSpeed <= 1.9, `velocidad máx ${maxSpeed}`);
  assert.ok(maxCurv <= 0.06, `curvatura máx ${maxCurv}`);
});

check('11. Vuelta en círculo de 20 m de radio: curvatura ≈ 1/20 hacia la derecha', () => {
  const R = 20, v = 1.2, out: Sample[] = [];
  for (let i = 0; i <= 60; i++) {
    const a = (v * i) / R; // rad recorridos, sentido horario (derecha) empezando hacia el norte
    out.push({ t: i * 1000, x: R - R * Math.cos(a), y: R * Math.sin(a), acc: 4, noise: 1, speed: v + gauss() * 0.05, heading: ((a * 180) / Math.PI) % 360 });
  }
  const { fm } = run(out);
  assert.ok(fm.current.curvature > 0.03 && fm.current.curvature <= 0.06, `curvatura ${fm.current.curvature.toFixed(3)}`);
});

check('12. Recorrido corto (8 m): camina y se detiene sin inventar movimiento', () => {
  const s = [...straight(1.0, 8), ...straight(0, 20, { t0: 9000, y0: 8, dopplerNoise: 0.05 })];
  const { log, fm } = run(s);
  assert.ok(log.some(e => e.s.moving));
  assert.equal(fm.current.moving, false);
});

check('13. Recorrido largo (40 min a 1 m/s): estable, sin pérdidas de estado', () => {
  const { log, fm } = run(straight(1.0, 2400));
  assert.equal(fm.current.moving, true);
  assert.ok(movingFraction(log, 5000, 2400000) > 0.98);
});

check('14. FieldMotion no altera la distancia de GpsTrack', () => {
  const s = straight(1.2, 120);
  seed = 7; const a = run(s).track.distance;
  seed = 7; const t2 = new GpsTrack();
  // misma secuencia de ruido sin FieldMotion
  for (const p of s) {
    const lat = LAT0 + (p.y + gauss() * p.noise) / M_PER_DEG; const lng = LNG0 + (p.x + gauss() * p.noise) / (M_PER_DEG * K);
    t2.push({ lat, lng, acc: p.acc, speed: p.speed, t: p.t });
  }
  assert.equal(a, t2.distance);
});

check('15. Android sin velocidad (speed = 0 siempre) caminando 1.2 m/s: el personaje camina', () => {
  const s = straight(1.2, 60).map(p => ({ ...p, speed: 0 }));
  const { fm, log } = run(s);
  assert.equal(fm.current.moving, true, 'no camina');
  const first = log.find(e => e.s.moving)!;
  assert.ok(first.t <= 12000, `tardó ${first.t} ms en arrancar`);
});

check('16. Android sin velocidad quieto 5 min: casi nunca camina', () => {
  const s = straight(0, 300, { noise: 3, acc: 6 }).map(p => ({ ...p, speed: 0 }));
  const { log } = run(s);
  const f = movingFraction(log, 0, 300000);
  assert.ok(f < 0.1, `en movimiento ${(f * 100).toFixed(1)}%`);
});

console.log('Field Tracking — simulaciones de movimiento');
console.log(results.join('\n'));
