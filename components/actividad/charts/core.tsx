/**
 * Base de las gráficas de Actividad → Resumen.
 *
 * - useTween: anima una lista de números desde lo que se ve ahora hacia los valores nuevos (600 ms, salida
 *   fuerte). Al montar parte de 0 (las barras crecen, la dona se forma); al cambiar un filtro va del valor
 *   anterior al nuevo, sin saltos. Con «Reducir movimiento» cambia de inmediato. Solo vuelve a dibujar la
 *   gráfica que lo usa, y se detiene al terminar (nada se anima en bucle).
 * - Colores, sombreado de caras laterales y tarjeta con hojas decorativas.
 */
import React, { useEffect, useId, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, G, LinearGradient as SvgLinear, Path, Stop } from 'react-native-svg';
import { ChevronRight } from 'lucide-react-native';

/** Id único para gradientes SVG (en web, ids repetidos entre gráficas se pisan). */
export function useSvgId(prefix: string): string {
  return prefix + useId().replace(/[^a-zA-Z0-9]/g, '');
}

export const EASE = (t: number) => 1 - Math.pow(1 - t, 3);

export function useTween(targets: number[], reduced: boolean, duration = 650, delay = 0): number[] {
  const [vals, setVals] = useState<number[]>(() => (reduced ? targets : targets.map(() => 0)));
  const shown = useRef<number[]>(vals);
  const key = targets.map(v => Math.round(v * 1000)).join(',');
  useEffect(() => {
    if (reduced) { shown.current = targets; setVals(targets); return; }
    const from = targets.map((_, i) => shown.current[i] ?? 0);
    const start = Date.now() + delay;
    let raf = 0;
    const step = () => {
      const t = Math.min(1, Math.max(0, (Date.now() - start) / duration));
      const e = EASE(t);
      const next = targets.map((v, i) => from[i] + (v - from[i]) * e);
      shown.current = next;
      setVals(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduced]);
  return vals.length === targets.length ? vals : targets.map((_, i) => vals[i] ?? 0);
}

/** Aclara (+) u oscurece (−) un color #RRGGBB. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export const A = {
  ink: '#10231A',
  inkSoft: '#3B4A42',
  muted: '#6B7A72',
  line: '#E9EFE9',
  green: '#1E9E46',
  greenDark: '#11632C',
  lime: '#8CCB2E',
  teal: '#14B8A6',
  yellow: '#F2C230',
  orange: '#F28C28',
  coral: '#EF5A4C',
  gray: '#B7C2BC',
  slate: '#94A3B8',
} as const;

/** Paleta agrícola para segmentos (verde → lima → amarillo → naranja → coral). */
export const SLICE_COLORS = ['#22A447', '#8CCB2E', '#F2C230', '#F28C28', '#EF5A4C'] as const;
/** Estados: saludable, revisar (confianza baja), con problema. */
export const CAT_COLORS = { sano: '#2BA84A', revisar: '#F2B630', enfermo: '#EF5A4C' } as const;
/** Clases de problema en el detalle por cultivo. */
export const PROBLEM_COLORS = ['#EF5A4C', '#F28C28', '#C2410C', '#D9467A', '#8B5CF6', '#A16207'] as const;

// ───────── Hojas decorativas ─────────

type Corner = 'tr' | 'tl' | 'br' | 'bl';
export type BotanicalProps = {
  variant?: 'leaf' | 'sprig' | 'fern';
  corner?: Corner;
  size?: number;
  opacity?: number;
  color?: string;
  rotate?: number;
};

/**
 * Hojas semitransparentes para las esquinas de las tarjetas (SVG original, nítido a cualquier escala).
 * No reciben toques (pointerEvents="none") y quedan detrás del contenido.
 */
export function BotanicalCardDecoration({ variant = 'leaf', corner = 'tr', size = 90, opacity = 0.5, color = '#5DB84A', rotate = 0 }: BotanicalProps) {
  const pos: ViewStyle = {
    position: 'absolute', width: size, height: size,
    ...(corner.includes('t') ? { top: -size * 0.22 } : { bottom: -size * 0.24 }),
    ...(corner.includes('r') ? { right: -size * 0.18 } : { left: -size * 0.2 }),
    opacity, transform: [{ rotate: `${rotate + (corner === 'tl' ? -70 : corner === 'bl' ? 200 : corner === 'br' ? 120 : 0)}deg` }],
  };
  const dark = shade(color, -0.35), light = shade(color, 0.35);
  const gid = useSvgId('bot');
  return (
    <View pointerEvents="none" style={pos}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <SvgLinear id={gid} x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={dark} />
            <Stop offset="0.6" stopColor={color} />
            <Stop offset="1" stopColor={light} />
          </SvgLinear>
        </Defs>
        {variant === 'leaf' && (
          <G>
            <Path d="M14 88 C 18 52, 42 22, 92 10 C 86 52, 60 80, 14 88 Z" fill={`url(#${gid})`} />
            <Path d="M14 88 C 40 62, 64 38, 92 10" stroke={light} strokeOpacity={0.8} strokeWidth={1.6} fill="none" />
            {[0.3, 0.5, 0.7].map(t => {
              const x = 14 + 78 * t, y = 88 - 78 * t;
              return <Path key={t} d={`M${x} ${y} q -4 -10 -2 -18 M${x} ${y} q 10 2 16 -2`} stroke={light} strokeOpacity={0.55} strokeWidth={1} fill="none" />;
            })}
          </G>
        )}
        {variant === 'sprig' && (
          <G>
            <Path d="M10 92 C 30 70, 50 50, 78 22" stroke={dark} strokeWidth={2} fill="none" />
            <Path d="M40 62 C 30 44, 36 30, 52 22 C 56 40, 52 52, 40 62 Z" fill={`url(#${gid})`} />
            <Path d="M56 46 C 66 30, 80 26, 94 30 C 86 44, 72 50, 56 46 Z" fill={`url(#${gid})`} />
            <Path d="M26 76 C 12 66, 8 54, 12 40 C 26 48, 30 62, 26 76 Z" fill={`url(#${gid})`} />
            <Path d="M70 30 C 70 16, 78 8, 90 4 C 92 16, 84 26, 70 30 Z" fill={`url(#${gid})`} />
          </G>
        )}
        {variant === 'fern' && (
          <G>
            <Path d="M50 98 C 50 70, 52 40, 60 4" stroke={dark} strokeWidth={1.6} fill="none" />
            {Array.from({ length: 7 }, (_, i) => {
              const y = 88 - i * 12, x = 50 + i * 1.3, w = 26 - i * 3;
              return (
                <G key={i}>
                  <Path d={`M${x} ${y} C ${x - w * 0.5} ${y - 4}, ${x - w} ${y - 2}, ${x - w} ${y + 3} C ${x - w * 0.6} ${y + 5}, ${x - w * 0.2} ${y + 3}, ${x} ${y} Z`} fill={`url(#${gid})`} />
                  <Path d={`M${x} ${y} C ${x + w * 0.5} ${y - 4}, ${x + w} ${y - 2}, ${x + w} ${y + 3} C ${x + w * 0.6} ${y + 5}, ${x + w * 0.2} ${y + 3}, ${x} ${y} Z`} fill={`url(#${gid})`} />
                </G>
              );
            })}
          </G>
        )}
      </Svg>
    </View>
  );
}

// ───────── Tarjeta ─────────

export function ChartCard({ icon, title, subtitle, onMore, moreLabel, decorations, children, style, tint }: {
  icon: React.ReactNode; title: string; subtitle?: string; onMore?: () => void; moreLabel?: string;
  decorations?: BotanicalProps[]; children: React.ReactNode; style?: StyleProp<ViewStyle>; tint?: string;
}) {
  return (
    <View style={[s.card, tint ? { backgroundColor: tint } : null, style]}>
      <View style={s.clip} pointerEvents="none">
        {decorations?.map((d, i) => <BotanicalCardDecoration key={i} {...d} />)}
      </View>
      <View style={s.head}>
        <View style={s.headIcon}>{icon}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title} numberOfLines={2} accessibilityRole="header" maxFontSizeMultiplier={1.25}>{title}</Text>
          {subtitle ? <Text style={s.subtitle} numberOfLines={2} maxFontSizeMultiplier={1.25}>{subtitle}</Text> : null}
        </View>
        {onMore && (
          <Pressable onPress={onMore} hitSlop={10} accessibilityRole="button" accessibilityLabel={moreLabel ?? title}
            style={({ pressed }) => [s.more, pressed && { transform: [{ scale: 0.94 }] }]}>
            <ChevronRight size={18} color={A.green} />
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

export function EmptyChart({ text }: { text: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyText} maxFontSizeMultiplier={1.3}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14,
    borderWidth: 1, borderColor: '#EEF2EC',
    shadowColor: '#2F4A35', shadowOpacity: 0.09, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  clip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  headIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF8EA' },
  title: { fontFamily: 'Poppins_600SemiBold', fontSize: 17.5, lineHeight: 23, color: A.ink, letterSpacing: -0.2 },
  subtitle: { fontFamily: 'Poppins_400Regular', fontSize: 11.5, lineHeight: 15, color: A.muted },
  more: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F8EF' },
  empty: { minHeight: 90, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 16 },
  emptyText: { fontFamily: 'Poppins_400Regular', fontSize: 13, lineHeight: 19, color: A.muted, textAlign: 'center' },
});
