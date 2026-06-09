-- Migration: 006_storage_bucket.sql
-- Run this in Supabase SQL Editor to create the storage bucket

-- Create the storage bucket for task images
INSERT INTO storage.buckets (id, name, public)
VALUES ('taskhub-images', 'taskhub-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images to their task folder
CREATE POLICY "authenticated_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'taskhub-images');

-- Allow public read access to all images (since bucket is public)
CREATE POLICY "public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'taskhub-images');

-- Allow owners to delete their objects
CREATE POLICY "owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'taskhub-images' AND auth.uid()::text = owner);
