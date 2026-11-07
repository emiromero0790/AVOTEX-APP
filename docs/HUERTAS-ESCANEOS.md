# Escaneos asociados a huertas

Cada **foto individual** (`scans`) y cada **recorrido inteligente** (`recorridos`) guarda la huerta donde se tomó.
Los **hallazgos** heredan siempre la huerta de su recorrido.

## Cómo se decide la huerta (antes de capturar)

`services/huertaResolver.ts` → `resolveScanHuerta(email)`. Lo usan Foto individual (`app/(app)/scan.tsx`) y Recorrido
inteligente (`app/(app)/recorrido.tsx`) antes de abrir la cámara o empezar a grabar.

1. Lee las huertas del usuario (`huertas` filtradas por `user_email`).
2. Pide una lectura GPS. Si no hay lectura en 9 s, usa la última conocida (de menos de 30 s y con precisión de 30 m o mejor).
3. Comprueba si el punto está **dentro del polígono real**. Usa `huertas.coordinates`: objetos `{latitude, longitude}`, o también `{lat, lng}` y `[lat, lng]`. Nunca usa el centro ni un radio.
4. Se asigna sola **solo** si el punto cae en **una** huerta, la precisión es de **30 m o mejor** y el punto está a más distancia del borde que la precisión.
5. Si no, abre la hoja **«¿Dónde guardarás este escaneo?»** con el motivo:

| Motivo | Mensaje |
|---|---|
| Fuera de todas | No te encuentras dentro de ninguna de tus huertas… |
| Sin permiso, GPS apagado o sin lectura | No pudimos verificar tu ubicación… |
| GPS impreciso o pegado al borde | La señal GPS no es lo bastante precisa (±X m)… |
| Varias huertas superpuestas | Tu ubicación coincide con más de una huerta… (con la insignia «Tu ubicación») |
| Sin huertas | Puedes guardar sin huerta o registrar una en Mapeo |

En la hoja nada viene preseleccionado. «Continuar» solo se habilita con una huerta o con **«No asignar a ninguna huerta»** (`huerta_id = null`). Cerrarla no crea nada.

Una vez decidida, la huerta se conserva durante toda la captura:

- **Foto individual:** la misma huerta vale para todas las fotos de esa sesión de cámara, sus reintentos y su guardado. No se vuelve a calcular después de la foto ni de la IA. La cámara muestra «Huerta: …» o «Sin huerta asignada».
- **Recorrido:** se guarda en el archivo local del recorrido (`huertaId`, sobrevive a cerrar la app). Se envía como `recorridos.huerta_id` al subir, y los reintentos reutilizan el mismo `remoteId`. Si en la preparación el usuario ya eligió una huerta, se usa esa y no se pregunta.
- **Procesador** (`processor/procesar_recorridos.py`): los hallazgos reciben exactamente el `huerta_id` del recorrido y no lo recalcula por GPS. La excepción son las importaciones de dron/cámara sin huerta: sus fotos se tomaron en otro momento, así que la huerta se detecta por el GPS de las fotos y todos sus hallazgos la heredan.

## Base de datos — qué ejecutar en Supabase (SQL Editor)

1. **`supabase/migrations/20261108_scans_huerta.sql`** (obligatoria, se puede repetir). Hace lo siguiente:
   - Agrega `scans.huerta_id uuid NULL`, una llave foránea a `huertas(id)` con `ON DELETE SET NULL`, e índices.
   - Agrega triggers de integridad:
     - `scans` y `recorridos` solo aceptan una huerta del **mismo `user_email`**.
     - Los hallazgos copian la huerta de su recorrido, y si el recorrido cambia de huerta, sus hallazgos la siguen.
   - Al final trae consultas de verificación (columna, llave, triggers, RLS, políticas y tipo de `poligono`).
2. `supabase/migrations/20261107_scans_ubicacion.sql` (**opcional**): `id`, `lat`, `lng`, `precision_m` e `imagen_path` en `scans`, para ver las fotos en el mapa de Mis escaneos. Ya no toca la huerta.
   - **Por qué conviene un `id`:** `scans` no tiene llave primaria. Sin ella no se puede abrir ni actualizar un escaneo concreto de forma fiable (hoy solo se puede por `ctid`, que cambia con cada UPDATE o VACUUM).
   - **No es requisito:** la asociación a huertas funciona sin el `id`.
3. **Datos históricos** (opcional, revisa antes de confirmar):
   - **`supabase/sql/historico_escaneos_huertas.sql`:**
     - **A:** vista previa.
     - **B:** reparto aleatorio por escaneo; termina en `ROLLBACK`, y para guardar se cambia por `COMMIT`.
     - **C y D:** verificación.
   - **`supabase/sql/historico_recorridos_huertas.sql`:**
     - **R1–R2:** vista previa e inconsistencias.
     - **R3:** resuelve sin azar los recorridos cuyos hallazgos coinciden en una sola huerta.
     - **R4:** sorteo de los demás.
     - **R5:** verificación.
   - **Fecha de corte:** ambos solo sortean registros **anteriores a la fecha de publicación** de esta versión (`antes_de`, por defecto 2026-11-09). Así no se reparten los escaneos que el usuario guardó a propósito con «No asignar».
   - **No es ubicación real:** el reparto aleatorio sirve para datos antiguos o de prueba, no como evidencia de dónde se tomaron.

App y base son compatibles en cualquier orden: si una columna no existe todavía, la app guarda sin ella (en capas) y la lee con respaldo.

## Seguridad: lo que protege la base de datos y lo que no

- **Protegido por triggers**, sin importar qué cliente escriba:
  - un escaneo o recorrido no puede quedar en una huerta de otra cuenta;
  - un hallazgo no puede tener otra huerta que la de su recorrido;
  - un hallazgo no puede ser de otro usuario que su recorrido.
- **No protegido (riesgo existente, no introducido aquí):** la app inicia sesión con **Firebase** y habla con Supabase con la **anon key**. Supabase no sabe quién llama: no hay RLS por usuario (ver `20260911_create_huertas.sql`). Quien tenga la anon key puede leer o escribir filas indicando cualquier `user_email`. Los filtros por usuario de la app no bastan como seguridad.
  - **Corrección recomendada:**
    - configurar Firebase como proveedor de terceros en Supabase (Auth → Third-party auth);
    - enviar el ID token de Firebase en cada petición;
    - activar RLS con políticas `user_email = auth.jwt() ->> 'email'` en `huertas`, `scans`, `recorridos`, `recorrido_fotos` y `hallazgos`.
  - **Por qué no se aplicó aquí:** activar RLS sin ese paso dejaría la app sin acceso a sus propios datos. No se activó ni se usó la service role en la app.

## Actividad → Historial

- **Selector de huerta** (Todas · cada huerta · Sin huerta asignada), con el número de registros. Solo filtra lo que se ve; no modifica nada.
- **Historial unificado y cronológico:**
  - **Fotos individuales** (`scans`): cultivo, resultado, confianza, fecha y huerta.
  - **Recorridos** (`recorridos`): estado, fotos, hallazgos, fecha y huerta. Cada recorrido es **un** registro; sus hallazgos no se cuentan aparte.
- **Filtros combinados:** el filtro de cultivo se combina con el de huerta. Un recorrido entra en un cultivo si tiene hallazgos de ese cultivo.
- **Huerta sin registros:** muestra «Todavía no hay escaneos en esta huerta» → «Realizar escaneo».
- **Resumen:** mantiene su propio filtro de huerta y su nota sobre las fotos sin huerta.
