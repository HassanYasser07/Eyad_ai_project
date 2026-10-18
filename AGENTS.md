# Agent notes

EYAD AI is a user-owned React + Vite + Capacitor app with a Supabase backend. Keep changes
focused on the request and preserve existing project conventions.

## Layout

- `src/`: frontend (`src/lib/supabase.js` is the single Supabase client).
- `supabase/functions/`: Edge Functions (`eyad-engine`, `eyad-voice`, `eyad-transcribe`).
- `supabase/migrations/`: SQL migrations. Never reset the database or weaken RLS policies.
- `public/images`, `public/icons`: static brand assets referenced by absolute `/...` paths.
- `scripts/`: asset manifest + fetch/check helpers.

## Rules

- Never put secret keys in frontend code or `VITE_*` variables. Secrets live in Supabase
  Edge Function secrets (see `.env.example`).
- Use `npm run dev` for local work, `npm run build` for production builds.
- Run `npm run test:reliability`, `npm run lint`, `npm run typecheck` before finishing.
