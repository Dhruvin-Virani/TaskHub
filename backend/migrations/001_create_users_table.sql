-- Migration: 001_create_users_table.sql
-- Run this first in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firebase_uid    TEXT NOT NULL UNIQUE,
  email           TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL DEFAULT '',
  avatar_url      TEXT DEFAULT '',
  -- role is set manually in Supabase: 'admin' or 'user'
  role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own record
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid()::text = firebase_uid);

-- Admins can read all users
CREATE POLICY "admins_select_all_users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.firebase_uid = auth.uid()::text AND u2.role = 'admin'
    )
  );

-- Service role bypasses RLS (used by backend with service_role key)
