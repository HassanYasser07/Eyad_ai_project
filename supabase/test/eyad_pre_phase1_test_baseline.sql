-- Disposable TEST baseline reconstructed from read-only Production catalog metadata.
-- This contains only the pre-Phase-1 tables required by Phase 1 integration tests.
-- It intentionally contains no rows and excludes Phase 1 columns/indexes/RPCs.

CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  studio_type text,
  status text NOT NULL DEFAULT 'draft',
  language text NOT NULL DEFAULT 'ar',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT projects_language_check CHECK (language IN ('ar', 'en')),
  CONSTRAINT projects_status_check CHECK (status IN ('draft', 'in_progress', 'completed', 'archived'))
);

CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  project_id uuid,
  title text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT conversations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT conversations_status_check CHECK (status IN ('active', 'archived'))
);

CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  role text NOT NULL,
  content text,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  input_tokens integer,
  output_tokens integer,
  credit_cost numeric(12,4) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE,
  CONSTRAINT messages_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT messages_role_check CHECK (role IN ('user', 'assistant', 'system', 'tool'))
);

CREATE TABLE public.assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  project_id uuid,
  kind text NOT NULL,
  name text,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  width integer,
  height integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assets_pkey PRIMARY KEY (id),
  CONSTRAINT assets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT assets_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT assets_kind_check CHECK (kind IN ('image', 'logo', 'video', 'audio', 'document', 'template', 'other'))
);

CREATE TABLE public.generations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  project_id uuid,
  studio_type text,
  provider text,
  model text,
  prompt text,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  error text,
  credit_cost numeric(12,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT generations_pkey PRIMARY KEY (id),
  CONSTRAINT generations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT generations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT generations_status_check CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled'))
);

CREATE TABLE public.eyad_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  project_id uuid,
  conversation_id uuid,
  message_id uuid,
  type text NOT NULL DEFAULT 'eyad_request',
  status text NOT NULL DEFAULT 'queued',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eyad_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT eyad_jobs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT eyad_jobs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL,
  CONSTRAINT eyad_jobs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL,
  CONSTRAINT eyad_jobs_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE SET NULL,
  CONSTRAINT eyad_jobs_status_check CHECK (status IN ('queued', 'processing', 'completed', 'failed'))
);

CREATE TABLE public.credit_accounts (
  owner_id uuid NOT NULL,
  balance numeric(14,4) NOT NULL DEFAULT 0,
  lifetime_credited numeric(14,4) NOT NULL DEFAULT 0,
  lifetime_used numeric(14,4) NOT NULL DEFAULT 0,
  plan text NOT NULL DEFAULT 'free',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_accounts_pkey PRIMARY KEY (owner_id),
  CONSTRAINT credit_accounts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT credit_accounts_balance_check CHECK (balance >= 0),
  CONSTRAINT credit_accounts_lifetime_credited_check CHECK (lifetime_credited >= 0),
  CONSTRAINT credit_accounts_lifetime_used_check CHECK (lifetime_used >= 0)
);

CREATE TABLE public.credit_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  amount numeric(14,4) NOT NULL,
  type text NOT NULL,
  reference_type text,
  reference_id uuid,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT credit_transactions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT credit_transactions_type_check CHECK (type IN ('grant', 'purchase', 'usage', 'refund', 'adjustment'))
);

CREATE INDEX projects_owner_created_idx ON public.projects(owner_id, created_at DESC);
CREATE INDEX projects_owner_studio_idx ON public.projects(owner_id, studio_type);
CREATE INDEX projects_owner_updated_idx ON public.projects(owner_id, updated_at DESC);
CREATE INDEX conversations_owner_project_idx ON public.conversations(owner_id, project_id, updated_at DESC);
CREATE INDEX conversations_owner_updated_idx ON public.conversations(owner_id, updated_at DESC);
CREATE INDEX conversations_project_idx ON public.conversations(project_id);
CREATE INDEX messages_conversation_created_idx ON public.messages(conversation_id, created_at);
CREATE INDEX messages_owner_conversation_created_idx ON public.messages(owner_id, conversation_id, created_at);
CREATE INDEX messages_owner_created_idx ON public.messages(owner_id, created_at DESC);
CREATE INDEX assets_owner_created_idx ON public.assets(owner_id, created_at DESC);
CREATE INDEX assets_owner_project_created_idx ON public.assets(owner_id, project_id, created_at DESC);
CREATE INDEX assets_project_idx ON public.assets(project_id);
CREATE INDEX generations_owner_created_idx ON public.generations(owner_id, created_at DESC);
CREATE INDEX generations_owner_project_created_idx ON public.generations(owner_id, project_id, created_at DESC);
CREATE INDEX generations_project_idx ON public.generations(project_id);
CREATE INDEX eyad_jobs_owner_updated_idx ON public.eyad_jobs(owner_id, updated_at DESC);
CREATE INDEX eyad_jobs_project_idx ON public.eyad_jobs(project_id, updated_at DESC);
CREATE INDEX credit_transactions_owner_created_idx ON public.credit_transactions(owner_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_eyad_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER assets_updated_at BEFORE UPDATE ON public.assets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER credit_accounts_updated_at BEFORE UPDATE ON public.credit_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER eyad_jobs_updated_at BEFORE UPDATE ON public.eyad_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_eyad_jobs_updated_at();

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eyad_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_owner_all ON public.projects FOR ALL TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY conversations_owner_all ON public.conversations FOR ALL TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY messages_owner_all ON public.messages FOR ALL TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY assets_owner_all ON public.assets FOR ALL TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY generations_owner_all ON public.generations FOR ALL TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "eyad jobs owner insert" ON public.eyad_jobs FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());
CREATE POLICY "eyad jobs owner select" ON public.eyad_jobs FOR SELECT TO authenticated
USING (owner_id = auth.uid());
CREATE POLICY "eyad jobs owner update" ON public.eyad_jobs FOR UPDATE TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY credit_accounts_owner_all ON public.credit_accounts FOR ALL TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY credit_transactions_owner_all ON public.credit_transactions FOR ALL TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Match observed Production table ACLs. Credit tables are RPC-managed and do not
-- grant direct DML; service_role executes the SECURITY DEFINER credit RPCs.
REVOKE ALL ON TABLE public.projects, public.conversations, public.messages, public.assets,
  public.generations, public.eyad_jobs FROM PUBLIC;
GRANT ALL ON TABLE public.projects, public.conversations, public.messages, public.assets,
  public.generations, public.eyad_jobs TO anon, authenticated, service_role;
REVOKE ALL ON TABLE public.credit_accounts, public.credit_transactions FROM PUBLIC;
GRANT TRUNCATE, REFERENCES, TRIGGER ON TABLE public.credit_accounts, public.credit_transactions TO anon, authenticated, service_role;
