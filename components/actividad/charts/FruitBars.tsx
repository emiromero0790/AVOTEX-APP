/**
 * Frutas más analizadas: barras horizontales con volumen (degradado, reflejo superior y sombra inferior).
 * Cada barra mide exactamente su porcentaje del total; crece al aparecer y se desplaza al filtrar.
 * Tocar una fila elige ese cultivo como filtro de todas las gráficas (otro toque lo quita) y muestra la
 * cantidad exacta.
 */
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgLinear, Path, Rect, Stop } from 'react-native-svg';
import { A, useSvgId, useTween } from './core';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Ilustración vectorial pequeña del fruto (sin emojis). */
export function FruitIcon({ crop, size = 28 }: { crop: string; size?: number }) {
  const k = norm(crop);
  const gid = useSvgId('fi');
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        <SvgLinear id={gid} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
        </SvgLinear>
      </Defs>
      <Ellipse cx={16} cy={29} rx={9} ry={2} fill="#000" opacity={0.1} />
      {k.startsWith('aguacate') ? (
        <G transform="rotate(-25 16 16)">
          <Path d="M16 3 C 11 3, 9 9, 8 14 C 6 20, 8 28, 16 28 C 24 28, 26 20, 24 14 C 23 9, 21 3, 16 3 Z" fill="#3E7B1F" />
          <Path d="M16 6 C 12.5 6, 11.5 10.5, 10.6 14.5 C 9.3 19.5, 11 25.5, 16 25.5 C 21 25.5, 22.7 19.5, 21.4 14.5 C 20.5 10.5, 19.5 6, 16 6 Z" fill="#C9E27A" />
          <Circle cx={16} cy={18.5} r={4.3} fill="#8A5A2B" />
          <Circle cx={15} cy={17.4} r={1.3} fill="#B98250" />
        </G>
      ) : k.startsWith('limon') || k.startsWith('lima') ? (
        <G>
          <Path d="M4 16 C 4 10, 10 6, 16 6 C 22 6, 28 10, 28 16 C 28 22, 22 26, 16 26 C 10 26, 4 22, 4 16 Z" fill="#F6D33C" transform="rotate(-20 16 16)" />
          <Path d="M2.5 18 L5 16 L4.5 19 Z M29.5 14 L27 16 L27.5 13 Z" fill="#E1B714" />
          <Path d="M8 13 C 10 10, 13 9, 16 9" stroke="#FFF6C2" strokeWidth={1.6} strokeLinecap="round" fill="none" />
        </G>
      ) : k.startsWith('granada') ? (
        <G>
          <Circle cx={16} cy={18} r={10} fill="#C81E3A" />
          <Path d="M12.5 8.5 L14 5 L16 7.5 L18 5 L19.5 8.5 Z" fill="#9F1239" />
          <Circle cx={12} cy={15} r={2.6} fill="#F87171" opacity={0.7} />
        </G>
      ) : k.startsWith('cafe') ? (
        <G>
          <Ellipse cx={11.5} cy={17} rx={6} ry={8} fill="#6B3E1F" transform="rotate(-20 11.5 17)" />
          <Path d="M9 10.5 C 12 14, 12 19, 13.5 23.5" stroke="#3B200D" strokeWidth={1.4} fill="none" />
          <Ellipse cx={21} cy={16} rx={6} ry={8} fill="#7C4A26" transform="rotate(20 21 16)" />
          <Path d="M23 9.5 C 20 13, 20.5 18, 19.5 22.5" stroke="#3B200D" strokeWidth={1.4} fill="none" />
        </G>
      ) : k.startsWith('mango') ? (
        <G>
          <Path d="M7 18 C 6 10, 13 5, 20 7 C 27 9, 28 18, 23 24 C 18 29, 8 26, 7 18 Z" fill="#F59E0B" />
          <Path d="M20 7 C 24 10, 26 15, 24 20 C 22 24, 18 26, 14 26 C 20 22, 22 15, 20 7 Z" fill="#EF6C1A" opacity={0.75} />
          <Path d="M19 7 C 20 4, 23 3, 25 4" stroke="#3F7D20" strokeWidth={1.8} strokeLinecap="round" fill="none" />
        </G>
      ) : (
        <G>
          <Circle cx={16} cy={17} r={10} fill="#7CC04B" />
          <Path d="M16 7 C 18 4, 21 3, 24 4 C 22 7, 19 8, 16 7 Z" fill="#3F8E2A" />
        </G>
      )}
      <Circle cx={12} cy={12} r={9} fill={`url(#${gid})`} />
    </Svg>
  );
}

export type FruitRow = { crop: string; label: string; count: number; pct: number };

const GREENS = [['#16833A', '#43C25B'], ['#239647', '#5FCC69'], ['#3BA84F', '#7BD57B'], ['#5DB863', '#98DE93'], ['#7EC67D', '#B3E6AC']] as const;

function FruitBars({ rows, width, selected, onSelect, reduced, countLabel }: {
  rows: FruitRow[]; width: number; selected: string | null; onSelect: (crop: string) => void; reduced: boolean;
  countLabel: (n: number) => string;
}) {
  const gid = useSvgId('fb');
  const vals = useTween(rows.map(r => r.pct), reduced, 700);
  const nameW = Math.min(92, Math.max(74, width * 0.24));
  const barW = Math.max(80, width - 34 - nameW - 52);
  const H = 22;
  return (
    <View style={{ gap: 6 }} accessibilityRole="radiogroup">
      {rows.map((row, i) => {
        const on = selected === row.crop;
        // Largo exacto del porcentaje (sin mínimo que exagere los valores pequeños).
        const w = (barW * Math.max(0, vals[i] ?? 0)) / 100;
        const rr = Math.min(H / 2, w / 2);
        const [c1, c2] = GREENS[Math.min(i, GREENS.length - 1)];
        return (
          <Pressable key={row.crop} onPress={() => onSelect(row.crop)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            accessibilityLabel={`${row.label}: ${Math.round(row.pct)} %, ${countLabel(row.count)}`}
            style={({ pressed }) => [st.row, on && st.rowOn, pressed && { opacity: 0.85 }]}>
            <FruitIcon crop={row.crop} size={28} />
            <View style={{ width: nameW }}>
              <Text style={st.name} numberOfLines={1} maxFontSizeMultiplier={1.2}>{row.label}</Text>
              {on && <Text style={st.count} numberOfLines={1}>{countLabel(row.count)}</Text>}
            </View>
            <Svg width={barW} height={H + 8}>
              <Defs>
                <SvgLinear id={`${gid}f${i}`} x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={c1} />
                  <Stop offset="1" stopColor={c2} />
                </SvgLinear>
                <SvgLinear id={`${gid}h`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.6} />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                </SvgLinear>
                <SvgLinear id={`${gid}t`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#E3E9E4" />
                  <Stop offset="1" stopColor="#F4F7F4" />
                </SvgLinear>
              </Defs>
              {/* canal */}
              <Rect x={0} y={2} width={barW} height={H} rx={H / 2} fill={`url(#${gid}t)`} />
              {/* sombra bajo la barra */}
              <Ellipse cx={w / 2} cy={H + 4} rx={w / 2} ry={3} fill={c1} opacity={0.18} />
              {/* cuerpo, base más oscura (volumen) y reflejo */}
              <Rect x={0} y={2} width={w} height={H} rx={rr} fill={`url(#${gid}f${i})`} />
              <Rect x={0} y={2 + H * 0.55} width={w} height={H * 0.45} rx={Math.min(H * 0.22, w / 2)} fill="#0B3D1C" opacity={0.16} />
              {w > 12 && <Rect x={4} y={4} width={w - 8} height={H * 0.38} rx={H * 0.19} fill={`url(#${gid}h)`} />}
            </Svg>
            <Text style={st.pct} maxFontSizeMultiplier={1.2}>{Math.round(vals[i] ?? 0)}%</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default memo(FruitBars);

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3, paddingHorizontal: 4, borderRadius: 14 },
  rowOn: { backgroundColor: '#EEF8EA' },
  name: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: A.ink },
  count: { fontFamily: 'Poppins_400Regular', fontSize: 10.5, color: A.muted, marginTop: -3 },
  pct: { width: 44, textAlign: 'right', fontFamily: 'Poppins_700Bold', fontSize: 14, color: A.ink, fontVariant: ['tabular-nums'] },
});
