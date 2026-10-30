"""Lógica pura del procesador de recorridos (sin red ni base de datos).

Se prueba con: python -m unittest discover -s processor/tests
"""
from __future__ import annotations

import io
import json
import math
from dataclasses import dataclass, field
from datetime import datetime
from typing import Iterable, Optional

from PIL import Image, ImageFilter, ImageStat

RADIO_TIERRA_M = 6371008.8

# Etiquetas del modelo que significan "aquí no hay fruto".
ETIQUETAS_SIN_FRUTO = {"nofruta", "no fruta", "no_fruta", "ninguno", "none"}
# Etiquetas de estado sano (mismas que usa la app en scan.tsx).
ETIQUETAS_SANAS = ("saludable", "healthy", "sano", "fresh", "fresco")


# ───────────────────────── geografía ─────────────────────────

def distancia_m(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    d_lat = math.radians(b_lat - a_lat)
    d_lng = math.radians(b_lng - a_lng)
    s = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(a_lat)) * math.cos(math.radians(b_lat)) * math.sin(d_lng / 2) ** 2)
    return 2 * RADIO_TIERRA_M * math.asin(min(1.0, math.sqrt(s)))


def coordenada_valida(lat, lng) -> bool:
    try:
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return False
    if not (math.isfinite(lat) and math.isfinite(lng)):
        return False
    if lat == 0 and lng == 0:
        return False
    return -90 <= lat <= 90 and -180 <= lng <= 180


def parsear_vertices(raw) -> list[tuple[float, float]]:
    """Mismos formatos que guarda la app en huertas.coordinates."""
    coords = raw
    if isinstance(coords, str):
        try:
            coords = json.loads(coords)
        except ValueError:
            return []
    if not isinstance(coords, list):
        return []
    out = []
    for c in coords:
        if c is None:
            continue
        if isinstance(c, (list, tuple)) and len(c) >= 2:
            lat, lng = c[0], c[1]
        elif isinstance(c, dict):
            lat = c.get("latitude", c.get("lat"))
            lng = c.get("longitude", c.get("lng"))
        else:
            continue
        if coordenada_valida(lat, lng):
            out.append((float(lat), float(lng)))
    return out


def punto_en_poligono(lat: float, lng: float, vertices: list[tuple[float, float]]) -> bool:
    if len(vertices) < 3:
        return False
    dentro = False
    j = len(vertices) - 1
    for i in range(len(vertices)):
        yi, xi = vertices[i]
        yj, xj = vertices[j]
        if (yi > lat) != (yj > lat):
            x_cruce = (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
            if lng < x_cruce:
                dentro = not dentro
        j = i
    return dentro


def huerta_para_punto(lat, lng, huertas: Iterable[dict], tolerancia_m: float = 15.0) -> Optional[str]:
    """Huerta que contiene el punto; si ninguna, la más cercana a menos de `tolerancia_m`
    (el GPS del celular tiene unos metros de error en los bordes)."""
    if not coordenada_valida(lat, lng):
        return None
    lat, lng = float(lat), float(lng)
    cercana, mejor = None, float("inf")
    for h in huertas:
        vertices = parsear_vertices(h.get("coordinates"))
        if punto_en_poligono(lat, lng, vertices):
            return h.get("id")
        d = distancia_a_borde_m(lat, lng, vertices)
        if d < mejor:
            cercana, mejor = h.get("id"), d
    return cercana if mejor <= tolerancia_m else None


def distancia_a_borde_m(lat: float, lng: float, vertices: list[tuple[float, float]]) -> float:
    """Distancia (m) del punto al lado más cercano del polígono (plano local; huertas de pocos km)."""
    if not vertices:
        return float("inf")
    kx = 111320.0 * math.cos(math.radians(lat))
    ky = 110574.0
    px, py = 0.0, 0.0
    pts = [((vlng - lng) * kx, (vlat - lat) * ky) for vlat, vlng in vertices]
    if len(pts) == 1:
        return math.hypot(*pts[0])
    mejor = float("inf")
    for i in range(len(pts)):
        ax, ay = pts[i]
        bx, by = pts[(i + 1) % len(pts)]
        dx, dy = bx - ax, by - ay
        largo2 = dx * dx + dy * dy
        t = 0.0 if largo2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / largo2))
        mejor = min(mejor, math.hypot(ax + t * dx - px, ay + t * dy - py))
    return mejor


# ───────────────────────── selección de fotos ─────────────────────────

def _fecha(valor) -> datetime:
    if isinstance(valor, datetime):
        return valor
    return datetime.fromisoformat(str(valor).replace("Z", "+00:00"))


def seleccionar_fotos(fotos: list[dict], min_dist_m: float = 2.5, min_seg_sin_gps: float = 2.0,
                      max_fotos: int = 600) -> list[dict]:
    """Elige qué fotos mandar al modelo: una cada `min_dist_m` metros recorridos.

    - Si la persona se detiene, no se repiten fotos del mismo lugar.
    - Si una foto no trae GPS, se usa el tiempo (una cada `min_seg_sin_gps` segundos).
    - Nunca se pasan de `max_fotos` (se reparten a lo largo del recorrido).
    """
    ordenadas = sorted(fotos, key=lambda f: _fecha(f["tomada_at"]))
    elegidas: list[dict] = []
    ultima = None
    for f in ordenadas:
        if ultima is None:
            elegidas.append(f)
            ultima = f
            continue
        con_gps = coordenada_valida(f.get("lat"), f.get("lng")) and coordenada_valida(ultima.get("lat"), ultima.get("lng"))
        if con_gps:
            avanzar = distancia_m(ultima["lat"], ultima["lng"], f["lat"], f["lng"]) >= min_dist_m
        else:
            avanzar = (_fecha(f["tomada_at"]) - _fecha(ultima["tomada_at"])).total_seconds() >= min_seg_sin_gps
        if avanzar:
            elegidas.append(f)
            ultima = f
    if len(elegidas) > max_fotos:
        paso = len(elegidas) / max_fotos
        elegidas = [elegidas[int(i * paso)] for i in range(max_fotos)]
    return elegidas


def nitidez(imagen_bytes: bytes) -> float:
    """Varianza de los bordes en escala de grises: valores bajos = foto borrosa o movida."""
    with Image.open(io.BytesIO(imagen_bytes)) as im:
        gris = im.convert("L")
        gris.thumbnail((640, 640))
        bordes = gris.filter(ImageFilter.FIND_EDGES)
        # El filtro marca el contorno de la propia imagen: se descarta ese marco.
        w, h = bordes.size
        if w > 8 and h > 8:
            bordes = bordes.crop((2, 2, w - 2, h - 2))
        return float(ImageStat.Stat(bordes).var[0])


def miniatura(imagen_bytes: bytes, lado_max: int = 480, calidad: int = 72) -> bytes:
    with Image.open(io.BytesIO(imagen_bytes)) as im:
        im = im.convert("RGB")
        im.thumbnail((lado_max, lado_max))
        out = io.BytesIO()
        im.save(out, format="JPEG", quality=calidad, optimize=True)
        return out.getvalue()


# ───────────────────────── resultados del modelo ─────────────────────────

@dataclass
class Deteccion:
    foto: dict
    fruto: str
    confianza_fruto: float
    estado: str
    confianza: float


def interpretar_prediccion(resultado: dict) -> Optional[tuple[str, float, str, float]]:
    """Toma la respuesta del servidor del modelo ({fruit: [...], state: [...]}) y devuelve
    (fruto, confianza_fruto, estado, confianza_estado) del primer lugar."""
    if not isinstance(resultado, dict):
        return None
    frutos = resultado.get("fruit") or []
    estados = resultado.get("state") or []
    if not frutos or not estados:
        return None
    f, s = frutos[0], estados[0]
    try:
        return str(f["class_name"]), float(f["confidence"]), str(s["class_name"]), float(s["confidence"])
    except (KeyError, TypeError, ValueError):
        return None


def es_fruto(fruto: str, confianza_fruto: float, umbral: float = 0.5) -> bool:
    return fruto.strip().lower() not in ETIQUETAS_SIN_FRUTO and confianza_fruto >= umbral


def es_sano(estado: str) -> bool:
    e = estado.lower()
    return any(s in e for s in ETIQUETAS_SANAS)


@dataclass
class Grupo:
    mejor: Deteccion
    cantidad: int = 1
    miembros: list = field(default_factory=list)


def agrupar(detecciones: list[Deteccion], max_dist_m: float = 10.0, max_seg: float = 30.0) -> list[Grupo]:
    """Une fotos seguidas, cercanas y con el mismo diagnóstico en un solo hallazgo
    (el mismo fruto suele salir en varias fotos). Se queda con la de mayor confianza."""
    grupos: list[Grupo] = []
    actual: Optional[Grupo] = None
    previa: Optional[Deteccion] = None
    for d in sorted(detecciones, key=lambda x: _fecha(x.foto["tomada_at"])):
        mismo = (
            actual is not None and previa is not None and
            d.fruto == actual.mejor.fruto and d.estado == actual.mejor.estado and
            (_fecha(d.foto["tomada_at"]) - _fecha(previa.foto["tomada_at"])).total_seconds() <= max_seg
        )
        if mismo and coordenada_valida(d.foto.get("lat"), d.foto.get("lng")) and coordenada_valida(previa.foto.get("lat"), previa.foto.get("lng")):
            mismo = distancia_m(previa.foto["lat"], previa.foto["lng"], d.foto["lat"], d.foto["lng"]) <= max_dist_m
        if mismo:
            actual.cantidad += 1
            actual.miembros.append(d)
            if d.confianza > actual.mejor.confianza:
                actual.mejor = d
        else:
            actual = Grupo(mejor=d, cantidad=1, miembros=[d])
            grupos.append(actual)
        previa = d
    return grupos


def resumen_notificacion(nombre_huerta: Optional[str], grupos: list[Grupo]) -> tuple[str, str]:
    lugar = f" en {nombre_huerta}" if nombre_huerta else ""
    titulo = f"Tu recorrido{lugar} está listo"
    if not grupos:
        return titulo, "No encontramos frutos en las fotos. Acércate a 30–50 cm de los frutos en el próximo recorrido."
    sanos = sum(1 for g in grupos if es_sano(g.mejor.estado))
    problemas: dict[str, int] = {}
    for g in grupos:
        if not es_sano(g.mejor.estado):
            problemas[g.mejor.estado] = problemas.get(g.mejor.estado, 0) + 1
    partes = []
    if sanos:
        partes.append(f"{sanos} {'sano' if sanos == 1 else 'sanos'}")
    for estado, n in sorted(problemas.items(), key=lambda kv: -kv[1]):
        partes.append(f"{n} con {estado}")
    total = len(grupos)
    return titulo, f"{total} {'hallazgo' if total == 1 else 'hallazgos'}: " + ", ".join(partes) + ". Toca para verlos en el mapa."
