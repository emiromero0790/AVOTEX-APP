---
name: Yarn para builds EAS
description: Elección del gestor de dependencias para builds iOS reproducibles de EAS.
---

Usar Yarn Classic 1.22.22 con su lockfile como gestor de dependencias y Node 22.14.0 en el perfil de producción de EAS.

**Why:** La imagen macOS seleccionada aborta repetidamente `npm ci` con el error interno “Exit handler never called”. Actualizar npm en el hook y cambiar Node no evitó que la etapa gestionada por EAS siguiera fallando.

El lockfile de Yarn generado dentro de Replit contiene URLs del registro privado del firewall. EAS no puede resolver ese dominio fuera de Replit, por lo que el hook previo debe sustituirlo por el registro público antes de instalar.

**How to apply:** No reintroducir un lockfile de npm junto al de Yarn, porque EAS volvería a seleccionar npm. Mantener el hook de normalización del registro y validar que la copia transformada no conserve URLs internas.