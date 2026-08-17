# NAMA Rent App

A registration, allocation, and tenancy lease management system for the Nsawam Municipal Assembly Estate Unit — built with React, Vite, TypeScript, Express, and Firebase (Firestore + Auth).

## Run locally

**Prerequisites:** Node.js 20+

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and fill in the required values (see below).
3. Run the app:
   `npm run dev`

## Environment variables

See `.env.example` for the full list. In short:

- `APP_URL` — the URL this app is hosted at.
- `WIGAL_API_KEY`, `WIGAL_USERNAME`, `WIGAL_CLIENT_ID`, `WIGAL_SENDER_ID` — credentials for the Wigal SMS gateway (frog.wigal.com.gh), used server-side only.
- `VITE_FIREBASE_API_KEY` — the Firebase Web API key, injected at build time.

## Build & deploy

- `npm run build` — builds the frontend (Vite) and bundles the Express server (esbuild) into `dist/`.
- `npm start` — runs the production build.
- CI runs typecheck + build on every push/PR via `.github/workflows/ci.yml`. Pushes to `main` also trigger an automated deploy to the app's VM — see `deploy/` for the deploy script, systemd service, and nginx config.
