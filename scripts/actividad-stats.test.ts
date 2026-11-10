/**
 * Pruebas de las estadísticas de Actividad → Resumen (services/actividadStats.ts).
 *
 *   node --experimental-transform-types scripts/actividad-stats.test.ts
 */
import assert from 'node:assert/strict';
// @ts-ignore — Node exige la extensión .ts
import { attention, classRows, cropRows, matchOrchard, orchardShare, timeline, type Rec } from '../services/actividadStats.ts';

const norm = (s: string) => s.toLowerCase().trim();
const day = 86400000;
const now = new Date(2026, 10, 10, 12).getTime();
const r = (o: Partial<Rec>): Rec => ({ source: 'foto', crop: 'Aguacate', cat: 'sano', conf: 0.9, date: now, huertaId: null, label: 'saludable', ...o });

// Distribución por huerta: suma 100 %, «Otras» y «Sin huerta» separados, sin duplicar.
{
  const recs = [
    ...Array.from({ length: 5 }, () => r({ huertaId: 'a' })),
    ...Array.from({ length: 3 }, () => r({ huertaId: 'b' })),
    r({ huertaId: 'c' }), r({ huertaId: 'd' }),
    r({ huertaId: null }), r({ huertaId: null }),
  ];
  const s = orchardShare(recs, { a: 'A', b: 'B', c: 'C', d: 'D' }, { none: 'Sin huerta', other: 'Otras' }, 2);
  assert.deepEqual(s.map(x => [x.name, x.count]), [['A', 5], ['B', 3], ['Otras', 2], ['Sin huerta', 2]]);
  assert.ok(Math.abs(s.reduce((a, x) => a + x.pct, 0) - 100) < 1e-9);
  assert.deepEqual(orchardShare([], {}, { none: '', other: '' }), []);
}

// Filtro de huerta: «none» = solo sin huerta.
assert.equal(matchOrchard({ huertaId: null }, 'none'), true);
assert.equal(matchOrchard({ huertaId: 'a' }, 'none'), false);
assert.equal(matchOrchard({ huertaId: 'a' }, 'a'), true);

// Frutas: orden por cantidad, estados por cultivo.
{
  const rows = cropRows([r({}), r({ cat: 'enfermo' }), r({ crop: 'Limón' }), r({ crop: 'Aguacate', cat: 'revisar' })]);
  assert.deepEqual(rows.map(x => [x.crop, x.count, x.sano, x.revisar, x.enfermo]), [['Aguacate', 3, 1, 1, 1], ['Limón', 1, 1, 0, 0]]);
  assert.equal(rows[0].pct, 75);
}

// Clases por cultivo: confianza baja aparte (no se atribuye a una enfermedad), saludable al final.
{
  const recs = [r({ cat: 'enfermo', label: 'Antracnosis' }), r({ cat: 'enfermo', label: 'antracnosis ' }), r({ cat: 'enfermo', label: 'Costra' }),
    r({ cat: 'revisar', label: 'Costra', conf: 0.4 }), r({}), r({ crop: 'Limón', cat: 'enfermo', label: 'Costra' })];
  const c = classRows(recs, 'Aguacate', norm);
  assert.deepEqual(c.map(x => [x.key, x.count]), [['antracnosis', 2], ['costra', 1], ['__low', 1], ['__healthy', 1]]);
}

// Serie: cubos vacíos con 0, cada análisis en un solo cubo, total conservado.
{
  const recs = [r({ date: now }), r({ date: now - 1 * day }), r({ date: now - 1 * day }), r({ date: now - 40 * day })];
  const t7 = timeline(recs, 7, () => '', now);
  assert.equal(t7.g, 'day');
  assert.ok(t7.buckets.length >= 7 && t7.buckets.length <= 8);
  assert.equal(t7.buckets.reduce((a, b) => a + b.count, 0), 3);
  assert.ok(t7.buckets.some(b => b.count === 0));
  const t90 = timeline(recs, 90, () => '', now);
  assert.equal(t90.g, 'week');
  assert.equal(t90.buckets.reduce((a, b) => a + b.count, 0), 4);
  const tall = timeline(recs, 'all', () => '', now);
  assert.equal(tall.g, 'month');
  assert.equal(tall.buckets.reduce((a, b) => a + b.count, 0), 4);
  assert.deepEqual(timeline([], 'all', () => '', now).buckets, []);
}

// Atención: solo 'enfermo'; los dos diagnósticos más frecuentes y el cultivo con más.
{
  const a = attention([r({ cat: 'enfermo', label: 'Antracnosis' }), r({ cat: 'enfermo', label: 'Antracnosis' }), r({ cat: 'enfermo', label: 'Costra', crop: 'Limón' }),
    r({ cat: 'revisar' }), r({})], norm);
  assert.equal(a.total, 3);
  assert.equal(a.pct, 60);
  assert.deepEqual(a.top.map(x => [x.label, x.count]), [['Antracnosis', 2], ['Costra', 1]]);
  assert.deepEqual(a.topCrop, { crop: 'Aguacate', count: 2 });
  assert.equal(a.lowConfidence, 1);
}

console.log('actividad-stats: OK');
