-- Teacher staff profiles are separate from login accounts in public.profiles.
-- profiles = authentication and permissions; teachers = HR/academic profile data.

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete restrict,
  linked_profile_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  class_name text,
  subject text not null default 'Giáo viên chủ nhiệm',
  phone text,
  email text,
  join_date date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  initials text,
  degree text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_teachers_facility on public.teachers(facility_id);
create index if not exists idx_teachers_status on public.teachers(status);
create unique index if not exists idx_teachers_facility_email_unique
on public.teachers(facility_id, lower(email))
where email is not null;

alter table public.teachers enable row level security;

drop policy if exists "teachers admin select all" on public.teachers;
create policy "teachers admin select all"
on public.teachers for select
using (public.current_user_role() = 'admin');

drop policy if exists "teachers teacher select own facility" on public.teachers;
create policy "teachers teacher select own facility"
on public.teachers for select
using (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
);

drop policy if exists "teachers admin write" on public.teachers;
create policy "teachers admin write"
on public.teachers for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

insert into public.teachers (
  facility_id,
  full_name,
  class_name,
  subject,
  phone,
  email,
  join_date,
  status,
  initials,
  degree
)
select
  f.id,
  seed.full_name,
  seed.class_name,
  seed.subject,
  seed.phone,
  lower(seed.email_prefix || '.' || f.code || '@maika.edu.vn'),
  seed.join_date::date,
  'active',
  seed.initials,
  seed.degree
from public.facilities f
cross join (
  values
    ('Nguyễn Thị Hoa', 'Lớp Mầm', 'Giáo viên chủ nhiệm', '0901111111', 'hoa.nt', '2022-08-01', 'TH', 'Cử nhân Giáo dục Mầm non'),
    ('Trần Thị Bích', 'Lớp Chồi', 'Giáo viên chủ nhiệm', '0902222222', 'bich.tt', '2021-08-01', 'TB', 'Cử nhân Giáo dục Mầm non'),
    ('Lê Thị Phương', 'Lớp Lá', 'Giáo viên chủ nhiệm', '0903333333', 'phuong.lt', '2020-08-01', 'TP', 'Thạc sĩ Giáo dục'),
    ('Phạm Văn Toàn', null, 'Giáo viên Thể chất', '0904444444', 'toan.pv', '2023-01-15', 'VT', 'Cử nhân Thể dục thể thao'),
    ('Võ Thị Hạnh', null, 'Giáo viên Âm nhạc', '0905555555', 'hanh.vt', '2022-03-01', 'TH2', 'Cử nhân Âm nhạc'),
    ('Đỗ Thị Kim', null, 'Y tế học đường', '0906666666', 'kim.dt', '2021-09-01', 'TK', 'Cử nhân Y tế')
) as seed(full_name, class_name, subject, phone, email_prefix, join_date, initials, degree)
where f.is_active = true
  and not exists (
    select 1
    from public.teachers t
    where t.facility_id = f.id
      and lower(t.email) = lower(seed.email_prefix || '.' || f.code || '@maika.edu.vn')
  );
