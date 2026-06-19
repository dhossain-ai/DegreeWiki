-- Migration 017: Add last_verified_at to articles
-- articles was the only content table missing this column.
-- All other content tables (countries, universities, programs, scholarships)
-- already have last_verified_at. This makes articles consistent and allows
-- SourceBox.astro to display a verified-at date for articles.
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;
