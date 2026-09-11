---
name: Yarn para builds EAS
description: Elección del gestor de dependencias para builds iOS reproducibles de EAS.
---

Usar Yarn Classic 1.22.22 con su lockfile como gestor de dependencias y Node 22.14.0 en el perfil de producción de EAS.

**Why:** La imagen macOS seleccionada aborta repetidamente `npm ci` con el error interno “Exit handler never called”. Actualizar npm en el hook y cambiar Node no evitó que la etapa gestionada por EAS siguiera fallando.

**How to apply:** No reintroducir un lockfile de npm junto al de Yarn, porque EAS volvería a seleccionar npm. Validar cambios de dependencias con una instalación Yarn limpia y lockfile congelado.