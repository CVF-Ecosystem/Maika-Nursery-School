-- Add photo attachments to daily_reports and incidents.
-- Teachers can attach up to 3 photos per record from mobile camera.

alter table public.daily_reports
  add column if not exists photo_paths text[] not null default '{}';

alter table public.incidents
  add column if not exists photo_paths text[] not null default '{}';
