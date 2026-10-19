-- Torn Command Center - Phase 16 graffiti images

alter table public.graffiti_posts
  add column if not exists image_url text;
