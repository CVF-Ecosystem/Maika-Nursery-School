-- Per-student tuition overrides and first-month proration support.

alter table public.students
add column if not exists enrollment_date date;

create table if not exists public.student_tuition_overrides (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  year_month text not null check (year_month ~ '^\d{4}-\d{2}$'),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  reason text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, year_month),
  foreign key (student_id, facility_id)
    references public.students(id, facility_id)
    on delete cascade
);

create index if not exists idx_student_tuition_overrides_facility_month
on public.student_tuition_overrides(facility_id, year_month);

alter table public.student_tuition_overrides enable row level security;

drop policy if exists "student tuition overrides admin all" on public.student_tuition_overrides;
create policy "student tuition overrides admin all"
on public.student_tuition_overrides for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "student tuition overrides staff select" on public.student_tuition_overrides;
create policy "student tuition overrides staff select"
on public.student_tuition_overrides for select
using (public.current_user_role() in ('admin', 'teacher'));
