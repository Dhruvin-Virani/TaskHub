-- Migration: 002_create_tasks_table.sql

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
CREATE INDEX idx_tasks_status ON public.tasks(status);

-- RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Admins see all tasks
CREATE POLICY "admins_all_tasks" ON public.tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.firebase_uid = auth.uid()::text AND u.role = 'admin'
    )
  );

-- Users see only tasks assigned to them
CREATE POLICY "users_assigned_tasks" ON public.tasks
  FOR SELECT USING (
    assigned_to = (
      SELECT id FROM public.users WHERE firebase_uid = auth.uid()::text
    )
  );

-- Users can update status of their own tasks
CREATE POLICY "users_update_own_tasks" ON public.tasks
  FOR UPDATE USING (
    assigned_to = (
      SELECT id FROM public.users WHERE firebase_uid = auth.uid()::text
    )
  );
