# Actividad → Resumen (gráficas 3D) y pestaña Escaneos

## Pestaña Escaneos
- **Lugar:** es la segunda pestaña de Actividad (Resumen · **Escaneos** · Historial · Plan de trabajo).
- **Qué abre:** `/(app)/escaneos`, la misma pantalla Mis escaneos a pantalla completa, sin cambios.
- **Al regresar:** su botón «Regresar» usa el historial de pestañas (`backBehavior="history"`), así que vuelves a Actividad en la sección donde estabas. La pantalla de Actividad conserva su estado.

## Unidad de análisis
- **Qué es un «análisis»:** una foto que la IA analizó. Puede ser:
  - una foto individual (`scans`), o
  - una foto analizada de un recorrido (`hallazgos`, una fila por foto).
- **Qué no cuenta:** el recorrido en sí no es un análisis, porque solo contiene sus fotos. Tampoco cuentan las fotos de recorrido que no se analizaron.
- **Exclusiones:** los resultados «no es fruto» no se cuentan.

**Estados** (`services/escaneos.ts → categoria`):

| Estado | Criterio | Color |
|---|---|---|
| Saludable | — | verde |
| Revisar | confianza < 60 % | ámbar |
| Con problema | el modelo detectó un problema con confianza suficiente | coral |

**Severidad:** la base no tiene un criterio de severidad. Por eso la tarjeta se llama «Hallazgos que requieren atención» y no habla de riesgo.

## Datos y filtros
- **Origen:** usa las consultas que ya existían, sin consultas nuevas ni por gráfica:
  - `scans` (por `user_id`);
  - `hallazgos` (por `user_email`, hasta 2000);
  - `huertas`.
- **Cálculos:** están centralizados en `services/actividadStats.ts` (funciones puras) y memoizados en la pantalla.
- **Filtros:**

| Filtro | Opciones |
|---|---|
| Huerta | todas · una · sin huerta asignada |
| Cultivo | solo los que tienen registros |
| Periodo | 7 d · 30 d · 90 d · 6 m · 12 m · todo |

- **Superficie:** se calcula con `huertas.area_m2` de las huertas del filtro, cada huerta una sola vez. Con «Sin huerta» no aplica.
- **Estado por huerta:** ignora el filtro de huerta (lo dice en su subtítulo), porque su propósito es comparar huertas. Las huertas sin nombre visible se agrupan en «Otras», y lo que no tiene huerta va en «Sin huerta asignada».

## Gráficas (SVG 2.5D + Reanimated, sin librerías nuevas)
| Componente | Qué muestra | Interacción |
|---|---|---|
| `Donut3D` | Reparto de análisis por huerta (anillo extruido: paredes, caras, brillo, sombra) | Tocar → filtra por esa huerta (se separa sin cambiar tamaño) |
| `FruitBars` | % de análisis por cultivo (barras con volumen y reflejo) | Tocar → filtra por cultivo y muestra la cantidad |
| `Columns3D` | Saludable / Revisar / Con problema por cultivo (prismas apilados) | Tocar → detalle con las clases reales del modelo para ese cultivo |
| `TrendLine` | Análisis por día (7 d), semana (30/90 d) o mes (6 m, 12 m, todo) | Tocar/arrastrar → valor y comparación con el periodo anterior |
| `AttentionPanel` | % con problema, los 2 diagnósticos más frecuentes, cultivo con más hallazgos | Tocar → Historial |

**Reglas de las gráficas:**
- La perspectiva nunca cambia las proporciones.
- La línea usa una curva monótona, que no rebasa los valores reales.
- La comparación temporal no se calcula sobre el periodo en curso (está incompleto) ni cuando el anterior fue 0.
- Las barras miden exactamente su porcentaje, sin un largo mínimo que exagere los valores pequeños.

**Animaciones:**
- Las tarjetas entran escalonadas (`FadeInDown`, 320 ms).
- La dona se forma, las barras y columnas crecen y la línea se dibuja.
- Al cambiar un filtro, los valores van del anterior al nuevo (`useTween`, 650–800 ms) y luego se detienen.
- Con «Reducir movimiento» los cambios son inmediatos.

**Hojas decorativas:** `BotanicalCardDecoration` (en `charts/core.tsx`) dibuja tres variantes en SVG original: hoja, ramita y helecho. Son semitransparentes, van recortadas en las esquinas y tienen `pointerEvents="none"`.

## Pruebas
- `node --experimental-transform-types scripts/actividad-stats.test.ts` cubre:
  - porcentajes que suman 100;
  - el filtro «sin huerta»;
  - las clases con confianza baja separadas;
  - los periodos vacíos en 0;
  - que cada análisis caiga en un solo periodo.

## Pendiente
- `hallazgos` se lee hasta 2000 filas (límite existente). Para historiales más grandes conviene una vista o RPC con agregados en PostgreSQL.
- Tocar un periodo de la línea muestra su valor, pero no filtra el Historial: el Historial no tiene filtro por fecha.
