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
 *    La velocidad solo se cree después de que el teléfono demostró que la mide (Android manda 0 en las
 *    lecturas sin velocidad: tomarlo como «quieto» dejaba la distancia en 0 m aunque caminaras).
 * 4. Sin velocidad utilizable: la puerta escala con la precisión, el desplazamiento debe sostenerse 2
 *    lecturas y un paso que deshace el anterior no suma (el GPS yendo y viniendo).
 *
 * Simulaciones: scripts/gps-distance.test.ts.
 *
 * La distancia es la suma de los pasos aceptados; la ruta guarda solo esos puntos.
 */
export type RawFix = { lat: number; lng: number; acc: number | null; speed?: number | null; t: number };
export type TrackPoint = { lat: number; lng: number; t: number };

/** Lecturas peores que esto no entran. Las imprecisas que sí entran pesan poco (Kalman por precisión). */
export const MAX_ACCURACY_M = 50;
const MIN_STEP_M = 3;
const WALK_Q = 2.6;            // m/s de incertidumbre de proceso (caminata; ajustado con simulación)
const STILL_SPEED = 0.35;      // m/s: por debajo, el teléfono dice que no te mueves
const MAX_SPEED = 4.5;         // m/s: más rápido que esto no es caminar por la huerta
const STILL_GATE_M = 25;       // m: con velocidad ~0 confiable (demostrada), solo un salto así cuenta como movimiento
/**
 * La velocidad del teléfono solo se usa después de que demostró en este recorrido que mide movimiento
 * (SPEED_PROOF_COUNT lecturas > SPEED_PROOF m/s). En Android, expo-location devuelve speed = 0 cuando la
 * lectura no trae velocidad (getSpeed() sin hasSpeed()): ese 0 no significa «quieto», y tomarlo así dejaba
 * la distancia en 0 m aunque caminaras. Sin velocidad demostrada se mide solo por posición.
 */
const SPEED_PROOF = 0.5;
const SPEED_PROOF_COUNT = 2;
/** Sin velocidad utilizable, la puerta es algo más exigente (el «baile» no tiene quién lo desmienta). */
const NO_SPEED_MIN_STEP_M = 4;
const NO_SPEED_SIGMAS = 2;
/** La deriva del GPS es correlacionada (se desplaza segundos en una dirección): sin velocidad, la puerta
 *  también escala con la precisión que reporta el teléfono. */
const NO_SPEED_ACC_FACTOR = 1.25;
const REVERSAL_WINDOW_MS = 30000;
const MOVING_WINDOW_MS = 8000; // «en movimiento» si se aceptó un paso hace menos de esto
const M_PER_DEG = 111320;

export class GpsTrack {
  /**
   * minStep: paso mínimo en metros (más alto para rutas guardadas, que no traen velocidad).
   * live: medición en vivo. false = reglas originales para re-filtrar rutas guardadas (filterRoute), así las
   * distancias del historial no cambian.
   */
  constructor(private readonly minStep = MIN_STEP_M, private readonly live = true) {}
  private lat0 = 0; private lng0 = 0; private k = 1;
  private x = 0; private y = 0; private P = 0; private lastT = 0; private ready = false;
  private anchor: { x: number; y: number; t: number } | null = null;
  private lastAcceptAt = 0;
  private spikes = 0;
  /** Últimas velocidades Doppler (una sola lectura alta no basta para «en movimiento»). */
  private speeds: number[] = [];
  private speedProofs = 0;
  /** Lecturas seguidas por encima de la puerta (sin velocidad, el desplazamiento debe persistir). */
  private over = 0;
  private lastVec: { x: number; y: number; t: number } | null = null;
  /** Última coordenada cruda y cuántas veces seguidas se repitió idéntica (ubicación congelada). */
  private lastRaw: { lat: number; lng: number } | null = null;
  private sameCount = 0;
  /** El teléfono repite exactamente la misma coordenada: aún no hay lecturas frescas (p. ej. al arrancar). */
  get frozen() { return this.sameCount >= 3; }
  /** Precisión típica reciente (m), suavizada. */
  private accEma = 10;
  /** Velocidad confiable de la última lectura (m/s), o null si el teléfono no da una utilizable. */
  lastSpeed: number | null = null;
  distance = 0;
  /** Diagnóstico (solo lectura, para la pantalla de diagnóstico GPS del recorrido). */
  readonly debug = {
    fixes: 0, accepted: 0, rejectedAccuracy: 0, rejectedGate: 0, rejectedSpike: 0, rejectedReversal: 0,
    lastAcc: null as number | null, lastRawSpeed: null as number | null, speedTrusted: false,
    lastGate: 0, lastDist: 0, still: false,
    /** Decisión de la última lectura. */
    lastReason: '' as '' | 'inicio' | 'aceptada' | 'repetida' | 'precisión' | 'puerta' | 'persistencia' | 'salto' | 'ida-vuelta',
  };

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
    this.debug.fixes += 1;
    const acc = typeof f.acc === 'number' && f.acc > 0 ? f.acc : 10;
    const raw = typeof f.speed === 'number' && Number.isFinite(f.speed) && f.speed >= 0 ? f.speed : null;
    if (raw != null && raw > SPEED_PROOF && this.speedProofs < SPEED_PROOF_COUNT) this.speedProofs += 1;
    const speed = raw != null && this.speedProofs >= SPEED_PROOF_COUNT ? raw : null;
    this.lastSpeed = speed;
    this.debug.lastAcc = acc; this.debug.lastRawSpeed = raw; this.debug.speedTrusted = speed != null;
    if (acc > MAX_ACCURACY_M) { this.debug.rejectedAccuracy += 1; this.debug.lastReason = 'precisión'; return { accepted: false, point: null, step: 0 }; }
    // Lectura idéntica a la anterior: el teléfono repite la última posición conocida (sin fix nuevo).
    // No es información nueva: no entra al Kalman, así la siguiente lectura real se sigue de inmediato.
    const same = this.lastRaw != null && this.lastRaw.lat === f.lat && this.lastRaw.lng === f.lng;
    this.lastRaw = { lat: f.lat, lng: f.lng };
    this.sameCount = same ? this.sameCount + 1 : 0;
    if (same && this.ready && this.live) { this.debug.lastReason = 'repetida'; return { accepted: false, point: null, step: 0 }; }
    // Se recupera rápido cuando la precisión vuelve a ser buena (α 0.5: ~3 s en volver de ±9 m a ±3 m).
    this.accEma = this.ready ? this.accEma + 0.5 * (acc - this.accEma) : acc;
    if (!this.ready) {
      this.lat0 = f.lat; this.lng0 = f.lng; this.k = Math.cos((f.lat * Math.PI) / 180);
      this.x = 0; this.y = 0; this.P = acc * acc; this.lastT = f.t; this.ready = true;
      this.anchor = { x: 0, y: 0, t: f.t }; this.lastAcceptAt = 0;
      this.debug.lastReason = 'inicio';
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
    let gate = speed == null && this.live
      ? Math.max(this.minStep, NO_SPEED_MIN_STEP_M, NO_SPEED_SIGMAS * Math.sqrt(this.P), NO_SPEED_ACC_FACTOR * this.accEma)
      : Math.max(this.minStep, 1.5 * Math.sqrt(this.P));
    // 3. Velocidad Doppler casi cero → quieto: solo cuenta un desplazamiento claramente grande
    //    (p. ej. el GPS se recuperó tras perder señal mientras caminabas).
    if (speed != null) { this.speeds.push(speed); if (this.speeds.length > 3) this.speeds.shift(); }
    else this.speeds = [];
    // Quieto si 2 de las 3 últimas velocidades están casi en cero y ninguna muestra movimiento claro.
    // (En Android las lecturas sin velocidad llegan como 0 entre lecturas reales: sin la segunda condición,
    // caminando se leía «quieto».)
    const still = this.speeds.length >= 2
      && this.speeds.filter(v => v < STILL_SPEED).length >= 2
      && this.speeds.every(v => v <= SPEED_PROOF);
    if (still) gate = Math.max(STILL_GATE_M, gate * 4);
    this.debug.lastGate = gate; this.debug.lastDist = d; this.debug.still = still;
    if (d < gate) { this.over = 0; this.debug.rejectedGate += 1; this.debug.lastReason = 'puerta'; return { accepted: false, point: null, step: 0 }; }
    // Sin velocidad que lo confirme, el desplazamiento debe sostenerse 2 lecturas: caminar lo cumple con
    // 1 s de retraso; el «baile» del GPS que cruza la puerta y regresa, no.
    this.over += 1;
    if (speed == null && this.live && this.over < 2) { this.debug.rejectedGate += 1; this.debug.lastReason = 'persistencia'; return { accepted: false, point: null, step: 0 }; }
    const secs = Math.max(0.5, (f.t - a.t) / 1000);
    if (d / secs > MAX_SPEED && this.spikes < 3) { this.spikes += 1; this.debug.rejectedSpike += 1; this.debug.lastReason = 'salto'; return { accepted: false, point: null, step: 0 }; }
    this.spikes = 0;
    this.over = 0;
    const vx = this.x - a.x, vy = this.y - a.y;
    const prev = this.lastVec;
    this.lastVec = { x: vx, y: vy, t: f.t };
    this.anchor = { x: this.x, y: this.y, t: f.t };
    const ll = this.toLL(this.x, this.y);
    // 4. Sin velocidad: un paso que deshace el anterior (> 120°) poco después es el GPS yendo y viniendo,
    //    no una caminata. Se mueve el ancla pero no se suman metros (al caminar solo pasa en vueltas de hilera).
    if (speed == null && this.live && prev && f.t - prev.t < REVERSAL_WINDOW_MS) {
      const cos = (vx * prev.x + vy * prev.y) / (Math.hypot(vx, vy) * Math.hypot(prev.x, prev.y) || 1);
      if (cos < -0.5) { this.debug.rejectedReversal += 1; this.debug.lastReason = 'ida-vuelta'; return { accepted: false, point: null, step: 0 }; }
    }
    this.lastAcceptAt = f.t;
    this.distance += d;
    this.debug.accepted += 1;
    this.debug.lastReason = 'aceptada';
    return { accepted: true, point: { lat: ll.lat, lng: ll.lng, t: f.t }, step: d };
  }
}

/**
 * Para rutas YA guardadas (sin precisión ni velocidad por punto): pasa los puntos por el mismo filtro
 * suponiendo ±10 m. Se usa para mostrar distancias sin el «baile» del GPS de recorridos anteriores.
 */
export function filterRoute<T extends { lat: number; lng: number; t?: string | number | null }>(points: T[]): { points: { lat: number; lng: number; t?: number }[]; meters: number } {
  // Sin velocidad ni precisión por punto: paso mínimo mayor para no sumar el «baile» de estar quieto.
  const track = new GpsTrack(6, false);
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
