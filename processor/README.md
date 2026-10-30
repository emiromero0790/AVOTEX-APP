# Procesador de recorridos (GitHub Actions + Supabase)

La app toma fotos automáticas con GPS durante el recorrido ("modo recorrido") y las sube cuando hay internet.
Este procesador las analiza en segundo plano: la persona puede cerrar la app y recibe una notificación cuando termina.

```
App → sube fotos a Supabase Storage (bucket "recorridos") → recorrido en estado "pendiente"
GitHub Actions (cada 10 min) → procesar_recorridos.py
  → elige 1 foto cada 2.5 m y descarta las borrosas
  → manda las fotos al modelo de Google Cloud en grupos (/predict_batch; el modelo NO se modifica)
  → agrupa detecciones en "hallazgos", les asigna la huerta por GPS y guarda una miniatura
  → borra las fotos originales → recorrido "listo" → notificación push (Expo, gratis)
```

## Puesta en marcha (una sola vez)

1. **Base de datos.** En Supabase → *SQL Editor*, ejecutar `supabase/migrations/20261030_recorridos.sql`.
   Crea las tablas `recorridos`, `recorrido_fotos`, `hallazgos` y `push_tokens`, y el bucket privado `recorridos`.
2. **Secretos en GitHub.** En el repositorio → *Settings → Secrets and variables → Actions → New repository secret*:
   - `SUPABASE_URL`: `https://<proyecto>.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase → *Project Settings → API keys* → `service_role`.
     **Nunca** ponerla en la app, en la página web ni en el repositorio.
   - `MODEL_URL` (opcional): si no se define, se usa la URL de la tabla `ia`, igual que la app.
3. **Activar el flujo.** Los flujos programados solo corren desde `main`: al unir esta rama a `main` empieza solo.
   Para probar sin esperar: pestaña *Actions → Procesar recorridos → Run workflow*.

## Costos

- **GitHub Actions:** gratis sin límite de minutos porque el repositorio es público. Si se vuelve privado, el plan
  gratuito trae 2,000 min/mes y cada ejecución cuenta como mínimo 1 minuto. En ese caso, cambia el `cron` a
  `*/30 * * * *` o activa el procesador desde Supabase cuando llegue un recorrido.
- **Supabase Storage:** el plan gratuito trae 1 GB. Las fotos originales se borran al procesarse y solo quedan
  miniaturas de ~30 KB por hallazgo.
- **Modelo (Cloud Run):** es lo único que consume créditos. El procesador elige pocas fotos y las manda en grupos,
  así que el arranque en frío (~45 s medidos) se paga una sola vez por ronda; ya encendido tarda ~0.6 s por foto.
- **Notificaciones:** el servicio de Expo es gratuito.

Medición real (30 oct 2026, `/predict_batch` con 2 fotos): primera llamada 44.9 s, segunda 1.2 s.

## Ajustes (variables de entorno opcionales)

| Variable | Por defecto | Qué hace |
|---|---|---|
| `MAX_RECORRIDOS` | 5 | Recorridos por ronda |
| `LOTE_MODELO` | 16 | Fotos por llamada al modelo (máx. 64) |
| `MIN_DIST_M` | 2.5 | Metros mínimos entre fotos analizadas |
| `MAX_FOTOS` | 600 | Tope de fotos por recorrido |
| `UMBRAL_NITIDEZ` | 60 | Debajo de este valor la foto se considera borrosa |

## Estados y reintentos

`subiendo` → `pendiente` → `procesando` → `listo` (o `error`).

- Un recorrido que falla se reintenta a los 30 min, hasta 3 veces. Sus fotos no se borran hasta que se procesa bien.
- Si una ejecución se corta, el recorrido vuelve a la cola a los 90 min.

## Pruebas

```bash
python -m unittest discover -s processor/tests -v
```

No usan red: Supabase y el modelo se simulan.
