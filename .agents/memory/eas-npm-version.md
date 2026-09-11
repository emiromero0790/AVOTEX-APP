---
name: npm estable para EAS
description: Restricción de versión de npm para instalaciones reproducibles en builds iOS de EAS.
---

Usar npm 10.9.4 en EAS antes de la instalación de dependencias.

**Why:** La imagen macOS seleccionada incluye npm 10.8.2, que puede abortar `npm ci` con el error interno “Exit handler never called” aunque el lockfile sea válido.

**How to apply:** Mantener alineadas la versión declarada del gestor y el hook previo a la instalación; validar cambios del lockfile con una instalación limpia usando esa versión.