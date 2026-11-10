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

export function buildScansMapHtml(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css"><style>html,body,#map{margin:0;width:100%;height:100%;background:#080D10}.maplibregl-ctrl-attrib{font:9px sans-serif;background:#10171be8!important;color:#cbd5e1!important}.maplibregl-ctrl-attrib a{color:#cbd5e1}</style></head><body><div id="map"></div><script src="https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js" onerror="var m=JSON.stringify({type:'error'});if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(m);else parent.postMessage(m,'*')"></script><script>const VECTOR_STYLES=${safeJson(scansVectorStyle)};const STATUS=${safeJson(SCAN_STATUS_COLOR)};const SPEED=${safeJson(SPEED_COLORS)};
(function () {
  const post = (m) => {
    const s = JSON.stringify(m);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else parent.postMessage(s, "*");
  };
  window.addEventListener("error", () => post({ type: "error" }));
  if (!window.maplibregl) {
    post({ type: "error" });
    return;
  }
  const fc = (features) => ({ type: "FeatureCollection", features });
  const valid = (p) =>
    p &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180;
  const xy = (p) => [p.lng, p.lat];
  const feature = (type, coordinates, properties) => ({
    type: "Feature",
    geometry: { type, coordinates },
    properties: properties || {},
  });
  const point = (p, props) =>
    valid(p) ? feature("Point", xy(p), props) : null;
  const line = (points, props) => {
    const c = points.filter(valid).map(xy);
    return c.length > 1 ? feature("LineString", c, props) : null;
  };
  const polygon = (points, props) => {
    const c = points.filter(valid).map(xy);
    if (c.length < 3) return null;
    if (String(c[0]) !== String(c[c.length - 1])) c.push(c[0]);
    return feature("Polygon", [c], props);
  };
  const tile = (svc) =>
    "https://server.arcgisonline.com/ArcGIS/rest/services/" +
    svc +
    "/MapServer/tile/{z}/{y}/{x}";
  const sources = {
    openmaptiles: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
    },
    sat: {
      type: "raster",
      tiles: [tile("World_Imagery")],
      tileSize: 256,
      attribution:
        "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, GIS User Community",
    },
  };
  function darkPaint(l) {
    const paint = { ...l.paint };
    if (l.type === "background") paint["background-color"] = "#0b1216";
    if (l.type === "line")
      paint["line-color"] =
        l["source-layer"] === "transportation" ? "#41555f" : "#293e48";
    if (l.type === "fill") {
      const source = l["source-layer"];
      paint["fill-color"] =
        source === "water"
          ? "#123947"
          : source === "building"
            ? "#1e3039"
            : source === "park" || source === "landcover"
              ? "#152d27"
              : "#101d23";
    }
    if (l.type === "symbol" && l.layout?.["text-field"])
      Object.assign(paint, {
        "text-color": "#bfd0d5",
        "text-halo-color": "#0b1216",
        "text-halo-width": 1.5,
      });
    return paint;
  }
  // Both base styles share a vector tile cache. Hybrid uses the same sharp roads/labels.
  const baseLayers = Object.entries(VECTOR_STYLES).flatMap(([group, layers]) =>
    layers.map((l) => ({
      ...l,
      paint: group === "dark" ? darkPaint(l) : l.paint || {},
      id: group + "-" + l.id,
      layout: {
        ...l.layout,
        visibility: group === "dark" ? "visible" : "none",
      },
    })),
  );
  const hybridLayers = VECTOR_STYLES.standard
    .filter((l) => ["line", "symbol"].includes(l.type))
    .map((l) => ({
      ...l,
      id: "hybrid-" + l.id,
      layout: { ...l.layout, visibility: "none" },
    }));

  const map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      sources,
      glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
      sprite: "https://tiles.openfreemap.org/sprites/ofm_f384/ofm",
      layers: [
        {
          id: "background",
          type: "background",
          paint: { "background-color": "#080D10" },
        },
        {
          id: "sat",
          type: "raster",
          source: "sat",
          layout: { visibility: "none" },
          paint: { "raster-fade-duration": 150 },
        },
        ...baseLayers,
        ...hybridLayers,
        {
          id: "avx-buildings",
          type: "fill-extrusion",
          source: "openmaptiles",
          "source-layer": "building",
          minzoom: 15,
          paint: {
            "fill-extrusion-color": "#324d5b",
            "fill-extrusion-height": ["coalesce", ["get", "render_height"], 0],
            "fill-extrusion-base": [
              "coalesce",
              ["get", "render_min_height"],
              0,
            ],
            "fill-extrusion-opacity": 0.8,
          },
        },
      ],
    },
    center: [-102, 23],
    zoom: 4,
    pitch: 48,
    maxPitch: 60,
    maxZoom: 21,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 3),
    attributionControl: { compact: true },
  });
  map.on("styleimagemissing", (e) => {
    if (!e.id.startsWith("count-")) return;
    const c = document.createElement("canvas");
    c.width = 192;
    c.height = 96;
    const ctx = c.getContext("2d");
    ctx.scale(3, 3);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(e.id.slice(6), 32, 16);
    map.addImage(e.id, ctx.getImageData(0, 0, 192, 96), { pixelRatio: 3 });
  });
  let data = null,
    detail = null,
    selected = null,
    active = null,
    layer = "oscuro",
    routeStyle = "clasica",
    pad = { top: 110, bottom: 220, left: 24, right: 72 },
    lastKey,
    loaded = false,
    queued = false,
    perspective = true;
  const colors = {
    enfermo: "#F2545B",
    revisar: "#F59E0B",
    sano: "#22C55E",
    otro: "#94A3B8",
  };
  const cache = {};
  function source(id, features) {
    const collection = fc(features.filter(Boolean));
    const key = JSON.stringify(collection);
    if (cache[id] === key) return;
    cache[id] = key;
    map.getSource(id).setData(collection);
  }
  function schedule() {
    if (!loaded || queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      draw();
    });
  }
  function visible(id, on) {
    map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  }
  function bases() {
    visible("avx-buildings", perspective && layer !== "satelite");
    visible("sat", layer === "satelite" || layer === "hibrido");
    const group =
      layer === "oscuro" || layer === "zonas"
        ? "dark"
        : layer === "hibrido"
          ? "hybrid"
          : layer === "estandar" || layer === "topo"
            ? "standard"
            : null;
    [...baseLayers, ...hybridLayers].forEach((l) =>
      visible(l.id, l.id.startsWith(group + "-")),
    );
  }
  function speedColor(v, range) {
    const t = Math.max(
      0,
      Math.min(1, (v - range[0]) / Math.max(0.1, range[1] - range[0])),
    );
    const stops = SPEED;
    const scaled = t * (stops.length - 1),
      i = Math.min(stops.length - 2, Math.floor(scaled));
    const a = parseInt(stops[i].slice(1), 16),
      b = parseInt(stops[i + 1].slice(1), 16),
      f = scaled - i;
    return (
      "#" +
      [16, 8, 0]
        .map((shift) =>
          Math.round(((a >> shift) & 255) * (1 - f) + ((b >> shift) & 255) * f)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    );
  }
  function draw() {
    if (!data) return;
    const show = data.show || {};
    source(
      "orchards",
      show.orchards === false
        ? []
        : data.orchards.map((o) =>
            polygon(o.points, {
              id: o.id,
              color: "#8BF52B",
              opacity:
                data.focusOrchard && data.focusOrchard !== o.id ? 0.035 : 0.16,
            }),
          ),
    );
    source(
      "zones",
      layer === "zonas"
        ? data.zones.map((z) =>
            polygon(z.ring, {
              color:
                {
                  green: "#84cc16",
                  yellow: "#fbbf24",
                  red: "#f87171",
                  orange: "#fb923c",
                }[z.color] || "#2dd4bf",
            }),
          )
        : [],
    );
    source(
      "routes",
      show.routes === false
        ? []
        : data.routes
            .filter((r) => !detail || r.id !== detail.id)
            .map((r) => line(r.points, { id: r.id })),
    );
    source(
      "scans",
      data.scans
        .filter((s) => !detail || s.id !== detail.id)
        .map((s) =>
          point(s, {
            id: s.id,
            color: STATUS[s.status] || "#38bdf8",
            selected: s.id === selected,
          }),
        ),
    );
    const r = detail ? detail.route.filter(valid) : [];
    source("detail", show.routes === false ? [] : [line(r, {})]);
    map.setPaintProperty(
      "detail-line",
      "line-gradient",
      routeStyle === "tiempo"
        ? [
            "interpolate",
            ["linear"],
            ["line-progress"],
            0,
            "#84cc16",
            0.5,
            "#2dd4bf",
            1,
            "#a78bfa",
          ]
        : [
            "interpolate",
            ["linear"],
            ["line-progress"],
            0,
            "#8BF52B",
            1,
            "#14b8a6",
          ],
    );
    let segments = [];
    if (routeStyle === "velocidad" && detail && detail.speedRange) {
      for (let i = 1; i < r.length; i++) {
        let dt = (r[i].t - r[i - 1].t) / 1000;
        let a = xy(r[i - 1]),
          b = xy(r[i]);
        let rad = Math.PI / 180,
          dy = (b[1] - a[1]) * rad,
          dx = (b[0] - a[0]) * rad;
        let h =
          Math.sin(dy / 2) ** 2 +
          Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dx / 2) ** 2;
        let v =
          dt > 0
            ? ((6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)))) / dt) * 3.6
            : null;
        segments.push(
          line([r[i - 1], r[i]], {
            color: v === null ? "#94a3b8" : speedColor(v, detail.speedRange),
          }),
        );
      }
    }
    source("speed", show.routes === false ? [] : segments);
    visible("detail-line", !segments.length);
    visible("heat", routeStyle === "calor" && show.routes !== false);
    source(
      "endpoints",
      show.routes === false || !r.length
        ? []
        : [
            point(r[0], { color: "#8BF52B", label: "▶" }),
            point(r[r.length - 1], { color: "#c4b5fd", label: "⚑" }),
          ],
    );
    source(
      "photos",
      !detail || show.photos === false
        ? []
        : detail.photos.map((p) =>
            point(p, { id: p.id, kind: "photo", color: "#2dd4bf" }),
          ),
    );
    source(
      "findings",
      !detail || show.findings === false
        ? []
        : detail.findings.map((p) =>
            point(p, {
              id: p.id,
              kind: "finding",
              color: colors[p.cat] || colors.otro,
            }),
          ),
    );
    map.setPaintProperty(
      "active-ring",
      "circle-translate",
      active && active.kind === "photo" ? [32, 0] : [0, 0],
    );
    source(
      "active",
      !detail || !active
        ? []
        : (active.kind === "photo" ? detail.photos : detail.findings)
            .filter((p) => p.id === active.id)
            .map((p) => point(p, {})),
    );
  }
  function allPoints() {
    if (!detail && selected && data) {
      const p = data.scans.find((s) => s.id === selected);
      if (p) return [p];
    }
    return detail
      ? [
          ...detail.route,
          ...detail.photos,
          ...detail.findings,
          ...detail.orchard,
        ]
      : data
        ? [
            ...data.scans,
            ...data.routes.flatMap((r) => r.points),
            ...data.orchards.flatMap((o) => o.points),
          ]
        : [];
  }
  function fit() {
    const pts = allPoints().filter(valid);
    if (!pts.length) return;
    const bounds = new maplibregl.LngLatBounds();
    pts.forEach((p) => bounds.extend(xy(p)));
    const h = map.getContainer().clientHeight,
      w = map.getContainer().clientWidth;
    const safe = {
      top: Math.min(pad.top, h * 0.2),
      bottom: Math.min(pad.bottom, h * 0.55),
      left: Math.min(pad.left, w * 0.2),
      right: Math.min(pad.right, w * 0.2),
    };
    map.fitBounds(bounds, {
      padding: safe,
      pitch: perspective ? 48 : 0,
      maxZoom: 19,
      duration: data && data.reduced ? 0 : 650,
    });
  }
  function go(p) {
    if (valid(p))
      map.easeTo({
        center: xy(p),
        zoom: Math.max(18, map.getZoom()),
        padding: pad,
        pitch: perspective ? 48 : 0,
        duration: data && data.reduced ? 0 : 500,
      });
  }
  map.on("load", () => {
    loaded = true;
    bases();
    [
      "orchards",
      "zones",
      "routes",
      "detail",
      "speed",
      "endpoints",
      "findings",
      "active",
      "user",
      "scans",
      "photos",
    ].forEach((id) =>
      map.addSource(id, {
        type: "geojson",
        data: fc([]),
        ...(id === "detail" ? { lineMetrics: true } : {}),
        ...(["scans", "photos"].includes(id)
          ? { cluster: true, clusterRadius: 40, clusterMaxZoom: 18 }
          : {}),
      }),
    );
    const add = (id, type, source, paint, extra) =>
      map.addLayer({ id, type, source, paint, ...extra });
    add("zones-fill", "fill", "zones", {
      "fill-color": ["get", "color"],
      "fill-opacity": 0.32,
    });
    add("orchards-fill", "fill", "orchards", {
      "fill-color": ["get", "color"],
      "fill-opacity": ["get", "opacity"],
    });
    add("orchards-border", "line", "orchards", {
      "line-color": "#8BF52B",
      "line-width": 2,
    });
    add("routes-line", "line", "routes", {
      "line-color": "#2dd4bf",
      "line-width": 3,
      "line-opacity": 0.5,
    });
    add("heat", "line", "routes", {
      "line-color": "#fb923c",
      "line-width": 14,
      "line-blur": 8,
      "line-opacity": 0.55,
    });
    add("detail-halo", "line", "detail", {
      "line-color": "#031d22",
      "line-width": 10,
    });
    add(
      "detail-line",
      "line",
      "detail",
      { "line-width": 5 },
      { layout: { "line-cap": "round", "line-join": "round" } },
    );
    add("speed-line", "line", "speed", {
      "line-color": ["get", "color"],
      "line-width": 5,
    });
    ["scans", "photos", "findings", "endpoints", "user"].forEach((id) => {
      add(
        id + "-circle",
        "circle",
        id,
        {
          "circle-radius": id === "endpoints" ? 3 : id === "user" ? 8 : id === "scans" ? 16 : 18,
          "circle-color":
            id === "user"
              ? "#38bdf8"
              : ["coalesce", ["get", "color"], "#14b8a6"],
          "circle-translate":
            id === "photos" ? [32, 0] : [0, 0],
          "circle-translate-anchor": "viewport",
          "circle-pitch-alignment": "viewport",
          "circle-pitch-scale": "viewport",
          "circle-stroke-width": 2.5,
          "circle-stroke-color":
            id === "scans"
              ? [
                  "case",
                  ["boolean", ["get", "selected"], false],
                  "#fff",
                  "#99f6e4",
                ]
              : "#ecfdf5",
        },
        ["scans", "photos"].includes(id)
          ? { filter: ["!", ["has", "point_count"]] }
          : {},
      );
      if (["scans", "photos"].includes(id)) {
        add(
          id + "-cluster",
          "circle",
          id,
          {
            "circle-translate": id === "photos" ? [32, 0] : [0, 0],
            "circle-translate-anchor": "viewport",
            "circle-color": "#0f766e",
            "circle-radius": [
              "step",
              ["get", "point_count"],
              17,
              10,
              22,
              50,
              28,
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#99f6e4",
          },
          { filter: ["has", "point_count"] },
        );
        map.addLayer({
          id: id + "-count",
          paint: {
            "icon-translate": id === "photos" ? [32, 0] : [0, 0],
            "icon-translate-anchor": "viewport",
          },
          type: "symbol",
          source: id,
          filter: ["has", "point_count"],
          layout: {
            "icon-image": [
              "concat",
              "count-",
              ["to-string", ["get", "point_count_abbreviated"]],
            ],
            "icon-size": 1,
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-pitch-alignment": "viewport",
            "icon-rotation-alignment": "viewport",
          },
        });
      }
    });
    // Stroke paths are rasterized at 3x and registered with their true pixelRatio.
    // No emoji/font fallback: each marker has a recognisable, consistent symbol.
    const iconPaths = {
      camera:
        "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z M16 13a4 4 0 1 1-8 0a4 4 0 0 1 8 0",
      alert: "M12 3L2 21h20z M12 9v5 M12 17v.1",
      start: "M7 3l14 9-14 9z",
      end: "M5 22V3 M5 3h14l-3 5 3 5H5",
      scan: "M5 20V6a3 3 0 0 1 6 0v12a3 3 0 0 0 6 0V4 M3 20h4 M15 4h4",
    };
    Object.entries(iconPaths).forEach(([id, path]) => {
      const c = document.createElement("canvas");
      const endpoint=id==='start'||id==='end';
      c.width=endpoint?144:72;c.height=endpoint?216:72;
      const ctx=c.getContext('2d');ctx.scale(3,3);
      if(endpoint) {
        ctx.strokeStyle='#cbded9';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(24,0);ctx.lineTo(24,30);ctx.stroke();
        ctx.fillStyle=id==='start'?'#65a30d':'#7c3aed';
        ctx.beginPath();ctx.arc(24,48,18,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#ecfdf5';ctx.lineWidth=2;ctx.stroke();
        ctx.translate(12,36);
      }
      ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.lineJoin='round';ctx.lineCap='round';
      ctx.stroke(new Path2D(path));
      map.addImage(id,ctx.getImageData(0,0,c.width,c.height),{pixelRatio:3});
    });
    [
      ["photos", "camera"],
      ["findings", "alert"],
      ["endpoints", "start"],
      ["scans", "scan"],
    ].forEach(([src, icon]) =>
      map.addLayer({
        id: src + "-icon",
        paint: {
          "icon-translate":
            src === "photos" ? [32, 0] : [0, 0],
          "icon-translate-anchor": "viewport",
        },
        type: "symbol",
        source: src,
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-anchor":src==="endpoints"?"top":"center",
          "icon-image":
            src === "endpoints"
              ? ["match", ["get", "label"], "⚑", "end", "start"]
              : icon,
          "icon-size": 1,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-pitch-alignment": "viewport",
          "icon-rotation-alignment": "viewport",
        },
      }),
    );
    // Thin stems preserve the actual GPS anchor when badges share coordinates.
    for (const src of ["photos"]) {
      const c = document.createElement("canvas");
      c.width = c.height = 96;
      const ctx = c.getContext("2d");
      ctx.scale(3, 3);
      ctx.strokeStyle = "#e2f2ee";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(src === "photos" ? 14 : 0, src === "photos" ? 0 : 14);
      ctx.stroke();
      map.addImage("stem-" + src, ctx.getImageData(0, 0, 96, 96), {
        pixelRatio: 3,
      });
      map.addLayer({
        id: src + "-stem",
        type: "symbol",
        source: src,
        layout: {
          "icon-image": "stem-" + src,
          "icon-anchor": "top-left",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
      add(src + "-anchor", "circle", src, {
        "circle-radius": 2.5,
        "circle-color": "#e2f2ee",
      });
    }
    add("active-ring", "circle", "active", {
      "circle-radius": 23,
      "circle-translate": active && active.kind === "photo" ? [32, 0] : [0, 0],
      "circle-color": "#fff",
      "circle-opacity": 0.1,
      "circle-stroke-width": 3,
      "circle-stroke-color": "#fff",
    });
    map.on("click", async (e) => {
      const hit = map.queryRenderedFeatures(e.point, {
        layers: [
          "photos-circle",
          "findings-circle",
          "scans-circle",
          "photos-cluster",
          "scans-cluster",
          "orchards-fill",
          "routes-line",
        ],
      })[0];
      if (!hit) {
        post({ type: "clear" });
        return;
      }
      const p = hit.properties;
      if (p.cluster) {
        const zoom = await map
          .getSource(hit.source)
          .getClusterExpansionZoom(p.cluster_id);
        map.easeTo({ center: hit.geometry.coordinates, zoom });
        return;
      }
      if (hit.source === "photos" || hit.source === "findings")
        post({
          type: "point",
          kind: hit.source === "photos" ? "photo" : "finding",
          id: p.id,
        });
      else
        post({
          type: hit.source === "orchards" ? "orchard" : "select",
          id: p.id,
        });
    });
    post({ type: "ready" });
  });
  map.on("error", (e) => {
    console.error(e.error);
    post({ type: "error" });
  });
  window.avx = {
    setPerspective(on) {
      perspective = !!on;
      if (loaded) bases();
      map.easeTo({
        pitch: perspective ? 48 : 0,
        duration: data && data.reduced ? 0 : 500,
      });
    },
    setData(d) {
      const refit = !data || lastKey !== d.fitKey;
      data = d;
      lastKey = d.fitKey;
      schedule();
      if (refit && !detail) fit();
    },
    setLayer(n) {
      layer = n;
      if (loaded) bases();
      schedule();
    },
    setRouteStyle(n) {
      routeStyle = n;
      schedule();
    },
    setPad(p) {
      pad = p;
      const el = document.querySelector(".maplibregl-ctrl-bottom-right");
      if (el)
        el.style.bottom =
          Math.min(p.bottom, map.getContainer().clientHeight * 0.55) + "px";
    },
    select(id) {
      selected = id;
      if (id && detail && detail.id !== id) detail = null;
      if (id && !detail) fit();
      if (!id) {
        detail = null;
        active = null;
      }
      schedule();
    },
    setDetail(d, focus) {
      detail = d;
      active = null;
      schedule();
      if (focus) fit();
    },
    point(kind, id) {
      active = id ? { kind, id } : null;
      schedule();
      if (active && detail) {
        const p = (kind === "photo" ? detail.photos : detail.findings).find(
          (p) => p.id === id,
        );
        if (p) go(p);
      }
    },
    zoom(d) {
      map.zoomTo(map.getZoom() + d);
    },
    showUser(lat, lng, fly) {
      const p = { lat, lng };
      if (loaded) source("user", [point(p, {})]);
      if (fly) go(p);
    },
    fit,
    invalidate() {
      map.resize();
    },
  };
})();
</script></body></html>`;
}
