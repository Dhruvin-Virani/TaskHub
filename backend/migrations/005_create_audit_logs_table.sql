-- Migration: 005_create_audit_logs_table.sql

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

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- RLS: only admins can read audit logs, no one can mutate them directly
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_admin_read" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.firebase_uid = auth.uid()::text AND u.role = 'admin')
  );

-- Only service role (backend) can insert — no client-side inserts
-- (policy is not needed since service role bypasses RLS)
