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
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css"><style>html,body,#map{margin:0;width:100%;height:100%;background:#080D10}.maplibregl-ctrl-attrib{font:9px sans-serif;background:#10171bd9;color:#cbd5e1}.maplibregl-ctrl-attrib a{color:#cbd5e1}</style></head><body><div id="map"></div><script src="https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js" onerror="var m=JSON.stringify({type:'error'});if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(m);else parent.postMessage(m,'*')"></script><script>const STATUS=${safeJson(SCAN_STATUS_COLOR)};const SPEED=${safeJson(SPEED_COLORS)};
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
    dark: {
      type: "raster",
      tiles: [tile("Canvas/World_Dark_Gray_Base")],
      maxzoom: 16,
      tileSize: 256,
      attribution: "Tiles © Esri, HERE, Garmin, OpenStreetMap contributors",
    },
    standard: {
      type: "raster",
      tiles: [tile("World_Street_Map")],
      tileSize: 256,
      attribution: "Tiles © Esri, HERE, Garmin, OpenStreetMap contributors",
    },
    sat: {
      type: "raster",
      tiles: [tile("World_Imagery")],
      tileSize: 256,
      attribution:
        "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, GIS User Community",
    },
    labels: {
      type: "raster",
      tiles: [tile("Reference/World_Boundaries_and_Places")],
      tileSize: 256,
      attribution: "© Esri",
    },
    roads: {
      type: "raster",
      tiles: [tile("Reference/World_Transportation")],
      tileSize: 256,
      attribution: "© Esri",
    },
  };
  const map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      sources,
      layers: [
        {
          id: "background",
          type: "background",
          paint: { "background-color": "#080D10" },
        },
        ...Object.keys(sources).map((id) => ({
          id,
          type: "raster",
          source: id,
          paint: id === "dark" ? {"raster-brightness-max": .7, "raster-saturation": -.4} : {},
          layout: { visibility: id === "dark" ? "visible" : "none" },
        })),
      ],
    },
    center: [-102, 23],
    zoom: 4,
    maxZoom: 21,
    attributionControl: { compact: true },
  });
  map.on("styleimagemissing", (e) => {
    if (!e.id.startsWith("count-")) return;
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 48;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(e.id.slice(6), 48, 24);
    map.addImage(e.id, ctx.getImageData(0, 0, 96, 48));
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
    queued = false;
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
    ["dark", "standard", "sat", "labels", "roads"].forEach((id) =>
      visible(
        id,
        (id === "dark" && (layer === "oscuro" || layer === "zonas")) ||
          (id === "standard" && (layer === "estandar" || layer === "topo")) ||
          (id === "sat" && (layer === "satelite" || layer === "hibrido")) ||
          ((id === "labels" || id === "roads") && layer === "hibrido"),
      ),
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
    if (!detail && selected && data) { const p=data.scans.find(s=>s.id===selected);if(p)return [p]; }
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
          "circle-radius":
            id === "findings" ? 12 : id === "endpoints" ? 15 : 10,
          "circle-color":
            id === "user"
              ? "#38bdf8"
              : ["coalesce", ["get", "color"], "#14b8a6"],
          "circle-stroke-width": 2,
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
          type: "symbol",
          source: id,
          filter: ["has", "point_count"],
          layout: {
            "icon-image": [
              "concat",
              "count-",
              ["to-string", ["get", "point_count_abbreviated"]],
            ],
            "icon-size": 0.5,
            "icon-allow-overlap": true,
          },
        });
      }
    });
    // Canvas sprites keep symbols legible without relying on a remote glyph server.
    [
      ["camera", "▣"],
      ["alert", "!"],
      ["start", "▶"],
      ["end", "⚑"],
    ].forEach(([id, text]) => {
      const c = document.createElement("canvas");
      c.width = c.height = 48;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#081318";
      ctx.font = "bold 34px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if(id === 'camera') { ctx.lineWidth=4;ctx.strokeStyle='#081318';ctx.strokeRect(7,14,34,24);ctx.beginPath();ctx.arc(24,26,8,0,Math.PI*2);ctx.stroke();ctx.fillRect(15,9,16,5); }
      else if(id === 'start') {ctx.beginPath();ctx.moveTo(13,8);ctx.lineTo(39,24);ctx.lineTo(13,40);ctx.closePath();ctx.fill();}
      else if(id === 'end') {ctx.fillRect(12,8,4,34);ctx.fillRect(16,8,24,17);}
      else ctx.fillText(text, 24, 25);
      map.addImage(id, ctx.getImageData(0, 0, 48, 48));
    });
    [
      ["photos", "camera"],
      ["findings", "alert"],
      ["endpoints", "start"],
    ].forEach(([src, icon]) =>
      map.addLayer({
        id: src + "-icon",
        type: "symbol",
        source: src,
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image":
            src === "endpoints"
              ? ["match", ["get", "label"], "⚑", "end", "start"]
              : icon,
          "icon-size": 0.5,
          "icon-allow-overlap": true,
        },
      }),
    );
    add("active-ring", "circle", "active", {
      "circle-radius": 19,
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
  map.on("error", () => post({ type: "error" }));
  window.avx = {
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
