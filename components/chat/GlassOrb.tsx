/**
 * Círculo decorativo de vidrio del Asistente Avotex: relleno translúcido salvia → marfil, borde fino de cristal
 * (transparente → blanco cálido → lima) y destellos verdes localizados, como luz reflejada en el borde.
 *
 * Solo SVG (sin filtros de desenfoque, que no se ven igual en iOS y Android): el halo de cada destello son
 * varios trazos cortos del mismo arco, cada vez más anchos y más transparentes.
 * Es decorativo: pointerEvents="none" y se oculta a los lectores de pantalla.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

export const ORB = {
  ivory: '#F7F7EF',
  sage: '#E9EFD7',
  lime: '#B9F62F',
  warmWhite: '#FFFDF2',
};

/** Un destello: centrado en `angle` (grados; 0 = derecha, 90 = abajo), de `span` grados y brillo `power` (0–1). */
export type Glint = { angle: number; span: number; power?: number };

type Props = {
  /** Centro y radio en coordenadas de la pantalla (dp). */
  cx: number;
  cy: number;
  r: number;
  glints: Glint[];
  /** Hacia dónde gira el degradado del borde (grados): el lado más claro y verde del cristal. */
  lightAngle?: number;
  id: string;
};

const rad = (a: number) => (a * Math.PI) / 180;

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const x1 = cx + r * Math.cos(rad(from)), y1 = cy + r * Math.sin(rad(from));
  const x2 = cx + r * Math.cos(rad(to)), y2 = cy + r * Math.sin(rad(to));
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

export default function GlassOrb({ cx, cy, r, glints, lightAngle = 45, id }: Props) {
  // El SVG cubre solo el cuadrado del círculo (+ margen del halo); lo que sale de la pantalla se recorta afuera.
  const pad = 18;
  const size = 2 * (r + pad);
  const c = r + pad;
  // Vector del degradado del borde: del lado opuesto a la luz (transparente) hacia la luz (lima).
  const lx = Math.cos(rad(lightAngle)), ly = Math.sin(rad(lightAngle));
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: cx - c, top: cy - c, width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          {/* 1. Relleno: casi marfil al centro, un poco más de salvia cerca del arco. */}
          <RadialGradient id={`${id}-fill`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={ORB.warmWhite} stopOpacity={0.3} />
            <Stop offset="0.7" stopColor={ORB.sage} stopOpacity={0.32} />
            <Stop offset="0.94" stopColor={ORB.sage} stopOpacity={0.72} />
            <Stop offset="1" stopColor={ORB.warmWhite} stopOpacity={0.6} />
          </RadialGradient>
          {/* 2. Borde de cristal: la intensidad cambia a lo largo del arco. */}
          <LinearGradient id={`${id}-edge`} x1={`${50 - lx * 50}%`} y1={`${50 - ly * 50}%`} x2={`${50 + lx * 50}%`} y2={`${50 + ly * 50}%`}>
            <Stop offset="0" stopColor={ORB.warmWhite} stopOpacity={0} />
            <Stop offset="0.45" stopColor={ORB.warmWhite} stopOpacity={0.85} />
            <Stop offset="0.8" stopColor={ORB.lime} stopOpacity={0.28} />
            <Stop offset="1" stopColor={ORB.lime} stopOpacity={0.5} />
          </LinearGradient>
        </Defs>
        <Circle cx={c} cy={c} r={r} fill={`url(#${id}-fill)`} />
        <Circle cx={c} cy={c} r={r - 0.5} fill="none" stroke={`url(#${id}-edge)`} strokeWidth={1.6} />
        {/* Brillo interior muy tenue que acompaña el borde (grosor del vidrio). */}
        <Circle cx={c} cy={c} r={r - 3} fill="none" stroke={ORB.warmWhite} strokeOpacity={0.35} strokeWidth={1} />
        {/* 3. Destellos: halo lima que se desvanece y núcleo casi blanco. */}
        {glints.map((g, i) => {
          const p = g.power ?? 1;
          const layers: [number, number, string, number][] = [
            // [ancho del trazo, opacidad, color, fracción del tramo]
            [16, 0.05 * p, ORB.lime, 1],
            [10, 0.09 * p, ORB.lime, 0.9],
            [6, 0.18 * p, ORB.lime, 0.75],
            [3, 0.45 * p, ORB.lime, 0.6],
            [1.6, 0.9 * p, '#F4FFD9', 0.38],
            [1.2, 0.95 * p, '#FFFFFF', 0.18],
          ];
          return layers.map(([w, o, col, f], k) => (
            <Path key={`${i}-${k}`} d={arc(c, c, r - 0.5, g.angle - (g.span * f) / 2, g.angle + (g.span * f) / 2)}
              stroke={col} strokeOpacity={o} strokeWidth={w} strokeLinecap="round" fill="none" />
          ));
        })}
      </Svg>
    </View>
  );
}
