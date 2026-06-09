-- ════════════════════════════════════════════════════════════════════════════
-- TaskHub — Full Database Migration (run this once in Supabase SQL Editor)
-- ════════════════════════════════════════════════════════════════════════════

-- ── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Shared trigger function ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: users
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firebase_uid    TEXT NOT NULL UNIQUE,
  email           TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL DEFAULT '',
  avatar_url      TEXT DEFAULT '',
  role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid()::text = firebase_uid);

CREATE POLICY "admins_select_all_users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.firebase_uid = auth.uid()::text AND u2.role = 'admin'
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: tasks
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tasks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  product_image_url TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','assigned','in_progress','submitted','accepted','revision_requested')),
  created_by        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_to       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_status      ON public.tasks(status);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_all_tasks" ON public.tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.firebase_uid = auth.uid()::text AND u.role = 'admin'
    )
  );

CREATE POLICY "users_assigned_tasks" ON public.tasks
  FOR SELECT USING (
    assigned_to = (SELECT id FROM public.users WHERE firebase_uid = auth.uid()::text)
  );

CREATE POLICY "users_update_own_tasks" ON public.tasks
  FOR UPDATE USING (
    assigned_to = (SELECT id FROM public.users WHERE firebase_uid = auth.uid()::text)
  );

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: generated_images
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.generated_images (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id      UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  image_type   TEXT NOT NULL
    CHECK (image_type IN ('white_bg','theme_1','theme_2','creative_1','creative_2',
                          'model_front','model_side','model_close')),
  image_url    TEXT NOT NULL,
  prompt_used  TEXT DEFAULT '',
  angle        TEXT DEFAULT NULL,
  metadata     JSONB DEFAULT '{}',
  is_final     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gen_images_task_id ON public.generated_images(task_id);

ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gen_images_admin" ON public.generated_images
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.firebase_uid = auth.uid()::text AND u.role = 'admin'
    )
  );

CREATE POLICY "gen_images_user" ON public.generated_images
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.users u ON u.id = t.assigned_to
      WHERE t.id = task_id AND u.firebase_uid = auth.uid()::text
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: generation_jobs
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id             UUID PRIMARY KEY,
  task_id        UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  image_type     TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed')),
  result_url     TEXT DEFAULT NULL,
  error          TEXT DEFAULT NULL,
  requested_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER gen_jobs_updated_at
  BEFORE UPDATE ON public.generation_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_gen_jobs_task_id ON public.generation_jobs(task_id);
CREATE INDEX idx_gen_jobs_status  ON public.generation_jobs(status);

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gen_jobs_admin" ON public.generation_jobs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.firebase_uid = auth.uid()::text AND u.role = 'admin')
  );

CREATE POLICY "gen_jobs_user" ON public.generation_jobs
  FOR SELECT USING (
    requested_by = (SELECT id FROM public.users WHERE firebase_uid = auth.uid()::text)
  );

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: audit_logs
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT '',
  resource_id   TEXT DEFAULT NULL,
  metadata      JSONB DEFAULT '{}',
  ip_address    INET DEFAULT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id    ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action     ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_admin_read" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.firebase_uid = auth.uid()::text AND u.role = 'admin')
  );

-- ════════════════════════════════════════════════════════════════════════════
-- STORAGE: taskhub-images bucket
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('taskhub-images', 'taskhub-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "storage_authenticated_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'taskhub-images');

CREATE POLICY "storage_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'taskhub-images');

CREATE POLICY "storage_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'taskhub-images');
