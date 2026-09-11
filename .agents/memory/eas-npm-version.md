---
name: npm estable para EAS
description: Restricción de versión de npm para instalaciones reproducibles en builds iOS de EAS.
---

Usar Node 22.14.0 en el perfil de producción de EAS y mantener npm 10.9.4 como versión declarada y protección secundaria.

**Why:** La imagen macOS seleccionada incluye npm 10.8.2, que puede abortar `npm ci` con el error interno “Exit handler never called” aunque el lockfile sea válido. El hook previo de npm no siempre se ejecuta antes de esa etapa, mientras que EAS prepara Node antes de instalar dependencias.

**How to apply:** Mantener Node 22.14.0 en builds de producción y alineadas la versión declarada de npm y el hook previo; validar Expo con esa versión de Node y el lockfile con una instalación limpia.