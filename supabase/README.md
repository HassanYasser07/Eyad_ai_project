# Supabase backend

Project ref used by the frontend defaults: see `src/lib/supabase.js`.

## What this repo contains

- Edge Functions: `eyad-engine`, `eyad-voice`, `eyad-transcribe`
- Migrations: generation-reliability / credit functions (`supabase/migrations/`)
- SQL/Node tests: `supabase/tests/`, `supabase/test/`

## What the app needs that is NOT tracked as a production migration

`supabase/migrations/` only contains the generation-reliability / credit *functions*.
The base schema is not tracked there. `supabase/test/eyad_pre_phase1_test_baseline.sql`
recreates part of it **for a disposable test project only** (`projects`, `conversations`,
`messages`, `assets`, `generations`, `eyad_jobs`, `credit_accounts`, `credit_transactions`
with RLS) and must NEVER be applied to production.

Not present anywhere in this repo, but used by the app (they exist in the live project):

- Tables: `push_subscriptions`, `actions`, `usage_events`
- Storage bucket `eyad-assets` and its storage policies
- Edge Functions invoked by the frontend: `send-push`, `delete-account`
- The production versions of the tables above (columns/policies/indexes may differ from the
  test baseline)

They must be pulled into version control before the backend can be recreated or moved:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db pull                     # writes the current schema as a migration
supabase functions download send-push
supabase functions download delete-account
```

Review the generated SQL/functions, commit them, and diff before applying anywhere.
Do not run `supabase db reset` against production.

## Secrets (Edge Functions)

```bash
supabase secrets set OPENAI_API_KEY=... RECRAFT_API_KEY=... \
  VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com \
  PUBLIC_APP_URL=https://eyad-ai.com
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase.

## Deploy

```bash
supabase functions deploy eyad-engine eyad-voice eyad-transcribe
supabase db push        # applies only new migrations
```
