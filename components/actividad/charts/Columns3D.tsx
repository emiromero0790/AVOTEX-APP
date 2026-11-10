/**
 * Columnas apiladas 3D (prismas con cara frontal, lateral y superior). Cada columna es un cultivo y cada
 * segmento su porcentaje real dentro de ese cultivo (la altura total es siempre 100 %; la perspectiva es
 * oblicua y no cambia las alturas). Los segmentos se separan con una línea blanca.
 *
 * Dos niveles:
 *  - General: Saludable / Revisar (confianza baja) / Con problema por cultivo.
 *  - Detalle (al tocar un cultivo): las clases que devolvió el modelo para ese cultivo.
 * Las alturas se animan (crecen al aparecer y se reacomodan al cambiar de vista o filtro).
 */
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, G, Line, LinearGradient as SvgLinear, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { A, shade, useSvgId, useTween } from './core';
import { FruitIcon } from './FruitBars';

export type ColSeg = { key: string; color: string; pct: number; label: string };
export type Column = { key: string; crop: string; label: string; n: number; segs: ColSeg[] };

function Columns3D({ columns, width, onPick, reduced, sampleLabel }: {
  columns: Column[]; width: number; onPick?: (crop: string) => void; reduced: boolean; sampleLabel: (n: number) => string;
}) {
  const gid = useSvgId('c3');
  // Una sola lista animada: alturas de todos los segmentos de todas las columnas.
  const flat = columns.flatMap(c => c.segs.map(s => s.pct));
  const anim = useTween(flat, reduced, 750);
  const axisW = 34, plotH = 150, top = 14, depthX = 11, depthY = 8;
  const plotW = width - axisW - 6;
  const n = Math.max(1, columns.length);
  const slot = plotW / n;
  const colW = Math.min(64, slot * (n === 1 ? 0.42 : 0.56));
  const y = (p: number) => top + plotH - (plotH * p) / 100;
  const H = top + plotH + 4;
  let k = 0;
  return (
    <View>
      <Svg width={width} height={H}>
        <Defs>
          {[...new Set(columns.flatMap(c => c.segs.map(sg => sg.color)))].map(color => (
            <SvgLinear key={color} id={`${gid}f${color.slice(1)}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={shade(color, -0.08)} />
              <Stop offset="0.45" stopColor={shade(color, 0.18)} />
              <Stop offset="1" stopColor={shade(color, -0.05)} />
            </SvgLinear>
          ))}
        </Defs>
        {/* ejes y guías */}
        {[0, 20, 40, 60, 80, 100].map(p => (
          <G key={p}>
            <Line x1={axisW} x2={width - 4} y1={y(p)} y2={y(p)} stroke="#E8EEE8" strokeWidth={1} strokeDasharray={p === 0 ? undefined : '3 4'} />
            <SvgText x={axisW - 6} y={y(p) + 3.5} fontSize={10} fill={A.muted} textAnchor="end" fontFamily="Poppins_400Regular">{`${p}%`}</SvgText>
          </G>
        ))}
        {columns.map((c, ci) => {
          const x = axisW + slot * ci + (slot - colW - depthX) / 2;
          let acc = 0;
          const segs = c.segs.map(sg => {
            const h = Math.max(0, anim[k++] ?? 0);
            const from = acc;
            acc += h;
            return { sg, from, to: acc };
          });
          const topPct = Math.min(100, acc);
          return (
            <G key={c.key} onPress={onPick ? () => onPick(c.crop) : undefined}>
              {/* sombra en el piso */}
              <Ellipse cx={x + colW / 2 + depthX / 2} cy={y(0) + 2} rx={colW * 0.62} ry={4} fill="#1D3B26" opacity={0.14} />
              {segs.map(({ sg, from, to }, si) => {
                if (to - from < 0.05) return null;
                const y1 = y(to), y2 = y(from), hh = y2 - y1;
                const last = si === segs.length - 1 || segs.slice(si + 1).every(s2 => s2.to - s2.from < 0.05);
                return (
                  <G key={sg.key}>
                    {/* cara lateral */}
                    <Path d={`M${x + colW} ${y1} L${x + colW + depthX} ${y1 - depthY} L${x + colW + depthX} ${y2 - depthY} L${x + colW} ${y2} Z`} fill={shade(sg.color, -0.32)} />
                    {/* cara frontal */}
                    <Rect x={x} y={y1} width={colW} height={hh} fill={`url(#${gid}f${sg.color.slice(1)})`} />
                    {/* separación entre segmentos */}
                    {si > 0 && <Line x1={x} x2={x + colW} y1={y2} y2={y2} stroke="#FFFFFF" strokeWidth={1.4} />}
                    {/* cara superior del último segmento */}
                    {last && <Path d={`M${x} ${y1} L${x + depthX} ${y1 - depthY} L${x + colW + depthX} ${y1 - depthY} L${x + colW} ${y1} Z`} fill={shade(sg.color, 0.3)} />}
                    {hh >= 15 && (
                      <SvgText x={x + colW / 2} y={y1 + hh / 2 + 4} fontSize={11} fontWeight="700" fill="#FFFFFF" textAnchor="middle" fontFamily="Poppins_600SemiBold">
                        {`${Math.round(to - from)}%`}
                      </SvgText>
                    )}
                  </G>
                );
              })}
              {topPct < 0.05 && <Rect x={x} y={y(0) - 2} width={colW} height={2} fill="#E2E8E3" />}
            </G>
          );
        })}
      </Svg>
      {/* etiquetas de cultivo (tocables) */}
      <View style={[st.labels, { paddingLeft: axisW }]}>
        {columns.map(c => (
          <Pressable key={c.key} disabled={!onPick} onPress={() => onPick?.(c.crop)} accessibilityRole="button"
            accessibilityLabel={`${c.label}. ${c.segs.map(s => `${s.label} ${Math.round(s.pct)} %`).join(', ')}`}
            style={[st.label, { width: slot }]}>
            <View style={st.labelRow}>
              {slot >= 84 && <FruitIcon crop={c.crop} size={18} />}
              <Text style={st.labelText} numberOfLines={1} maxFontSizeMultiplier={1.15}>{c.label}</Text>
            </View>
            <Text style={st.sample} numberOfLines={1}>{sampleLabel(c.n)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default memo(Columns3D);

const st = StyleSheet.create({
  labels: { flexDirection: 'row', marginTop: 2 },
  label: { alignItems: 'center', paddingHorizontal: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  labelText: { flexShrink: 1, fontFamily: 'Poppins_600SemiBold', fontSize: 11.5, color: A.ink, textAlign: 'center' },
  sample: { fontFamily: 'Poppins_400Regular', fontSize: 10, color: A.muted, marginTop: -2 },
});
