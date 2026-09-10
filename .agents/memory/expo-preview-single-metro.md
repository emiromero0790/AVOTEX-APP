---
name: Expo y Preview comparten Metro
description: Restricción del entorno para mantener Preview web y Expo Go disponibles sin agotar los observadores de archivos.
---

Usar un solo proceso Expo que habilite web y túnel simultáneamente. No crear ni iniciar un segundo workflow de Expo/Metro en paralelo.

**Why:** Dos procesos Metro vigilando el mismo proyecto alcanzan el límite de `inotify` del entorno y terminan con `ENOSPC`, dejando Preview o Expo Go fuera de servicio.

**How to apply:** Mantener el workflow principal como servidor web en el puerto 5000 con host `tunnel`; el mismo proceso muestra el QR y la dirección `exp://` para Expo Go. Excluir del seguimiento de Metro los artefactos de diseño y directorios residuales regenerables.