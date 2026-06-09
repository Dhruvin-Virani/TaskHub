-- Migration: 004_create_generation_jobs_table.sql
-- Tracks RQ background jobs for AI image generation

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
CREATE INDEX idx_gen_jobs_status ON public.generation_jobs(status);

-- RLS: users can only see jobs for their tasks
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gen_jobs_admin" ON public.generation_jobs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.firebase_uid = auth.uid()::text AND u.role = 'admin')
  );

CREATE POLICY "gen_jobs_user" ON public.generation_jobs
  FOR SELECT USING (requested_by = (SELECT id FROM public.users WHERE firebase_uid = auth.uid()::text));
