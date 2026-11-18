/**
 * Hojas de aguacate decorativas (vectoriales, no emojis ni iconos genéricos).
 * Forma lanceolada con punta alargada, nervadura central, degradado, reflejo y sombra discreta.
 */
import React, { memo } from 'react';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

/** Hoja en coordenadas locales: nace en (0,0) y apunta hacia +x con longitud L. */
function leafPath(L: number, w = 1) {
  return (
    `M 0 0 C ${L * 0.22} ${-L * 0.24 * w} ${L * 0.68} ${-L * 0.17 * w} ${L} 0` +
    ` C ${L * 0.7} ${L * 0.13 * w} ${L * 0.26} ${L * 0.2 * w} 0 0 Z`
  );
}
function leafHighlight(L: number, w = 1) {
  return (
    `M ${L * 0.08} ${-L * 0.02} C ${L * 0.25} ${-L * 0.17 * w} ${L * 0.62} ${-L * 0.13 * w} ${L * 0.9} ${-L * 0.01}` +
    ` C ${L * 0.6} ${-L * 0.05 * w} ${L * 0.3} ${-L * 0.05 * w} ${L * 0.08} ${-L * 0.02} Z`
  );
}

export type LeafProps = {
  x: number;
  y: number;
  /** Ángulo en grados (0 = derecha, -90 = arriba). */
  angle: number;
  length: number;
  width?: number;
  /** Prefijo de los degradados definidos con <LeafDefs>. */
  ids: string;
  /** Hoja de fondo: más oscura. */
  back?: boolean;
  stem?: number;
};

export function LeafDefs({ ids }: { ids: string }) {
  return (
    <Defs>
      <LinearGradient id={`${ids}Fill`} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#1F6A1C" />
        <Stop offset="0.45" stopColor="#3F8F22" />
        <Stop offset="1" stopColor="#7DBE2E" />
      </LinearGradient>
      <LinearGradient id={`${ids}Back`} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#0F4A17" />
        <Stop offset="1" stopColor="#2F7420" />
      </LinearGradient>
    </Defs>
  );
}

export function Leaf({ x, y, angle, length: L, width = 1, ids, back, stem = 0 }: LeafProps) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${angle})`}>
      {stem > 0 && (
        <Path d={`M ${-stem} 0 L 0 0`} stroke="#3A5A1A" strokeWidth={1.2} strokeLinecap="round" opacity={0.8} />
      )}
      {/* sombra discreta */}
      <G transform="translate(1 1.6)">
        <Path d={leafPath(L, width)} fill="#021A0C" opacity={0.25} />
      </G>
      <Path d={leafPath(L, width)} fill={`url(#${ids}${back ? 'Back' : 'Fill'})`} />
      {!back && <Path d={leafHighlight(L, width)} fill="#FFFFFF" opacity={0.16} />}
      {/* nervadura central */}
      <Path
        d={`M 0 0 Q ${L * 0.5} ${-L * 0.02} ${L * 0.94} 0`}
        stroke={back ? '#5E9A2E' : '#C9F06A'}
        strokeOpacity={back ? 0.35 : 0.55}
        strokeWidth={0.8}
        fill="none"
        strokeLinecap="round"
      />
    </G>
  );
}

/**
 * Grupo de tres hojas que brota de una esquina superior de la barra.
 * Se dibuja para el lado izquierdo; el derecho se refleja con scaleX: -1.
 * Origen de los tallos: (size*0.62, size*0.86).
 */
function LeafClusterImpl({ size = 60, ids }: { size?: number; ids: string }) {
  const s = size / 60;
  const ox = 37 * s;
  const oy = 52 * s;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} pointerEvents="none">
      <LeafDefs ids={ids} />
      {/* tercera hoja, parcialmente detrás */}
      <Leaf ids={ids} back x={ox + 1 * s} y={oy} angle={-108} length={34 * s} width={0.95} stem={3 * s} />
      {/* hoja principal: arriba y hacia afuera */}
      <Leaf ids={ids} x={ox} y={oy} angle={-140} length={40 * s} stem={4 * s} />
      {/* hoja secundaria: más pequeña, inclinada hacia el centro */}
      <Leaf ids={ids} x={ox + 2 * s} y={oy + 1 * s} angle={-62} length={24 * s} width={1.05} stem={2 * s} />
    </Svg>
  );
}

export const LeafCluster = memo(LeafClusterImpl);
