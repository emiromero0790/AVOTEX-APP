/**
 * Estado de movimiento para AVOTEX Field Tracking 3D (solo visualización).
 *
 * Recibe las MISMAS lecturas que ya procesa el recorrido (onPosition en recorrido.tsx → GpsTrack); no crea
 * observadores de ubicación propios. Decide tres cosas para la escena 3D:
 *
 *   1. ¿El agricultor camina?  Umbral con histéresis: para arrancar hacen falta 2 lecturas seguidas con
 *      velocidad Doppler ≥ START_SPEED (o un paso aceptado por GpsTrack); para detenerse, STOP_HOLD_MS con
 *      velocidad < STOP_SPEED. Así el «baile» del GPS estando quieto no hace caminar al personaje.
 *   2. ¿A qué velocidad?  Velocidad Doppler suavizada (o la de los pasos aceptados si el teléfono no la da),
 *      limitada a [MIN_WALK, MAX_WALK]: caminar rápido acelera el paso pero nunca se convierte en carrera.
 *   3. ¿Gira?  Curvatura a partir del rumbo GPS (o del rumbo entre pasos aceptados) solo cuando es fiable;
 *      si no, se relaja hacia 0 (orientación neutra). No se usa el magnetómetro.
 *
 * NO calcula distancia: la distancia mostrada sigue siendo la de GpsTrack (stats.distance).
 * Si las lecturas dejan de llegar, la velocidad cae a 0 (no se sigue avanzando indefinidamente).
 */

export type GpsQuality = 'good' | 'weak' | 'none';

export type MotionFix = {
  t: number;
  lat: number;
  lng: number;
  acc: number | null;
  /** Velocidad Doppler del teléfono (m/s); null o negativa si no la informa. */
  speed: number | null;
  /** Rumbo de desplazamiento (grados, 0 = norte); null o negativo si no es válido. */
  heading: number | null;
  /** Paso aceptado por GpsTrack en esta lectura y sus metros (0 si fue ruido). */
  accepted: boolean;
  step: number;
  /** GpsTrack.isMoving(t): hubo un paso real hace poco. */
  trackMoving: boolean;
};

export type FieldMotionState = {
  /** Velocidad objetivo para la animación (m/s). 0 = quieto. */
  speed: number;
  moving: boolean;
  /** Curvatura del camino (1/m, + = gira a la derecha). */
  curvature: number;
  gps: GpsQuality;
};

export const FIELD_MOTION = {
  START_SPEED: 0.5,
  STOP_SPEED: 0.3,
  START_FIXES: 2,
  STOP_HOLD_MS: 2500,
  /** Sin lecturas durante esto → se detiene la animación. */
  STALE_MS: 4000,
  /** Sin lecturas durante esto → «ubicación no disponible». */
  NONE_MS: 9000,
  /** Sin velocidad Doppler: un paso aceptado cuenta como movimiento durante esto. */
  STEP_VALID_MS: 6000,
  MIN_WALK: 0.45,
  MAX_WALK: 1.9,
  GOOD_ACC: 12,
  MAX_ACC: 25,
  HEADING_ACC: 15,
  HEADING_MIN_SPEED: 0.6,
  MAX_TURN_RATE: 0.5, // rad/s
  MAX_CURVATURE: 0.06, // 1/m (radio mínimo ~17 m)
} as const;

const DEG = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrapPi = (a: number) => { let x = a; while (x > Math.PI) x -= 2 * Math.PI; while (x < -Math.PI) x += 2 * Math.PI; return x; };

function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const k = Math.cos(((a.lat + b.lat) / 2) * DEG);
  const dx = (b.lng - a.lng) * k;
  const dy = b.lat - a.lat;
  return Math.atan2(dx, dy); // rad, 0 = norte, horario
}

export class FieldMotion {
  private state: FieldMotionState = { speed: 0, moving: false, curvature: 0, gps: 'none' };
  private listeners = new Set<(s: FieldMotionState) => void>();
  private startedAt = 0;
  private lastFixAt = 0;
  private lastStepAt = 0;
  private lastStepSpeed = 0;
  private startCount = 0;
  private lowSince: number | null = null;
  private vEma = 0;
  private lastCourse: number | null = null;
  private lastCourseAt = 0;
  private lastAccepted: { lat: number; lng: number; t: number } | null = null;
  private gpsEnabled = true;

  constructor(now = Date.now()) { this.startedAt = now; }

  get current() { return this.state; }

  subscribe(fn: (s: FieldMotionState) => void) {
    this.listeners.add(fn);
    fn(this.state);
    return () => { this.listeners.delete(fn); };
  }

  /** El recorrido se grabó sin permiso de ubicación. */
  setGpsEnabled(on: boolean) { this.gpsEnabled = on; this.tick(Date.now()); }

  pushFix(f: MotionFix) {
    const C = FIELD_MOTION;
    if (!Number.isFinite(f.lat) || !Number.isFinite(f.lng)) return;
    const acc = typeof f.acc === 'number' && f.acc > 0 ? f.acc : 10;
    if (acc > C.MAX_ACC) {
      // Lectura demasiado imprecisa: se informa «GPS débil» y no se usa para decidir movimiento.
      // Se mantiene la última escena válida; tick() la detiene si esto se prolonga.
      this.emit({ ...this.state, gps: 'weak' });
      return;
    }
    this.lastFixAt = f.t;
    const gps: GpsQuality = acc <= C.GOOD_ACC ? 'good' : 'weak';
    const doppler = typeof f.speed === 'number' && Number.isFinite(f.speed) && f.speed >= 0 ? f.speed : null;

    if (f.accepted && f.step > 0) {
      if (this.lastStepAt > 0) {
        const dt = Math.max(0.5, (f.t - this.lastStepAt) / 1000);
        this.lastStepSpeed = clamp(f.step / dt, 0, 3);
      }
      this.lastStepAt = f.t;
    }
    const stepFresh = this.lastStepAt > 0 && f.t - this.lastStepAt < C.STEP_VALID_MS;
    const measured = doppler ?? (stepFresh ? this.lastStepSpeed : 0);

    // --- histéresis caminar / quieto ---
    let moving = this.state.moving;
    if (!moving) {
      // Con mala precisión el Doppler solo no basta: se exige también un paso real reciente.
      const dopplerStart = doppler != null && doppler >= C.START_SPEED && (acc <= 20 || f.trackMoving);
      this.startCount = dopplerStart ? this.startCount + 1 : 0;
      const stepStart = f.accepted && f.step > 0 && this.lastStepSpeed >= 0.35 && !(doppler != null && doppler < C.STOP_SPEED);
      if (this.startCount >= C.START_FIXES || stepStart) { moving = true; this.lowSince = null; this.vEma = Math.max(measured, C.MIN_WALK); }
    } else {
      const low = doppler != null ? doppler < C.STOP_SPEED : !(stepFresh || f.trackMoving);
      if (low) {
        if (this.lowSince == null) this.lowSince = f.t;
        if (f.t - this.lowSince >= C.STOP_HOLD_MS) { moving = false; this.startCount = 0; }
      } else this.lowSince = null;
    }
    if (moving) this.vEma += 0.4 * (measured - this.vEma);
    else this.vEma = 0;
    const speed = moving ? clamp(this.vEma, C.MIN_WALK, C.MAX_WALK) : 0;

    // --- rumbo → curvatura ---
    let course: number | null = null;
    if (moving && doppler != null && doppler >= C.HEADING_MIN_SPEED && acc <= C.HEADING_ACC && typeof f.heading === 'number' && f.heading >= 0 && Number.isFinite(f.heading)) {
      course = f.heading * DEG;
    } else if (moving && f.accepted && f.step >= 3 && this.lastAccepted && acc <= C.HEADING_ACC) {
      course = bearing(this.lastAccepted, f);
    }
    if (f.accepted) this.lastAccepted = { lat: f.lat, lng: f.lng, t: f.t };
    let curvature = this.state.curvature;
    if (course != null) {
      if (this.lastCourse != null && f.t - this.lastCourseAt < 5000) {
        const dt = Math.max(0.5, (f.t - this.lastCourseAt) / 1000);
        const rate = clamp(wrapPi(course - this.lastCourse) / dt, -C.MAX_TURN_RATE, C.MAX_TURN_RATE);
        const k = clamp(rate / Math.max(speed, 0.5), -C.MAX_CURVATURE, C.MAX_CURVATURE);
        curvature += 0.3 * (k - curvature);
      }
      this.lastCourse = course;
      this.lastCourseAt = f.t;
    } else {
      // Rumbo no fiable: se relaja hacia una orientación neutra, sin giros bruscos.
      curvature *= 0.6;
    }
    if (!moving || Math.abs(curvature) < 0.002) curvature = moving ? 0 : curvature * 0.5;

    this.emit({ speed, moving, curvature, gps });
  }

  /** Llamar ~1 vez por segundo: detiene la animación si las lecturas dejan de llegar. */
  tick(now: number) {
    const C = FIELD_MOTION;
    if (!this.gpsEnabled) { this.emit({ speed: 0, moving: false, curvature: 0, gps: 'none' }); return; }
    if (!this.lastFixAt) {
      if (now - this.startedAt > C.NONE_MS) this.emit({ speed: 0, moving: false, curvature: 0, gps: 'none' });
      return;
    }
    const age = now - this.lastFixAt;
    if (age > C.NONE_MS) { this.reset(); this.emit({ speed: 0, moving: false, curvature: 0, gps: 'none' }); return; }
    if (age > C.STALE_MS) { this.reset(); this.emit({ speed: 0, moving: false, curvature: 0, gps: 'weak' }); }
  }

  private reset() {
    this.startCount = 0; this.lowSince = null; this.vEma = 0; this.lastCourse = null;
  }

  private emit(next: FieldMotionState) {
    const s = this.state;
    const same = s.moving === next.moving && s.gps === next.gps
      && Math.abs(s.speed - next.speed) < 0.02 && Math.abs(s.curvature - next.curvature) < 0.0005;
    if (same) return;
    this.state = next;
    for (const fn of this.listeners) {
      try { fn(next); } catch (e) { console.warn('[fieldMotion] listener', e); }
    }
  }
}
