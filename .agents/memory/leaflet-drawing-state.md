---
name: Dibujo Leaflet sin recarga
description: Restricción para coordinar el estado React con Leaflet Draw dentro de iframe y WebView.
---

Al iniciar una delimitación nueva, la limpieza de la capa y la activación de Leaflet Draw deben ocurrir juntas dentro de la instancia Leaflet actual. No se debe vaciar primero el estado React que alimenta el polígono inicial.

**Why:** Cambiar el polígono inicial actualiza el HTML del iframe/WebView. Esa recarga puede destruir la instancia Leaflet justo después de activar el modo de dibujo y hacer que el primer intento no comience.

**How to apply:** Durante un dibujo nuevo, conservar temporalmente la geometría React anterior pero ocultar sus datos en la interfaz. Sustituirla solo cuando Leaflet emita el polígono terminado.