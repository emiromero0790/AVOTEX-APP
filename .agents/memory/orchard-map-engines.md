---
name: Motores del mapa de huertas
description: Decisión sobre qué motor usar para visualizar y editar delimitaciones agrícolas.
---

Las huertas guardadas deben visualizarse con una cámara MapLibre GL de perspectiva alta. La creación y edición de polígonos debe permanecer en Leaflet con vista superior.

**Why:** Leaflet es un motor 2D; inclinar sus capas con CSS sigue pareciendo una vista cenital deformada y no produce una cámara frontal real. MapLibre ofrece pitch y perspectiva reales, mientras Leaflet Draw sigue siendo la herramienta adecuada para editar vértices.

**How to apply:** Mantener ambos mapas coordinados dentro del mismo documento. MapLibre solo debe mostrarse cuando WebGL, sus fuentes y sus capas estén listos; mientras carga o si falla, Leaflet debe permanecer visible y funcional.