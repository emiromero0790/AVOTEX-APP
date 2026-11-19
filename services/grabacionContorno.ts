/**
 * Contorno de la huerta para mostrar una grabación como se veía al subirla.
 * (Sin dependencias de React Native: se prueba en Node con scripts/grabacion-contorno.test.ts.)
 */
import type { LatLng } from './satZones';
import type { ZonaSnapshot } from './grabacion';

/**
 * Contorno de la huerta TAL COMO ERA al subir la grabación, reconstruido de su copia de zonas.
 *
 * Las zonas cubren la huerta completa sin encimarse, así que su borde exterior es el contorno de ese
 * momento: se juntan las aristas de todas las zonas, se quitan las que comparten dos zonas (los
 * cortes interiores) y lo que queda se encadena en un solo anillo. null si no se puede reconstruir.
 */
export function contornoDeZonas(zonas: ZonaSnapshot[]): LatLng[] | null {
  // Tolerancia: la copia se guarda redondeada a 1e-6° (≈ 11 cm como máximo por eje). En huertas muy
  // irregulares, dos cortes casi juntos pueden necesitar un poco más; cada intento se valida por área.
  for (const tol of [0.15, 0.3, 0.6]) {
    const r = contornoConTolerancia(zonas, tol);
    if (r) return r;
  }
  return null;
}

function contornoConTolerancia(zonas: ZonaSnapshot[], TOL: number): LatLng[] | null {
  const rings = zonas.map(z => z.ring).filter(r => r.length >= 3);
  if (!rings.length) return null;
  const all = rings.flat();
  const lat0 = all.reduce((s, p) => s + p.lat, 0) / all.length;
  const lng0 = all.reduce((s, p) => s + p.lng, 0) / all.length;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540;
  type Q = { x: number; y: number };
  const to = (p: LatLng): Q => ({ x: (p.lng - lng0) * kx, y: (p.lat - lat0) * ky });
  const from = (q: Q): LatLng => ({ lat: lat0 + q.y / ky, lng: lng0 + q.x / kx });

  // 1. Todas las aristas de todas las zonas.
  type Seg = { a: Q; b: Q };
  const segs: Seg[] = [];
  for (const r of rings) {
    const q = r.map(to);
    for (let i = 0; i < q.length; i++) {
      const a = q[i], b = q[(i + 1) % q.length];
      if (Math.hypot(b.x - a.x, b.y - a.y) > 1e-6) segs.push({ a, b });
    }
  }

  // 2. Tramos de cada arista que NO cubre ninguna otra arista sobre la misma recta. Una arista compartida
  //    por dos zonas (corte interior) queda cubierta por la de la vecina; los «puentes» de ancho cero que
  //    deja el recorte de huertas cóncavas se cubren a sí mismos. Lo que queda descubierto es el borde.
  const pieces: Seg[] = [];
  segs.forEach((e, ei) => {
    const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const off = (p: Q) => (p.x - e.a.x) * uy - (p.y - e.a.y) * ux; // distancia (con signo) a la recta de e
    const along = (p: Q) => (p.x - e.a.x) * ux + (p.y - e.a.y) * uy;
    const cover: [number, number][] = [];
    segs.forEach((f, fi) => {
      if (fi === ei) return;
      const fx = f.b.x - f.a.x, fy = f.b.y - f.a.y, fl = Math.hypot(fx, fy);
      // Casi paralela (< ~1°): el redondeo de la copia separa unos centímetros las aristas compartidas.
      if (Math.abs(fx * uy - fy * ux) / fl > 0.02) return;
      // Solo cuenta la parte de f que está pegada a la recta de e (a menos de TOL).
      const o1 = off(f.a), o2 = off(f.b);
      let u0 = 0, u1 = 1;
      if (Math.abs(o2 - o1) < 1e-9) { if (Math.abs(o1) > TOL) return; }
      else {
        const ua = (-TOL - o1) / (o2 - o1), ub = (TOL - o1) / (o2 - o1);
        u0 = Math.max(0, Math.min(ua, ub)); u1 = Math.min(1, Math.max(ua, ub));
        if (u1 <= u0) return;
      }
      const s1 = along({ x: f.a.x + fx * u0, y: f.a.y + fy * u0 }), s2 = along({ x: f.a.x + fx * u1, y: f.a.y + fy * u1 });
      const lo = Math.max(0, Math.min(s1, s2)), hi = Math.min(L, Math.max(s1, s2));
      if (hi - lo > TOL) cover.push([lo, hi]);
    });
    cover.sort((u, v) => u[0] - v[0]);
    let pos = 0;
    const emit = (lo: number, hi: number) => {
      if (hi - lo > TOL) pieces.push({ a: { x: e.a.x + ux * lo, y: e.a.y + uy * lo }, b: { x: e.a.x + ux * hi, y: e.a.y + uy * hi } });
    };
    for (const [lo, hi] of cover) {
      if (lo > pos) emit(pos, lo);
      pos = Math.max(pos, hi);
    }
    if (pos < L) emit(pos, L);
  });

  // 3. Se encadenan los tramos del borde (extremos a menos de TOL son el mismo punto).
  const verts: Q[] = [];
  const idOf = (q: Q): number => {
    for (let i = 0; i < verts.length; i++) if (Math.hypot(verts[i].x - q.x, verts[i].y - q.y) < TOL * 2) return i;
    verts.push(q);
    return verts.length - 1;
  };
  const count = new Map<string, number>();
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  for (const pc of pieces) {
    const a = idOf(pc.a), b = idOf(pc.b);
    if (a !== b) count.set(key(a, b), (count.get(key(a, b)) ?? 0) + 1);
  }

  // Anillo del borde. Normalmente cada vértice tiene dos tramos; en huertas muy irregulares el borde puede
  // tocarse a sí mismo en un punto (4 tramos): ahí se sigue el tramo que gira menos hacia el mismo lado,
  // así el recorrido no se cruza y pasa una sola vez por cada tramo.
  const adj = new Map<number, number[]>();
  const used = new Set<string>();
  let edges = 0;
  for (const [kk, n] of count) {
    if (n !== 1) continue;
    const [a, b] = kk.split('-').map(Number);
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
    edges++;
  }
  if (edges < 3) return null;
  for (const list of adj.values()) if (list.length % 2 !== 0) return null; // tramo suelto: no cierra

  const start = [...adj.entries()].find(([, l]) => l.length === 2)?.[0];
  if (start === undefined) return null;
  const ring: number[] = [start];
  let prev = start, cur = adj.get(start)![0];
  used.add(key(prev, cur));
  for (let guard = 0; guard < edges * 2 && cur !== start; guard++) {
    ring.push(cur);
    const options = adj.get(cur)!.filter(n => !used.has(key(cur, n)));
    if (!options.length) return null;
    let next = options[0];
    if (options.length > 1) {
      // Ángulo de giro (−π, π] respecto a la dirección de llegada; se toma el giro más a la izquierda.
      const inX = verts[cur].x - verts[prev].x, inY = verts[cur].y - verts[prev].y;
      let bestTurn = -Infinity;
      for (const o of options) {
        const ox = verts[o].x - verts[cur].x, oy = verts[o].y - verts[cur].y;
        const turn = Math.atan2(inX * oy - inY * ox, inX * ox + inY * oy);
        if (turn > bestTurn) { bestTurn = turn; next = o; }
      }
    }
    used.add(key(cur, next));
    prev = cur;
    cur = next;
  }
  if (cur !== start || used.size !== edges) return null; // había más de un anillo (zonas separadas)

  // Comprobación: el área del contorno debe ser la suma de las áreas de las zonas.
  const areaOf = (pts: Q[]) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
  const outline = ring.map(i => verts[i]);
  const zonesArea = rings.reduce((s, r) => s + areaOf(r.map(to)), 0);
  if (!zonesArea || Math.abs(areaOf(outline) - zonesArea) / zonesArea > 0.01) return null;

  // Se quitan los vértices intermedios en línea recta (puntos donde un corte tocaba el borde). Se compara
  // con el último vértice conservado, no con el vecino original: así dos puntos muy juntos en una esquina
  // real no se eliminan uno al otro.
  const devia = (p: Q, a: Q, b: Q) =>
    Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
  // Se empieza en el vértice más «esquina» (el que más se desvía de sus vecinos), que nunca se quita.
  let first = 0, best = -1;
  outline.forEach((p, i) => {
    const d = devia(p, outline[(i - 1 + outline.length) % outline.length], outline[(i + 1) % outline.length]);
    if (d > best) { best = d; first = i; }
  });
  const seq = [...outline.slice(first), ...outline.slice(0, first)];
  const pts: Q[] = [seq[0]];
  for (let i = 1; i < seq.length; i++) {
    const next = seq[(i + 1) % seq.length];
    if (devia(seq[i], pts[pts.length - 1], next) > TOL / 2) pts.push(seq[i]);
  }
  return (pts.length >= 3 ? pts : outline).map(from);
}

/**
 * Contorno que se dibuja con una grabación. Si trae su copia de zonas, el de ESE momento (aunque la
 * huerta se haya redibujado después); si no la trae (grabaciones antiguas), el contorno actual.
 * null = no dibujar contorno (las zonas ya muestran la forma).
 */
export function contornoGrabacion(zonasGuardadas: ZonaSnapshot[], contornoActual: LatLng[]): LatLng[] | null {
  if (zonasGuardadas.length) return contornoDeZonas(zonasGuardadas);
  return contornoActual.length >= 3 ? contornoActual : null;
}
