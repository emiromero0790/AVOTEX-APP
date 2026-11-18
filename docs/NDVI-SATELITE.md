# Mapa de vigor (NDVI) en Satélite

En la pantalla **Satélite**, la capa **«Satélite»** pinta dentro del contorno de la huerta el NDVI real de
**Sentinel-2**: verde = vegetación vigorosa; amarillo/naranja = vigor bajo; rojo = suelo desnudo.
La capa «Zonas» no cambia (zonas ilustrativas A–D).

Fuente: **Microsoft Planetary Computer** (API pública, sin cuenta ni claves), que sirve las imágenes
Copernicus Sentinel-2 L2A.

## Cómo funciona

```
App (services/ndviMap.ts) ──POST contorno──▶ Supabase Edge Function ndvi-huerta ──▶ Planetary Computer
   ◀── PNG + fecha + NDVI medio ──
```

1. **STAC**: imágenes Sentinel-2 de los últimos 75 días que cubren la huerta (de la más reciente a la más vieja).
2. **Estadística** dentro del contorno, por imagen: parte de la huerta despejada según la capa SCL (sin nubes,
   sombras ni nieve) y NDVI medio de esos píxeles. Se elige la más reciente con ≥ 60 % despejado.
3. **Imagen** de esa fecha a su resolución real (10 m por píxel, < 1 KB para una huerta típica), de la caja de
   la huerta + 15 m, con nubes transparentes. El mapa la estira con interpolación suave (gradientes en vez de
   cuadros) y la recorta al contorno con un clip-path nítido.
4. La app guarda el resultado **24 h por huerta** (6 h si no hubo imagen despejada) y solo lo pide al abrir
   la capa «Satélite».

Probado contra el servicio real: ~3 s por huerta (búsqueda + estadística + imagen).

Limitaciones: píxel de **10 m** (una huerta de 1 ha son ~100 píxeles; se ven zonas de más y menos vigor, no
árboles individuales), una pasada cada ~5 días, fechas nubladas descartadas. Planetary Computer no tiene
acuerdo de servicio: si falla, la app muestra «No se pudo cargar el mapa de vigor» con «Reintentar».

## Puesta en marcha

La función **tiene que estar publicada** en el proyecto de Supabase (no lleva secretos). Si no lo está, Supabase
responde 404 y la capa «Satélite» muestra «Mapa de vigor no disponible por ahora»; lo demás funciona igual.

Cualquiera de estas tres opciones:

1. **Panel de Supabase (sin instalar nada)**: Edge Functions → *Deploy a new function* → *Via Editor* →
   nombre **`ndvi-huerta`** → pegar todo `supabase/functions/ndvi-huerta/index.ts` → *Deploy function*.
   Dejar activado *Verify JWT* (la app llama con la clave anon).
2. **CLI**: `supabase functions deploy ndvi-huerta --project-ref rnlnomhgtscmdqqyyyyz`
3. **GitHub Actions** (`.github/workflows/desplegar-funciones.yml`): con el secreto `SUPABASE_ACCESS_TOKEN`
   en el repositorio, se publica sola al cambiar `supabase/functions` en main, o a mano con *Run workflow*.

Comprobar que quedó publicada (debe responder `200` con `"ok": true`):

```bash
curl -X POST https://rnlnomhgtscmdqqyyyyz.supabase.co/functions/v1/ndvi-huerta \
  -H "Authorization: Bearer <clave anon>" -H "Content-Type: application/json" \
  -d '{"outline":[{"lat":19.4650,"lng":-101.7225},{"lat":19.4650,"lng":-101.7215},{"lat":19.4660,"lng":-101.7215}]}'
```

La app guarda en el celular «sin imagen despejada» hasta 6 h, pero **no** guarda el «no disponible»: en cuanto la
función esté publicada, el mapa de vigor aparece al volver a abrir la capa «Satélite».

## Datos y atribución

Datos Copernicus Sentinel-2, libres y gratuitos incluso para uso comercial. El mapa muestra
«Vigor: Copernicus Sentinel-2» en la atribución cuando la capa está visible.

## Revisar la función en local

```bash
cd supabase/functions/ndvi-huerta
npx deno@2 check index.ts
```
