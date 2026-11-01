-- Gamma presentation generation jobs.
-- One row per "Generate Presentation" request. Written only by the
-- eyad-presentation Edge Function (service role); owners can read their own rows.
-- The Gamma API key is NOT stored here: it lives in the Edge Function secret GAMMA_API_KEY.

CREATE TABLE IF NOT EXISTS public.gamma_presentation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  project_id uuid,
  generation_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  gamma_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  gamma_url text,
  export_url text,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, request_id)
);

CREATE INDEX IF NOT EXISTS gamma_presentation_jobs_owner_status_idx
  ON public.gamma_presentation_jobs (owner_id, status, created_at DESC);

ALTER TABLE public.gamma_presentation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners read their gamma presentation jobs" ON public.gamma_presentation_jobs;
CREATE POLICY "owners read their gamma presentation jobs"
  ON public.gamma_presentation_jobs
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies on purpose: only the service role (Edge Function) writes.
