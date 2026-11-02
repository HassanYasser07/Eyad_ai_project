-- Keep the .pptx exported by Gamma in our own private storage so the Eyad editor can open it.
-- Written only by the eyad-presentation Edge Function (service role). The browser receives
-- a short-lived signed URL through the function's "download" action; no client policies on purpose.

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
ON CONFLICT (id) DO NOTHING;
