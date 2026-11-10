# Mis escaneos: MapLibre

Rama: `feat/maplibre-recorridos`, creada desde `main`.

## Arquitectura y alcance

`app/(app)/escaneos.tsx` conserva autenticación, navegación, filtros, estadísticas,
detalle y lecturas reales de huertas, recorridos, recorrido_fotos, hallazgos y scans.
`ScansMap.native` mantiene un WebView estable; web mantiene un iframe estable.
La API `avx` y los mensajes de selección conservan su contrato anterior.

El renderer Leaflet de esta pantalla se sustituye por MapLibre GL JS 5.6.2 (versión
fijada, JS y CSS por CDN). No se migra el editor de delimitación ni otros mapas de
la app. No se añade un módulo nativo ni un plugin Expo: se reutiliza
react-native-webview. No requiere un nuevo dev client por este cambio. El dispositivo
sí necesita WebGL en su WebView; hay aviso de error si falla el motor o los recursos.

## Implementación

- Base oscura vectorial OpenFreeMap predeterminada, satélite Esri, híbrido con etiquetas/calles vectoriales, estándar
  OpenFreeMap y zonas ilustrativas sobre fondo oscuro. Zonas no representa diagnósticos.
- Las bases se conmutan por visibilidad, sin `setStyle` ni reconstrucción de overlays.
  Oscuro, estándar y zonas usan vectores OpenMapTiles; el satélite sigue usando
  fotografías raster, cuya resolución depende de Esri.
- Fuentes GeoJSON independientes: huertas, zonas, rutas, detalle, velocidad, extremos,
  fotos, hallazgos, usuario y selección activa. Se agrupan fotos y scans en workers.
- Se descartan coordenadas no finitas/fuera de rango y se cierran anillos de polígonos.
- Inicio verde, fin violeta, hallazgos por categoría, capturas teal y selección con halo.
  Ruta con degradado; velocidad usa tiempos GPS y colores de la leyenda existente.
- Actualizaciones agrupadas por frame; las fuentes sin cambios no reciben `setData`.
  No se crean cientos de marcadores DOM; los overlays se dibujan en WebGL.
- Selector compacto sin miniaturas ni precargas de red; preserva switches de overlays.
- Se conserva el panel de tres alturas y FlatList virtualizada. Se coordina explícitamente
  el gesto de lista con el gesto nativo de scroll y se recorta el contenido a sus esquinas.
  Se elimina el emblema del encabezado, manteniendo controles y diseño oscuro flotante.

## Límites y validación móvil pendiente

Los recursos CDN y los proveedores de tiles requieren conexión. No hay caché offline
persistente. Las atribuciones están visibles; revisar términos de OpenFreeMap y Esri
antes de producción de alto volumen. `topo`, conservado por compatibilidad con
preferencias guardadas, usa estándar y ya no se ofrece como opción nueva.

Validar en Android/iOS reales: soporte WebGL, memoria con historiales grandes,
gestos del panel en todas sus alturas y rotación, safe areas, permisos de ubicación,
selección foto/hallazgo y navegación autenticada. No se dispone aquí de sesión de
usuario ni de simuladores móviles. No se ha medido FPS ni se garantiza fluidez móvil
por una prueba de escritorio.

Siguiente mejora recomendada: empaquetar el runtime localmente y añadir caché offline.
Si WebView no satisface los perfiles de rendimiento medidos, evaluar MapLibre Native
con un development build Expo en una iteración posterior.

## Comprobaciones realizadas

- Transpilación de los TS/TSX modificados y chequeo estricto aislado de scansMapHtml.
- Chromium/Playwright con WebGL: carga del motor, fuentes de ruta/hallazgos/extremos,
  cambios de bases/estilos, foco de hallazgo, usuario y atribuciones.
- No se ejecutó un build Expo completo: el checkout no trae sus dependencias instaladas.

Prueba reproducible (requiere esbuild, Python Playwright y Chromium):

```sh
mkdir -p work
npx esbuild components/scansMapHtml.ts --bundle --platform=node --outfile=work/map.cjs
node -e "require('fs').writeFileSync('work/map.html',require('./work/map.cjs').buildScansMapHtml())"
python scripts/test-scans-map.py work/map.html
```

`CHROMIUM_PATH` permite elegir el ejecutable. Solo para un proxy de pruebas con CA
no reconocida por Chromium, `MAP_TEST_IGNORE_HTTPS_ERRORS=1` omite ese chequeo en el
contexto del test, sin cambiar el comportamiento TLS de la app.

## Corrección de nitidez y vista 2.5D

La primera versión seguía ampliando imágenes de Esri en el mapa oscuro (zoom máximo
nativo 16). Se eliminaron esas bases raster de Oscuro/Estándar y las referencias raster
de Híbrido. Las definiciones de estilo vectorial se incluyen en scansVectorStyle.ts:
OpenFreeMap Dark y Liberty, con raster de relieve omitido y ajustes de contraste.
Los vectores conservan contornos nítidos al ampliar, aunque la cobertura y el detalle
geográfico dependen de los datos OSM disponibles. No se requiere clave para este endpoint.
Licencias y procedencia: docs/licenses; estilos adaptados con contraste AVOTEX,
capas agrupadas por modo y relieve raster eliminado.

La vista predeterminada tiene inclinación de 48 grados. El botón 2D/3D cambia la
perspectiva sin recrear el mapa ni las fuentes. Edificios con volumen a partir de
render_height/render_min_height de OpenMapTiles; donde no hay alturas, no se inventan.
No hay elevación de terreno DEM ni árboles 3D. El seguimiento automático giro a giro
no forma parte de esta pantalla de historial.

Los iconos usan trazos geométricos rasterizados a 3× y registrados con pixelRatio=3,
sin emojis ni fuentes de símbolos. Permanecen verticales respecto de la pantalla.
Las fotos se muestran a la derecha y los extremos debajo de su ancla GPS mediante
pequeñas líneas guía, para distinguirlos cuando coinciden con un hallazgo.
La prueba de Chromium verifica fuente vectorial, ausencia de raster visible en Oscuro,
renderizado de geometría real, densidad de iconos, alternancia 2D/3D, encuadre con
perspectiva y separación de las áreas de interacción de fotos y hallazgos/extremos. Se prueba DPR configurable
(MAP_TEST_DPR, predeterminado 3) y capturas opcionales (MAP_TEST_SCREENSHOT=prefijo).
