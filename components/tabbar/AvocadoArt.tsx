/**
 * Medio aguacate Hass cortado longitudinalmente, en posición vertical.
 * Capas: cáscara texturizada → borde de pulpa lima → pulpa amarillenta → centro cremoso
 * → hueco del hueso → hueso marrón con brillo → reflejos → tallo y dos hojas.
 *
 * `AvocadoGlow` es la capa de contorno lima luminoso que se enciende cuando Escanear está activo.
 *
 * Si se dispone de un render 3D (PNG/WebP transparente, proporción 100:142), puede pasarse
 * como `source` en <AvocadoArt>: se usará en lugar del vector manteniendo el mismo encuadre.
 */
import React, { memo } from 'react';
import { Image, type ImageSourcePropType } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { Leaf, LeafDefs } from './Leaves';

export const AVOCADO_VIEWBOX = { w: 100, h: 142 };
/** Centro del hueso en unidades del viewBox (para colocar la cámara encima). */
export const AVOCADO_PIT = { cx: 50, cy: 101, r: 23 };

const BODY =
  'M50 24 C38.5 24 33.5 35 30.5 49 C27.5 62 10 72 10 100 C10 124.5 28.5 140 50 140 C71.5 140 90 124.5 90 100 C90 72 72.5 62 69.5 49 C66.5 35 61.5 24 50 24 Z';
const scaleAbout = (s: number) => `translate(50 88) scale(${s}) translate(-50 -88)`;

// Textura sutil de la cáscara: poros deterministas sobre la franja visible.
const PORES = (() => {
  const out: { x: number; y: number; r: number }[] = [];
  let seed = 11;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 70; i++) {
    const t = rnd() * Math.PI * 2;
    // aproximación de la silueta: elipse que cubre el cuerpo
    const rx = 35.5 + rnd() * 1.6;
    const ry = 57 + rnd() * 2;
    const x = 50 + Math.cos(t) * rx * (Math.sin(t) < -0.3 ? 0.62 : 1);
    const y = 84 + Math.sin(t) * ry * (Math.sin(t) > 0 ? 0.92 : 1.06);
    out.push({ x, y, r: 0.45 + rnd() * 0.5 });
  }
  return out;
})();

function AvocadoSvg({ width, height }: { width: number; height: number }) {
  const { cx, cy, r } = AVOCADO_PIT;
  return (
    <Svg width={width} height={height} viewBox="0 0 100 142" pointerEvents="none">
      <LeafDefs ids="avxAvoLeaf" />
      <Defs>
        <RadialGradient id="avxSkin" cx="38%" cy="34%" rx="70%" ry="70%">
          <Stop offset="0" stopColor="#4A8A2A" />
          <Stop offset="0.5" stopColor="#245C19" />
          <Stop offset="1" stopColor="#0C3311" />
        </RadialGradient>
        <LinearGradient id="avxRim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#C8F84A" />
          <Stop offset="1" stopColor="#8CC524" />
        </LinearGradient>
        <RadialGradient id="avxPulp" cx="50%" cy="62%" rx="58%" ry="58%">
          <Stop offset="0" stopColor="#FBF6C4" />
          <Stop offset="0.38" stopColor="#F1F09A" />
          <Stop offset="0.7" stopColor="#E6ED7A" />
          <Stop offset="0.9" stopColor="#CDE65A" />
          <Stop offset="1" stopColor="#B4DA3E" />
        </RadialGradient>
        <RadialGradient id="avxPit" cx="36%" cy="30%" rx="72%" ry="72%">
          <Stop offset="0" stopColor="#B07040" />
          <Stop offset="0.45" stopColor="#7A4320" />
          <Stop offset="1" stopColor="#3B1D0C" />
        </RadialGradient>
        <RadialGradient id="avxPitBed" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0.78" stopColor="#B8C64A" stopOpacity="0.9" />
          <Stop offset="1" stopColor="#E9EC8C" stopOpacity="0" />
        </RadialGradient>
        <ClipPath id="avxSkinClip">
          <Path d={BODY} />
        </ClipPath>
        <LinearGradient id="avxShine" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* tallo y hojas cerca del tallo */}
      <Path d="M50 26 C50 20 51 15 53.5 11" stroke="#5B3A1A" strokeWidth={2.6} strokeLinecap="round" fill="none" />
      <Leaf ids="avxAvoLeaf" back x={52} y={14} angle={-150} length={24} width={0.95} />
      <Leaf ids="avxAvoLeaf" x={53} y={12} angle={-28} length={30} />

      {/* cáscara */}
      <Path d={BODY} fill="url(#avxSkin)" />
      <G opacity={0.35} clipPath="url(#avxSkinClip)">
        {PORES.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={p.r} fill={i % 3 === 0 ? '#7FB34A' : '#06260B'} />
        ))}
      </G>
      {/* reflejo lateral de la cáscara */}
      <Path
        d="M28.5 54 C25.5 66 14.5 76 14.5 98"
        stroke="#FFFFFF"
        strokeOpacity={0.22}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />

      {/* borde de pulpa (lima) */}
      <Path d={BODY} transform={scaleAbout(0.9)} fill="url(#avxRim)" />
      {/* pulpa */}
      <Path d={BODY} transform={scaleAbout(0.85)} fill="url(#avxPulp)" />

      {/* hueco donde descansa el hueso */}
      <Circle cx={cx} cy={cy} r={r + 4} fill="url(#avxPitBed)" />
      {/* hueso */}
      <Circle cx={cx} cy={cy} r={r} fill="url(#avxPit)" />
      <Ellipse cx={cx - 8} cy={cy - 9} rx={8} ry={5} fill="url(#avxShine)" transform={`rotate(-30 ${cx - 8} ${cy - 9})`} />
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke="#2A1206" strokeOpacity={0.5} strokeWidth={0.8} />

      {/* brillo superior de la pulpa (volumen) */}
      <Path d="M42 44 C45 38 55 38 58 44" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function AvocadoArtImpl({ width, height, source }: { width: number; height: number; source?: ImageSourcePropType }) {
  if (source) {
    return <Image source={source} style={{ width, height }} resizeMode="contain" />;
  }
  return <AvocadoSvg width={width} height={height} />;
}

export const AvocadoArt = memo(AvocadoArtImpl);

/** Contorno lima luminoso (estado activo). Se superpone exactamente a la silueta. */
function AvocadoGlowImpl({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 142" pointerEvents="none">
      <Path d={BODY} fill="none" stroke="#B9F62F" strokeOpacity={0.35} strokeWidth={6} />
      <Path d={BODY} fill="none" stroke="#D8FF6A" strokeOpacity={0.95} strokeWidth={1.8} />
    </Svg>
  );
}
export const AvocadoGlow = memo(AvocadoGlowImpl);

/** Halo verde difuso detrás del aguacate. */
function AvocadoHaloImpl({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Defs>
        <RadialGradient id="avxHalo" cx="50%" cy="55%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#B9F62F" stopOpacity="0.55" />
          <Stop offset="0.55" stopColor="#7FD12A" stopOpacity="0.22" />
          <Stop offset="1" stopColor="#3FA02A" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill="url(#avxHalo)" />
    </Svg>
  );
}
export const AvocadoHalo = memo(AvocadoHaloImpl);
