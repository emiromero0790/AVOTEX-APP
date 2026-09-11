---
name: Xcode mínimo para Expo 57
description: Compatibilidad del toolchain iOS usado por EAS con Expo SDK 57.
---

Los perfiles iOS de Expo SDK 57 deben usar una imagen EAS con Xcode 26.4 o superior.

**Why:** Xcode 26.2 rechaza las anotaciones de retención de `RuntimeScheduler` en `expo-modules-jsi`; Expo 57 declara Xcode 26.4 como mínimo.

**How to apply:** Mantener los perfiles iOS en una imagen oficial de SDK 57, actualmente Xcode 26.6, y revisar el mínimo de Expo antes de fijar otra imagen.