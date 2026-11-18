# Deploy: background generation (extract the zip over the project root)

1. `npm install && npm run build && npm run lint`  (fix anything your own ESLint config flags; see "Not verified")
2. `supabase db push`  (applies 20261117120000_background_generation.sql)
3. In the SQL editor, once:
   select vault.create_secret('https://<PROJECT_REF>.supabase.co','eyad_project_url');
   select vault.create_secret('<SERVICE_ROLE_KEY>','eyad_service_role_key');
   select vault.create_secret('<LONG_RANDOM_STRING>','eyad_cron_secret');
4. `supabase secrets set EYAD_CRON_SECRET=<LONG_RANDOM_STRING>`
5. `supabase functions deploy eyad-engine eyad-presentation`
6. `psql "$DATABASE_URL" -f supabase/tests/eyad_background_generation.sql`
7. `npm run test:reliability`, then `npx cap sync`

Order matters: deploy the edge functions and the migration before or together with the web build.
The client works with both old (synchronous) and new (202 processing) servers.

## Rollback
- Client: restore previous versions of the 21 src files; delete src/services/generation*.js, src/lib/GenerationContext.jsx, src/components/generation/, src/i18n/generationTranslations.js.
- Edge: redeploy the previous eyad-engine / eyad-presentation.
- DB: select cron.unschedule('eyad-reconcile-waiting'); select cron.unschedule('eyad-reconcile-presentations');
  and re-create reconcile_expired_eyad_jobs with the old 3/4/15 minute intervals from 20260929110000_phase1_generation_reliability.sql.

## Known limits
- Edge background work is bounded by your Supabase plan's wall-clock limit; mockups can take up to 240 s. The cron sweeper finishes waiting_external jobs if the worker dies; synchronous jobs are failed+refunded after 8 min.
- If your gateway rejects the sweeper call, check verify_jwt for eyad-engine: new-style service-role keys are not JWTs. If needed deploy with `--no-verify-jwt` (the function authenticates itself).
- Native (Capacitor) push is NOT implemented; Web Push only. On return to the app, reconcile restores results.
- Presentation/video jobs are not shown in the global pill yet.

## Verified (with your real project files)
`vite build` passes; no new ESLint errors vs. your original code; 27 reliability tests pass; edge functions type-check (only Deno/npm import resolution is unchecked locally).

## Still not done / not verifiable here
- public/sw.js (web push notificationclick deep link): the source file was not in the upload (only the iOS build copy). Not changed.
- Native Capacitor push notifications: not implemented.
- Manual device tests (Android, iOS, web) and running the SQL test against your database.
- Chat.jsx: minimal change only (a `processing` reply is treated like the existing `queued` flow).
