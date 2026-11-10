/**
 * Escena 3D de AVOTEX Field Tracking: agricultor caminando hacia el horizonte entre filas de árboles.
 *
 * Técnica (ver docs/FIELD-TRACKING-3D.md): 3D prerenderizado + proyección en perspectiva en vivo.
 * - El agricultor es un modelo humano riggeado (CC0) cuya caminata se prerenderizó desde esta misma cámara.
 * - Camino, cuadrícula, trayectoria y árboles cercanos se proyectan cada tick con la cámara de projection.ts.
 *
 * Rendimiento:
 * - Un solo useFrameCallback en el hilo de UI, limitado a QUALITY[q].fps. Solo escribe 3 valores compartidos
 *   (travel, curv, frame); los estilos dependen de ellos. React no re-renderiza mientras se camina.
 * - Solo se animan transform/opacity (árboles, sprite) y el atributo d de 5 trazos SVG.
 * - En pausa, en segundo plano o minimizado, el callback se detiene (cero trabajo).
 * - Vigila la cadencia del hilo de UI: si hay tirones sostenidos, pide bajar de calidad (onJank).
 */
import React, { memo, useEffect, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Reanimated, {
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Defs, Ellipse, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import {
  CHAR_Z,
  COMPANIONS,
  CX,
  DYNAMIC_TREE_Z,
  FARMER,
  HORIZON_Y,
  TREES,
  TREE_ROWS_X,
  TREE_SPACING,
  VIEW_H,
  VIEW_W,
  bendX,
  depthOf,
  groundLine,
  hash,
  mod,
  ribbon,
  scaleAt,
  screenX,
  screenY,
} from './projection';
import { QUALITY, type FieldQuality } from './quality';

const SHEET = require('../../assets/field-tracking/farmer-walk.png');
// Modos Dron y GoPro: agricultor con casco y GoPro, secuencias de inicio y el dron (ver render.html).
const SHEET_GOPRO = require('../../assets/field-tracking/farmer-gopro.png');
const INTRO_DRONE = require('../../assets/field-tracking/farmer-drone-intro.png');
const INTRO_GOPRO = require('../../assets/field-tracking/farmer-gopro-intro.png');
const DRONE_IMG = require('../../assets/field-tracking/drone.png');

/** Acompañante del recorrido: solo cambia la animación (la captura sigue siendo con el celular). */
export type Companion = 'none' | 'dron' | 'gopro';

const DR = COMPANIONS.drone;
const DI = COMPANIONS.droneIntro;
const GI = COMPANIONS.goproIntro;
const GW = COMPANIONS.goproWalk;
const DI_LAST = DI.frames - 1;
const GI_LAST = GI.frames - 1;
/**
 * Dron (s): sube el brazo con el dron (0–1.1) · lo sostiene · se encienden LEDs y hélices (1.5) · despega (2.0–3.4)
 * mientras el brazo baja (2.15–2.95) · después vuela sobre el agricultor y lo acompaña al caminar.
 */
const D_RAISE = 1.1, D_ON = 1.5, D_LIFT0 = 2.0, D_LIFT1 = 3.4, D_LOWER0 = 2.15, D_LOWER1 = 2.95;
/** GoPro (s): sube el casco, lo baja hasta la cabeza y el brazo vuelve; luego camina con él. */
const G_END = 2.6;
const REF_DEPTH = depthOf(DR.ref.z, DR.ref.y);
const BG = require('../../assets/field-tracking/field-bg.jpg');
const TREE_IMG = [
  require('../../assets/field-tracking/tree-1.png'),
  require('../../assets/field-tracking/tree-2.png'),
  require('../../assets/field-tracking/tree-3.png'),
];

const APath = Reanimated.createAnimatedComponent(Path);

const WALK = FARMER.walkFrames;
const IDLE = FARMER.idleFrames;
const COLS = FARMER.sheetCols;
const FW = FARMER.frameW;
const FH = FARMER.frameH;
const M_PER_CYCLE = FARMER.metersPerCycle;
const IDLE_PERIOD_S = 2.6;
/** Por debajo de esta velocidad visual el suelo deja de desplazarse y el paso se cierra hacia idle. */
const SCROLL_MIN = 0.15;
/**
 * El agricultor siempre camina (desde el inicio, aunque el GPS aún no confirme movimiento): esta es su
 * velocidad base en m/s. Si el usuario camina más rápido, el paso se acelera con su velocidad real.
 * Solo es animación: la distancia mostrada sigue siendo la del GPS.
 */
const BASE_WALK = 0.55;

// Muestras de distancia (m) para el camino y la trayectoria: densas cerca, espaciadas lejos.
const Z_ROAD = [2.6, 3.2, 4, 5, 6.5, 8.5, 11, 15, 20, 28, 40, 60, 100] as const;
const Z_TRAJ = [CHAR_Z + 0.15, 5.2, 6.2, 7.5, 9.5, 12, 16, 22, 30, 42, 60] as const;
const ROAD_HALF = 0.85;
const CROSS_STEP = 1.6;
const FLOW_STEP = 2.6;
const FLOW_N = 9;

// Huella del agricultor (anillo luminoso + sombra), fija: se calcula una vez.
const FOOT_Y = screenY(CHAR_Z);
const FOOT_RX = 0.42 * scaleAt(CHAR_Z);
const FOOT_RY = (screenY(CHAR_Z - 0.42) - screenY(CHAR_Z + 0.42)) / 2;

export type FieldSceneProps = {
  /** Velocidad objetivo (m/s) del estado de movimiento; 0 = quieto. */
  targetSpeed: SharedValue<number>;
  /** Curvatura objetivo (1/m). */
  targetCurvature: SharedValue<number>;
  /** Animación activa (no pausada, app en primer plano, panel visible). */
  running: boolean;
  quality: Exclude<FieldQuality, 'off'>;
  /** Tirones sostenidos en el hilo de UI: el panel baja un nivel de calidad. */
  onJank: () => void;
  /** Error al cargar una imagen: el panel pasa a modo sin escena. */
  onAssetError: () => void;
  companion?: Companion;
  /** Segundos de la secuencia de inicio ya transcurridos (al volver a montar no se repite). */
  introElapsed?: number;
};

function FieldSceneImpl({ targetSpeed, targetCurvature, running, quality, onJank, onAssetError, companion = 'none', introElapsed = 0 }: FieldSceneProps) {
  const spec = QUALITY[quality];
  const tickMs = 1000 / spec.fps;

  // Estado de la animación (hilo de UI).
  const travel = useSharedValue(0); // metros visuales recorridos por el suelo (NO es la distancia del recorrido)
  const curv = useSharedValue(0);
  const frame = useSharedValue(WALK); // primer fotograma idle
  const sim = useSharedValue({ acc: 0, v: 0, phase: 0, idle: 0, walking: 0 });
  const mon = useSharedValue({ n: 0, sum: 0, t: 0, bad: 0, cooldown: 0 });
  // Acompañante: tiempo de la secuencia de inicio, fotograma de esa secuencia y estado del dron.
  const introEnd = companion === 'dron' ? D_LIFT1 : companion === 'gopro' ? G_END : 0;
  const introT = useSharedValue(Math.min(introElapsed, introEnd));
  const introFrame = useSharedValue(0);
  const drone = useSharedValue({ x: DR.ref.x, y: DR.ref.y, z: DR.ref.z, f: 4 });

  const callback = useFrameCallback(info => {
    'worklet';
    const dtFrame = info.timeSincePreviousFrame ?? 16;

    // --- monitor de cadencia del hilo de UI (ventanas de 3 s) ---
    const m = mon.get();
    m.n += 1; m.sum += Math.min(dtFrame, 250); m.t += dtFrame;
    if (m.cooldown > 0) m.cooldown -= dtFrame;
    if (m.t >= 3000) {
      const mean = m.sum / m.n;
      m.bad = mean > 40 ? m.bad + 1 : 0; // < 25 fps sostenido en el hilo de UI
      if (m.bad >= 2 && m.cooldown <= 0) { m.bad = 0; m.cooldown = 8000; scheduleOnRN(onJank); }
      m.n = 0; m.sum = 0; m.t = 0;
    }

    // --- limitador de fotogramas de la escena ---
    const s = sim.get();
    s.acc += dtFrame;
    if (s.acc < tickMs) return;
    const dt = Math.min(s.acc, 250) / 1000; // tras un salto (segundo plano) no se «teletransporta»
    s.acc = 0;

    // --- acompañante: secuencia de inicio y dron ---
    let it = introT.get();
    if (it < introEnd) { it = Math.min(introEnd, it + dt); introT.set(it); }
    const intro = it < introEnd;
    if (companion === 'gopro') {
      introFrame.set(Math.min(GI_LAST, Math.floor((it / G_END) * GI.frames)));
    } else if (companion === 'dron') {
      // Brazo: sube, se queda arriba y baja tras soltar el dron.
      const fi = it < D_RAISE ? Math.floor((it / D_RAISE) * DI_LAST)
        : it < D_LOWER0 ? DI_LAST
        : it < D_LOWER1 ? DI_LAST - Math.floor(((it - D_LOWER0) / (D_LOWER1 - D_LOWER0)) * DI_LAST) : 0;
      introFrame.set(fi);
      // Flota sobre el agricultor con un vaivén suave; en la mano antes de despegar.
      const hx = DR.ref.x + 0.05 * Math.sin(it * 0.8), hy = DR.ref.y + 0.035 * Math.sin(it * 2.3), hz = DR.ref.z;
      const d = drone.get();
      if (it < D_LIFT0) {
        const h = DI.hand[it < D_RAISE ? fi : DI_LAST];
        d.x = h.x; d.y = h.y; d.z = h.z;
      } else if (it < D_LIFT1) {
        const u = (it - D_LIFT0) / (D_LIFT1 - D_LIFT0);
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        const h = DI.hand[DI_LAST];
        d.x = h.x + (hx - h.x) * e; d.y = h.y + (hy - h.y) * e; d.z = h.z + (hz - h.z) * e;
      } else { d.x = hx; d.y = hy; d.z = hz; }
      d.f = it >= D_ON ? Math.floor(it * 24) % 4 : 4; // hélices girando (4 fotogramas) o apagado
      drone.set({ ...d });
    }

    // Velocidad visual: se acerca suavemente a la velocidad real (arranque y frenado sin saltos).
    // Durante la secuencia de inicio el agricultor espera quieto.
    const target = intro ? 0 : Math.max(BASE_WALK, targetSpeed.get());
    const tau = target > s.v ? 0.6 : 0.45;
    s.v += (target - s.v) * (1 - Math.exp(-dt / tau));
    if (target === 0 && s.v < 0.03) s.v = 0;

    // Curvatura: cambios de rumbo lentos y suaves.
    const kt = targetCurvature.get();
    const kc = curv.get();
    let kn = kc + (kt - kc) * (1 - Math.exp(-dt / 1.2));
    if (Math.abs(kn) < 0.0004 && kt === 0) kn = 0;
    if (kn !== kc) curv.set(kn);

    if (s.v >= SCROLL_MIN) {
      // Suelo y paso avanzan juntos a la misma razón (metros por ciclo del modelo) → sin patinar.
      s.walking = 1;
      travel.set(travel.get() + s.v * dt);
      s.phase = (s.phase + (s.v * dt) / M_PER_CYCLE) % 1;
    } else if (s.walking) {
      // Se detuvo: termina el paso en curso sin desplazar el suelo hasta juntar los pies.
      const next = s.phase + dt * 0.9;
      if ((s.phase < 0.5 && next >= 0.5) || next >= 1) { s.walking = 0; s.phase = next >= 1 ? 0 : 0.5; s.idle = 0; }
      else s.phase = next;
    }
    let f: number;
    if (s.walking) f = Math.floor(s.phase * WALK) % WALK;
    else { s.idle = (s.idle + dt / IDLE_PERIOD_S) % 1; f = WALK + (Math.floor(s.idle * IDLE) % IDLE); }
    if (f !== frame.get()) frame.set(f);
  }, false);

  useEffect(() => {
    callback.setActive(running);
    return () => callback.setActive(false);
  }, [running, callback]);

  // --- suelo: camino, cuadrícula, trayectoria (SVG con d animado) ---
  const roadProps = useAnimatedProps(() => ({ d: ribbon(Z_ROAD, 0, ROAD_HALF, curv.get()) }));
  const outerGrid = spec.outerGrid;
  const gridProps = useAnimatedProps(() => {
    const k = curv.get();
    let d = groundLine(Z_ROAD, -2.0, k) + groundLine(Z_ROAD, 2.0, k);
    if (outerGrid) d += groundLine(Z_ROAD, -3.7, k) + groundLine(Z_ROAD, 3.7, k);
    return { d };
  });
  const crossN = spec.crossLines;
  const crossProps = useAnimatedProps(() => {
    const k = curv.get();
    const off = mod(travel.get(), CROSS_STEP);
    let d = '';
    for (let i = 0; i < crossN; i++) {
      const z = 2.7 + (i + 1) * CROSS_STEP - off;
      const b = bendX(z, k);
      const y = screenY(z).toFixed(1);
      d += 'M' + screenX(-5.5 + b, z).toFixed(1) + ' ' + y + 'L' + screenX(5.5 + b, z).toFixed(1) + ' ' + y;
    }
    return { d };
  });
  const glowProps = useAnimatedProps(() => ({ d: ribbon(Z_TRAJ, 0, 0.34, curv.get(), 0.2) }));
  const coreProps = useAnimatedProps(() => ({ d: ribbon(Z_TRAJ, 0, 0.075, curv.get()) }));
  const flow = spec.flow;
  const flowProps = useAnimatedProps(() => {
    if (!flow) return { d: '' };
    const k = curv.get();
    const off = mod(travel.get(), FLOW_STEP);
    let d = '';
    for (let i = 0; i < FLOW_N; i++) {
      const z0 = CHAR_Z + 0.6 + i * FLOW_STEP + (FLOW_STEP - off);
      d += ribbon([z0, z0 + 0.55], 0, 0.13, k);
    }
    return { d };
  });

  // --- sprite del agricultor (normal o con casco) y de la secuencia de inicio ---
  const W_SHEET = companion === 'gopro' ? GW : null;
  const wCols = W_SHEET ? W_SHEET.sheetCols : COLS, wFW = W_SHEET ? W_SHEET.frameW : FW, wFH = W_SHEET ? W_SHEET.frameH : FH;
  const spriteStyle = useAnimatedStyle(() => {
    const f = frame.get();
    return { transform: [{ translateX: -(f % wCols) * wFW }, { translateY: -Math.floor(f / wCols) * wFH }] };
  });
  // Mientras dura la secuencia se ve su hoja; después, la caminata.
  const introSheet = companion === 'dron' ? DI : companion === 'gopro' ? GI : null;
  const showIntroUntil = companion === 'dron' ? D_LOWER1 : G_END;
  const walkVis = useAnimatedStyle(() => ({ opacity: introSheet && introT.get() < showIntroUntil ? 0 : 1 }));
  const introVis = useAnimatedStyle(() => ({ opacity: introSheet && introT.get() < showIntroUntil ? 1 : 0 }));
  const introStyle = useAnimatedStyle(() => {
    if (!introSheet) return {};
    const f = introFrame.get();
    return { transform: [{ translateX: -(f % introSheet.sheetCols) * introSheet.frameW }, { translateY: -Math.floor(f / introSheet.sheetCols) * introSheet.frameH }] };
  });
  // Dron: posición proyectada con la misma cámara y escala por profundidad (la imagen se hizo en DR.ref).
  const droneBox = useAnimatedStyle(() => {
    const d = drone.get();
    const k = REF_DEPTH / depthOf(d.z, d.y);
    return { transform: [{ translateX: screenX(d.x, d.z, d.y) - DR.anchorX * k }, { translateY: screenY(d.z, d.y) - DR.anchorY * k }, { scale: k }] };
  });
  const droneImg = useAnimatedStyle(() => ({ transform: [{ translateX: -drone.get().f * DR.frameW }] }));
  const droneShadow = useAnimatedStyle(() => {
    const d = drone.get();
    const k = scaleAt(d.z);
    const lift = Math.max(0, Math.min(1, (d.y - 1.0) / 1.6));
    return {
      opacity: 0.1 + 0.18 * lift,
      transform: [{ translateX: screenX(d.x, d.z) - 0.22 * k }, { translateY: screenY(d.z) - 0.05 * k }, { scaleX: 0.44 * k / 10 }, { scaleY: 0.1 * k / 10 }],
    };
  });

  // Ranuras de árboles: más lejanas primero (orden de pintado = profundidad).
  const slots = useMemo(() => {
    const out: { key: string; row: number; side: number; slot: number }[] = [];
    for (const row of [...spec.treeRows].sort((a, b) => b - a)) {
      for (let slot = spec.treeSlots - 1; slot >= 0; slot--) {
        for (const side of [-1, 1]) out.push({ key: `${row}:${side}:${slot}`, row, side, slot });
      }
    }
    return out;
  }, [spec.treeRows, spec.treeSlots]);

  return (
    <View style={styles.root} pointerEvents="none">
      <Image source={BG} style={styles.bg} onError={onAssetError} fadeDuration={0} />
      <Svg width={VIEW_W} height={VIEW_H} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="traj" x1="0" y1={HORIZON_Y} x2="0" y2={VIEW_H} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#3e6ae1" stopOpacity="0" />
            <Stop offset="0.45" stopColor="#3e6ae1" stopOpacity="0.6" />
            <Stop offset="1" stopColor="#3e6ae1" stopOpacity="1" />
          </SvgGradient>
          <SvgGradient id="road" x1="0" y1={HORIZON_Y} x2="0" y2={VIEW_H} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.25" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0.9" />
          </SvgGradient>
          <SvgGradient id="grid" x1="0" y1={HORIZON_Y} x2="0" y2={VIEW_H} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#8a939d" stopOpacity="0" />
            <Stop offset="1" stopColor="#8a939d" stopOpacity="0.45" />
          </SvgGradient>
        </Defs>
        <APath animatedProps={roadProps} fill="url(#road)" stroke="url(#grid)" strokeWidth={0.8} />
        <APath animatedProps={gridProps} fill="none" stroke="url(#grid)" strokeWidth={0.6} />
        <APath animatedProps={crossProps} fill="none" stroke="url(#grid)" strokeWidth={0.6} />
        <APath animatedProps={glowProps} fill="url(#traj)" opacity={0.18} />
        <APath animatedProps={coreProps} fill="url(#traj)" />
        <APath animatedProps={flowProps} fill="#ffffff" opacity={0.9} />
        <Ellipse cx={CX} cy={FOOT_Y} rx={FOOT_RX * 0.62} ry={FOOT_RY * 0.62} fill="#1f2328" opacity={0.18} />
        <Ellipse cx={CX} cy={FOOT_Y} rx={FOOT_RX * 1.25} ry={FOOT_RY * 1.25} fill="none" stroke="#3e6ae1" strokeOpacity={0.18} strokeWidth={3} />
        <Ellipse cx={CX} cy={FOOT_Y} rx={FOOT_RX} ry={FOOT_RY} fill="none" stroke="#3e6ae1" strokeWidth={1.4} />
      </Svg>
      {slots.map(s => (
        <TreeSlot key={s.key} row={s.row} side={s.side} slot={s.slot} travel={travel} curv={curv} onError={onAssetError} />
      ))}
      {companion === 'dron' && <Reanimated.View style={[styles.droneShadow, droneShadow]} />}
      <Reanimated.View style={[W_SHEET
        ? { position: 'absolute', left: W_SHEET.x, top: W_SHEET.y, width: W_SHEET.frameW, height: W_SHEET.frameH, overflow: 'hidden' }
        : styles.sprite, walkVis]}>
        <Reanimated.Image source={W_SHEET ? SHEET_GOPRO : SHEET} onError={onAssetError} fadeDuration={0}
          style={[W_SHEET ? { width: W_SHEET.frameW * W_SHEET.sheetCols, height: W_SHEET.frameH * W_SHEET.sheetRows } : styles.sheet, spriteStyle]} />
      </Reanimated.View>
      {introSheet && (
        <Reanimated.View style={[{ position: 'absolute', left: introSheet.x, top: introSheet.y, width: introSheet.frameW, height: introSheet.frameH, overflow: 'hidden' }, introVis]}>
          <Reanimated.Image source={companion === 'dron' ? INTRO_DRONE : INTRO_GOPRO} onError={onAssetError} fadeDuration={0}
            style={[{ width: introSheet.frameW * introSheet.sheetCols, height: introSheet.frameH * introSheet.sheetRows }, introStyle]} />
        </Reanimated.View>
      )}
      {companion === 'dron' && (
        <Reanimated.View style={[styles.drone, droneBox]}>
          <Reanimated.Image source={DRONE_IMG} onError={onAssetError} fadeDuration={0} style={[styles.droneSheet, droneImg]} />
        </Reanimated.View>
      )}
      {/* Bruma suave del horizonte. */}
      <LinearGradient
        colors={['rgba(244,245,247,0.7)', 'rgba(244,245,247,0)']}
        style={styles.topShade}
      />
    </View>
  );
}

const [Z_START, Z_END] = DYNAMIC_TREE_Z;
const TREE_FOR_ROW = [[0, 1], [2, 0]]; // [fila][lado izq/der] → imagen

type TreeSlotProps = {
  row: number;
  side: number;
  slot: number;
  travel: SharedValue<number>;
  curv: SharedValue<number>;
  onError: () => void;
};

const TreeSlot = memo(function TreeSlot({ row, side, slot, travel, curv, onError }: TreeSlotProps) {
  const variant = TREE_FOR_ROW[row]?.[side < 0 ? 0 : 1] ?? 0;
  const meta = TREES[variant];
  const rowX = TREE_ROWS_X[row] ?? 2.7;
  const key = row * 31 + (side < 0 ? 0 : 17);
  // Filas desfasadas para que los árboles no queden alineados en pares.
  const rowOffset = row * 1.7 + (side < 0 ? 0 : 2.1);
  const style = useAnimatedStyle(() => {
    const base = (travel.get() + rowOffset) / TREE_SPACING;
    const i0 = Math.floor(base);
    const z = Z_START + (slot + 1 - (base - i0)) * TREE_SPACING;
    const id = i0 + slot + 1;
    const h1 = hash(id * 7.13 + key);
    const h2 = hash(id * 3.71 + key + 5);
    const size = 0.82 + 0.36 * h1;
    const flip = h2 > 0.5 ? -1 : 1;
    const x = side * (rowX + (h2 - 0.5) * 0.5) + bendX(z, curv.get());
    const s = scaleAt(z) * meta.metersPerPx * size;
    const fade = (Z_END - z) / 7;
    return {
      opacity: fade < 0 ? 0 : fade > 1 ? 1 : fade,
      transform: [
        { translateX: screenX(x, z) - meta.anchorX },
        { translateY: screenY(z) - meta.anchorY },
        { scaleX: s * flip },
        { scaleY: s },
      ],
    };
  });
  return (
    <Reanimated.Image
      source={TREE_IMG[variant]}
      onError={onError}
      fadeDuration={0}
      style={[
        { position: 'absolute', left: 0, top: 0, width: meta.w, height: meta.h, transformOrigin: `${meta.anchorX}px ${meta.anchorY}px` },
        style,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  root: { width: VIEW_W, height: VIEW_H, overflow: 'hidden', backgroundColor: '#e9ecef' },
  bg: { position: 'absolute', left: 0, top: 0, width: VIEW_W, height: VIEW_H },
  sprite: { position: 'absolute', left: FARMER.x, top: FARMER.y, width: FW, height: FH, overflow: 'hidden' },
  sheet: { width: FW * COLS, height: FH * FARMER.sheetRows },
  topShade: { position: 'absolute', left: 0, right: 0, top: 0, height: 36 },
  drone: { position: 'absolute', left: 0, top: 0, width: DR.frameW, height: DR.frameH, overflow: 'hidden', transformOrigin: 'left top' },
  droneSheet: { width: DR.frameW * DR.sheetCols, height: DR.frameH },
  // Elipse de 10×10 que se escala al tamaño de la sombra en el suelo.
  droneShadow: { position: 'absolute', left: 0, top: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#1f2328', transformOrigin: 'left top' },
});

export default memo(FieldSceneImpl);
