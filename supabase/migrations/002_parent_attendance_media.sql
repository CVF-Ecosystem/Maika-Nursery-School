-- Maika Supabase production extensions: parents, attendance details, media, import logs.

create extension if not exists pgcrypto;

alter table public.attendance
  add column if not exists check_in_time time,
  add column if not exists check_out_time time,
  add column if not exists pickup_person text,
  add column if not exists pickup_phone text,
  add column if not exists late_reason text,
  add column if not exists early_pickup_reason text;

create table if not exists public.parent_student_links (
  parent_profile_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  relationship text not null default 'parent',
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (parent_profile_id, student_id)
);

create table if not exists public.media_albums (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references public.facilities(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  album_id uuid references public.media_albums(id) on delete set null,
  facility_id uuid references public.facilities(id) on delete set null,
  student_id uuid references public.students(id) on delete set null,
  storage_path text not null,
  public_url text,
  original_name text,
  mime_type text,
  caption text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references public.facilities(id) on delete set null,
  source_name text not null,
  mode text not null default 'students',
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  error_rows integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'imported', 'failed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_parent_student_links_parent on public.parent_student_links(parent_profile_id);
create index if not exists idx_parent_student_links_student on public.parent_student_links(student_id);
create index if not exists idx_media_albums_facility on public.media_albums(facility_id);
create index if not exists idx_media_assets_album on public.media_assets(album_id);
create index if not exists idx_media_assets_facility on public.media_assets(facility_id);
create index if not exists idx_media_assets_student on public.media_assets(student_id);
create index if not exists idx_import_batches_facility on public.import_batches(facility_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('maika-media', 'maika-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.parent_student_links enable row level security;
alter table public.media_albums enable row level security;
alter table public.media_assets enable row level security;
alter table public.import_batches enable row level security;

drop policy if exists "profiles admin select all" on public.profiles;
create policy "profiles admin select all"
on public.profiles for select
using (public.current_user_role() = 'admin');

drop policy if exists "facilities parent select linked" on public.facilities;
create policy "facilities parent select linked"
on public.facilities for select
using (
  public.current_user_role() = 'parent'
  and exists (
    select 1
    from public.parent_student_links psl
    join public.students s on s.id = psl.student_id
    where psl.parent_profile_id = auth.uid()
      and s.facility_id = facilities.id
  )
);

drop policy if exists "students parent select linked" on public.students;
create policy "students parent select linked"
on public.students for select
using (
  public.current_user_role() = 'parent'
  and exists (
    select 1
    from public.parent_student_links psl
    where psl.parent_profile_id = auth.uid()
      and psl.student_id = students.id
  )
);

drop policy if exists "attendance parent select linked" on public.attendance;
create policy "attendance parent select linked"
on public.attendance for select
using (
  public.current_user_role() = 'parent'
  and exists (
    select 1
    from public.parent_student_links psl
    where psl.parent_profile_id = auth.uid()
      and psl.student_id = attendance.student_id
  )
);

drop policy if exists "parent links admin manage" on public.parent_student_links;
create policy "parent links admin manage"
on public.parent_student_links for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "parent links parent select own" on public.parent_student_links;
create policy "parent links parent select own"
on public.parent_student_links for select
using (parent_profile_id = auth.uid());

drop policy if exists "media albums admin all" on public.media_albums;
create policy "media albums admin all"
on public.media_albums for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "media albums teacher own facility" on public.media_albums;
create policy "media albums teacher own facility"
on public.media_albums for all
using (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
)
with check (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
);

drop policy if exists "media albums parent published linked" on public.media_albums;
create policy "media albums parent published linked"
on public.media_albums for select
using (
  status = 'published'
  and public.current_user_role() = 'parent'
  and exists (
    select 1
    from public.parent_student_links psl
    join public.students s on s.id = psl.student_id
    where psl.parent_profile_id = auth.uid()
      and (media_albums.facility_id is null or media_albums.facility_id = s.facility_id)
  )
);

drop policy if exists "media assets admin all" on public.media_assets;
create policy "media assets admin all"
on public.media_assets for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "media assets teacher own facility" on public.media_assets;
create policy "media assets teacher own facility"
on public.media_assets for all
using (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
)
with check (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
);

drop policy if exists "media assets parent published linked" on public.media_assets;
create policy "media assets parent published linked"
on public.media_assets for select
using (
  status = 'published'
  and public.current_user_role() = 'parent'
  and exists (
    select 1
    from public.parent_student_links psl
    join public.students s on s.id = psl.student_id
    where psl.parent_profile_id = auth.uid()
      and (media_assets.student_id is null or media_assets.student_id = s.id)
      and (media_assets.facility_id is null or media_assets.facility_id = s.facility_id)
  )
);

drop policy if exists "import batches admin all" on public.import_batches;
create policy "import batches admin all"
on public.import_batches for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "storage maika media select" on storage.objects;
create policy "storage maika media select"
on storage.objects for select
using (bucket_id = 'maika-media');

drop policy if exists "storage maika media admin all" on storage.objects;
create policy "storage maika media admin all"
on storage.objects for all
using (
  bucket_id = 'maika-media'
  and public.current_user_role() = 'admin'
)
with check (
  bucket_id = 'maika-media'
  and public.current_user_role() = 'admin'
);

drop policy if exists "storage maika media teacher write" on storage.objects;
create policy "storage maika media teacher write"
on storage.objects for insert
with check (
  bucket_id = 'maika-media'
  and public.current_user_role() = 'teacher'
);
