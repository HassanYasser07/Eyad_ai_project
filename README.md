# EYAD AI

AI creative workspace (logo, image, SVG, presentation, voice and transcription studios).
React + Vite web app, packaged for Android/iOS with Capacitor, backed by Supabase
(Auth, Postgres, Storage, Edge Functions) and external AI providers (OpenAI, Recraft).

The project no longer depends on Base44 in any way (no SDK, CLI, build plugin, hosted
assets or platform OAuth/MCP endpoints).

## Architecture

| Concern | Provided by |
| --- | --- |
| UI | React 18 + Vite + Tailwind (this repo, `src/`) |
| Auth (email/password, OTP, anonymous, Google) | Supabase Auth |
| Data (projects, assets, chat, jobs, credits) | Supabase Postgres (`supabase/migrations/`) |
| File storage | Supabase Storage bucket `eyad-assets` |
| AI generation / voice / transcription | Supabase Edge Functions `eyad-engine`, `eyad-voice`, `eyad-transcribe` → OpenAI, Recraft |
| Web push | Edge Function(s) + VAPID keys |
| Mobile | Capacitor (`android/`, `ios/`, `capacitor.config.ts`) |
| Static brand images | `public/images`, `public/icons` (served by whatever hosts the web build) |

## Prerequisites

- Node.js 22+ and npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for functions/migrations)
- Android Studio / Xcode for native builds

## Local development

```bash
npm ci
cp .env.example .env      # optional: defaults point to the production Supabase project
npm run dev               # http://localhost:5173
```

Brand images must be present in `public/` (see **Brand assets**). `npm run build` runs a
guard (`prebuild`) that fails if any are missing.

## Brand assets (one-time migration step)

The images that used to live on `media.base44.com` are now referenced as local files
(`/images/...`, `/icons/eyad-icon.png`). If `public/images` / `public/icons` are empty in
your checkout, populate them once while the old URLs still resolve, then commit:

```bash
npm run assets:fetch
git add public/images public/icons
```

## Tests and checks

```bash
npm run test:reliability
npm run test:pptx
npm run lint
npm run typecheck
npm run build
```

## Supabase backend

See [`supabase/README.md`](supabase/README.md) for secrets, deployment commands and the
list of backend pieces that must be verified/recovered from the live project.

## Deploying the web app (static hosting)

`npm run build` outputs `dist/`. Host it on any static host (Cloudflare Pages, Netlify,
Vercel, S3+CDN, nginx) with an SPA fallback so every route serves `index.html`.
Add the deployed origin to Supabase **Auth → URL Configuration** (Site URL and Redirect
URLs) and to the Google OAuth client's authorized origins/redirects.

## Mobile (Capacitor)

```bash
npm run build
npx cap sync android   # or: npx cap sync ios
npx cap open android   # or: npx cap open ios
```

`codemagic.yaml` contains an unsigned iOS simulator build; CI for the web app is in
`.github/workflows/ci.yml`.
