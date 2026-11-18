/**
 * Cuerpo vegetal de la barra: forma orgánica dibujada con react-native-svg.
 *
 * Capas (de atrás hacia adelante):
 *  1. Sombra exterior (elipse difusa + sombra de contacto desplazada).
 *  2. Cuerpo verde bosque con degradado vertical (claro arriba, oscuro abajo).
 *  3. Colinas y follaje en la franja superior (recortados a la silueta).
 *  4. Brillo lima en el borde superior y contorno oscuro de definición.
 *  5. Divisiones verticales entre opciones.
 *
 * Es estático: se calcula una vez por tamaño y no se anima.
 */
import React, { memo, useMemo } from 'react';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { NAV } from './palette';

export type Separator = { x: number; len: number; dy?: number };

type Props = {
  width: number;
  /** Alto del cuerpo de la barra (sin el montículo ni la sombra). */
  height: number;
  /** Espacio sobre el borde superior reservado para el montículo bajo el aguacate. */
  moundPad: number;
  /** Espacio bajo la barra para la sombra. */
  shadowPad: number;
  /** Centro horizontal del aguacate (Escanear). */
  moundX: number;
  separators: Separator[];
};

/** Borde superior ondulado con un montículo donde se asienta el aguacate. */
function topEdge(W: number, T: number, H: number, cx: number) {
  const r = H * 0.5;
  const x0 = r * 0.9;
  const x1 = W - r * 0.9;
  const mW = 46;
  const wave = (from: number, to: number, phase: number) => {
    const span = to - from;
    if (span <= 4) return `L ${to} ${T}`;
    const n = Math.max(1, Math.round(span / 34));
    const step = span / n;
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = from + step * i;
      const amp = (i + phase) % 2 === 0 ? -1.8 : 1.4;
      d += ` Q ${a + step / 2} ${T + amp} ${a + step} ${T}`;
    }
    return d;
  };
  const left = Math.max(x0 + 4, cx - mW);
  const right = Math.min(x1 - 4, cx + mW);
  return (
    `M ${x0} ${T + 1}` +
    ` Q ${(x0 + Math.min(left, x0 + 20)) / 2} ${T} ${Math.min(left, x0 + 20)} ${T}` +
    wave(Math.min(left, x0 + 20), left, 0) +
    ` C ${cx - 28} ${T} ${cx - 24} ${T - 9} ${cx} ${T - 10}` +
    ` C ${cx + 24} ${T - 9} ${cx + 28} ${T} ${right} ${T}` +
    wave(right, x1, 1) +
    ` L ${x1} ${T + 1}`
  );
}

function bodyPath(W: number, T: number, H: number, cx: number) {
  const r = H * 0.5;
  const B = T + H;
  return (
    topEdge(W, T, H, cx) +
    ` C ${W - 4} ${T + 1} ${W} ${T + H * 0.28} ${W} ${T + H * 0.52}` +
    ` C ${W} ${T + H * 0.82} ${W - r * 0.35} ${B} ${W - r} ${B}` +
    ` Q ${W / 2} ${B + 3} ${r} ${B}` +
    ` C ${r * 0.35} ${B} 0 ${T + H * 0.82} 0 ${T + H * 0.52}` +
    ` C 0 ${T + H * 0.28} 4 ${T + 1} ${r * 0.9} ${T + 1} Z`
  );
}

/** Colinas suaves en la franja superior. */
function hills(W: number, T: number, H: number, phase: number, base: number, amp: number) {
  const n = 6;
  const step = W / n;
  let d = `M 0 ${T + base}`;
  for (let i = 0; i < n; i++) {
    const x = step * i;
    const up = (i + phase) % 2 === 0;
    d += ` Q ${x + step / 2} ${T + base + (up ? -amp : amp * 0.6)} ${x + step} ${T + base}`;
  }
  return d + ` L ${W} ${T + H + 4} L 0 ${T + H + 4} Z`;
}

/** Follaje: puntos pequeños y deterministas (sin aleatoriedad entre renders). */
function foliage(W: number, T: number) {
  const dots: { x: number; y: number; r: number; o: number; c: string }[] = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const count = Math.round(W / 12);
  for (let i = 0; i < count; i++) {
    dots.push({
      x: 14 + rnd() * (W - 28),
      y: T + 3 + rnd() * 9,
      r: 0.7 + rnd() * 1.1,
      o: 0.06 + rnd() * 0.1,
      c: rnd() > 0.55 ? NAV.lime : NAV.yellow,
    });
  }
  return dots;
}

function BarBodyImpl({ width: W, height: H, moundPad: T, shadowPad: S, moundX, separators }: Props) {
  const d = useMemo(() => bodyPath(W, T, H, moundX), [W, T, H, moundX]);
  const edge = useMemo(() => topEdge(W, T, H, moundX), [W, T, H, moundX]);
  const h1 = useMemo(() => hills(W, T, H, 0, 9, 4), [W, T, H]);
  const h2 = useMemo(() => hills(W, T, H, 1, 14, 5), [W, T, H]);
  const dots = useMemo(() => foliage(W, T), [W, T]);
  const midY = T + H * 0.5;

  return (
    <Svg width={W} height={T + H + S} pointerEvents="none">
      <Defs>
        <RadialGradient id="avxBarShadow" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#021A0C" stopOpacity="0.42" />
          <Stop offset="0.7" stopColor="#021A0C" stopOpacity="0.14" />
          <Stop offset="1" stopColor="#021A0C" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="avxBarBody" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2A7A2C" />
          <Stop offset="0.22" stopColor={NAV.forest} />
          <Stop offset="0.7" stopColor="#0B4A22" />
          <Stop offset="1" stopColor={NAV.deep} />
        </LinearGradient>
        <LinearGradient id="avxHillA" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={NAV.vegetal} stopOpacity="0.75" />
          <Stop offset="0.35" stopColor={NAV.vegetal} stopOpacity="0.18" />
          <Stop offset="0.6" stopColor={NAV.vegetal} stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="avxHillB" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={NAV.olive} stopOpacity="0.55" />
          <Stop offset="0.3" stopColor={NAV.olive} stopOpacity="0.12" />
          <Stop offset="0.55" stopColor={NAV.olive} stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="avxBottomShade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.55" stopColor="#021A0C" stopOpacity="0" />
          <Stop offset="1" stopColor="#021A0C" stopOpacity="0.35" />
        </LinearGradient>
        <LinearGradient id="avxSep" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={NAV.yellow} stopOpacity="0" />
          <Stop offset="0.5" stopColor={NAV.yellow} stopOpacity="0.6" />
          <Stop offset="1" stopColor={NAV.yellow} stopOpacity="0" />
        </LinearGradient>
        <ClipPath id="avxBarClip">
          <Path d={d} />
        </ClipPath>
      </Defs>

      {/* 1. Sombra exterior */}
      <Ellipse cx={W / 2} cy={T + H + 2} rx={W / 2 - 4} ry={S - 2} fill="url(#avxBarShadow)" />
      <G transform="translate(0 4)">
        <Path d={d} fill="#021A0C" opacity={0.28} />
      </G>

      {/* 2. Cuerpo */}
      <Path d={d} fill="url(#avxBarBody)" />

      {/* 3. Relieve vegetal */}
      <G clipPath="url(#avxBarClip)">
        <Path d={h2} fill="url(#avxHillB)" />
        <Path d={h1} fill="url(#avxHillA)" />
        {dots.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.c} opacity={p.o} />
        ))}
        <Path d={d} fill="url(#avxBottomShade)" />
      </G>

      {/* 4. Brillo y contorno */}
      <Path d={d} fill="none" stroke="#03230E" strokeOpacity={0.7} strokeWidth={1} />
      <Path d={edge} fill="none" stroke={NAV.lime} strokeOpacity={0.55} strokeWidth={1.3} strokeLinecap="round" />

      {/* 5. Divisiones */}
      {separators.map((s, i) => (
        <Rect
          key={i}
          x={s.x - 0.5}
          y={midY + (s.dy ?? 0) - s.len / 2}
          width={1}
          height={s.len}
          fill="url(#avxSep)"
        />
      ))}
    </Svg>
  );
}

export const BarBody = memo(BarBodyImpl);
