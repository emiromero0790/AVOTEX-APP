/**
 * Panel flotante de capas (lo más parecido posible al panel lateral de la referencia).
 * Las ilustraciones se generan con SVG a partir de la geometría real de la huerta:
 * - Zonas: las zonas ilustrativas como bloques 3D sobre una rejilla isométrica.
 * - Contorno: la silueta real de la huerta con textura sobre una rejilla (textura ilustrativa, no NDVI).
 * - Relieve: imagen fija ilustrativa de la capa de sombreado de relieve (vista Híbrido).
 * Cada sección cambia la capa del mapa; no son adornos.
 */
import React, { memo, useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Line, LinearGradient as SvgGradient, Path, Polygon, Polyline, Rect, Stop } from 'react-native-svg';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react-native';
import type { LatLng, Zone } from '../../services/satZones';
import type { SatLayer } from '../satMapHtml';

type XY = { x: number; y: number };
type Size = { w: number; h: number };

/** Colores sólidos de los bloques (como la referencia): cara superior y cara lateral. */
const SLAB: Record<string, { top: string; side: string; edge: string }> = {
  cyan: { top: '#3EE6F0', side: '#17A9B8', edge: '#A5F6FA' },
  yellow: { top: '#F6F05A', side: '#C8B523', edge: '#FDFBB0' },
  pink: { top: '#F77FC4', side: '#C24C90', edge: '#FCC7E5' },
  green: { top: '#9BEA62', side: '#5DAE2E', edge: '#D3F9B6' },
};

function normalizer(outline: LatLng[]) {
  const lat0 = outline.reduce((s, p) => s + p.lat, 0) / Math.max(1, outline.length);
  const k = Math.cos((lat0 * Math.PI) / 180);
  const pts = outline.map(p => ({ x: p.lng * k, y: p.lat }));
  const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
  const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  return {
    n: (p: LatLng): XY => ({ x: (p.lng * k - minX) / span, y: (maxY - p.lat) / span }),
    w: (maxX - minX) / span,
    h: (maxY - minY) / span,
  };
}

// Vista isométrica: x hacia la derecha-abajo, y hacia la izquierda-abajo, h hacia arriba.
const iso = (p: XY, h = 0): XY => ({ x: (p.x - p.y) * 0.866, y: (p.x + p.y) * 0.5 - h });

function fitter(points: XY[], w: number, h: number, pad: number) {
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
  const s = Math.min((w - pad * 2) / (maxX - minX || 1), (h - pad * 2) / (maxY - minY || 1));
  const ox = (w - (maxX - minX) * s) / 2, oy = (h - (maxY - minY) * s) / 2;
  const f = (p: XY): XY => ({ x: ox + (p.x - minX) * s, y: oy + (p.y - minY) * s });
  return { f, str: (pts: XY[]) => pts.map(p => { const q = f(p); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(' ') };
}

// Ruido de valor determinista (para texturas estables por huerta).
function noise2(seed: number) {
  const r = (x: number, y: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    const a = r(xi, yi), b = r(xi + 1, yi), c = r(xi, yi + 1), d = r(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

function heat(t: number): string {
  // verde → amarillo → naranja → rojo
  const stops = [[34, 197, 94], [163, 230, 53], [250, 204, 21], [249, 115, 22], [239, 68, 68]];
  const x = Math.max(0, Math.min(0.999, t)) * (stops.length - 1);
  const i = Math.floor(x), f = x - i;
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** 1) Bloques 3D de las zonas sobre una rejilla. */
const ZoneBlocks = memo(function ZoneBlocks({ outline, zones, w, h }: { outline: LatLng[]; zones: Zone[] } & Size) {
  const scene = useMemo(() => {
    if (outline.length < 3 || zones.length === 0) return null;
    const { n } = normalizer(outline);
    const T = 0.1; // grosor de los bloques
    const center = outline.map(n).reduce((a, p) => ({ x: a.x + p.x / outline.length, y: a.y + p.y / outline.length }), { x: 0, y: 0 });
    const blocks = zones.map((z, i) => {
      const pts = z.ring.map(n);
      const c = pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });
      // Separación hacia afuera, como piezas de un rompecabezas despiezado.
      const dx = (c.x - center.x) * 0.22, dy = (c.y - center.y) * 0.22;
      const lift = 0.05 + (i % 2) * 0.05;
      const moved = pts.map(p => ({ x: p.x + dx, y: p.y + dy }));
      return { z, moved, lift, depth: c.x + dx + c.y + dy };
    }).sort((a, b) => a.depth - b.depth);
    // Plano base (un poco más grande que la huerta) con rejilla.
    const all = outline.map(n);
    const minX = Math.min(...all.map(p => p.x)) - 0.18, maxX = Math.max(...all.map(p => p.x)) + 0.18;
    const minY = Math.min(...all.map(p => p.y)) - 0.18, maxY = Math.max(...all.map(p => p.y)) + 0.18;
    const plane = [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }];
    const projected = [...plane.map(p => iso(p)), ...blocks.flatMap(b => b.moved.map(p => iso(p, b.lift + T)))];
    const fit = fitter(projected, w, h, 3);
    const grid: string[] = [];
    for (let k = 1; k < 6; k++) {
      const gx = minX + ((maxX - minX) * k) / 6, gy = minY + ((maxY - minY) * k) / 6;
      grid.push(fit.str([iso({ x: gx, y: minY }), iso({ x: gx, y: maxY })]));
      grid.push(fit.str([iso({ x: minX, y: gy }), iso({ x: maxX, y: gy })]));
    }
    return {
      plane: fit.str(plane.map(p => iso(p))),
      grid,
      blocks: blocks.map(b => {
        const top = b.moved.map(p => iso(p, b.lift + T));
        const bottom = b.moved.map(p => iso(p, b.lift));
        // Caras laterales ordenadas de atrás hacia adelante.
        const sides = b.moved.map((p, i) => {
          const q = b.moved[(i + 1) % b.moved.length];
          return { pts: [top[i], top[(i + 1) % top.length], bottom[(i + 1) % bottom.length], bottom[i]], depth: p.x + p.y + q.x + q.y };
        }).sort((u, v) => u.depth - v.depth);
        return {
          id: b.z.id,
          color: SLAB[b.z.color],
          shadow: fit.str(b.moved.map(p => iso({ x: p.x + 0.03, y: p.y + 0.03 }))),
          sides: sides.map(sd => fit.str(sd.pts)),
          top: fit.str(top),
        };
      }),
    };
  }, [outline, zones, w, h]);
  if (!scene) return <View style={{ width: w, height: h }} />;
  return (
    <Svg width={w} height={h}>
      <Polygon points={scene.plane} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.45)" strokeWidth={0.8} />
      {scene.grid.map((g, i) => <Polyline key={i} points={g} stroke="rgba(255,255,255,0.12)" strokeWidth={0.6} fill="none" />)}
      {scene.blocks.map(b => <Polygon key={`s${b.id}`} points={b.shadow} fill="rgba(0,0,0,0.45)" />)}
      {scene.blocks.map(b => (
        <G key={b.id}>
          {b.sides.map((sd, i) => <Polygon key={i} points={sd} fill={b.color.side} stroke={b.color.side} strokeWidth={0.4} strokeLinejoin="round" />)}
          <Polygon points={b.top} fill={b.color.top} stroke={b.color.edge} strokeWidth={0.6} strokeLinejoin="round" />
        </G>
      ))}
    </Svg>
  );
});

/** 2) Silueta real con textura sobre una rejilla, con su barra de color. */
const TexturedOutline = memo(function TexturedOutline({ outline, seed, w, h, clipId }: { outline: LatLng[]; seed: number; clipId: string } & Size) {
  const scene = useMemo(() => {
    if (outline.length < 3) return null;
    const { n } = normalizer(outline);
    const pts = outline.map(n);
    const fit = fitter(pts, w, h, 12);
    const P = pts.map(fit.f);
    const minX = Math.min(...P.map(p => p.x)), maxX = Math.max(...P.map(p => p.x));
    const minY = Math.min(...P.map(p => p.y)), maxY = Math.max(...P.map(p => p.y));
    const nz = noise2(seed);
    const cell = 2.6;
    const cells: { x: number; y: number; c: string }[] = [];
    for (let y = minY; y < maxY; y += cell) {
      for (let x = minX; x < maxX; x += cell) {
        const v = nz(x / 9, y / 9) * 0.65 + nz(x / 3.5 + 40, y / 3.5) * 0.35;
        cells.push({ x, y, c: heat(Math.pow(v, 1.6) * 0.95) });
      }
    }
    return {
      path: `M ${P.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')} Z`,
      shadow: P.map(p => `${(p.x - 5).toFixed(1)},${(p.y + 4).toFixed(1)}`).join(' '),
      frame: { x: minX - 7, y: minY - 4, w: maxX - minX + 10, h: maxY - minY + 10 },
      cells,
      cell,
    };
  }, [outline, seed, w, h]);
  const grid = [];
  for (let x = 4; x < w; x += 13) grid.push(<Line key={`x${x}`} x1={x} y1={0} x2={x} y2={h} stroke="rgba(255,255,255,0.1)" strokeWidth={0.6} />);
  for (let y = 4; y < h; y += 13) grid.push(<Line key={`y${y}`} x1={0} y1={y} x2={w} y2={y} stroke="rgba(255,255,255,0.1)" strokeWidth={0.6} />);
  return (
    <Svg width={w} height={h}>
      {grid}
      {scene && (
        <>
          <Defs>
            <ClipPath id={clipId}><Path d={scene.path} /></ClipPath>
          </Defs>
          <Rect x={scene.frame.x} y={scene.frame.y} width={scene.frame.w} height={scene.frame.h} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={0.8} />
          <Polygon points={scene.shadow} fill="rgba(255,255,255,0.12)" />
          <G clipPath={`url(#${clipId})`}>
            {scene.cells.map((c, i) => <Rect key={i} x={c.x} y={c.y} width={scene.cell + 0.4} height={scene.cell + 0.4} fill={c.c} />)}
          </G>
          <Path d={scene.path} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={0.7} />
        </>
      )}
    </Svg>
  );
});

function HeatBar({ w, id }: { w: number; id: string }) {
  return (
    <Svg width={w} height={6}>
      <Defs>
        <SvgGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#22C55E" />
          <Stop offset="0.45" stopColor="#FACC15" />
          <Stop offset="0.75" stopColor="#F97316" />
          <Stop offset="1" stopColor="#EF4444" />
        </SvgGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={6} rx={3} fill={`url(#${id})`} />
    </Svg>
  );
}

/** 3) Relieve: imagen fija (assets/images/satelite/relieve.jpg). */
const RELIEF = require('../../assets/images/satelite/relieve.jpg');

type Props = {
  open: boolean;
  onToggle: () => void;
  layer: SatLayer;
  onLayer: (l: SatLayer) => void;
  outline: LatLng[];
  zones: Zone[];
  seed: number;
  reduced: boolean;
  /** Ancho del panel (teléfono más angosto que tableta). */
  width: number;
  labels: { zones: string; outline: string; relief: string; texture: string; hide: string; show: string };
};

export default function LayerPanel({ open, onToggle, layer, onLayer, outline, zones, seed, reduced, width, labels }: Props) {
  if (!open) {
    return (
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={labels.show} hitSlop={8} style={({ pressed }) => [s.collapsed, pressed && s.pressed]}>
        <Layers size={17} color="#E8F5D0" />
        <ChevronRight size={13} color="#C9D8CC" />
      </Pressable>
    );
  }
  const inner = width - 12;
  const art: Size = { w: inner, h: Math.round(inner * 0.72) };
  const sections: { key: SatLayer; label: string; node: React.ReactNode; extra?: React.ReactNode }[] = [
    { key: 'zonas', label: labels.zones, node: <ZoneBlocks outline={outline} zones={zones} {...art} /> },
    {
      key: 'satelite', label: labels.outline,
      node: <TexturedOutline outline={outline} seed={seed} clipId={`clip${seed}`} {...art} />,
      extra: (
        <View style={s.legend}>
          <HeatBar w={inner - 8} id={`heat${seed}`} />
          <Text style={s.legendText} numberOfLines={1}>{labels.texture}</Text>
        </View>
      ),
    },
    { key: 'hibrido', label: labels.relief, node: <Image source={RELIEF} style={{ width: art.w, height: Math.round(art.w * 0.75), borderRadius: 8 }} resizeMode="cover" accessibilityIgnoresInvertColors /> },
  ];
  return (
    <Reanimated.View entering={reduced ? undefined : FadeIn.duration(180)} exiting={reduced ? undefined : FadeOut.duration(140)} style={[s.panel, { width }]}>
      {sections.map((sec, i) => {
        const active = layer === sec.key;
        return (
          <React.Fragment key={sec.key}>
            {i > 0 && <View style={s.divider} />}
            <Pressable
              onPress={() => onLayer(sec.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={sec.label}
              style={({ pressed }) => [s.section, active && s.sectionActive, pressed && s.pressed]}
            >
              {sec.node}
              {sec.extra}
              <Text style={[s.sectionLabel, active && s.sectionLabelActive]} numberOfLines={1}>{sec.label}</Text>
            </Pressable>
          </React.Fragment>
        );
      })}
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={labels.hide} hitSlop={8} style={({ pressed }) => [s.toggle, pressed && s.pressed]}>
        <ChevronLeft size={12} color="#0B1F17" strokeWidth={2.6} />
        <ChevronRight size={12} color="#0B1F17" strokeWidth={2.6} />
      </Pressable>
    </Reanimated.View>
  );
}

const s = StyleSheet.create({
  panel: {
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(17,20,19,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  section: { alignItems: 'center', paddingTop: 2, paddingBottom: 4, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  sectionActive: { borderColor: 'rgba(216,243,107,0.55)', backgroundColor: 'rgba(216,243,107,0.06)' },
  sectionLabel: { marginTop: 2, color: '#8FA197', fontFamily: 'Poppins_600SemiBold', fontSize: 9, letterSpacing: 0.3 },
  sectionLabelActive: { color: '#D8F36B' },
  divider: { alignSelf: 'stretch', height: 1, marginVertical: 6, marginHorizontal: 4, backgroundColor: 'rgba(255,255,255,0.1)' },
  legend: { marginTop: 4, alignItems: 'center', gap: 2 },
  legendText: { color: '#8FA197', fontFamily: 'Poppins_400Regular', fontSize: 8 },
  toggle: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: '#F1F5F2' },
  collapsed: {
    height: 40, paddingHorizontal: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(17,20,19,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
});
