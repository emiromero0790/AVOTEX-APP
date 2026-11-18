/**
 * Mapa de zonas de una huerta (A–D, mismos colores que Satélite) dibujado en SVG.
 * - Al clasificar una grabación: zona grande, se toca o se suelta una foto encima (hover en el hilo de UI).
 * - En el detalle de un hallazgo o de una grabación: zona resaltada y las demás atenuadas.
 */
import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import Reanimated, { type SharedValue, useAnimatedProps } from 'react-native-reanimated';
import type { LatLng, ZoneId } from '../../services/satZones';
import { ZONE_UI, type ZonaSnapshot } from '../../services/grabacion';

export type ProjectedZone = { id: ZoneId; pts: [number, number][]; d: string; label: [number, number] };

/** Proyecta las zonas a un recuadro w×h (corrige la longitud por la latitud, conserva proporción). */
export function projectZones(zonas: ZonaSnapshot[], outline: LatLng[] | null, w: number, h: number, pad = 14) {
  const all = [...zonas.flatMap(z => z.ring), ...(outline ?? [])];
  if (!all.length || w <= 0 || h <= 0) return { zones: [] as ProjectedZone[], outline: '' };
  const minLat = Math.min(...all.map(p => p.lat)), maxLat = Math.max(...all.map(p => p.lat));
  const minLng = Math.min(...all.map(p => p.lng)), maxLng = Math.max(...all.map(p => p.lng));
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const sw = Math.max(1e-9, (maxLng - minLng) * k), sh = Math.max(1e-9, maxLat - minLat);
  const s = Math.min((w - 2 * pad) / sw, (h - 2 * pad) / sh);
  const ox = (w - sw * s) / 2, oy = (h - sh * s) / 2;
  const pr = (p: LatLng): [number, number] => [ox + (p.lng - minLng) * k * s, oy + (maxLat - p.lat) * s];
  const path = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z';
  return {
    zones: zonas.map(z => { const pts = z.ring.map(pr); return { id: z.id, pts, d: path(pts), label: pr(z.label) }; }),
    outline: outline && outline.length >= 3 ? path(outline.map(pr)) : '',
  };
}

/** Punto dentro de polígono (también en el hilo de UI). */
export function pointInPolygon(x: number, y: number, pts: [number, number][]): boolean {
  'worklet';
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}

const AnimatedPath = Reanimated.createAnimatedComponent(Path);

const ZonePath = memo(function ZonePath({ z, index, color, line, base, hover, onPress }: {
  z: ProjectedZone; index: number; color: string; line: string; base: number; hover?: SharedValue<number>; onPress?: () => void;
}) {
  const animatedProps = useAnimatedProps(() => {
    const on = hover ? hover.get() === index : false;
    return { fillOpacity: on ? Math.min(0.9, base + 0.4) : base, strokeWidth: on ? 4 : 2 };
  });
  return <AnimatedPath d={z.d} fill={color} stroke={line} strokeLinejoin="round" animatedProps={animatedProps} onPress={onPress} />;
});

type Props = {
  zonas: ZonaSnapshot[];
  outline?: LatLng[] | null;
  width: number;
  height: number;
  /** Zona resaltada (las demás se atenúan). */
  highlight?: ZoneId | null;
  /** Número a mostrar junto a cada letra (fotos asignadas, hallazgos…). */
  counts?: Partial<Record<ZoneId, number>>;
  /** Índice de la zona bajo el dedo mientras se arrastra (-1 = ninguna). */
  hover?: SharedValue<number>;
  onZonePress?: (id: ZoneId) => void;
  compact?: boolean;
};

export default function ZoneBoard({ zonas, outline = null, width, height, highlight = null, counts, hover, onZonePress, compact }: Props) {
  const proj = useMemo(() => projectZones(zonas, outline, width, height, compact ? 8 : 14), [zonas, outline, width, height, compact]);
  const r = compact ? 10 : 15;
  return (
    <View style={[st.wrap, { width, height }]}>
      <Svg width={width} height={height}>
        <Rect x={0} y={0} width={width} height={height} rx={compact ? 12 : 18} fill="#EAF3E6" />
        {proj.outline ? <Path d={proj.outline} fill="#CFE3C4" stroke="#7FA36B" strokeWidth={1} /> : null}
        {proj.zones.map((z, i) => {
          const zona = zonas.find(x => x.id === z.id)!;
          const ui = ZONE_UI[zona.color];
          const dim = highlight && highlight !== z.id;
          return (
            <ZonePath key={z.id} z={z} index={i} color={ui.fill} line={ui.line} base={dim ? 0.12 : highlight ? 0.78 : 0.42}
              hover={hover} onPress={onZonePress ? () => onZonePress(z.id) : undefined} />
          );
        })}
        {width >= 90 && proj.zones.map(z => {
          const zona = zonas.find(x => x.id === z.id)!;
          const ui = ZONE_UI[zona.color];
          const dim = highlight && highlight !== z.id;
          const n = counts?.[z.id];
          return (
            <G key={`l${z.id}`} opacity={dim ? 0.45 : 1} onPress={onZonePress ? () => onZonePress(z.id) : undefined}>
              <Circle cx={z.label[0]} cy={z.label[1]} r={r} fill="#FFFFFF" stroke={ui.line} strokeWidth={2} />
              <SvgText x={z.label[0]} y={z.label[1] + (compact ? 3.5 : 5)} fontSize={compact ? 10 : 14} fontWeight="700" fontFamily="Poppins_700Bold" fill={ui.ink} textAnchor="middle">{z.id}</SvgText>
              {n !== undefined && !compact && (
                <G>
                  <Rect x={z.label[0] + r - 4} y={z.label[1] - r - 8} width={n > 9 ? 26 : 20} height={18} rx={9} fill={ui.line} />
                  <SvgText x={z.label[0] + r - 4 + (n > 9 ? 13 : 10)} y={z.label[1] - r + 5} fontSize={11} fontWeight="700" fontFamily="Poppins_700Bold" fill="#FFFFFF" textAnchor="middle">{String(n)}</SvgText>
                </G>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const st = StyleSheet.create({ wrap: { borderRadius: 18, overflow: 'hidden' } });
