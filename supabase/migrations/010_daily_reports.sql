create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  facility_id uuid not null,
  report_date date not null default current_date,
  breakfast text,
  lunch text,
  snack text,
  nap_duration integer not null default 0,
  mood text,
  activities text[] not null default '{}',
  note text,
  health text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, report_date),
  foreign key (student_id, facility_id)
    references public.students(id, facility_id)
    on delete cascade
);

create index if not exists idx_daily_reports_facility_date on public.daily_reports(facility_id, report_date desc);
create index if not exists idx_daily_reports_student_date on public.daily_reports(student_id, report_date desc);

alter table public.daily_reports enable row level security;

drop policy if exists "daily reports admin select all" on public.daily_reports;
create policy "daily reports admin select all"
on public.daily_reports for select
using (public.current_user_role() = 'admin');

drop policy if exists "daily reports teacher select own facility" on public.daily_reports;
create policy "daily reports teacher select own facility"
on public.daily_reports for select
using (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
);

drop policy if exists "daily reports admin write" on public.daily_reports;
create policy "daily reports admin write"
on public.daily_reports for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "daily reports teacher insert own facility" on public.daily_reports;
create policy "daily reports teacher insert own facility"
on public.daily_reports for insert
with check (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
);

drop policy if exists "daily reports teacher update own facility" on public.daily_reports;
create policy "daily reports teacher update own facility"
on public.daily_reports for update
using (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
)
with check (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
);
