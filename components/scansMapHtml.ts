import { scansVectorStyle } from "./scansVectorStyle";
import { safeJsonValue } from "./safeJson";

export type ScansMapPoint = { lat: number; lng: number };
export type ScanStatus = "listo" | "proceso" | "cola" | "local" | "error";
export type ScansMapLayer =
  "satelite" | "hibrido" | "zonas" | "estandar" | "topo" | "oscuro";
/**
 * Estilo de la ruta (como los mapas de actividad de Strava):
 * - clasica: teal.
 * - velocidad: cada tramo coloreado por su rapidez real (distancia / tiempo entre puntos GPS).
 * - tiempo: degradado del inicio (verde) al final (violeta).
 * - calor: todas las rutas superpuestas brillan más donde más has caminado.
 */
export type ScansMapRouteStyle = "clasica" | "velocidad" | "tiempo" | "calor";
/** Escala de velocidad (azul lento → rojo rápido), compartida con la leyenda de la pantalla. */
export const SPEED_COLORS = [
  "#3B82F6",
  "#22C55E",
  "#EAB308",
  "#F97316",
  "#EF4444",
] as const;
export const TIME_COLORS = [
  "#22C55E",
  "#14B8A6",
  "#6366F1",
  "#A855F7",
] as const;
export type FindingCat = "sano" | "enfermo" | "revisar" | "otro";

export type ScansMapOrchard = {
  id: string;
  name: string;
  points: ScansMapPoint[];
};
export type ScansMapScan = {
  id: string;
  kind: "recorrido" | "foto";
  status: ScanStatus;
  lat: number;
  lng: number;
};
export type ScansMapRoute = { id: string; points: ScansMapPoint[] };
export type ScansMapZone = {
  key: string;
  label: string;
  color: string;
  ring: ScansMapPoint[];
  at: ScansMapPoint;
};
export type ScansMapDetail = {
  id: string;
  /** t: hora del punto en ms (si la ruta la trae), para los estilos Velocidad y Tiempo. */
  route: (ScansMapPoint & { t?: number })[];
  /** Límites de la escala de velocidad (km/h) que también muestra la leyenda. */
  speedRange?: [number, number] | null;
  photos: { id: string; lat: number; lng: number; n: number }[];
  findings: { id: string; lat: number; lng: number; cat: FindingCat }[];
  /** Perímetro de su huerta, para encuadrar el terreno junto con la ruta. */
  orchard: ScansMapPoint[];
};
export type ScansMapShow = {
  routes: boolean;
  photos: boolean;
  findings: boolean;
  orchards: boolean;
};

export type ScansMapData = {
  orchards: ScansMapOrchard[];
  /** Pines, del más reciente al más antiguo (al agrupar, se elige el más reciente). */
  scans: ScansMapScan[];
  routes: ScansMapRoute[];
  zones: ScansMapZone[];
  focusOrchard: string | null;
  /** Cambia cuando cambia lo que hay que encuadrar (huerta elegida o filtros). */
  fitKey: string;
  /** Obsoleto: usar la prop `pad` de ScansMap (no redibuja). */
  pad?: { top: number; right: number; bottom: number; left: number };
  show: ScansMapShow;
  reduced: boolean;
};

export const SCAN_STATUS_COLOR: Record<ScanStatus, string> = {
  listo: "#22C55E",
  proceso: "#F59E0B",
  cola: "#F59E0B",
  local: "#0EA5E9",
  error: "#EF4444",
};

export const FINDING_COLOR: Record<FindingCat, string> = {
  sano: "#22C55E",
  enfermo: "#F2545B",
  revisar: "#F59E0B",
  otro: "#94A3B8",
};

export const safeJson = safeJsonValue;


/** Inclinación de la vista 3D (grados). 55° se lee como "maqueta" sin dejar media pantalla en el horizonte. */
export const SCANS_MAP_PITCH = 55;

/**
 * Mapa de Mis escaneos: MapLibre GL JS (WebGL, vectorial) dentro de un WebView / iframe.
 * Contrato `window.avx` igual que antes (setData, select, setDetail, point, setLayer, setRouteStyle,
 * setPerspective, setPad, zoom, showUser, fit, invalidate) y mensajes {type: ready|select|orchard|point|clear|error}.
 *
 * Todo lo que dibujamos (huertas, árboles, rutas, pines) son capas WebGL sobre fuentes GeoJSON creadas UNA vez;
 * los cambios solo hacen setData en la fuente que cambió (y nada si el contenido es igual).
 */
export function buildScansMapHtml(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css"><style>html,body,#map{margin:0;width:100%;height:100%;background:#080D10;overflow:hidden}.maplibregl-ctrl-bottom-right{transition:bottom .25s ease-out}.maplibregl-ctrl-attrib{font:8.5px/1.3 sans-serif;background:rgba(12,18,22,.72)!important;color:#9fb0b8!important;border-radius:10px!important}.maplibregl-ctrl-attrib a{color:#9fb0b8}.maplibregl-ctrl-attrib-button{filter:invert(1);opacity:.7}</style></head><body><div id="map"></div><script src="https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js" onerror="var m=JSON.stringify({type:'error'});if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(m);else parent.postMessage(m,'*')"></script><script>const VECTOR_STYLES=${safeJson(scansVectorStyle)};const STATUS=${safeJson(SCAN_STATUS_COLOR)};const SPEED=${safeJson(SPEED_COLORS)};const TIME=${safeJson(TIME_COLORS)};const FINDING=${safeJson(FINDING_COLOR)};const PITCH=${SCANS_MAP_PITCH};
${RUNTIME}
</script></body></html>`;
}

/* El motor del mapa. Es JS plano (sin backticks ni "${" para poder vivir dentro de la plantilla). */
const RUNTIME = String.raw`(function () {
  var post = function (m) {
    var s = JSON.stringify(m);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else parent.postMessage(s, "*");
  };
  if (!window.maplibregl) { post({ type: "error" }); return; }

  // ───────── geometría ─────────
  var NEON = "#8BF52B", TEAL = "#2DD4BF", CYAN = "#22D3EE";
  var fc = function (f) { return { type: "FeatureCollection", features: f.filter(Boolean) }; };
  var valid = function (p) { return p && isFinite(p.lat) && isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && !(p.lat === 0 && p.lng === 0); };
  var xy = function (p) { return [p.lng, p.lat]; };
  var feat = function (type, coordinates, props) { return { type: "Feature", geometry: { type: type, coordinates: coordinates }, properties: props || {} }; };
  var pt = function (p, props) { return valid(p) ? feat("Point", xy(p), props) : null; };
  var line = function (ps, props) { var c = ps.filter(valid).map(xy); return c.length > 1 ? feat("LineString", c, props) : null; };
  var ring = function (ps) {
    var c = ps.filter(valid).map(xy);
    if (c.length < 3) return null;
    if (c[0][0] !== c[c.length - 1][0] || c[0][1] !== c[c.length - 1][1]) c.push(c[0]);
    return c;
  };
  var poly = function (ps, props) { var r = ring(ps); return r ? feat("Polygon", [r], props) : null; };
  function meters(lat) { var ky = 111320; return { ky: ky, kx: ky * Math.max(0.01, Math.cos(lat * Math.PI / 180)) }; }
  function dist(a, b) { var k = meters((a.lat + b.lat) / 2); return Math.hypot((b.lng - a.lng) * k.kx, (b.lat - a.lat) * k.ky); }
  function inside(x, y, r) {
    var inn = false;
    for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
      var xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inn = !inn;
    }
    return inn;
  }
  function hash(n) { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }

  // ───────── bases ─────────
  function darkPaint(l) {
    var paint = Object.assign({}, l.paint);
    var src = l["source-layer"];
    if (l.type === "background") paint["background-color"] = "#0A1014";
    if (l.type === "line") paint["line-color"] = src === "transportation" ? "#2E3E46" : src === "waterway" ? "#14394a" : "#1d2c33";
    if (l.type === "fill")
      paint["fill-color"] = src === "water" ? "#0f2f3b" : src === "building" ? "#18252c" : src === "park" || src === "landcover" ? "#0f1d18" : "#0d171c";
    if (l.type === "symbol" && l.layout && l.layout["text-field"])
      Object.assign(paint, { "text-color": "#8496A0", "text-halo-color": "#0A1014", "text-halo-width": 1.4, "text-opacity": 0.6 });
    return paint;
  }
  var NOISY = /oneway|one_way/;
  var baseLayers = [];
  Object.keys(VECTOR_STYLES).forEach(function (group) {
    VECTOR_STYLES[group].forEach(function (l) {
      if (NOISY.test(l.id)) return;
      baseLayers.push(Object.assign({}, l, {
        id: group + "-" + l.id,
        paint: group === "dark" ? darkPaint(l) : l.paint || {},
        layout: Object.assign({}, l.layout, { visibility: group === "dark" ? "visible" : "none" }),
      }));
    });
  });
  VECTOR_STYLES.standard.forEach(function (l) {
    if ((l.type === "line" || l.type === "symbol") && !NOISY.test(l.id))
      baseLayers.push(Object.assign({}, l, { id: "hybrid-" + l.id, layout: Object.assign({}, l.layout, { visibility: "none" }) }));
  });

  var map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
      sprite: "https://tiles.openfreemap.org/sprites/ofm_f384/ofm",
      sky: { "sky-color": "#0B1A20", "horizon-color": "#123038", "fog-color": "#0A1014", "sky-horizon-blend": 0.7, "horizon-fog-blend": 0.6, "fog-ground-blend": 0.35, "atmosphere-blend": 0 },
      sources: {
        openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
        // Esri no tiene fotos más finas que ~z19: de ahí en adelante MapLibre amplía (no queda en blanco).
        sat: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 19,
          attribution: "Imagery © Esri, Maxar, Earthstar Geographics" },
      },
      layers: [{ id: "background", type: "background", paint: { "background-color": "#080D10" } },
        { id: "sat", type: "raster", source: "sat", layout: { visibility: "none" }, paint: { "raster-fade-duration": 120 } }]
        .concat(baseLayers)
        .concat([{ id: "avx-buildings", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 15,
          paint: { "fill-extrusion-color": "#1F3038", "fill-extrusion-height": ["coalesce", ["get", "render_height"], 0],
            "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0], "fill-extrusion-opacity": 0.75 } }]),
    },
    center: [-102.06, 19.42], zoom: 5, pitch: 0, bearing: 0,
    maxPitch: 70, maxZoom: 20.5,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 3),
    attributionControl: { compact: true },
    fadeDuration: 120,
  });

  // ───────── estado ─────────
  var data = null, detail = null, selected = null, active = null, layer = "oscuro", routeStyle = "clasica",
    pad = { top: 110, bottom: 220, left: 24, right: 72 }, lastKey = null, loaded = false, queued = false, perspective = true, userPt = null;
  var cache = {};
  function setSource(id, features) {
    var collection = fc(features);
    var key = JSON.stringify(collection);
    if (cache[id] === key) return;
    cache[id] = key;
    map.getSource(id).setData(collection);
  }
  function setPaint(layerId, prop, value) {
    var key = layerId + "|" + prop, s = JSON.stringify(value);
    if (cache[key] === s) return;
    cache[key] = s;
    map.setPaintProperty(layerId, prop, value);
  }
  function visible(id, on) {
    var v = on ? "visible" : "none";
    if (map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== v) map.setLayoutProperty(id, "visibility", v);
  }
  function schedule() {
    if (!loaded || queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; draw(); });
  }
  function bases() {
    var group = layer === "oscuro" || layer === "zonas" ? "dark" : layer === "hibrido" ? "hybrid" : layer === "satelite" ? null : "standard";
    baseLayers.forEach(function (l) { visible(l.id, group !== null && l.id.indexOf(group + "-") === 0); });
    visible("sat", layer === "satelite" || layer === "hibrido");
    visible("avx-buildings", perspective && layer !== "satelite" && layer !== "hibrido");
    // Árboles ilustrativos: solo en 3D y sobre bases dibujadas (en satélite ya se ven los reales).
    visible("trees", perspective && (layer === "oscuro" || layer === "estandar" || layer === "topo"));
  }

  // ───────── árboles 3D (ilustrativos: no son posiciones reales de árboles) ─────────
  var treeCache = { key: null, out: [] };
  function treesFor(polys) {
    var key = polys.map(function (r) { return r.length + ":" + r[0]; }).join("|");
    if (treeCache.key === key) return treeCache.out;
    var out = [], budget = 1600;
    polys.forEach(function (r, pi) {
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      r.forEach(function (c) { minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]); });
      var k = meters((minY + maxY) / 2);
      var w = (maxX - minX) * k.kx, h = (maxY - minY) * k.ky;
      var step = Math.max(9, Math.sqrt((w * h) / Math.max(60, budget / polys.length)));
      for (var y = minY + (step / 2) / k.ky, row = 0; y < maxY; y += step / k.ky, row++) {
        for (var x = minX + ((row % 2 ? step : step / 2) / 2) / k.kx; x < maxX; x += step / k.kx) {
          var seed = pi * 7919 + row * 131 + Math.round((x - minX) * k.kx);
          var jx = (hash(seed) - 0.5) * 1.2 / k.kx, jy = (hash(seed + 3) - 0.5) * 1.2 / k.ky;
          var cx = x + jx, cy = y + jy;
          if (!inside(cx, cy, r)) continue;
          var rad = 2.7 + hash(seed + 5) * 0.9, top = 5.2 + hash(seed + 9) * 1.8, tone = hash(seed + 11);
          var circle = function (rr) {
            var c = [];
            for (var a = 0; a <= 10; a++) {
              var ang = (a % 10) / 10 * Math.PI * 2 + tone;
              c.push([cx + Math.cos(ang) * rr / k.kx, cy + Math.sin(ang) * rr / k.ky]);
            }
            return c;
          };
          var trunk = [];
          for (var b = 0; b <= 4; b++) {
            var ang2 = (b % 4) / 4 * Math.PI * 2 + 0.78;
            trunk.push([cx + Math.cos(ang2) * 0.3 / k.kx, cy + Math.sin(ang2) * 0.3 / k.ky]);
          }
          // Copa en dos niveles (ancha abajo, angosta arriba) para que se lea como árbol y no como cilindro.
          out.push(feat("Polygon", [circle(rad)], { b: 1.3, h: top * 0.72, c: tone < 0.33 ? "#1B6E38" : tone < 0.66 ? "#217D41" : "#28894A" }));
          out.push(feat("Polygon", [circle(rad * 0.62)], { b: top * 0.72, h: top, c: tone < 0.5 ? "#2FA055" : "#38AE5E" }));
          out.push(feat("Polygon", [trunk], { b: 0, h: 1.2, c: "#5B4632" }));
          if (out.length > budget * 3) return;
        }
      }
    });
    treeCache = { key: key, out: out };
    return out;
  }

  // ───────── ruta: degradado por progreso, tiempo o velocidad ─────────
  function lerpHex(a, b, f) {
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    return "#" + [16, 8, 0].map(function (s) { return Math.round(((x >> s) & 255) * (1 - f) + ((y >> s) & 255) * f).toString(16).padStart(2, "0"); }).join("");
  }
  function ramp(stops, t) {
    t = Math.max(0, Math.min(1, t));
    var s = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(s));
    return lerpHex(stops[i], stops[i + 1], s - i);
  }
  var gradCache = { key: null, value: null };
  function routeGradient(r) {
    var classic = ["interpolate", ["linear"], ["line-progress"], 0, NEON, 0.55, TEAL, 1, CYAN];
    if (r.length < 2) return classic;
    var key = (detail ? detail.id : "") + "|" + routeStyle + "|" + r.length;
    if (gradCache.key === key) return gradCache.value;
    var value = classic;
    var hasT = r.every(function (p) { return isFinite(p.t); }) && r[r.length - 1].t > r[0].t;
    if (routeStyle === "tiempo" || (routeStyle === "velocidad" && hasT && detail.speedRange)) {
      // line-progress es la fracción de DISTANCIA: cada parada se pone en la distancia acumulada de su punto.
      var cum = [0];
      for (var i = 1; i < r.length; i++) cum.push(cum[i - 1] + dist(r[i - 1], r[i]));
      var total = cum[cum.length - 1];
      if (total > 0) {
        var lo = detail.speedRange ? detail.speedRange[0] : 0, hi = detail.speedRange ? Math.max(lo + 0.1, detail.speedRange[1]) : 1;
        var stops = [], last = -1, every = Math.max(1, Math.ceil(r.length / 120));
        for (var j = 0; j < r.length; j += every) {
          var prog = cum[j] / total;
          if (prog <= last + 1e-6) continue;
          var color;
          if (routeStyle === "tiempo") color = ramp(TIME, hasT ? (r[j].t - r[0].t) / (r[r.length - 1].t - r[0].t) : prog);
          else {
            var a = r[Math.max(0, j - 2)], b = r[Math.min(r.length - 1, j + 2)];
            var dt = (b.t - a.t) / 1000, d = cum[Math.min(r.length - 1, j + 2)] - cum[Math.max(0, j - 2)];
            color = dt > 0 ? ramp(SPEED, ((d / dt) * 3.6 - lo) / (hi - lo)) : "#94A3B8";
          }
          stops.push(prog, color);
          last = prog;
        }
        if (last < 1) stops.push(1, stops[stops.length - 1]);
        if (stops[0] !== 0) stops[0] = 0;
        if (stops.length >= 4) value = ["interpolate", ["linear"], ["line-progress"]].concat(stops);
      }
    }
    gradCache = { key: key, value: value };
    return value;
  }

  // ───────── dibujo ─────────
  function draw() {
    if (!data) return;
    var show = data.show || {};
    var focusId = detail ? null : data.focusOrchard;
    var own = detail && detail.orchard && detail.orchard[0];
    var isOwn = function (o) { return own && o.points[0] && o.points[0].lat === own.lat && o.points[0].lng === own.lng; };
    setSource("orchards", show.orchards === false ? [] : data.orchards.map(function (o) {
      var dim = detail ? (own && !isOwn(o) ? 1 : 0) : focusId ? (focusId === o.id ? 0 : 1) : 0;
      return poly(o.points, { id: o.id, dim: dim });
    }));
    setSource("zones", layer === "zonas" ? data.zones.map(function (z) {
      return poly(z.ring, { color: { green: "#84CC16", yellow: "#FBBF24", red: "#F87171", orange: "#FB923C" }[z.color] || TEAL });
    }) : []);
    // Árboles: en la huerta del recorrido elegido, en la huerta filtrada o, si son pocas, en todas.
    var treePolys = [];
    if (show.orchards !== false) {
      if (detail && detail.orchard && detail.orchard.length >= 3) treePolys = [ring(detail.orchard)];
      else if (focusId) treePolys = data.orchards.filter(function (o) { return o.id === focusId; }).map(function (o) { return ring(o.points); });
      else if (data.orchards.length <= 6) treePolys = data.orchards.map(function (o) { return ring(o.points); });
    }
    setSource("trees", treesFor(treePolys.filter(Boolean)));

    setSource("routes", show.routes === false ? [] : data.routes.filter(function (r) { return !detail || r.id !== detail.id; }).map(function (r) { return line(r.points, { id: r.id }); }));
    setPaint("routes-line", "line-opacity", detail ? 0.22 : 0.7);
    visible("heat", routeStyle === "calor" && show.routes !== false);

    setSource("scans", detail ? [] : data.scans.map(function (s) {
      return pt(s, { id: s.id, icon: "pin-" + (s.kind === "foto" ? "photo" : "walk") + "-" + (s.status || "listo"), sel: s.id === selected ? 1 : 0 });
    }));

    var r = detail ? detail.route.filter(valid) : [];
    setSource("detail", show.routes === false ? [] : [line(r, {})]);
    var grad = routeGradient(r);
    setPaint("detail-line", "line-gradient", grad);
    setPaint("detail-glow", "line-gradient", grad);
    setSource("endpoints", show.routes === false || r.length < 2 ? [] : [pt(r[0], { icon: "pin-start" }), pt(r[r.length - 1], { icon: "pin-end" })]);
    setSource("photos", !detail || show.photos === false ? [] : detail.photos.map(function (p) { return pt(p, { id: p.id }); }));
    setSource("findings", !detail || show.findings === false ? [] : detail.findings.map(function (p) {
      return pt(p, { id: p.id, icon: "pin-alert-" + (FINDING[p.cat] ? p.cat : "otro") });
    }));
    var act = [];
    if (detail && active) (active.kind === "photo" ? detail.photos : detail.findings).forEach(function (p) { if (p.id === active.id) act.push(pt(p, {})); });
    setSource("active", act);
    setSource("user", userPt ? [pt(userPt, {})] : []);
  }

  // ───────── encuadre ─────────
  function bbox(ps) {
    var b = null;
    ps.filter(valid).forEach(function (p) {
      if (!b) b = [p.lng, p.lat, p.lng, p.lat];
      else { b[0] = Math.min(b[0], p.lng); b[1] = Math.min(b[1], p.lat); b[2] = Math.max(b[2], p.lng); b[3] = Math.max(b[3], p.lat); }
    });
    return b;
  }
  function focusPoints() {
    if (detail) {
      var own = detail.route.concat(detail.photos, detail.findings).filter(valid);
      // La huerta entra al encuadre si no es enorme comparada con el recorrido (relación ruta ↔ huerta).
      var ob = bbox(detail.orchard || []);
      if (ob) {
        var diag = dist({ lat: ob[1], lng: ob[0] }, { lat: ob[3], lng: ob[2] });
        if (!own.length || diag < 700) own = own.concat(detail.orchard);
      }
      return own;
    }
    if (selected && data) {
      var s = data.scans.find(function (x) { return x.id === selected; });
      if (s) return [s];
    }
    if (!data) return [];
    var pts = [];
    data.scans.forEach(function (s) { pts.push(s); });
    data.routes.forEach(function (r) { pts = pts.concat(r.points); });
    data.orchards.forEach(function (o) { if (!data.focusOrchard || o.id === data.focusOrchard) pts = pts.concat(o.points); });
    return pts;
  }
  // Zoom que hace caber la caja (con giro) en el hueco que dejan los márgenes. Se calcula a mano porque
  // fitBounds/cameraForBounds de MapLibre 5 alejan de más cuando la cámara está inclinada y hay padding.
  function zoomFor(b, p, bearing, maxZoom, pitch) {
    var mx = function (lng) { return (lng + 180) / 360; };
    var my = function (lat) { var s = Math.sin(lat * Math.PI / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
    var rad = bearing * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad);
    var xs = [], ys = [];
    [[b[0], b[1]], [b[0], b[3]], [b[2], b[1]], [b[2], b[3]]].forEach(function (q) {
      var x = mx(q[0]), y = my(q[1]);
      xs.push(x * cs + y * sn); ys.push(-x * sn + y * cs);
    });
    var dx = Math.max.apply(null, xs) - Math.min.apply(null, xs), dy = (Math.max.apply(null, ys) - Math.min.apply(null, ys)) * Math.max(0.55, Math.cos((pitch || 0) * Math.PI / 180) * 1.15);
    var el = map.getContainer();
    var w = Math.max(80, el.clientWidth - p.left - p.right), h = Math.max(80, el.clientHeight - p.top - p.bottom);
    var scale = Math.min(dx > 0 ? w / dx : Infinity, dy > 0 ? h / dy : Infinity);
    return Math.min(maxZoom, Math.log2(scale / 512));
  }
  function safePad() {
    var h = map.getContainer().clientHeight, w = map.getContainer().clientWidth;
    // +40 arriba: los pines se levantan sobre su coordenada y no deben quedar bajo el encabezado.
    return { top: Math.min(pad.top + 40, h * 0.35), bottom: Math.min(pad.bottom, h * 0.55), left: Math.min(pad.left, w * 0.2), right: Math.min(pad.right, w * 0.25) };
  }
  function camera() { return { pitch: perspective ? PITCH : 0, bearing: perspective ? -12 : 0 }; }
  // Ajuste fino con la cámara final: se colocan los puntos reales en pantalla y se corrigen zoom y centro
  // (con inclinación, lo cercano se ve más grande y una estimación en plano deja la ruta cortada).
  // Los saltos de prueba ocurren en el mismo cuadro y se deshacen: no se ven.
  function refine(pts, center, zoom, c, padding, maxZoom) {
    var before = { center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), padding: map.getPadding() };
    var el = map.getContainer(), W = el.clientWidth, H = el.clientHeight;
    var aw = Math.max(60, W - padding.left - padding.right), ah = Math.max(60, H - padding.top - padding.bottom);
    var step = Math.max(1, Math.floor(pts.length / 400));
    for (var it = 0; it < 4; it++) {
      map.jumpTo({ center: center, zoom: zoom, pitch: c.pitch, bearing: c.bearing, padding: padding });
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (var i = 0; i < pts.length; i += step) {
        var q = map.project(xy(pts[i]));
        x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
      }
      if (!isFinite(x0)) break;
      var k = Math.min(aw / Math.max(1, x1 - x0), ah / Math.max(1, y1 - y0));
      var mid = map.unproject([(x0 + x1) / 2, (y0 + y1) / 2]);
      var tx = padding.left + aw / 2, ty = padding.top + ah / 2;
      var here = map.unproject([tx, ty]);
      center = [center[0] + (mid.lng - here.lng), center[1] + (mid.lat - here.lat)];
      var nz = Math.min(maxZoom, zoom + Math.log2(k) * 0.92);
      if (Math.abs(nz - zoom) < 0.02 && it > 0) { zoom = nz; break; }
      zoom = nz;
    }
    map.jumpTo(before);
    return { center: center, zoom: zoom };
  }
  function fit() {
    var pts = focusPoints().filter(valid);
    var b = bbox(pts);
    if (!b) return;
    var c = camera();
    var single = b[0] === b[2] && b[1] === b[3];
    var opts = { padding: safePad(), pitch: c.pitch, bearing: c.bearing, duration: data && data.reduced ? 0 : 700, essential: true };
    if (single) { map.easeTo(Object.assign(opts, { center: [b[0], b[1]], zoom: Math.max(17, Math.min(map.getZoom(), 18.5)) })); return; }
    var maxZoom = detail ? 19.6 : 18.5;
    var z = zoomFor(b, opts.padding, c.bearing, maxZoom, c.pitch);
    var cam = refine(pts, [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], z, c, opts.padding, maxZoom);
    map.easeTo(Object.assign(opts, { center: cam.center, zoom: cam.zoom }));
  }
  function go(p) {
    if (!valid(p)) return;
    var c = camera();
    map.easeTo({ center: xy(p), zoom: Math.max(18.5, map.getZoom()), padding: safePad(), pitch: c.pitch, bearing: map.getBearing(), duration: data && data.reduced ? 0 : 500, essential: true });
  }

  // ───────── iconos nítidos (dibujados a 3×) ─────────
  var GLYPH = {
    play: { d: "M8 5.5v13l10.5-6.5z", fill: true },
    flag: { d: "M5 21V4 M5 4.5c3-2 6 1.5 9 0s4-1 5 0v8c-1-1-2-1.5-5 0s-6-2-9 0" },
    alert: { d: "M12 4.5 3.5 19h17z M12 10v4 M12 16.6v.1" },
    camera: { d: "M14.5 5h-5L8 7.5H5a1.5 1.5 0 0 0-1.5 1.5v8.5A1.5 1.5 0 0 0 5 19h14a1.5 1.5 0 0 0 1.5-1.5V9A1.5 1.5 0 0 0 19 7.5h-3z M15.2 13a3.2 3.2 0 1 1-6.4 0a3.2 3.2 0 0 1 6.4 0" },
    walk: { d: "M6 18.5h9a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h9 M6 18.5v.1 M18 6.5v.1" },
  };
  function glyph(ctx, g, color, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 24, s / 24);
    var p = new Path2D(GLYPH[g].d);
    if (GLYPH[g].fill) { ctx.fillStyle = color; ctx.fill(p); }
    ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(p);
    ctx.restore();
  }
  function addIcon(id, w, h, paint) {
    var R = 3, c = document.createElement("canvas");
    c.width = w * R; c.height = h * R;
    var ctx = c.getContext("2d");
    ctx.scale(R, R);
    paint(ctx);
    map.addImage(id, ctx.getImageData(0, 0, c.width, c.height), { pixelRatio: R });
  }
  // Pin de gota: la punta es la coordenada GPS exacta (icon-anchor: bottom).
  function pin(id, color, g, ink) {
    addIcon(id, 36, 46, function (ctx) {
      ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
      ctx.beginPath();
      ctx.moveTo(18, 44);
      ctx.bezierCurveTo(14, 37, 4, 30, 4, 18.5);
      ctx.arc(18, 18, 14, Math.PI, 0);
      ctx.bezierCurveTo(32, 30, 22, 37, 18, 44);
      ctx.closePath();
      ctx.fillStyle = color; ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.92)"; ctx.stroke();
      glyph(ctx, g, ink || "#FFFFFF", 8, 8, 20);
    });
  }
  function badge(id, color, g, size) {
    addIcon(id, size + 6, size + 6, function (ctx) {
      var c = (size + 6) / 2;
      ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1.5;
      ctx.beginPath(); ctx.arc(c, c, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.lineWidth = 1.8; ctx.strokeStyle = "rgba(255,255,255,0.92)"; ctx.stroke();
      glyph(ctx, g, "#FFFFFF", c - size * 0.32, c - size * 0.32, size * 0.64);
    });
  }
  function icons() {
    pin("pin-start", NEON, "play", "#0B1A0E");
    pin("pin-end", "#A78BFA", "flag");
    Object.keys(FINDING).forEach(function (k) { pin("pin-alert-" + k, k === "enfermo" ? "#FF5A5F" : FINDING[k], "alert"); });
    Object.keys(STATUS).forEach(function (k) { pin("pin-walk-" + k, STATUS[k], "walk"); pin("pin-photo-" + k, STATUS[k], "camera"); });
    badge("photo", "#0D9488", "camera", 24);
    addIcon("chev", 12, 12, function (ctx) {
      ctx.strokeStyle = "rgba(4,22,20,0.85)"; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(4, 2.5); ctx.lineTo(8, 6); ctx.lineTo(4, 9.5); ctx.stroke();
    });
  }

  // ───────── carga ─────────
  map.on("load", function () {
    loaded = true;
    icons();
    ["orchards", "zones", "trees", "routes", "detail", "endpoints", "findings", "active", "user", "scans", "photos"].forEach(function (id) {
      var opts = { type: "geojson", data: fc([]) };
      if (id === "detail") opts.lineMetrics = true;
      if (id === "scans") { opts.cluster = true; opts.clusterRadius = 38; opts.clusterMaxZoom = 18; }
      map.addSource(id, opts);
    });
    var add = function (id, type, source, paint, extra) { map.addLayer(Object.assign({ id: id, type: type, source: source, paint: paint }, extra || {})); };
    add("zones-fill", "fill", "zones", { "fill-color": ["get", "color"], "fill-opacity": 0.3 });
    add("zones-line", "line", "zones", { "line-color": ["get", "color"], "line-width": 1, "line-opacity": 0.7 });
    // Huerta: relleno suave + contorno neón con brillo.
    add("orchards-fill", "fill", "orchards", { "fill-color": NEON, "fill-opacity": ["case", ["==", ["get", "dim"], 1], 0.025, 0.09] });
    add("orchards-glow", "line", "orchards", { "line-color": NEON, "line-width": 9, "line-blur": 7, "line-opacity": ["case", ["==", ["get", "dim"], 1], 0.08, 0.42] });
    add("orchards-border", "line", "orchards", { "line-color": NEON, "line-width": 2.2, "line-opacity": ["case", ["==", ["get", "dim"], 1], 0.35, 1] },
      { layout: { "line-join": "round" } });
    add("trees", "fill-extrusion", "trees", { "fill-extrusion-color": ["get", "c"], "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": ["get", "b"],
      "fill-extrusion-opacity": 0.95, "fill-extrusion-vertical-gradient": true }, { minzoom: 14.5 });
    add("routes-line", "line", "routes", { "line-color": TEAL, "line-width": 2.5, "line-opacity": 0.7 }, { layout: { "line-cap": "round", "line-join": "round" } });
    add("heat", "line", "routes", { "line-color": "#FB923C", "line-width": 14, "line-blur": 9, "line-opacity": 0.5 }, { layout: { visibility: "none" } });
    add("detail-glow", "line", "detail", { "line-width": 16, "line-blur": 10, "line-opacity": 0.55, "line-gradient": ["interpolate", ["linear"], ["line-progress"], 0, NEON, 1, CYAN] },
      { layout: { "line-cap": "round", "line-join": "round" } });
    add("detail-casing", "line", "detail", { "line-color": "#04110E", "line-width": 8, "line-opacity": 0.85 }, { layout: { "line-cap": "round", "line-join": "round" } });
    add("detail-line", "line", "detail", { "line-width": 5, "line-gradient": ["interpolate", ["linear"], ["line-progress"], 0, NEON, 1, CYAN] },
      { layout: { "line-cap": "round", "line-join": "round" } });
    add("detail-arrows", "symbol", "detail", {}, { minzoom: 16.5, layout: { "symbol-placement": "line", "symbol-spacing": 70, "icon-image": "chev", "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-rotation-alignment": "map", "icon-pitch-alignment": "map" } });
    add("user-halo", "circle", "user", { "circle-radius": 18, "circle-color": "#38BDF8", "circle-opacity": 0.18, "circle-pitch-alignment": "map" });
    add("user-dot", "circle", "user", { "circle-radius": 7, "circle-color": "#38BDF8", "circle-stroke-width": 2.5, "circle-stroke-color": "#FFFFFF" });
    var sym = { "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-pitch-alignment": "viewport", "icon-rotation-alignment": "viewport" };
    var clusterPaint = { "circle-color": "rgba(10,18,22,0.88)", "circle-radius": ["step", ["get", "point_count"], 15, 10, 19, 50, 24], "circle-stroke-width": 2, "circle-stroke-color": TEAL, "circle-pitch-alignment": "viewport" };
    var countLayout = { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-allow-overlap": true, "text-ignore-placement": true, "text-pitch-alignment": "viewport" };
    add("scans-cluster", "circle", "scans", clusterPaint, { filter: ["has", "point_count"] });
    add("scans-count", "symbol", "scans", { "text-color": "#E6FFFA" }, { filter: ["has", "point_count"], layout: countLayout });
    add("scans-icon", "symbol", "scans", {}, { filter: ["!", ["has", "point_count"]], layout: Object.assign({ "icon-image": ["get", "icon"], "icon-anchor": "bottom", "icon-size": ["case", ["==", ["get", "sel"], 1], 1.18, 0.9], "symbol-sort-key": ["get", "sel"] }, sym) });
    // Fotos: puntos discretos sobre la ruta y, de cerca, la insignia con cámara (sin burbujas con números).
    add("photos-dot", "circle", "photos", { "circle-radius": 3.4, "circle-color": "#14B8A6", "circle-stroke-width": 1.2, "circle-stroke-color": "#E6FFFA", "circle-pitch-alignment": "viewport" }, { maxzoom: 18 });
    add("photos-icon", "symbol", "photos", {}, { minzoom: 18, layout: Object.assign({ "icon-image": "photo" }, sym) });
    add("active-ring", "circle", "active", { "circle-radius": 20, "circle-color": "#FFFFFF", "circle-opacity": 0.12, "circle-stroke-width": 2.5, "circle-stroke-color": "#FFFFFF", "circle-pitch-alignment": "viewport" });
    add("findings-icon", "symbol", "findings", {}, { layout: Object.assign({ "icon-image": ["get", "icon"], "icon-anchor": "bottom" }, sym) });
    add("endpoints-icon", "symbol", "endpoints", {}, { layout: Object.assign({ "icon-image": ["get", "icon"], "icon-anchor": "bottom" }, sym) });

    map.on("click", function (e) {
      var t = 8, box = [[e.point.x - t, e.point.y - t], [e.point.x + t, e.point.y + t]];
      var hits = map.queryRenderedFeatures(box, { layers: ["findings-icon", "photos-icon", "photos-dot", "scans-icon", "scans-cluster"] });
      var hit = hits[0] || map.queryRenderedFeatures(box, { layers: ["routes-line", "orchards-fill"] })[0];
      if (!hit) { post({ type: "clear" }); return; }
      var p = hit.properties;
      if (p.cluster) {
        map.getSource(hit.source).getClusterExpansionZoom(p.cluster_id).then(function (z) {
          map.easeTo({ center: hit.geometry.coordinates, zoom: Math.min(z + 0.5, 20), duration: data && data.reduced ? 0 : 450 });
        });
        return;
      }
      if (hit.source === "photos" || hit.source === "findings") post({ type: "point", kind: hit.source === "photos" ? "photo" : "finding", id: p.id });
      else post({ type: hit.source === "orchards" ? "orchard" : "select", id: p.id });
    });
    bases();
    // Datos que llegaron antes de que el mapa cargara: se dibujan ahora.
    draw();
    if (data || detail) fit();
    post({ type: "ready" });
  });
  var errorSent = false;
  map.on("error", function (e) {
    // Un mosaico o fuente que falla no tumba el mapa; solo avisamos si el motor no llegó a cargar.
    console.error(e && e.error);
    if (!loaded && !errorSent) { errorSent = true; post({ type: "error" }); }
  });

  window.avx = {
    setPerspective: function (on) {
      perspective = !!on;
      if (!loaded) return;
      bases();
      var c = camera();
      map.easeTo({ pitch: c.pitch, bearing: c.bearing, duration: data && data.reduced ? 0 : 550 });
    },
    setData: function (d) {
      var refit = !data || lastKey !== d.fitKey;
      data = d; lastKey = d.fitKey;
      schedule();
      if (refit && !detail && loaded) fit();
    },
    setLayer: function (n) { if (n === layer) return; layer = n; if (loaded) bases(); schedule(); },
    setRouteStyle: function (n) { routeStyle = n; schedule(); },
    setPad: function (p) {
      pad = p;
      var el = document.querySelector(".maplibregl-ctrl-bottom-right");
      if (el) el.style.bottom = Math.min(p.bottom, map.getContainer().clientHeight * 0.55) + "px";
    },
    select: function (id) {
      selected = id;
      if (id && detail && detail.id !== id) detail = null;
      if (!id) { detail = null; active = null; }
      schedule();
      if (id && !detail && loaded) fit();
    },
    setDetail: function (d, focus) {
      detail = d; active = null;
      schedule();
      if (focus && loaded) fit();
    },
    point: function (kind, id) {
      active = id ? { kind: kind, id: id } : null;
      schedule();
      if (active && detail) {
        var list = kind === "photo" ? detail.photos : detail.findings;
        for (var i = 0; i < list.length; i++) if (list[i].id === id) { go(list[i]); break; }
      }
    },
    zoom: function (d) { map.easeTo({ zoom: map.getZoom() + d, duration: data && data.reduced ? 0 : 250 }); },
    showUser: function (lat, lng, fly) {
      userPt = { lat: lat, lng: lng };
      schedule();
      if (fly) go(userPt);
    },
    fit: fit,
    invalidate: function () { map.resize(); },
  };
})();`;
