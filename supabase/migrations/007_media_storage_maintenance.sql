-- Track uploaded media size for admin storage maintenance.

alter table public.media_assets
  add column if not exists size_bytes bigint not null default 0;

create index if not exists idx_media_assets_status_created
on public.media_assets(status, created_at desc);
