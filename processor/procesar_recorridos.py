"""Procesador de recorridos de AVOTEX.

Lo ejecuta GitHub Actions cada ~10 minutos (.github/workflows/procesar-recorridos.yml):
  1. Busca recorridos en estado "pendiente" en Supabase.
  2. Elige las fotos útiles (una cada 2–3 m, sin borrosas).
  3. Las manda en grupos al modelo que ya está en Google Cloud (/predict_batch). El modelo no se modifica.
  4. Agrupa las detecciones en hallazgos, les asigna la huerta por GPS y guarda una miniatura.
  5. Borra las fotos originales, marca el recorrido como "listo" y envía la notificación push.

Variables de entorno (secretos del repositorio en GitHub):
  SUPABASE_URL                 https://<proyecto>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY    clave service_role (nunca en la app ni en el repositorio)
  MODEL_URL                    opcional; si falta se lee de la tabla "ia" (igual que la app)
Opcionales: MAX_RECORRIDOS (5), LOTE_MODELO (16), MIN_DIST_M (2.5), MAX_FOTOS (600), UMBRAL_NITIDEZ (60)
"""
from __future__ import annotations

import os
import sys
import time
import traceback
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Optional

import requests

import nucleo

BUCKET = "recorridos"
IA_ROW_ID = "7293688b-1ee9-469c-9679-d69d9a1089a5"  # misma fila que usa la app (scan.tsx)
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
MAX_INTENTOS = 3


def log(msg: str) -> None:
    print(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] {msg}", flush=True)


class Supabase:
    """Cliente mínimo de la API REST y de Storage de Supabase."""

    def __init__(self, url: str, key: str, session: Optional[requests.Session] = None):
        self.url = url.rstrip("/")
        self.s = session or requests.Session()
        self.s.headers.update({"apikey": key, "Authorization": f"Bearer {key}"})

    def _check(self, r: requests.Response) -> requests.Response:
        if r.status_code >= 400:
            raise RuntimeError(f"Supabase {r.request.method} {r.url.split('?')[0]} → HTTP {r.status_code}: {r.text[:300]}")
        return r

    def select(self, tabla: str, params: dict) -> list:
        return self._check(self.s.get(f"{self.url}/rest/v1/{tabla}", params=params, timeout=30)).json()

    def update(self, tabla: str, filtros: dict, datos: dict) -> list:
        r = self.s.patch(f"{self.url}/rest/v1/{tabla}", params=filtros, json=datos,
                         headers={"Prefer": "return=representation"}, timeout=30)
        return self._check(r).json()

    def insert(self, tabla: str, filas: list) -> list:
        if not filas:
            return []
        r = self.s.post(f"{self.url}/rest/v1/{tabla}", json=filas, headers={"Prefer": "return=representation"}, timeout=60)
        return self._check(r).json()

    def delete(self, tabla: str, filtros: dict) -> None:
        self._check(self.s.delete(f"{self.url}/rest/v1/{tabla}", params=filtros, timeout=30))

    def descargar(self, path: str) -> bytes:
        return self._check(self.s.get(f"{self.url}/storage/v1/object/{BUCKET}/{path}", timeout=60)).content

    def subir(self, path: str, datos: bytes, tipo: str = "image/jpeg") -> None:
        r = self.s.post(f"{self.url}/storage/v1/object/{BUCKET}/{path}", data=datos,
                        headers={"Content-Type": tipo, "x-upsert": "true"}, timeout=60)
        self._check(r)

    def borrar_archivos(self, paths: list) -> None:
        for i in range(0, len(paths), 100):
            r = self.s.delete(f"{self.url}/storage/v1/object/{BUCKET}", json={"prefixes": paths[i:i + 100]}, timeout=60)
            self._check(r)


class Modelo:
    """Cliente del servidor del modelo que ya existe (server2.py en Cloud Run)."""

    def __init__(self, url: str, session: Optional[requests.Session] = None, timeout: int = 300, reintentos: int = 2):
        self.url = url.rstrip("/")
        self.s = session or requests.Session()
        self.timeout = timeout
        self.reintentos = reintentos

    def predecir_lote(self, imagenes: list[tuple[str, bytes]]) -> list[dict]:
        """Devuelve una lista alineada con `imagenes`: el `result` de cada foto o None si falló."""
        archivos = [("files", (nombre, datos, "image/jpeg")) for nombre, datos in imagenes]
        ultimo_error = None
        for intento in range(self.reintentos + 1):
            try:
                r = self.s.post(f"{self.url}/predict_batch", params={"top_k": 1, "max_batch": max(1, len(imagenes))},
                                files=archivos, timeout=self.timeout)
                if r.status_code >= 500:
                    raise RuntimeError(f"HTTP {r.status_code}")
                r.raise_for_status()
                preds = r.json().get("predictions", [])
                por_nombre = {p.get("filename"): p.get("result") for p in preds}
                return [por_nombre.get(nombre) for nombre, _ in imagenes]
            except Exception as e:  # red, arranque en frío, 5xx
                ultimo_error = e
                espera = 15 * (intento + 1)
                log(f"  modelo falló ({e}); reintento en {espera}s")
                time.sleep(espera)
        raise RuntimeError(f"El modelo no respondió después de {self.reintentos + 1} intentos: {ultimo_error}")


def enviar_push(sb: Supabase, email: str, titulo: str, cuerpo: str, datos: dict, session=None) -> int:
    """Notificación con el servicio gratuito de Expo. Devuelve cuántos dispositivos la recibieron."""
    tokens = [t["token"] for t in sb.select("push_tokens", {"user_email": f"eq.{email}", "select": "token"})]
    if not tokens:
        return 0
    s = session or requests.Session()
    mensajes = [{"to": t, "title": titulo, "body": cuerpo, "data": datos, "sound": "default", "channelId": "recorridos"} for t in tokens]
    try:
        r = s.post(EXPO_PUSH_URL, json=mensajes, timeout=30)
        r.raise_for_status()
        enviados = 0
        for token, ticket in zip(tokens, r.json().get("data", [])):
            if ticket.get("status") == "ok":
                enviados += 1
            elif (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                sb.delete("push_tokens", {"token": f"eq.{token}"})  # la app se desinstaló
        return enviados
    except Exception as e:
        log(f"  no se pudo enviar la notificación: {e}")
        return 0


def url_del_modelo(sb: Supabase) -> str:
    if os.environ.get("MODEL_URL"):
        return os.environ["MODEL_URL"]
    filas = sb.select("ia", {"id": f"eq.{IA_ROW_ID}", "select": "url"})
    if not filas or not filas[0].get("url"):
        raise RuntimeError("No se encontró la URL del modelo en la tabla ia")
    return filas[0]["url"]


def recuperar_atascados(sb: Supabase) -> None:
    """Un recorrido "procesando" por más de 90 min (el trabajo anterior se cortó) vuelve a la cola,
    y los que fallaron se reintentan después de 30 min, hasta MAX_INTENTOS."""
    ahora = datetime.now(timezone.utc)
    hace_90 = (ahora - timedelta(minutes=90)).isoformat()
    hace_30 = (ahora - timedelta(minutes=30)).isoformat()
    sb.update("recorridos", {"estado": "eq.procesando", "updated_at": f"lt.{hace_90}"}, {"estado": "pendiente"})
    sb.update("recorridos", {"estado": "eq.error", "intentos": f"lt.{MAX_INTENTOS}", "updated_at": f"lt.{hace_30}"}, {"estado": "pendiente"})


def tomar(sb: Supabase, recorrido: dict) -> bool:
    """Marca el recorrido como "procesando" solo si sigue pendiente (evita procesarlo dos veces)."""
    filas = sb.update("recorridos", {"id": f"eq.{recorrido['id']}", "estado": "eq.pendiente"},
                      {"estado": "procesando", "intentos": int(recorrido.get("intentos") or 0) + 1, "error": None})
    return bool(filas)


def procesar(sb: Supabase, modelo: Modelo, recorrido: dict, cfg: dict) -> dict:
    rid = recorrido["id"]
    email = recorrido["user_email"]
    fotos = sb.select("recorrido_fotos", {"recorrido_id": f"eq.{rid}", "select": "*", "order": "tomada_at.asc"})
    elegidas = nucleo.seleccionar_fotos(fotos, min_dist_m=cfg["min_dist_m"], max_fotos=cfg["max_fotos"])
    log(f"  {len(fotos)} fotos → {len(elegidas)} elegidas por distancia")

    # Descarga y descarta las borrosas (si todas salen borrosas se usan igual: mejor algo que nada).
    descargadas = []
    for f in elegidas:
        try:
            datos = sb.descargar(f["storage_path"])
        except Exception as e:
            log(f"  no se pudo descargar {f['storage_path']}: {e}")
            continue
        try:
            nit = nucleo.nitidez(datos)
        except Exception:
            continue  # no es una imagen válida
        descargadas.append((f, datos, nit))
    nitidas = [d for d in descargadas if d[2] >= cfg["umbral_nitidez"]] or descargadas
    log(f"  {len(nitidas)} fotos nítidas para el modelo")

    detecciones: list[nucleo.Deteccion] = []
    datos_por_foto = {}
    for i in range(0, len(nitidas), cfg["lote"]):
        lote = nitidas[i:i + cfg["lote"]]
        resultados = modelo.predecir_lote([(f"{f['id']}.jpg", datos) for f, datos, _ in lote])
        for (f, datos, _), res in zip(lote, resultados):
            pred = nucleo.interpretar_prediccion(res)
            if not pred:
                continue
            fruto, conf_fruto, estado, conf = pred
            if nucleo.es_fruto(fruto, conf_fruto):
                detecciones.append(nucleo.Deteccion(f, fruto, conf_fruto, estado, conf))
                datos_por_foto[f["id"]] = datos

    grupos = nucleo.agrupar(detecciones)
    huertas = sb.select("huertas", {"user_email": f"eq.{email}", "select": "id,nombre,coordinates"})

    # Reintento seguro: se reemplazan los hallazgos de una corrida anterior incompleta.
    sb.delete("hallazgos", {"recorrido_id": f"eq.{rid}"})
    filas = []
    for n, g in enumerate(grupos, start=1):
        f = g.mejor.foto
        miniatura_path = f"hallazgos/{rid}/{n:03d}.jpg"
        sb.subir(miniatura_path, nucleo.miniatura(datos_por_foto[f["id"]]))
        filas.append({
            "recorrido_id": rid,
            "user_email": email,
            "huerta_id": nucleo.huerta_para_punto(f.get("lat"), f.get("lng"), huertas) or recorrido.get("huerta_id"),
            "tomada_at": f["tomada_at"],
            "lat": f.get("lat"),
            "lng": f.get("lng"),
            "fruto": g.mejor.fruto,
            "estado": g.mejor.estado,
            "confianza": round(g.mejor.confianza, 4),
            "confianza_fruto": round(g.mejor.confianza_fruto, 4),
            "fotos_en_grupo": g.cantidad,
            "miniatura_path": miniatura_path,
        })
    sb.insert("hallazgos", filas)

    # Huerta del recorrido: la que más hallazgos tuvo (si la app no la indicó).
    huerta_id = recorrido.get("huerta_id")
    if not huerta_id:
        conteo = Counter(fl["huerta_id"] for fl in filas if fl["huerta_id"])
        if not conteo:
            puntos = [f for f in fotos if nucleo.coordenada_valida(f.get("lat"), f.get("lng"))]
            conteo = Counter(h for h in (nucleo.huerta_para_punto(p["lat"], p["lng"], huertas) for p in puntos) if h)
        huerta_id = conteo.most_common(1)[0][0] if conteo else None

    # Privacidad y espacio: las fotos originales se borran; solo quedan las miniaturas.
    sb.borrar_archivos([f["storage_path"] for f in fotos])

    sb.update("recorridos", {"id": f"eq.{rid}"}, {
        "estado": "listo",
        "huerta_id": huerta_id,
        "fotos_analizadas": len(nitidas),
        "hallazgos_total": len(filas),
        "procesado_at": datetime.now(timezone.utc).isoformat(),
        "error": None,
    })

    nombre = next((h.get("nombre") for h in huertas if h.get("id") == huerta_id), None)
    titulo, cuerpo = nucleo.resumen_notificacion(nombre, grupos)
    enviados = enviar_push(sb, email, titulo, cuerpo, {"tipo": "recorrido", "recorridoId": rid})
    log(f"  listo: {len(filas)} hallazgos; notificación a {enviados} dispositivo(s)")
    return {"hallazgos": len(filas), "analizadas": len(nitidas), "notificados": enviados}


def configuracion() -> dict:
    return {
        "max_recorridos": int(os.environ.get("MAX_RECORRIDOS", "5")),
        "lote": max(1, min(64, int(os.environ.get("LOTE_MODELO", "16")))),
        "min_dist_m": float(os.environ.get("MIN_DIST_M", "2.5")),
        "max_fotos": int(os.environ.get("MAX_FOTOS", "600")),
        "umbral_nitidez": float(os.environ.get("UMBRAL_NITIDEZ", "60")),
    }


def main() -> int:
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        log("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY")
        return 2
    cfg = configuracion()
    sb = Supabase(url, key)
    recuperar_atascados(sb)
    pendientes = sb.select("recorridos", {"estado": "eq.pendiente", "select": "*", "order": "created_at.asc", "limit": cfg["max_recorridos"]})
    if not pendientes:
        log("Sin recorridos pendientes.")
        return 0
    modelo = Modelo(url_del_modelo(sb))
    fallos = 0
    for r in pendientes:
        if not tomar(sb, r):
            continue
        log(f"Recorrido {r['id']} ({r['user_email']})")
        try:
            procesar(sb, modelo, r, cfg)
        except Exception as e:
            fallos += 1
            traceback.print_exc()
            sb.update("recorridos", {"id": f"eq.{r['id']}"}, {"estado": "error", "error": str(e)[:500]})
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
