/**
 * Filtro de la traza GPS de un recorrido: que estar quieto no sume metros ni dispare fotos.
 *
 * El GPS de un celular «baila» varios metros aunque no te muevas (±5–15 m es normal). Antes, cada
 * lectura que se movía 1 m sumaba distancia: sentado 5 minutos podía marcar 75 m.
 *
 * Cómo se decide que hubo movimiento real:
 * 1. Suavizado: filtro de Kalman por eje (posición constante con ruido de proceso de caminata);
 *    cada lectura pesa según su precisión (`accuracy`). Lecturas peores que MAX_ACCURACY_M no entran.
 * 2. Puerta de movimiento: un punto nuevo solo se acepta si el estimado suavizado se alejó del último
 *    punto aceptado más que el error del estimado (2σ, mínimo MIN_STEP_M).
 * 3. Velocidad: si el teléfono informa velocidad Doppler casi cero (< STILL_SPEED), se considera quieto
 *    salvo un desplazamiento claramente grande. Saltos imposibles caminando (> MAX_SPEED) se descartan.
 *
 * La distancia es la suma de los pasos aceptados; la ruta guarda solo esos puntos.
 */
export type RawFix = { lat: number; lng: number; acc: number | null; speed?: number | null; t: number };
export type TrackPoint = { lat: number; lng: number; t: number };

export const MAX_ACCURACY_M = 25;
const MIN_STEP_M = 3;
const WALK_Q = 2.6;            // m/s de incertidumbre de proceso (caminata; ajustado con simulación)
const STILL_SPEED = 0.35;      // m/s: por debajo, el teléfono dice que no te mueves
const MAX_SPEED = 4.5;         // m/s: más rápido que esto no es caminar por la huerta
const STILL_JUMP_M = 25;       // m: con velocidad ~0, solo un salto así cuenta como movimiento
const MOVING_WINDOW_MS = 8000; // «en movimiento» si se aceptó un paso hace menos de esto
const M_PER_DEG = 111320;

export class GpsTrack {
  /** minStep: paso mínimo en metros (más alto para rutas guardadas, que no traen velocidad). */
  constructor(private readonly minStep = MIN_STEP_M) {}
  private lat0 = 0; private lng0 = 0; private k = 1;
  private x = 0; private y = 0; private P = 0; private lastT = 0; private ready = false;
  private anchor: { x: number; y: number; t: number } | null = null;
  private lastAcceptAt = 0;
  private spikes = 0;
  /** Últimas velocidades Doppler (una sola lectura alta no basta para «en movimiento»). */
  private speeds: number[] = [];
  distance = 0;

  private toXY(lat: number, lng: number) { return { x: (lng - this.lng0) * this.k * M_PER_DEG, y: (lat - this.lat0) * M_PER_DEG }; }
  private toLL(x: number, y: number) { return { lat: this.lat0 + y / M_PER_DEG, lng: this.lng0 + x / (this.k * M_PER_DEG) }; }

  /** ¿Hubo un paso real hace poco? (para decidir si se toman fotos por distancia) */
  isMoving(now: number) { return now - this.lastAcceptAt < MOVING_WINDOW_MS; }

  /** Posición suavizada actual (o null si aún no hay lecturas válidas). */
  position() { return this.ready ? this.toLL(this.x, this.y) : null; }

  /**
   * Procesa una lectura. Devuelve el punto aceptado (para la ruta) y los metros sumados,
   * o `accepted: false` si se considera ruido.
   */
  push(f: RawFix): { accepted: boolean; point: TrackPoint | null; step: number } {
    if (!Number.isFinite(f.lat) || !Number.isFinite(f.lng)) return { accepted: false, point: null, step: 0 };
    const acc = typeof f.acc === 'number' && f.acc > 0 ? f.acc : 10;
    if (acc > MAX_ACCURACY_M) return { accepted: false, point: null, step: 0 };
    if (!this.ready) {
      this.lat0 = f.lat; this.lng0 = f.lng; this.k = Math.cos((f.lat * Math.PI) / 180);
      this.x = 0; this.y = 0; this.P = acc * acc; this.lastT = f.t; this.ready = true;
      this.anchor = { x: 0, y: 0, t: f.t }; this.lastAcceptAt = 0;
      return { accepted: true, point: { lat: f.lat, lng: f.lng, t: f.t }, step: 0 };
    }
    // 1. Kalman (mismo P en ambos ejes)
    const dt = Math.max(0.2, Math.min(30, (f.t - this.lastT) / 1000));
    this.lastT = f.t;
    this.P += (WALK_Q * dt) ** 2;
    const R = Math.max(3, acc) ** 2;
    const K = this.P / (this.P + R);
    const z = this.toXY(f.lat, f.lng);
    this.x += K * (z.x - this.x);
    this.y += K * (z.y - this.y);
    this.P = (1 - K) * this.P;

    // 2. Puerta de movimiento respecto al último punto aceptado
    const a = this.anchor!;
    const d = Math.hypot(this.x - a.x, this.y - a.y);
    let gate = Math.max(this.minStep, 1.5 * Math.sqrt(this.P));
    // 3. Velocidad Doppler casi cero → quieto: solo cuenta un desplazamiento claramente grande
    //    (p. ej. el GPS se recuperó tras perder señal mientras caminabas).
    if (typeof f.speed === 'number' && f.speed >= 0) { this.speeds.push(f.speed); if (this.speeds.length > 3) this.speeds.shift(); }
    // Quieto si al menos 2 de las 3 últimas velocidades están casi en cero.
    const still = this.speeds.length >= 2 && this.speeds.filter(v => v < STILL_SPEED).length >= Math.min(2, this.speeds.length);
    if (still) gate = Math.max(STILL_JUMP_M, gate * 4);
    if (d < gate) return { accepted: false, point: null, step: 0 };
    const secs = Math.max(0.5, (f.t - a.t) / 1000);
    if (d / secs > MAX_SPEED && this.spikes < 3) { this.spikes += 1; return { accepted: false, point: null, step: 0 }; }
    this.spikes = 0;
    this.anchor = { x: this.x, y: this.y, t: f.t };
    this.lastAcceptAt = f.t;
    this.distance += d;
    const ll = this.toLL(this.x, this.y);
    return { accepted: true, point: { lat: ll.lat, lng: ll.lng, t: f.t }, step: d };
  }
}

/**
 * Para rutas YA guardadas (sin precisión ni velocidad por punto): pasa los puntos por el mismo filtro
 * suponiendo ±10 m. Se usa para mostrar distancias sin el «baile» del GPS de recorridos anteriores.
 */
export function filterRoute<T extends { lat: number; lng: number; t?: string | number | null }>(points: T[]): { points: { lat: number; lng: number; t?: number }[]; meters: number } {
  // Sin velocidad ni precisión por punto: paso mínimo mayor para no sumar el «baile» de estar quieto.
  const track = new GpsTrack(6);
  const out: { lat: number; lng: number; t?: number }[] = [];
  let tFallback = 0;
  for (const p of points) {
    const t = typeof p.t === 'number' ? p.t : p.t ? Date.parse(p.t) : NaN;
    tFallback = Number.isFinite(t) ? t : tFallback + 1000;
    const r = track.push({ lat: p.lat, lng: p.lng, acc: 10, t: tFallback });
    if (r.accepted && r.point) out.push(Number.isFinite(t) ? { lat: r.point.lat, lng: r.point.lng, t: r.point.t } : { lat: r.point.lat, lng: r.point.lng });
  }
  return { points: out, meters: track.distance };
}
