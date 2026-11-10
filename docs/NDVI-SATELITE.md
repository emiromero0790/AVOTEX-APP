# Mapa de vigor (NDVI) en Satélite

En la pantalla **Satélite**, la capa **«Satélite»** pinta dentro del contorno de la huerta el NDVI real de
**Sentinel-2** (Copernicus, Unión Europea): verde = vegetación vigorosa; amarillo/naranja = vigor bajo;
rojo = suelo desnudo. La capa «Zonas» no cambia (zonas ilustrativas A–D).

## Cómo funciona

```
App (services/ndviMap.ts) ──POST contorno──▶ Supabase Edge Function ndvi-huerta ──▶ Copernicus Data Space
   ◀── PNG coloreado + fecha + NDVI medio ──                (claves OAuth solo en el servidor)
```

1. **Statistical API** (últimos 75 días, por día): NDVI medio/mín/máx y qué parte de la huerta se vio
   despejada (sin nubes, sombras ni nieve, capa SCL). Se elige la fecha más reciente con ≥ 60 % despejado.
2. **Process API** de esa fecha: PNG recortado al contorno, con la misma escala de color que la app; nubes
   y exterior transparentes. Todo en EPSG:3857 para encajar exacto en el mapa.
3. La app guarda el resultado **24 h por huerta** (y 6 h si no hubo imagen despejada) y solo lo pide al abrir
   la capa «Satélite».

Limitaciones reales: píxel de **10 m** (una huerta de 1 ha son ~100 píxeles; la imagen se suaviza pero no
muestra árboles individuales), una pasada cada ~5 días y fechas nubladas descartadas.

## Puesta en marcha (una vez)

1. Crea una cuenta gratuita en <https://dataspace.copernicus.eu/>.
2. En el **Sentinel Hub Dashboard** (<https://shapps.dataspace.copernicus.eu/dashboard/>) → *User settings* →
   *OAuth clients* → crea un cliente y copia su **ID** y **secret** (el secret solo se muestra una vez).
3. Guarda los secretos en Supabase y despliega la función (con la CLI de Supabase enlazada al proyecto):

   ```bash
   supabase secrets set CDSE_CLIENT_ID=tu-id CDSE_CLIENT_SECRET=tu-secret
   supabase functions deploy ndvi-huerta
   ```

Mientras la función no esté desplegada o sin claves, la app muestra «Mapa de vigor no disponible por ahora»
y todo lo demás funciona igual.

## Cuota

Copernicus Data Space da un cupo gratuito mensual de *processing units* y peticiones (revisa los límites
vigentes en tu Dashboard). Cada carga usa 2 peticiones pequeñas (estadística + imagen de una huerta) y se
guarda 24 h en el celular.

## Datos y atribución

Datos Copernicus Sentinel-2, libres y gratuitos incluso para uso comercial. El mapa muestra
«Vigor: Copernicus Sentinel-2» en la atribución cuando la capa está visible.

## Probar la función en local

```bash
cd supabase/functions/ndvi-huerta
npx deno@2 check index.ts
```
