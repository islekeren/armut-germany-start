# Mobile App

Expo-based React Native client for the Armut Germany monorepo.

## Structure

- `app/`: Expo Router route tree
- `src/components/`: shared native UI primitives and common cards
- `src/providers/`: app-level providers such as auth
- `src/lib/`: API, env, and persistence helpers
- `src/screens/`: route-group screen implementations
- `src/theme/`: design tokens mirrored from the web app

## Run

```bash
npm run dev:mobile
```

Set `EXPO_PUBLIC_API_URL` when testing against a non-localhost API host.
