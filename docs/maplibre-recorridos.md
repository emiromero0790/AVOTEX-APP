# Mis escaneos: mapa MapLibre (semi-3D)

Rama: `feat/maplibre-recorridos` (incluye `main` hasta PR #28).

## Arquitectura

- **Motor:** MapLibre GL JS 5.6.2 (WebGL, vectorial). Va dentro del `WebView` (Android/iOS) o de un
  iframe (web) que ya usaba la pantalla.
  - **No hay módulo nativo nuevo ni plugin de Expo:** funciona en el build actual y en Expo Go.
  - **Requisitos del dispositivo:** WebGL en su WebView y conexión. Sin ellos, aparece "No se pudo cargar el mapa".
  - **`@maplibre/maplibre-react-native`** (nativo puro) daría más FPS, pero exige un development build
    (`expo prebuild` + plugin), y no funcionaría en Expo Go. Queda como siguiente paso si se mide que el WebView no alcanza.
- **Contrato sin cambios:** `window.avx.*` (setData, select, setDetail, point, setLayer, setRouteStyle,
  setPerspective, setPad, zoom, showUser, fit) y los mensajes `ready / select / orchard / point / clear / error`.
  Navegación, autenticación y lecturas de Supabase (huertas, recorridos, recorrido_fotos, hallazgos, scans) no cambian.
- **Web:** el iframe se carga con una URL `blob:` y ya no con `srcDoc`. Con `srcDoc` el mapa nunca
  terminaba de cargar: los mosaicos vectoriales se quedaban pendientes y el mapa salía negro.

## Qué se ve

| Elemento | Cómo se dibuja |
| --- | --- |
| Base Oscuro (predeterminada) | Vectores OpenFreeMap, colores AVOTEX, etiquetas atenuadas y sin flechas de sentido. Nítida a cualquier zoom. |
| Satélite / Híbrido | Fotos Esri (hasta z19; más cerca se amplían) + calles/etiquetas vectoriales en Híbrido. |
| Estándar | Vectores OpenFreeMap Liberty. |
| Zonas | Base oscura + zonas ilustrativas de la huerta. |
| Huerta | Relleno neón suave, contorno neón con brillo. Las demás huertas se atenúan al elegir un recorrido. |
| Árboles 3D | Copas en dos niveles (`fill-extrusion`), solo en 3D y en Oscuro/Estándar. |
| Recorrido elegido | Línea con degradado (`line-gradient`) + brillo + flechas de sentido de cerca. |
| Inicio / Fin | Pin verde con ▶ / pin violeta con bandera. La punta es la coordenada GPS. |
| Hallazgos | Pin de alerta por categoría (rojo enfermo, ámbar revisar, verde sano, gris otro). |
| Fotos | Punto teal sobre la ruta; desde z18, insignia con cámara. |
| Otros escaneos | Pines por estado (recorrido / foto) con agrupación (clusters) al alejar. |
| Usuario | Punto azul con halo. |

**Los árboles son ilustrativos:** se reparten en cuadrícula (~9 m) dentro del contorno real. **No** son
posiciones medidas de árboles. En Satélite e Híbrido no se dibujan, porque ahí ya se ven los reales.

**Estilos de ruta:**
- **Avance:** degradado de inicio a fin.
- **Tiempo:** colores según la hora GPS de cada punto.
- **Velocidad:** colores según la rapidez real entre puntos (km/h), con la leyenda que ya existía.

Los degradados se calculan una vez por recorrido y estilo.

## Cámara

- **3D (predeterminada):** inclinación de 55° y giro de -12°. El botón 2D/3D cambia de vista sin recargar nada.
- **Encuadre del recorrido:** se encuadran la ruta, las fotos y los hallazgos. La huerta entra también si
  mide menos de unos 700 m de diagonal (así se ve la relación ruta ↔ huerta).
- **Cálculo propio:** el encuadre se calcula a mano (Mercator) porque `fitBounds` / `cameraForBounds` de
  MapLibre 5 alejaba unos 3 niveles de zoom de más con la cámara inclinada y márgenes.

## Rendimiento

- **Fuentes y capas:** se crean una sola vez. Cambiar de base solo alterna visibilidades (sin `setStyle`).
- **Actualizaciones:** se agrupan por cuadro (`requestAnimationFrame`). Una fuente cuyo contenido no
  cambió no recibe `setData`, y las propiedades de pintura tampoco se reescriben si son iguales.
- **Datos que llegan antes de cargar el mapa:** se dibujan al terminar la carga.
- **Márgenes:** los del panel (`setPad`) no redibujan nada.
- **Marcadores:** todo es WebGL, sin cientos de nodos DOM.
- **Árboles:** se generan una vez por huerta, con un tope de ~1 600.

## Interfaz de la pantalla

- **Mapa a pantalla completa** con encabezado de cristal: regresar, título y filtros.
- **Selector de capas:** la barra de capas del encabezado y el modal se reemplazaron por un panel flotante
  ligero junto al botón Capas. Tiene tipo de mapa (5 opciones), estilo de ruta y qué mostrar. Cada toque
  cambia el mapa al instante; tocar fuera lo cierra.
- **Panel inferior:** el de tres alturas existente, sin cambios (huerta, métricas, historial, selección).

## Limitaciones

- **Conexión:** requiere red para el motor (CDN unpkg), los mosaicos y las tipografías. No hay caché offline.
- **Satélite:** la nitidez depende de Esri; más allá de z19, la imagen se amplía.
- **Validación:** no se probó en teléfonos reales (FPS, memoria, gestos). Se validó en Chromium con WebGL por
  software y con el build Android de Expo (`expo export`).
- **Licencias:** revisar los términos de OpenFreeMap y Esri antes de un uso de alto volumen
  (atribución visible en el mapa; ver `docs/licenses`).

## Prueba

```sh
node scripts/test-scans-map.mjs                  # requiere red y playwright con Chromium
MAP_TEST_SCREENSHOT=/tmp/mapa node scripts/test-scans-map.mjs
```

La prueba comprueba:
- que los datos se dibujan aunque lleguen antes de la carga;
- base vectorial y que en Oscuro no quede ninguna capa raster visible;
- árboles en 3D y ocultos en 2D;
- degradados de los tres estilos;
- que cambiar de base no recrea fuentes;
- el zoom del encuadre;
- que tocar un hallazgo o una foto responde.

## Siguientes mejoras

1. Empaquetar MapLibre localmente (sin CDN) y añadir caché de mosaicos para trabajar en campo sin señal.
2. Si en gama baja no alcanza el rendimiento, migrar a `@maplibre/maplibre-react-native` con un development build.
3. Usar posiciones reales de árboles cuando existan (p. ej., conteo por dron) en lugar de la cuadrícula ilustrativa.
4. Relieve del terreno (DEM) para huertas en ladera.
