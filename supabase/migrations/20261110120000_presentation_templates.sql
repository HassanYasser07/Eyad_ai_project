-- Presentation templates: categories + templates shown under the prompt box in the Presentation Studio.
-- Run once (Supabase Dashboard -> SQL Editor, or `supabase db push`). Safe to re-run.
--
-- * Everyone (anon + signed-in) can READ active categories and the display columns of active templates.
-- * Nobody can write from the browser: add/edit rows in the Table Editor or SQL Editor (service role).
-- * gamma_template_id / gamma_theme_id / style_prompt are NOT readable from the browser;
--   only the eyad-presentation Edge Function (service role) reads them.

/* ------------------------------ categories ------------------------------ */
CREATE TABLE IF NOT EXISTS public.presentation_template_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_ar text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

/* ------------------------------ templates ------------------------------- */
CREATE TABLE IF NOT EXISTS public.presentation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.presentation_template_categories(id) ON DELETE CASCADE,
  title_en text NOT NULL,
  title_ar text NOT NULL,
  description_en text,
  description_ar text,
  slide_count integer CHECK (slide_count IS NULL OR slide_count BETWEEN 1 AND 100),
  thumbnail_url text,                    -- public image URL (see the presentation-templates bucket below)
  accent_colors text[] NOT NULL DEFAULT '{}', -- optional 2 hex colors used for the placeholder when there is no thumbnail
  gamma_template_id text,                -- Gamma "gammaId" of a template -> POST /generations/from-template
  gamma_theme_id text,                   -- Gamma themeId applied to the generation
  style_prompt text,                     -- design direction sent to Gamma when there is no Gamma template
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS presentation_templates_category_idx
  ON public.presentation_templates (category_id, sort_order);
CREATE INDEX IF NOT EXISTS presentation_template_categories_sort_idx
  ON public.presentation_template_categories (sort_order);

/* --------------------------------- RLS ---------------------------------- */
ALTER TABLE public.presentation_template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentation_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone reads active template categories" ON public.presentation_template_categories;
CREATE POLICY "anyone reads active template categories"
  ON public.presentation_template_categories FOR SELECT TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS "anyone reads active templates" ON public.presentation_templates;
CREATE POLICY "anyone reads active templates"
  ON public.presentation_templates FOR SELECT TO anon, authenticated
  USING (is_active);

-- No INSERT/UPDATE/DELETE policies on purpose (service role / dashboard only).
-- Column-level grants keep the Gamma ids and the style prompt private.
REVOKE ALL ON public.presentation_template_categories FROM anon, authenticated;
REVOKE ALL ON public.presentation_templates FROM anon, authenticated;
GRANT SELECT (id, slug, name_en, name_ar, sort_order, is_active)
  ON public.presentation_template_categories TO anon, authenticated;
GRANT SELECT (id, category_id, title_en, title_ar, description_en, description_ar, slide_count,
              thumbnail_url, accent_colors, sort_order, is_active)
  ON public.presentation_templates TO anon, authenticated;

/* ------------------------- thumbnails storage bucket ------------------------- */
-- Public bucket: upload thumbnails in Dashboard -> Storage -> presentation-templates,
-- then paste the file's public URL into presentation_templates.thumbnail_url.
INSERT INTO storage.buckets (id, name, public)
VALUES ('presentation-templates', 'presentation-templates', true)
ON CONFLICT (id) DO NOTHING;

/* ------------------------------ the categories ------------------------------ */
INSERT INTO public.presentation_template_categories (slug, name_en, name_ar, sort_order) VALUES
  ('business',        'Business',                    'أعمال',                 10),
  ('education',       'Education',                   'تعليم',                 20),
  ('arts',            'Arts',                        'فنون',                  30),
  ('science',         'Science',                     'علوم',                  40),
  ('nature',          'Nature',                      'طبيعة',                 50),
  ('finance',         'Finance',                     'مالية',                 60),
  ('technology',      'Technology',                  'تقنية',                 70),
  ('food',            'Food',                        'طعام',                  80),
  ('engineering',     'Engineering',                 'هندسة',                 90),
  ('health',          'Health',                      'صحة',                  100),
  ('travel',          'Travel',                      'سفر وسياحة',           110),
  ('data-analytics',  'Data and Analytics',          'البيانات والتحليلات',   120),
  ('history-social',  'History and Social Studies',  'التاريخ والدراسات الاجتماعية', 130),
  ('law-government',  'Law and Government',          'القانون والحكومة',     140),
  ('real-estate',     'Real Estate and Architecture','العقارات والعمارة',    150),
  ('psychology',      'Psychology and Self-help',    'علم النفس وتطوير الذات', 160),
  ('sports',          'Sports',                      'رياضة',                170),
  ('religion',        'Religion',                    'أديان',                180)
ON CONFLICT (slug) DO UPDATE
  SET name_en = EXCLUDED.name_en, name_ar = EXCLUDED.name_ar, sort_order = EXCLUDED.sort_order;
