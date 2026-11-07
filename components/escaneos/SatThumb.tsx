/**
 * Miniatura satelital real de un recorrido: mosaicos de Esri del lugar (los mismos del mapa) con la
 * ruta GPS y el perímetro de la huerta dibujados encima. Sin datos geográficos no dibuja nada inventado.
 */
import React, { memo, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Polygon, Polyline } from 'react-native-svg';
import type { LatLng } from '../../services/escaneos';

const TILE = 256;
const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';

function worldPx(p: LatLng, z: number) {
  const s = TILE * 2 ** z;
  const sin = Math.sin((p.lat * Math.PI) / 180);
  return {
    x: ((p.lng + 180) / 360) * s,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s,
  };
}

type Props = {
  route: LatLng[]; points?: LatLng[]; outline?: LatLng[]; size: number; radius?: number;
  /** Alto (por defecto, cuadrado). */
  height?: number;
  /** Marcador de ubicación (p. ej. un hallazgo), centrado en la vista. */
  pin?: LatLng | null;
  pinColor?: string;
  /** Metros mínimos visibles alrededor del contenido. */
  minMeters?: number;
};

function SatThumb({ route, points = [], outline = [], size, radius = 14, height, pin = null, pinColor = '#EF4444', minMeters }: Props) {
  const h = height ?? size;
  const scene = useMemo(() => {
    const all = [...route, ...points, ...outline, ...(pin ? [pin] : [])];
    if (!all.length) return null;
    // Zoom más cercano en el que todo cabe con margen (máx. 18, el detalle real de las imágenes).
    let z = 18, minX = 0, minY = 0, maxX = 0, maxY = 0;
    for (; z >= 3; z--) {
      const px = all.map(p => worldPx(p, z));
      minX = Math.min(...px.map(p => p.x)); maxX = Math.max(...px.map(p => p.x));
      minY = Math.min(...px.map(p => p.y)); maxY = Math.max(...px.map(p => p.y));
      if (Math.max(maxX - minX, maxY - minY) <= TILE * 0.9) break;
    }
    // Metros por píxel de mundo a este zoom (para un mínimo visible en metros).
    const lat0 = all[0].lat;
    const mPerPx = (156543.03392 * Math.cos((lat0 * Math.PI) / 180)) / 2 ** z;
    const minPx = minMeters ? minMeters / mPerPx : 60;
    const span = Math.max(maxX - minX, maxY - minY, minPx) * 1.35;
    const big = Math.max(size, h);
    const spanX = span * (size / big), spanY = span * (h / big);
    // Con un pin, la vista se centra en él.
    const pc = pin ? worldPx(pin, z) : null;
    const cx = pc ? pc.x : (minX + maxX) / 2, cy = pc ? pc.y : (minY + maxY) / 2;
    const left = cx - spanX / 2, top = cy - spanY / 2;
    const k = size / spanX;
    const tiles: { key: string; uri: string; x: number; y: number }[] = [];
    const n = 2 ** z;
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + spanY) / TILE); ty++) {
      for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + spanX) / TILE); tx++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n;
        tiles.push({ key: `${z}/${ty}/${tx}`, uri: `${TILE_URL}/${z}/${ty}/${wx}`, x: (tx * TILE - left) * k, y: (ty * TILE - top) * k });
      }
    }
    const toStr = (pts: LatLng[]) => pts.map(p => { const w = worldPx(p, z); return `${((w.x - left) * k).toFixed(1)},${((w.y - top) * k).toFixed(1)}`; }).join(' ');
    const end = (p: LatLng) => { const w = worldPx(p, z); return { x: (w.x - left) * k, y: (w.y - top) * k }; };
    return {
      tiles, tileSize: TILE * k,
      route: route.length > 1 ? toStr(route) : null,
      outline: outline.length > 2 ? toStr(outline) : null,
      dots: (route.length > 1 ? [] : points).slice(0, 60).map(end),
      start: route.length > 1 ? end(route[0]) : null,
      finish: route.length > 1 ? end(route[route.length - 1]) : null,
      pin: pin ? end(pin) : null,
    };
  }, [route, points, outline, size, h, pin, minMeters]);

  if (!scene) return null;
  return (
    <View style={[s.wrap, { width: size, height: h, borderRadius: radius }]}>
      {scene.tiles.map(t => (
        <Image key={t.key} source={{ uri: t.uri }} style={{ position: 'absolute', left: t.x, top: t.y, width: scene.tileSize + 0.5, height: scene.tileSize + 0.5 }} />
      ))}
      <Svg width={size} height={h} style={StyleSheet.absoluteFill}>
        {scene.outline && <Polygon points={scene.outline} fill="rgba(132,204,22,0.18)" stroke="#BEF264" strokeWidth={1.6} strokeLinejoin="round" />}
        {scene.route && <Polyline points={scene.route} fill="none" stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />}
        {scene.route && <Polyline points={scene.route} fill="none" stroke="#10B981" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />}
        {scene.dots.map((d, i) => <Circle key={i} cx={d.x} cy={d.y} r={2.4} fill="#FFFFFF" stroke="#0F766E" strokeWidth={1.2} />)}
        {scene.start && <Circle cx={scene.start.x} cy={scene.start.y} r={3.6} fill="#0F766E" stroke="#FFFFFF" strokeWidth={1.5} />}
        {scene.finish && <Circle cx={scene.finish.x} cy={scene.finish.y} r={3.6} fill="#111827" stroke="#FFFFFF" strokeWidth={1.5} />}
        {scene.pin && (
          <G>
            <Circle cx={scene.pin.x} cy={scene.pin.y} r={13} fill={pinColor} fillOpacity={0.22} />
            <Path d={`M ${scene.pin.x} ${scene.pin.y} c -6 -8 -9 -11.5 -9 -15.5 a 9 9 0 1 1 18 0 c 0 4 -3 7.5 -9 15.5 z`} fill={pinColor} stroke="#FFFFFF" strokeWidth={1.8} />
            <Circle cx={scene.pin.x} cy={scene.pin.y - 15.5} r={3.4} fill="#FFFFFF" />
          </G>
        )}
      </Svg>
    </View>
  );
}

export default memo(SatThumb);

const s = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#C9D6C4' },
});
