-- Lets a template carry a real .pptx file so clicking it in the gallery opens it in the presentation editor.
-- Run once (Supabase Dashboard -> SQL Editor, or `supabase db push`). Safe to re-run.
--
-- pptx_path: either a path inside the public "presentation-templates" bucket (e.g. 'business/proposal.pptx')
--            or a full https URL to a .pptx file. Templates with no pptx_path keep the old behaviour
--            (the template is just attached to the prompt box).

ALTER TABLE public.presentation_templates
  ADD COLUMN IF NOT EXISTS pptx_path text;

GRANT SELECT (pptx_path) ON public.presentation_templates TO anon, authenticated;
