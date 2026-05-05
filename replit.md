# Avotex — Replit Project

## Overview
Avotex is an Expo/React Native mobile application for avocado pest detection using AI. Developed by VEX (Bruno Parra & Emiliano Romero) with guidance from Instituto Tecnológico de Morelia.

## Tech Stack
- **Framework**: Expo 54 / React Native 0.81.4
- **Routing**: expo-router (file-based)
- **Styling**: NativeWind 4 + React Native StyleSheet
- **Auth**: Firebase Auth (with AsyncStorage persistence on native)
- **Database**: Supabase (scan history storage)
- **AI**: Google Gemini 2.5 Flash (chatbot)
- **Image AI**: Custom CNN REST API on Google Cloud Run
- **Maps**: expo-location + react-native-maps
- **Weather**: OpenWeatherMap API
- **Email**: EmailJS (contact form from chatbot)
- **Fonts**: @expo-google-fonts/poppins

## App Structure
```
app/
  (auth)/          — Login, Register, Forgot Password
  (app)/
    _layout.tsx    — Tab bar + Privacy bar + Mi Perfil button + FAB chatbot button
    index.tsx      — Home dashboard (weather, map, stats, location toggle)
    scan.tsx       — Camera scan with AI prediction + privacy modal
    mapping.tsx    — GPS polygon map with location toggle
    results.tsx    — Scan history with charts
    agenda.tsx     — Recommendations & task management
    chatbot.tsx    — Gemini AI chatbot with disclaimer modal
    privacy.tsx    — Full Privacy Notice screen (11 sections)
    profile.tsx    — User profile: email display, change password, delete account
```

## Environment Variables
All credentials stored as `EXPO_PUBLIC_*` shared env vars in Replit secrets:
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GEMINI_API_KEY`
- `EXPO_PUBLIC_EMAILJS_SERVICE_ID`
- `EXPO_PUBLIC_EMAILJS_TEMPLATE_ID`
- `EXPO_PUBLIC_EMAILJS_PUBLIC_KEY`
- `EXPO_PUBLIC_OPENWEATHER_API_KEY`
- `EXPO_PUBLIC_PREDICT_URL`

## Key Features Implemented
1. **Location toggle (when-in-use only)** — Switch in Home and Mapping screens; off by default; uses `requestForegroundPermissionsAsync`; clears data when toggled off
2. **Chatbot disclaimer modal** — Always shown on mount; "Cancelar" returns to previous screen; "Continuar" enables chat input; shield icon re-opens modal if not accepted
3. **Scan privacy modal** — Always shown on mount before camera is usable; single "Entendido, continuar" button; explains images are not stored
4. **Privacy Notice screen** — Full 11-section screen at `/(app)/privacy`; accessible via "Aviso de Privacidad" bar above tab bar
5. **Hardcoded credentials removed** — All API keys moved to `EXPO_PUBLIC_*` env vars; `firebaseConfig.js` and `supabaseConfig.ts` updated
6. **app.json iOS infoPlist** — Full NSLocation/NSCamera permission strings; `isIosBackgroundLocationEnabled: false`
7. **Mi Perfil screen** — Replaced "Eliminar Cuenta" in bottom bar with "Mi Perfil" button; new `profile.tsx` screen with email display, change password (same logic as login modal), and delete account (same confirmation modal)

## Workflow
- **Start application**: `npm run web` → serves on port 5000

## App Store Submission Notes
- iOS: `supportsTablet: false`
- Location: foreground (when-in-use) only — no background location
- Camera: used only for in-app scan feature
- Images: never persisted; only analysis result is saved to Supabase
