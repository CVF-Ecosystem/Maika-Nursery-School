-- Maika Supabase core schema
-- Run this in Supabase SQL Editor or through Supabase migrations.

create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('admin', 'teacher', 'parent');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.attendance_status as enum ('present', 'absent', 'late', 'early_pickup', 'sick');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.facilities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  facility_id uuid references public.facilities(id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint teacher_facility_required check (role <> 'teacher' or facility_id is not null)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete restrict,
  full_name text not null,
  dob date,
  gender text not null default 'unknown' check (gender in ('male', 'female', 'unknown')),
  class_name text,
  parent_name text,
  parent_phone text,
  parent_email text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  unique (id, facility_id)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  facility_id uuid not null,
  attendance_date date not null default current_date,
  status public.attendance_status not null default 'present',
  note text,
  meal_photo_url text,
  meal_photo_path text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, attendance_date),
  foreign key (student_id, facility_id)
    references public.students(id, facility_id)
    on delete cascade
);

create index if not exists idx_profiles_facility on public.profiles(facility_id);
create index if not exists idx_students_facility on public.students(facility_id);
create index if not exists idx_students_status on public.students(status);
create index if not exists idx_attendance_facility_date on public.attendance(facility_id, attendance_date desc);
create index if not exists idx_attendance_student_date on public.attendance(student_id, attendance_date desc);

insert into public.facilities (code, name)
values
  ('CS1', 'Maika Cơ sở 1'),
  ('CS2', 'Maika Cơ sở 2')
on conflict (code) do update set name = excluded.name;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid() and is_active = true
$$;

create or replace function public.current_facility_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select facility_id
  from public.profiles
  where id = auth.uid() and is_active = true
$$;

alter table public.facilities enable row level security;
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.attendance enable row level security;

drop policy if exists "facilities admin select all" on public.facilities;
create policy "facilities admin select all"
on public.facilities for select
using (public.current_user_role() = 'admin');

drop policy if exists "facilities teacher select own" on public.facilities;
create policy "facilities teacher select own"
on public.facilities for select
using (
  public.current_user_role() = 'teacher'
  and id = public.current_facility_id()
);

drop policy if exists "profiles self select" on public.profiles;
create policy "profiles self select"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "profiles admin manage" on public.profiles;
create policy "profiles admin manage"
on public.profiles for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "students admin select all" on public.students;
create policy "students admin select all"
on public.students for select
using (public.current_user_role() = 'admin');

drop policy if exists "students teacher select own facility" on public.students;
create policy "students teacher select own facility"
on public.students for select
using (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
);

drop policy if exists "students admin write" on public.students;
create policy "students admin write"
on public.students for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "attendance admin select all" on public.attendance;
create policy "attendance admin select all"
on public.attendance for select
using (public.current_user_role() = 'admin');

drop policy if exists "attendance teacher select own facility" on public.attendance;
create policy "attendance teacher select own facility"
on public.attendance for select
using (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
);

drop policy if exists "attendance admin write" on public.attendance;
create policy "attendance admin write"
on public.attendance for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "attendance teacher insert own facility" on public.attendance;
create policy "attendance teacher insert own facility"
on public.attendance for insert
with check (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
);

drop policy if exists "attendance teacher update own facility" on public.attendance;
create policy "attendance teacher update own facility"
on public.attendance for update
using (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
)
with check (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
);
