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

- Base oscura predeterminada, satélite Esri, híbrido con etiquetas/calles, estándar
  Esri y zonas ilustrativas sobre fondo oscuro. Zonas no representa diagnósticos.
- Las bases se conmutan por visibilidad, sin `setStyle` ni reconstrucción de overlays.
  Los mosaicos siguen siendo raster: MapLibre no inventa detalle satelital adicional.
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
persistente. Las atribuciones están visibles; revisar términos/cuotas de Esri y Esri
antes de producción de alto volumen. `topo`, conservado por compatibilidad con
preferencias guardadas, usa estándar y ya no se ofrece como opción nueva.

Validar en Android/iOS reales: soporte WebGL, memoria con historiales grandes,
gestos del panel en todas sus alturas y rotación, safe areas, permisos de ubicación,
selección foto/hallazgo y navegación autenticada. No se dispone aquí de sesión de
usuario ni de simuladores móviles. No se ha medido FPS ni se garantiza fluidez móvil
por una prueba de escritorio.

Siguiente mejora recomendada: migrar las bases raster a un proveedor vectorial con
licencia y estilos propios; empaquetar el runtime localmente y añadir caché offline.
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
