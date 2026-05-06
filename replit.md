# Avotex — Expo/React Native app for avocado pest detection using AI

## Run & Operate
- **Start**: `npm run web` → serves on port 5000
- **Install**: `npm install --legacy-peer-deps` (required due to peer dep conflicts)
- **Env vars**: All `EXPO_PUBLIC_*` in Replit shared secrets (see list below)

Required env vars:
`EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`, `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `EXPO_PUBLIC_FIREBASE_APP_ID`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GEMINI_API_KEY`, `EXPO_PUBLIC_EMAILJS_SERVICE_ID`, `EXPO_PUBLIC_EMAILJS_TEMPLATE_ID`, `EXPO_PUBLIC_EMAILJS_PUBLIC_KEY`, `EXPO_PUBLIC_OPENWEATHER_API_KEY`, `EXPO_PUBLIC_PREDICT_URL`

## Stack
- **Framework**: Expo 54 / React Native 0.81.4 + expo-router (file-based)
- **Styling**: NativeWind 4 + React Native StyleSheet + `useWindowDimensions` for iPad breakpoints (≥768px)
- **Auth**: Firebase Auth (AsyncStorage persistence on native)
- **Database**: Supabase (scan history)
- **AI**: Google Gemini 2.5 Flash (chatbot) + Custom CNN on Google Cloud Run (image AI)
- **Maps**: expo-location + react-native-maps
- **Weather**: OpenWeatherMap API | **Email**: EmailJS | **Fonts**: @expo-google-fonts/poppins

## Where things live
```
app/
  _layout.tsx          — Root: GuestProvider > AccessibilityProvider > Stack
  (auth)/index.tsx     — Login + "Continuar como invitado" button
  (app)/
    _layout.tsx        — Tab bar + guest lock modal + bottom bar + FAB
    index.tsx          — Home dashboard
    scan.tsx           — Camera scan + guest counter
    mapping.tsx        — GPS polygon map
    results.tsx        — Scan history + charts
    agenda.tsx         — Recommendations & tasks
    chatbot.tsx        — Gemini AI chatbot
    privacy.tsx        — Privacy notice
    profile.tsx        — User profile
context/
  GuestContext.tsx     — isGuest, guestScansLeft, enter/exit/decrement
  AccessibilityContext.tsx
```
Schema: `supabase` table `scans` (id, user_id, user_email, label, score, created_at)

## Architecture decisions
- **Guest mode**: stored in React state only (not Firebase); scan counter persisted in AsyncStorage (`guest_scans_remaining`, max 10). Guest scans are NOT saved to Supabase.
- **iPad responsiveness**: `useWindowDimensions()` hook everywhere; `isTablet = width >= 768`; content centered with `maxWidth` constraints; larger fonts/buttons via `*Tablet` style keys.
- **react-native-maps**: only in native builds; `.native.tsx` components wrap in try-catch and show fallback in Expo Go.
- **react / react-dom** pinned to `19.1.4` exact to match `react-native-renderer@19.1.4`.
- **GuestProvider** wraps the entire app (outside AccessibilityProvider) so all screens can read guest state.

## Product
1. Login with Firebase Auth or enter as guest (limited: 10 scans, only Home/Scan/Privacy)
2. AI-powered leaf scan (CNN on Cloud Run) — results NOT stored for guests
3. GPS polygon mapping of avocado parcels
4. Scan history with bar/pie/line charts (Supabase)
5. Recommendations & task agenda based on scan history
6. Gemini AI chatbot with EmailJS contact
7. OpenWeatherMap weather widget on home

## User preferences
- App in Spanish (Mexican)
- Developed by VEX (Bruno Parra & Emiliano Romero) / Instituto Tecnológico de Morelia
- No hardcoded credentials — all via `EXPO_PUBLIC_*` env vars

## Gotchas
- `npm install` requires `--legacy-peer-deps`
- After setting env vars, **restart the workflow** for them to take effect
- `react-native-maps` doesn't work in Expo Go; gracefully degrades with a warning message
- Guest mode resets scan counter when `exitGuestMode()` is called (AsyncStorage cleared)

## Pointers
- Expo docs: https://docs.expo.dev
- Firebase Web SDK v9 modular API
- Supabase JS client v2
