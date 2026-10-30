"""Pruebas del procesador (sin red). Ejecutar desde la raíz del repositorio:
    python -m unittest discover -s processor/tests -v
"""
import io
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from PIL import Image, ImageDraw  # noqa: E402

import nucleo  # noqa: E402
import procesar_recorridos as pr  # noqa: E402


def jpg_nitida() -> bytes:
    im = Image.new("RGB", (320, 240), "white")
    d = ImageDraw.Draw(im)
    for x in range(0, 320, 16):
        for y in range(0, 240, 16):
            if (x // 16 + y // 16) % 2:
                d.rectangle([x, y, x + 15, y + 15], fill="black")
    out = io.BytesIO()
    im.save(out, "JPEG")
    return out.getvalue()


def jpg_borrosa() -> bytes:
    """La misma imagen nítida, pero muy desenfocada (como una foto movida)."""
    from PIL import ImageFilter
    with Image.open(io.BytesIO(jpg_nitida())) as im:
        out = io.BytesIO()
        im.filter(ImageFilter.GaussianBlur(10)).save(out, "JPEG")
        return out.getvalue()


T0 = datetime(2026, 10, 30, 9, 0, tzinfo=timezone.utc)
# Huerta cuadrada de ~110 m de lado
CUADRO = [{"latitude": 19.4650, "longitude": -101.7225}, {"latitude": 19.4650, "longitude": -101.7215},
          {"latitude": 19.4660, "longitude": -101.7215}, {"latitude": 19.4660, "longitude": -101.7225}]


def foto(i, segundos, lat, lng, path=None):
    return {"id": f"f{i}", "storage_path": path or f"fotos/r1/{i}.jpg",
            "tomada_at": (T0 + timedelta(seconds=segundos)).isoformat(), "lat": lat, "lng": lng}


class GeografiaTest(unittest.TestCase):
    def test_distancia(self):
        d = nucleo.distancia_m(19.465, -101.722, 19.466, -101.722)
        self.assertAlmostEqual(d, 111.2, delta=0.5)

    def test_punto_en_poligono_y_huerta(self):
        verts = nucleo.parsear_vertices(CUADRO)
        self.assertTrue(nucleo.punto_en_poligono(19.4655, -101.722, verts))
        self.assertFalse(nucleo.punto_en_poligono(19.4670, -101.722, verts))
        huertas = [{"id": "h1", "coordinates": CUADRO}]
        self.assertEqual(nucleo.huerta_para_punto(19.4655, -101.722, huertas), "h1")
        # A ~8 m fuera del borde norte: se acepta por el error del GPS
        self.assertEqual(nucleo.huerta_para_punto(19.46607, -101.7220, huertas), "h1")
        self.assertIsNone(nucleo.huerta_para_punto(19.4700, -101.7220, huertas))
        self.assertIsNone(nucleo.huerta_para_punto(None, None, huertas))
        self.assertIsNone(nucleo.huerta_para_punto(0, 0, huertas))

    def test_parsear_vertices_formatos(self):
        self.assertEqual(nucleo.parsear_vertices('[{"lat":1,"lng":2},[3,4]]'), [(1.0, 2.0), (3.0, 4.0)])
        self.assertEqual(nucleo.parsear_vertices("x"), [])
        self.assertEqual(nucleo.parsear_vertices(None), [])


class SeleccionTest(unittest.TestCase):
    def test_una_cada_distancia_y_sin_repetir_al_detenerse(self):
        fotos = []
        # Camina 1 m por segundo hacia el norte durante 10 s, luego se queda quieto 10 s
        for s in range(20):
            lat = 19.4650 + min(s, 10) * (1 / 111195)
            fotos.append(foto(s, s, lat, -101.722))
        elegidas = nucleo.seleccionar_fotos(fotos, min_dist_m=2.5)
        self.assertEqual([f["id"] for f in elegidas], ["f0", "f3", "f6", "f9"])

    def test_sin_gps_usa_el_tiempo(self):
        fotos = [foto(s, s, None, None) for s in range(7)]
        self.assertEqual(len(nucleo.seleccionar_fotos(fotos, min_seg_sin_gps=2.0)), 4)

    def test_tope_maximo(self):
        fotos = [foto(s, s, 19.465 + s * 3 / 111195, -101.722) for s in range(100)]
        elegidas = nucleo.seleccionar_fotos(fotos, min_dist_m=2.5, max_fotos=10)
        self.assertEqual(len(elegidas), 10)
        self.assertEqual(elegidas[0]["id"], "f0")

    def test_nitidez_distingue_borrosas(self):
        self.assertGreater(nucleo.nitidez(jpg_nitida()), 60)
        self.assertLess(nucleo.nitidez(jpg_borrosa()), 60)

    def test_miniatura_es_pequena(self):
        m = nucleo.miniatura(jpg_nitida(), lado_max=100)
        with Image.open(io.BytesIO(m)) as im:
            self.assertLessEqual(max(im.size), 100)


class ResultadosTest(unittest.TestCase):
    def test_interpretar(self):
        res = {"fruit": [{"class_name": "Aguacate", "confidence": 0.9}], "state": [{"class_name": "Antracnosis", "confidence": 0.8}]}
        self.assertEqual(nucleo.interpretar_prediccion(res), ("Aguacate", 0.9, "Antracnosis", 0.8))
        self.assertIsNone(nucleo.interpretar_prediccion({"fruit": []}))
        self.assertIsNone(nucleo.interpretar_prediccion(None))

    def test_es_fruto(self):
        self.assertTrue(nucleo.es_fruto("Aguacate", 0.9))
        self.assertFalse(nucleo.es_fruto("Nofruta", 0.99))
        self.assertFalse(nucleo.es_fruto("Aguacate", 0.3))

    def test_agrupar_fotos_seguidas_con_mismo_diagnostico(self):
        def det(i, s, lat, estado, conf):
            return nucleo.Deteccion(foto(i, s, lat, -101.722), "Aguacate", 0.9, estado, conf)
        m = 1 / 111195
        dets = [
            det(1, 0, 19.4650, "Antracnosis", 0.7),
            det(2, 3, 19.4650 + 3 * m, "Antracnosis", 0.9),   # mismo fruto, mejor foto
            det(3, 6, 19.4650 + 6 * m, "Saludable", 0.8),     # cambia el diagnóstico
            det(4, 9, 19.4650 + 40 * m, "Saludable", 0.85),   # mismo diagnóstico pero 34 m después
        ]
        grupos = nucleo.agrupar(dets)
        self.assertEqual(len(grupos), 3)
        self.assertEqual(grupos[0].cantidad, 2)
        self.assertEqual(grupos[0].mejor.foto["id"], "f2")
        titulo, cuerpo = nucleo.resumen_notificacion("La nueva brecha 3", grupos)
        self.assertEqual(titulo, "Tu recorrido en La nueva brecha 3 está listo")
        self.assertIn("3 hallazgos", cuerpo)
        self.assertIn("2 sanos", cuerpo)
        self.assertIn("1 con Antracnosis", cuerpo)

    def test_resumen_sin_hallazgos(self):
        titulo, cuerpo = nucleo.resumen_notificacion(None, [])
        self.assertEqual(titulo, "Tu recorrido está listo")
        self.assertIn("No encontramos frutos", cuerpo)


class FakeSupabase:
    def __init__(self, fotos, archivos, huertas, tokens=()):
        self.tablas = {
            "recorrido_fotos": fotos,
            "huertas": huertas,
            "push_tokens": [{"token": t, "user_email": "a@b.mx"} for t in tokens],
            "hallazgos": [],
        }
        self.archivos = dict(archivos)
        self.updates, self.borrados, self.subidos = [], [], {}

    def select(self, tabla, params):
        return list(self.tablas.get(tabla, []))

    def update(self, tabla, filtros, datos):
        self.updates.append((tabla, filtros, datos))
        return [datos]

    def insert(self, tabla, filas):
        self.tablas.setdefault(tabla, []).extend(filas)
        return filas

    def delete(self, tabla, filtros):
        if tabla == "hallazgos":
            self.tablas["hallazgos"] = []
        if tabla == "push_tokens":
            tok = filtros["token"].split(".", 1)[1]
            self.tablas["push_tokens"] = [t for t in self.tablas["push_tokens"] if t["token"] != tok]

    def descargar(self, path):
        return self.archivos[path]

    def subir(self, path, datos, tipo="image/jpeg"):
        self.subidos[path] = datos

    def borrar_archivos(self, paths):
        self.borrados.extend(paths)


class FakeModelo:
    """Devuelve un diagnóstico según el número de foto y cuenta las llamadas."""
    def __init__(self, respuestas):
        self.respuestas = respuestas
        self.llamadas = []

    def predecir_lote(self, imagenes):
        self.llamadas.append([n for n, _ in imagenes])
        return [self.respuestas.get(n) for n, _ in imagenes]


def res(fruto, cf, estado, ce):
    return {"fruit": [{"class_name": fruto, "confidence": cf}], "state": [{"class_name": estado, "confidence": ce}]}


class ProcesarTest(unittest.TestCase):
    def test_flujo_completo(self):
        m = 1 / 111195
        fotos = [foto(i, i * 3, 19.4652 + i * 3 * m, -101.7220) for i in range(6)]
        fotos.append(foto(6, 18, 19.4652 + 15 * m, -101.7220))  # parado: misma posición que f5
        archivos = {f["storage_path"]: jpg_nitida() for f in fotos}
        archivos["fotos/r1/4.jpg"] = jpg_borrosa()
        sb = FakeSupabase(fotos, archivos, [{"id": "h1", "nombre": "Huerta 1", "coordinates": CUADRO}], tokens=["ExponentPushToken[x]"])
        modelo = FakeModelo({
            "f0.jpg": res("Aguacate", 0.95, "Antracnosis", 0.81),
            "f1.jpg": res("Aguacate", 0.92, "Antracnosis", 0.88),
            "f2.jpg": res("Nofruta", 0.97, "ninguno", 0.99),
            "f3.jpg": res("Aguacate", 0.90, "Saludable", 0.93),
            "f5.jpg": None,  # el modelo falló con esta foto
        })
        respuesta_push = mock.Mock(status_code=200)
        respuesta_push.json.return_value = {"data": [{"status": "ok"}]}
        respuesta_push.raise_for_status = lambda: None
        with mock.patch.object(pr.requests, "Session") as S:
            S.return_value.post.return_value = respuesta_push
            out = pr.procesar(sb, modelo, {"id": "r1", "user_email": "a@b.mx", "huerta_id": None},
                              {"lote": 2, "min_dist_m": 2.5, "max_fotos": 600, "umbral_nitidez": 60})
            enviado = S.return_value.post.call_args.kwargs["json"][0]

        # f6 se descarta por no moverse; f4 por borrosa; el resto va al modelo en lotes de 2
        self.assertEqual(modelo.llamadas, [["f0.jpg", "f1.jpg"], ["f2.jpg", "f3.jpg"], ["f5.jpg"]])
        hall = sb.tablas["hallazgos"]
        self.assertEqual([(h["estado"], h["fotos_en_grupo"]) for h in hall], [("Antracnosis", 2), ("Saludable", 1)])
        self.assertEqual(hall[0]["confianza"], 0.88)       # se queda con la mejor foto del grupo
        self.assertEqual(hall[0]["huerta_id"], "h1")       # asignada por GPS
        self.assertEqual(set(sb.subidos), {"hallazgos/r1/001.jpg", "hallazgos/r1/002.jpg"})
        self.assertEqual(sorted(sb.borrados), sorted(f["storage_path"] for f in fotos))  # originales borradas
        final = sb.updates[-1][2]
        self.assertEqual(final["estado"], "listo")
        self.assertEqual(final["huerta_id"], "h1")
        self.assertEqual(final["hallazgos_total"], 2)
        self.assertEqual(out["notificados"], 1)
        self.assertEqual(enviado["title"], "Tu recorrido en Huerta 1 está listo")
        self.assertEqual(enviado["data"], {"tipo": "recorrido", "recorridoId": "r1"})

    def test_recorrido_sin_fotos(self):
        sb = FakeSupabase([], {}, [])
        out = pr.procesar(sb, FakeModelo({}), {"id": "r2", "user_email": "a@b.mx"},
                          {"lote": 16, "min_dist_m": 2.5, "max_fotos": 600, "umbral_nitidez": 60})
        self.assertEqual(out["hallazgos"], 0)
        self.assertEqual(sb.updates[-1][2]["estado"], "listo")

    def test_token_desinstalado_se_borra(self):
        sb = FakeSupabase([], {}, [], tokens=["t-viejo", "t-bueno"])
        r = mock.Mock()
        r.raise_for_status = lambda: None
        r.json.return_value = {"data": [{"status": "error", "details": {"error": "DeviceNotRegistered"}}, {"status": "ok"}]}
        sesion = mock.Mock()
        sesion.post.return_value = r
        enviados = pr.enviar_push(sb, "a@b.mx", "t", "c", {}, session=sesion)
        self.assertEqual(enviados, 1)
        self.assertEqual([t["token"] for t in sb.tablas["push_tokens"]], ["t-bueno"])

    def test_modelo_reintenta_y_se_rinde(self):
        sesion = mock.Mock()
        sesion.post.side_effect = RuntimeError("cold start")
        modelo = pr.Modelo("https://modelo", session=sesion, reintentos=1)
        with mock.patch.object(pr.time, "sleep"):
            with self.assertRaises(RuntimeError):
                modelo.predecir_lote([("a.jpg", b"x")])
        self.assertEqual(sesion.post.call_count, 2)

    def test_modelo_alinea_resultados_por_nombre(self):
        r = mock.Mock(status_code=200)
        r.raise_for_status = lambda: None
        r.json.return_value = {"predictions": [{"filename": "b.jpg", "result": {"x": 2}}, {"filename": "a.jpg", "error": "mala"}]}
        sesion = mock.Mock()
        sesion.post.return_value = r
        out = pr.Modelo("https://modelo/", session=sesion).predecir_lote([("a.jpg", b"1"), ("b.jpg", b"2")])
        self.assertEqual(out, [None, {"x": 2}])
        self.assertEqual(sesion.post.call_args.args[0], "https://modelo/predict_batch")


if __name__ == "__main__":
    unittest.main()
