/**
 * Dona 3D (2.5D en SVG): anillo inclinado con grosor. Se dibuja por capas, de atrás hacia delante:
 * sombra proyectada → pared interior visible (mitad trasera del hueco) → pared exterior visible (mitad
 * delantera, tono más oscuro) → caras superiores con degradado → brillo del borde.
 *
 * Escala correcta: cada segmento ocupa exactamente su fracción del ángulo (la inclinación es igual para
 * todos, así que no cambia proporciones). Al tocar un segmento se separa un poco hacia fuera y se eleva,
 * sin cambiar su tamaño; los demás se atenúan.
 * Animación: la dona se «forma» girando sus límites desde 0 (o desde los valores anteriores al filtrar).
 */
import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, G, LinearGradient as SvgLinear, Path, RadialGradient, Stop } from 'react-native-svg';
import { A, shade, useSvgId, useTween } from './core';

export type DonutSlice = { key: string; color: string; value: number };

const TILT = 0.6;
const STEP = Math.PI / 90; // 2° por punto: curvas suaves sin miles de vértices

function Donut3D({ size, slices, selected, onSelect, total, totalLabel, reduced }: {
  size: number; slices: DonutSlice[]; selected: string | null; onSelect: (key: string) => void;
  total: string; totalLabel: string; reduced: boolean;
}) {
  const gid = useSvgId('dn');
  const sum = slices.reduce((a, s) => a + s.value, 0) || 1;
  // Límites acumulados (0…1) animados: la dona se forma y, al filtrar, sus límites se desplazan.
  const bounds = useMemo(() => {
    let acc = 0;
    return slices.map(s => (acc += s.value / sum));
  }, [slices, sum]);
  const anim = useTween(bounds, reduced, 800);

  const W = size, depth = Math.round(size * 0.1);
  const R = size * 0.46, r = R * 0.56;
  const cx = W / 2, cy = R * TILT + 6;
  const H = Math.ceil(cy + R * TILT + depth + 14);
  const pt = (rad: number, a: number, lift = 0): [number, number] => [cx + rad * Math.sin(a), cy - rad * Math.cos(a) * TILT + lift];
  const arc = (rad: number, a1: number, a2: number, lift = 0) => {
    const pts: [number, number][] = [];
    const n = Math.max(1, Math.ceil((a2 - a1) / STEP));
    for (let i = 0; i <= n; i++) pts.push(pt(rad, a1 + ((a2 - a1) * i) / n, lift));
    return pts;
  };
  const poly = (pts: [number, number][]) => 'M' + pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L') + ' Z';

  const segs = slices.map((s, i) => {
    const a1 = (i === 0 ? 0 : anim[i - 1]) * Math.PI * 2;
    const a2 = anim[i] * Math.PI * 2;
    const on = selected === s.key;
    const mid = (a1 + a2) / 2;
    // Separación al elegir: hacia fuera en su dirección y un poco hacia arriba.
    const dx = on ? Math.sin(mid) * 7 : 0, dy = on ? -Math.cos(mid) * 7 * TILT - 4 : 0;
    return { s, a1, a2, on, dx, dy };
  }).filter(x => x.a2 - x.a1 > 0.0005);

  // Rango visible de una pared: exterior = mitad delantera (π/2…3π/2); interior = mitad trasera.
  const clip = (a1: number, a2: number, lo: number, hi: number): [number, number] | null => {
    const s1 = Math.max(a1, lo), s2 = Math.min(a2, hi);
    return s2 > s1 ? [s1, s2] : null;
  };

  return (
    <View style={{ width: W, height: H }}>
      <Svg width={W} height={H}>
        <Defs>
          <RadialGradient id={`${gid}sh`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#1D3B26" stopOpacity={0.28} />
            <Stop offset="1" stopColor="#1D3B26" stopOpacity={0} />
          </RadialGradient>
          {slices.map(sl => (
            <React.Fragment key={sl.key}>
              <SvgLinear id={`${gid}t${sl.key}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={shade(sl.color, 0.28)} />
                <Stop offset="0.55" stopColor={sl.color} />
                <Stop offset="1" stopColor={shade(sl.color, -0.12)} />
              </SvgLinear>
              <SvgLinear id={`${gid}w${sl.key}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={shade(sl.color, -0.22)} />
                <Stop offset="1" stopColor={shade(sl.color, -0.45)} />
              </SvgLinear>
            </React.Fragment>
          ))}
          <SvgLinear id={`${gid}gl`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </SvgLinear>
        </Defs>

        {/* sombra proyectada */}
        <Ellipse cx={cx} cy={cy + depth + 6} rx={R * 1.06} ry={R * TILT * 1.0} fill={`url(#${gid}sh)`} />

        {/* paredes interiores (fondo del hueco) */}
        {segs.map(({ s, a1, a2, on, dx, dy }) => {
          const parts = [clip(a1, a2, 0, Math.PI / 2), clip(a1, a2, (3 * Math.PI) / 2, Math.PI * 2)].filter(Boolean) as [number, number][];
          return parts.map(([b1, b2], k) => (
            <Path key={`${s.key}i${k}`} transform={`translate(${dx} ${dy})`} opacity={selected && !on ? 0.6 : 1}
              d={poly([...arc(r, b1, b2), ...arc(r, b1, b2, depth).reverse()])} fill={shade(s.color, -0.5)} />
          ));
        })}

        {/* paredes exteriores (frente) */}
        {segs.map(({ s, a1, a2, on, dx, dy }) => {
          const c = clip(a1, a2, Math.PI / 2, (3 * Math.PI) / 2);
          if (!c) return null;
          return (
            <Path key={`${s.key}o`} transform={`translate(${dx} ${dy})`} opacity={selected && !on ? 0.6 : 1}
              d={poly([...arc(R, c[0], c[1]), ...arc(R, c[0], c[1], depth).reverse()])} fill={`url(#${gid}w${s.key})`} />
          );
        })}

        {/* caras superiores (tocables) */}
        {segs.map(({ s, a1, a2, on, dx, dy }) => (
          <G key={`${s.key}t`} transform={`translate(${dx} ${dy})`} opacity={selected && !on ? 0.6 : 1} onPress={() => onSelect(s.key)}>
            <Path d={poly([...arc(R, a1, a2), ...arc(r, a1, a2).reverse()])} fill={`url(#${gid}t${s.key})`}
              stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={1.2} strokeLinejoin="round" />
            {/* brillo en el borde exterior trasero */}
            <Path d={poly([...arc(R, a1, a2), ...arc(R * 0.9, a1, a2).reverse()])} fill={`url(#${gid}gl)`} opacity={0.5} />
          </G>
        ))}
      </Svg>
      {/* total en el centro del hueco */}
      <View pointerEvents="none" style={[st.center, { left: cx - r, top: cy - r * TILT - 2, width: r * 2, height: r * 2 * TILT + 8 }]}>
        <Text style={[st.total, { fontSize: Math.max(17, Math.min(24, size * 0.11)) }]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.1}>{total}</Text>
        <Text style={st.totalLabel} numberOfLines={1} maxFontSizeMultiplier={1.1}>{totalLabel}</Text>
      </View>
    </View>
  );
}

export default memo(Donut3D);

const st = StyleSheet.create({
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  total: { fontFamily: 'Poppins_700Bold', color: A.ink, letterSpacing: -0.5 },
  totalLabel: { fontFamily: 'Poppins_400Regular', fontSize: 10.5, color: A.muted, marginTop: -4 },
});
