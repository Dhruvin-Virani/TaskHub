-- Migration: 003_create_generated_images_table.sql

CREATE TABLE IF NOT EXISTS public.generated_images (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id      UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  image_type   TEXT NOT NULL
    CHECK (image_type IN ('white_bg','theme_1','theme_2','creative_1','creative_2',
                          'model_front','model_side','model_close')),
  image_url    TEXT NOT NULL,
  prompt_used  TEXT DEFAULT '',
  -- angle is useful metadata for model images
  angle        TEXT DEFAULT NULL,
  -- free-form JSON metadata (job_id, pexels source, etc.)
  metadata     JSONB DEFAULT '{}',
  is_final     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gen_images_task_id ON public.generated_images(task_id);

-- RLS: same visibility as tasks
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gen_images_via_task_admin" ON public.generated_images
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.firebase_uid = auth.uid()::text AND u.role = 'admin'
    )
  );

CREATE POLICY "gen_images_via_task_user" ON public.generated_images
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.users u ON u.id = t.assigned_to
      WHERE t.id = task_id AND u.firebase_uid = auth.uid()::text
    )
  );
