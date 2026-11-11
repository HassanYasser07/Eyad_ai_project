-- Presentations <-> Projects: every generated / saved deck is a version of a project (studio_type = 'presentations').
-- Run once (Supabase Dashboard -> SQL Editor, or `supabase db push`). Safe to re-run.
--
-- * Files live ONLY in the private "presentation-files" bucket. The browser never gets a public URL:
--   the eyad-presentation Edge Function hands out short-lived Signed URLs (download) and Signed UPLOAD
--   URLs (save), after checking that the project belongs to the caller.
-- * presentation_versions is written only by the Edge Function (service role). Owners can read their own rows.

/* ------------------------- columns the function relies on ------------------------- */
ALTER TABLE public.gamma_presentation_jobs
  ADD COLUMN IF NOT EXISTS pptx_path text,
  ADD COLUMN IF NOT EXISTS pptx_error text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'presentation-files',
  'presentation-files',
  false,
  104857600,
  ARRAY['application/vnd.openxmlformats-officedocument.presentationml.presentation']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

/* ------------------------------- versions table ------------------------------- */
CREATE TABLE IF NOT EXISTS public.presentation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no >= 1),
  source text NOT NULL DEFAULT 'user' CHECK (source IN ('gamma', 'user')),
  label text,
  file_name text,
  storage_path text NOT NULL,
  size_bytes bigint,
  job_id uuid REFERENCES public.gamma_presentation_jobs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version_no)
);

-- One stored version per Gamma job: concurrent status polls cannot create duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS presentation_versions_job_uidx
  ON public.presentation_versions (job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS presentation_versions_project_idx
  ON public.presentation_versions (project_id, version_no DESC);
CREATE INDEX IF NOT EXISTS presentation_versions_owner_idx
  ON public.presentation_versions (owner_id);

ALTER TABLE public.presentation_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners read their presentation versions" ON public.presentation_versions;
CREATE POLICY "owners read their presentation versions"
  ON public.presentation_versions
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies on purpose: only the service role (Edge Function) writes.
REVOKE ALL ON public.presentation_versions FROM anon, authenticated;
GRANT SELECT ON public.presentation_versions TO authenticated;

-- NOTE: no storage.objects policies are added for "presentation-files" on purpose.
-- With RLS on and no policy, the bucket is unreachable from the browser except through Signed URLs
-- created by the Edge Function.
