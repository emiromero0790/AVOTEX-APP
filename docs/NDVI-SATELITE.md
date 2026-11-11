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

Solo hay que desplegar la función (no lleva secretos):

```bash
supabase functions deploy ndvi-huerta
```

Mientras no esté desplegada, la capa «Satélite» muestra «Mapa de vigor no disponible por ahora» y lo demás
funciona igual.

## Datos y atribución

Datos Copernicus Sentinel-2, libres y gratuitos incluso para uso comercial. El mapa muestra
«Vigor: Copernicus Sentinel-2» en la atribución cuando la capa está visible.

## Revisar la función en local

```bash
cd supabase/functions/ndvi-huerta
npx deno@2 check index.ts
```
