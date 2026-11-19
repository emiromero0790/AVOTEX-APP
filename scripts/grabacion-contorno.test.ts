/**
 * Grabaciones subidas antes de redibujar la huerta: deben verse como se veían al subirlas.
 *
 *   node --experimental-transform-types scripts/grabacion-contorno.test.ts
 *
 * Una grabación guarda una copia de las zonas (recorridos.zonas) pero no del contorno. El contorno de
 * ese momento se reconstruye del borde exterior de las zonas (services/grabacionContorno.ts). Aquí se
 * simulan grabaciones con la copia EXACTA que guarda la app (zonasDeHuerta: redondeo a 1e-6 grados)
 * y se comprueba que el contorno reconstruido es el de entonces, no el actual.
 */
import assert from 'node:assert/strict';
// @ts-ignore — Node ejecuta TypeScript directamente y exige la extensión .ts.
import { buildOrchardGeometry, checkNewCut, serializeZoneCuts } from '../services/satZones.ts';
// @ts-ignore
import { contornoDeZonas, contornoGrabacion } from '../services/grabacionContorno.ts';

type LL = { lat: number; lng: number };
const LAT0 = 19.41, LNG0 = -102.06;
const M_LAT = 1 / 110540, M_LNG = 1 / (111320 * Math.cos((LAT0 * Math.PI) / 180));
const ring = (pts: [number, number][]) => pts.map(([x, y]) => ({ latitude: LAT0 + y * M_LAT, longitude: LNG0 + x * M_LNG }));
const at = (x: number, y: number): LL => ({ lat: LAT0 + y * M_LAT, lng: LNG0 + x * M_LNG });
const cut = (x1: number, y1: number, x2: number, y2: number) => ({ a: at(x1, y1), b: at(x2, y2) });
const xy = (p: LL) => ({ x: (p.lng - LNG0) / M_LNG, y: (p.lat - LAT0) / M_LAT });

/** Exactamente lo que guarda la app al subir una grabación (services/grabacion.ts → zonasDeHuerta). */
function snapshot(coords: unknown, id: string, cuts?: unknown) {
  const g = buildOrchardGeometry(coords, id, cuts);
  assert.ok(g.ok && g.zones.length, 'la huerta debe tener zonas');
  const r = (p: LL) => ({ lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 });
  return g.zones.map(z => ({ id: z.id, color: z.color, ring: z.ring.map(r), label: r(z.label), share: Math.round(z.share * 10) / 10 }));
}

const areaM2 = (pts: LL[]) => {
  const q = pts.map(xy);
  return Math.abs(q.reduce((s, p, i) => { const n = q[(i + 1) % q.length]; return s + p.x * n.y - n.x * p.y; }, 0)) / 2;
};
const distToRing = (p: { x: number; y: number }, r: { x: number; y: number }[]) => {
  let best = Infinity;
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length], dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)) : 0;
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return best;
};
/** El contorno reconstruido coincide con el polígono original (mismo borde, con tolerancia de 0.5 m). */
function assertSameShape(got: LL[] | null, coords: { latitude: number; longitude: number }[], label: string) {
  assert.ok(got && got.length >= 3, `${label}: no se reconstruyó el contorno`);
  const orig = coords.map(c => xy({ lat: c.latitude, lng: c.longitude }));
  const g = got!.map(xy);
  for (const p of orig) assert.ok(distToRing(p, g) < 0.5, `${label}: vértice original fuera del contorno (${distToRing(p, g).toFixed(2)} m)`);
  for (const p of g) assert.ok(distToRing(p, orig) < 0.5, `${label}: vértice reconstruido fuera del original (${distToRing(p, orig).toFixed(2)} m)`);
  const a1 = areaM2(got!), a0 = areaM2(coords.map(c => ({ lat: c.latitude, lng: c.longitude })));
  assert.ok(Math.abs(a1 - a0) / a0 < 0.005, `${label}: área ${a1.toFixed(1)} vs ${a0.toFixed(1)}`);
}

const shapes: Record<string, ReturnType<typeof ring>> = {
  rect: ring([[0, 0], [200, 0], [200, 120], [0, 120]]),
  ele: ring([[0, 0], [160, 0], [160, 60], [70, 60], [70, 150], [0, 150]]),
  irregular: ring([[0, 10], [40, -15], [110, -5], [170, 20], [190, 80], [150, 140], [80, 160], [20, 130], [-10, 70]]),
  u: ring([[0, 0], [180, 0], [180, 140], [130, 140], [130, 50], [50, 50], [50, 140], [0, 140]]),
  grande: ring([[0, 0], [900, -40], [1300, 300], [1000, 800], [300, 900], [-100, 500]]),
  chica: ring([[0, 0], [30, 0], [35, 25], [5, 30]]),
};

let n = 0;
const test = (name: string, fn: () => void) => { fn(); n++; console.log(`  ✓ ${name}`); };
console.log('Grabaciones con la huerta de antes');

test('el contorno reconstruido de las zonas automáticas es el polígono original (6 formas × 4 huertas)', () => {
  for (const [name, coords] of Object.entries(shapes)) {
    for (const id of ['a', 'huerta-7', '0b7c1e2a-77aa-4b61-9d0e-1d2c3b4a5f60', 'zz']) {
      assertSameShape(contornoDeZonas(snapshot(coords, id)), coords, `${name}/${id}`);
    }
  }
});

test('también con zonas editadas a mano (1, 2, 3 y 4 zonas)', () => {
  const r = shapes.rect;
  const sets = [
    [],
    [cut(100, -10, 100, 130)],
    [cut(100, -10, 100, 130), cut(10, 60, 90, 60)],
    [cut(100, -10, 100, 130), cut(-10, 60, 210, 60)],
  ];
  for (const s of sets) assertSameShape(contornoDeZonas(snapshot(r, 'x', serializeZoneCuts(s))), r, `rect/${s.length} líneas`);
  const irr = shapes.irregular;
  assertSameShape(contornoDeZonas(snapshot(irr, 'x', serializeZoneCuts([cut(90, -40, 90, 180), cut(-20, 70, 85, 70), cut(95, 75, 200, 75)]))), irr, 'irregular/editadas');
  const ele = shapes.ele;
  assertSameShape(contornoDeZonas(snapshot(ele, 'x', serializeZoneCuts([cut(-10, 40, 170, 40), cut(35, 30, 35, 160)]))), ele, 'ele/editadas');
});

test('CASO REAL: grabación subida con la huerta chica; después se agrandó y se editaron las zonas', () => {
  const antes = shapes.irregular;                                                  // polígono al subir la grabación
  const despues = ring([[-60, -40], [60, -70], [220, -20], [260, 90], [200, 210], [60, 220], [-40, 150]]); // polígono nuevo, más grande
  const id = '0b7c1e2a-77aa-4b61-9d0e-1d2c3b4a5f60';
  const guardadas = snapshot(antes, id);                                           // zonas automáticas de entonces (recorridos.zonas)
  const actuales = snapshot(despues, id, serializeZoneCuts([cut(100, -100, 100, 260)])); // zonas editadas hoy
  const contornoActual = despues.map(c => ({ lat: c.latitude, lng: c.longitude }));

  // Lo que se dibuja con la grabación: el contorno de ANTES, no el actual.
  const dibujado = contornoGrabacion(guardadas, contornoActual);
  assertSameShape(dibujado, antes, 'contorno de la grabación');
  assert.ok(Math.abs(areaM2(dibujado!) - areaM2(contornoActual)) > 1000, 'no debe ser el contorno actual');
  // Las zonas que se dibujan son las guardadas (4 de entonces), no las 2 editadas de hoy.
  assert.equal(guardadas.length, 4);
  assert.equal(actuales.length, 2);
  // Y todas las zonas guardadas quedan dentro del contorno dibujado (no se salen ni dejan huecos).
  const sumZonas = guardadas.reduce((s, z) => s + areaM2(z.ring), 0);
  assert.ok(Math.abs(sumZonas - areaM2(dibujado!)) / sumZonas < 0.005);
});

test('CASO REAL: la huerta se achicó después de subir la grabación', () => {
  const antes = shapes.grande, despues = shapes.chica;
  const guardadas = snapshot(antes, 'h');
  const dibujado = contornoGrabacion(guardadas, despues.map(c => ({ lat: c.latitude, lng: c.longitude })));
  assertSameShape(dibujado, antes, 'contorno grande de antes');
});

test('grabación antigua SIN copia de zonas → contorno actual (como antes del arreglo)', () => {
  const actual = shapes.rect.map(c => ({ lat: c.latitude, lng: c.longitude }));
  assert.deepEqual(contornoGrabacion([], actual), actual);
  assert.equal(contornoGrabacion([], []), null);
});

test('copia dañada o incompleta → no se dibuja contorno, sin errores', () => {
  const full = snapshot(shapes.rect, 'x', serializeZoneCuts([cut(100, -10, 100, 130), cut(-10, 60, 210, 60)]));
  // Dos zonas en diagonal (no se tocan): no forman un solo anillo.
  const diag = full.filter(z => ['A', 'D'].includes(z.id));
  const r = contornoDeZonas(diag);
  assert.ok(r === null || r.length >= 3);
  assert.equal(contornoDeZonas([]), null);
  assert.equal(contornoDeZonas([{ id: 'A', color: 'cyan', ring: [at(0, 0), at(1, 1)], label: at(0, 0), share: 100 }]), null);
});

test('una sola zona guardada → su propio contorno', () => {
  const one = snapshot(shapes.ele, 'x', serializeZoneCuts([]));
  assert.equal(one.length, 1);
  assertSameShape(contornoDeZonas(one), shapes.ele, 'una zona');
});

test('300 huertas al azar (formas cóncavas, zonas automáticas y editadas): el contorno siempre se reconstruye igual', () => {
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let edited = 0;
  for (let k = 0; k < 300; k++) {
    // Polígono en estrella (siempre simple): 5–14 vértices, radios de 40 a 400 m, a veces muy cóncavo.
    const nv = 5 + Math.floor(rnd() * 10), R = 40 + rnd() * 360, wild = rnd() < 0.4 ? 0.75 : 0.35;
    const pts: [number, number][] = [];
    for (let i = 0; i < nv; i++) {
      const ang = (i / nv) * Math.PI * 2 + (rnd() - 0.5) * (Math.PI / nv);
      const r = R * (1 - wild * rnd());
      pts.push([Math.cos(ang) * r, Math.sin(ang) * r]);
    }
    const coords = ring(pts);
    const id = `h${k}`;
    const g = buildOrchardGeometry(coords, id);
    if (!g.ok || !g.zones.length) continue;
    assertSameShape(contornoDeZonas(snapshot(coords, id)), coords, `azar ${k} automáticas`);
    // Zonas editadas: hasta 3 líneas al azar que la app acepte.
    const cuts: { a: LL; b: LL }[] = [];
    for (let t = 0; t < 12 && cuts.length < 3; t++) {
      const a0 = rnd() * Math.PI * 2, off = (rnd() - 0.5) * R;
      const cx = Math.cos(a0 + Math.PI / 2) * off, cy = Math.sin(a0 + Math.PI / 2) * off;
      const c = cut(cx - Math.cos(a0) * R * 2, cy - Math.sin(a0) * R * 2, cx + Math.cos(a0) * R * 2, cy + Math.sin(a0) * R * 2);
      const r = checkNewCut(coords, cuts, c);
      if (r.ok) cuts.push(r.cut);
    }
    if (cuts.length) {
      edited++;
      assertSameShape(contornoDeZonas(snapshot(coords, id, serializeZoneCuts(cuts))), coords, `azar ${k} editadas (${cuts.length} líneas)`);
    }
  }
  assert.ok(edited > 150, `casos con zonas editadas: ${edited}`);
});

console.log(`\n${n} pruebas correctas`);
