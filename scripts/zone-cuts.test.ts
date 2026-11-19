/**
 * Pruebas de las zonas editables (services/satZones.ts): líneas de corte → zonas A–D.
 *
 *   node --experimental-transform-types scripts/zone-cuts.test.ts
 *
 * Comprueba que:
 *   - Las líneas equivalentes a las zonas automáticas reproducen exactamente las mismas zonas
 *     (al abrir el editor no cambia nada hasta que el agricultor dibuja).
 *   - Una línea divide, de lado a lado, solo las zonas por las que pasa.
 *   - Nunca hay más de 4 zonas, ni zonas diminutas, y las zonas siempre suman el 100 % de la huerta.
 *   - Los datos dañados en la base no rompen nada (se vuelve a las zonas automáticas).
 */
import assert from 'node:assert/strict';
// @ts-ignore — Node ejecuta TypeScript directamente y exige la extensión .ts.
import { autoZoneCuts, buildOrchardGeometry, checkNewCut, parseZoneCuts, serializeZoneCuts, MAX_ZONES } from '../services/satZones.ts';

type LL = { lat: number; lng: number };
// Rectángulo de ~200 m × 120 m cerca de Uruapan, en el formato de la app ({latitude, longitude}).
const LAT0 = 19.41, LNG0 = -102.06;
const M_LAT = 1 / 110540, M_LNG = 1 / (111320 * Math.cos((LAT0 * Math.PI) / 180));
const at = (x: number, y: number): LL => ({ lat: LAT0 + y * M_LAT, lng: LNG0 + x * M_LNG });
const ring = (pts: [number, number][]) => pts.map(([x, y]) => ({ latitude: LAT0 + y * M_LAT, longitude: LNG0 + x * M_LNG }));
const cut = (x1: number, y1: number, x2: number, y2: number) => ({ a: at(x1, y1), b: at(x2, y2) });

const rect = ring([[0, 0], [200, 0], [200, 120], [0, 120]]);
// Huerta en «L» (cóncava).
const ell = ring([[0, 0], [160, 0], [160, 60], [70, 60], [70, 150], [0, 150]]);
// Polígono irregular de 9 vértices.
const blob = ring([[0, 10], [40, -15], [110, -5], [170, 20], [190, 80], [150, 140], [80, 160], [20, 130], [-10, 70]]);

let n = 0;
const test = (name: string, fn: () => void) => { fn(); n++; console.log(`  ✓ ${name}`); };
const zonesOf = (coords: unknown, seed: string, cuts?: unknown) => {
  const g = buildOrchardGeometry(coords, seed, cuts);
  assert.ok(g.ok);
  return g.zones;
};
const shares = (zs: { share: number }[]) => zs.reduce((s, z) => s + z.share, 0);

console.log('Zonas editables');

test('las líneas de las zonas automáticas reproducen las mismas zonas', () => {
  for (const [name, coords] of [['rect', rect], ['ell', ell], ['blob', blob]] as const) {
    for (const seed of ['a', 'huerta-1', '0b7c1e2a-77aa-4b61-9d0e-1d2c3b4a5f60', 'x9', 'zz-42']) {
      const auto = zonesOf(coords, seed);
      const cuts = autoZoneCuts(coords, seed);
      const custom = zonesOf(coords, seed, serializeZoneCuts(cuts));
      assert.equal(custom.length, auto.length, `${name}/${seed}: mismo número de zonas`);
      for (let i = 0; i < auto.length; i++) {
        assert.equal(custom[i].id, auto[i].id);
        // Tolerancia 0.1 %: al guardar, las coordenadas se redondean a ~1 cm.
        assert.ok(Math.abs(custom[i].areaM2 - auto[i].areaM2) / auto[i].areaM2 < 0.001, `${name}/${seed} zona ${auto[i].id}: ${custom[i].areaM2} vs ${auto[i].areaM2}`);
      }
    }
  }
});

test('sin líneas guardadas (lista vacía) la huerta completa es una sola zona A', () => {
  const zs = zonesOf(rect, 's', { version: 1, cortes: [] });
  assert.equal(zs.length, 1);
  assert.equal(zs[0].id, 'A');
  assert.ok(Math.abs(zs[0].share - 100) < 0.01);
});

test('una línea vertical parte el rectángulo en dos mitades', () => {
  const zs = zonesOf(rect, 's', serializeZoneCuts([cut(100, -20, 100, 140)]));
  assert.equal(zs.length, 2);
  for (const z of zs) assert.ok(Math.abs(z.share - 50) < 0.5, `share ${z.share}`);
});

test('la línea puede empezar y terminar fuera de la huerta (trazo con el dedo)', () => {
  const zs = zonesOf(rect, 's', serializeZoneCuts([cut(-500, 60, 700, 60)]));
  assert.equal(zs.length, 2);
});

test('una línea corta dentro de una zona la divide de lado a lado', () => {
  // Trazo de 20 m en medio del rectángulo: igual divide toda la huerta.
  const zs = zonesOf(rect, 's', serializeZoneCuts([cut(100, 50, 100, 70)]));
  assert.equal(zs.length, 2);
});

test('la segunda línea solo divide la zona por la que pasa', () => {
  // Corte vertical en x=100 y luego horizontal solo en la mitad izquierda.
  const zs = zonesOf(rect, 's', serializeZoneCuts([cut(100, -10, 100, 130), cut(10, 60, 90, 60)]));
  assert.equal(zs.length, 3);
  const big = zs.filter(z => Math.abs(z.share - 50) < 0.5);
  const small = zs.filter(z => Math.abs(z.share - 25) < 0.5);
  assert.equal(big.length, 1, 'la mitad derecha queda entera');
  assert.equal(small.length, 2, 'la mitad izquierda queda en dos');
});

test('una línea que cruza dos zonas divide ambas', () => {
  const zs = zonesOf(rect, 's', serializeZoneCuts([cut(100, -10, 100, 130), cut(-10, 60, 210, 60)]));
  assert.equal(zs.length, 4);
  for (const z of zs) assert.ok(Math.abs(z.share - 25) < 0.5);
});

test('nunca hay más de 4 zonas y siempre suman el 100 %', () => {
  const many = [cut(50, -10, 50, 130), cut(100, -10, 100, 130), cut(150, -10, 150, 130), cut(-10, 60, 210, 60), cut(-10, 30, 210, 30)];
  const zs = zonesOf(rect, 's', serializeZoneCuts(many));
  assert.ok(zs.length <= MAX_ZONES);
  assert.equal(zs.length, 4);
  assert.ok(Math.abs(shares(zs) - 100) < 0.01, `suma ${shares(zs)}`);
  assert.deepEqual(zs.map(z => z.id), ['A', 'B', 'C', 'D']);
});

test('checkNewCut: acepta una línea que divide', () => {
  const r = checkNewCut(rect, [], cut(100, -10, 100, 130));
  assert.equal(r.ok, true);
});

test('checkNewCut: rechaza una línea fuera de la huerta', () => {
  assert.deepEqual(checkNewCut(rect, [], cut(300, -10, 300, 130)), { ok: false, reason: 'no-split' });
});

test('checkNewCut: rechaza una tira diminuta junto al lindero (< 2 %)', () => {
  assert.deepEqual(checkNewCut(rect, [], cut(1, -10, 1, 130)), { ok: false, reason: 'no-split' });
});

test('checkNewCut: con 4 zonas ya no se puede agregar otra', () => {
  const four = [cut(100, -10, 100, 130), cut(-10, 60, 210, 60)];
  assert.deepEqual(checkNewCut(rect, four, cut(50, -10, 50, 130)), { ok: false, reason: 'max-zones' });
});

test('checkNewCut: con 3 zonas, una línea que cruza 2 zonas se rechaza (serían 5)', () => {
  const three = [cut(100, -10, 100, 130), cut(10, 60, 90, 60)];
  // Horizontal a todo lo ancho: cruzaría la mitad derecha y una zona de la izquierda.
  assert.deepEqual(checkNewCut(rect, three, cut(-10, 30, 210, 30)), { ok: false, reason: 'max-zones' });
});

test('checkNewCut: con 3 zonas, una línea que cruza solo 1 zona sí entra', () => {
  const three = [cut(100, -10, 100, 130), cut(10, 60, 90, 60)];
  const r = checkNewCut(rect, three, cut(150, -10, 150, 130));
  assert.equal(r.ok, true);
  const zs = zonesOf(rect, 's', serializeZoneCuts([...three, cut(150, -10, 150, 130)]));
  assert.equal(zs.length, 4);
});

test('huerta cóncava (L): las zonas suman el 100 % y no salen del contorno', () => {
  const zs = zonesOf(ell, 's', serializeZoneCuts([cut(-10, 40, 170, 40), cut(35, 30, 35, 160)]));
  assert.ok(zs.length >= 2 && zs.length <= 4);
  assert.ok(Math.abs(shares(zs) - 100) < 0.01, `suma ${shares(zs)}`);
});

test('polígono irregular: tres líneas → 4 zonas que suman 100 %', () => {
  const zs = zonesOf(blob, 's', serializeZoneCuts([cut(90, -40, 90, 180), cut(-20, 70, 85, 70), cut(95, 75, 200, 75)]));
  assert.equal(zs.length, 4);
  assert.ok(Math.abs(shares(zs) - 100) < 0.01);
});

test('datos dañados en la base → zonas automáticas', () => {
  for (const bad of [null, undefined, 'xx', '{"cortes":5}', 42, [], { cortes: 'no' }]) {
    assert.equal(parseZoneCuts(bad), null);
    assert.equal(zonesOf(rect, 'seed', bad).length, zonesOf(rect, 'seed').length);
  }
  // Puntos inválidos se ignoran.
  assert.deepEqual(parseZoneCuts({ cortes: [{ a: { lat: 'x' }, b: {} }] }), []);
  // También se acepta el valor guardado como texto JSON.
  assert.equal(parseZoneCuts(JSON.stringify(serializeZoneCuts([cut(100, -10, 100, 130)])))!.length, 1);
});

test('líneas que ya no dividen nada (contorno redibujado) → la huerta queda como una zona', () => {
  const zs = zonesOf(rect, 's', serializeZoneCuts([cut(500, -10, 500, 130)]));
  assert.equal(zs.length, 1);
});

test('serializeZoneCuts guarda 7 decimales (~1 cm) y el formato versión 1', () => {
  const v = serializeZoneCuts([{ a: { lat: 19.123456789, lng: -102.987654321 }, b: { lat: 19.1, lng: -102.9 } }]);
  assert.equal(v.version, 1);
  assert.equal(v.cortes[0].a.lat, 19.1234568);
  assert.equal(v.cortes[0].a.lng, -102.9876543);
});

test('el trazo se ajusta al tramo real del corte y divide exactamente igual', () => {
  const cases: [typeof rect, ReturnType<typeof cut>[], ReturnType<typeof cut>][] = [
    [rect, [], cut(100, 50, 100, 70)],                       // trazo corto en medio
    [rect, [], cut(-500, 60, 700, 60)],                      // trazo que sale de la huerta
    [rect, [cut(100, -10, 100, 130)], cut(10, 60, 90, 60)],  // solo la mitad izquierda
    [blob, [], cut(60, 20, 120, 120)],                       // diagonal en polígono irregular
    [ell, [], cut(35, 30, 35, 160)],                         // huerta cóncava
  ];
  for (const [coords, prev, raw] of cases) {
    const r = checkNewCut(coords, prev, raw);
    assert.ok(r.ok);
    const fitted = (r as { cut: ReturnType<typeof cut> }).cut;
    const zRaw = zonesOf(coords, 's', serializeZoneCuts([...prev, raw]));
    const zFit = zonesOf(coords, 's', serializeZoneCuts([...prev, fitted]));
    assert.equal(zFit.length, zRaw.length);
    for (let i = 0; i < zRaw.length; i++) assert.ok(Math.abs(zFit[i].share - zRaw[i].share) < 0.2, `${zFit[i].share} vs ${zRaw[i].share}`);
  }
  // El trazo que salía de la huerta queda dentro de ella (no más largo que el ancho de 200 m).
  const r = checkNewCut(rect, [], cut(-500, 60, 700, 60)) as { ok: true; cut: ReturnType<typeof cut> };
  const lenM = Math.abs(r.cut.b.lng - r.cut.a.lng) / M_LNG;
  assert.ok(lenM > 150 && lenM <= 200.5, `largo ${lenM}`);
  // Igual en el polígono irregular con una línea vertical larga (caso encontrado en la prueba de interfaz).
  const rb = checkNewCut(blob, [], cut(90, -60, 90, 200)) as { ok: true; cut: ReturnType<typeof cut> };
  const ys = [rb.cut.a.lat, rb.cut.b.lat].map(v => (v - LAT0) / M_LAT);
  assert.ok(Math.min(...ys) > -15 && Math.max(...ys) < 165, `extremos ${ys}`);
  // Una línea en sentido contrario (de abajo hacia arriba) también se ajusta.
  const rc = checkNewCut(rect, [], cut(100, 200, 100, -80)) as { ok: true; cut: ReturnType<typeof cut> };
  const yc = [rc.cut.a.lat, rc.cut.b.lat].map(v => (v - LAT0) / M_LAT);
  assert.ok(Math.min(...yc) >= -0.5 && Math.max(...yc) <= 120.5, `extremos ${yc}`);
});

console.log(`\n${n} pruebas correctas`);
