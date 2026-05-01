-- Operational domains for Supabase cutover.
-- Covers notifications, school settings, academic calendar, tuition plans, and meal menus.

create extension if not exists pgcrypto;

create table if not exists public.school_settings (
  id integer primary key default 1 check (id = 1),
  school_name text not null default 'Nhà Trẻ Maika',
  logo_url text,
  address text,
  phone text,
  email text,
  hours_open text not null default '07:00',
  hours_close text not null default '18:00',
  pickup_start text not null default '16:30',
  pickup_end text not null default '18:00',
  timezone text not null default 'Asia/Ho_Chi_Minh',
  current_academic_year_id uuid,
  updated_at timestamptz not null default now()
);

insert into public.school_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  check (start_date <= end_date)
);

create unique index if not exists idx_academic_years_one_current
on public.academic_years(is_current)
where is_current;

create table if not exists public.school_holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null,
  is_recurring boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.tuition_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  class_id text,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  currency text not null default 'VND',
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'term', 'yearly')),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_menus (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  day_of_week integer not null check (day_of_week between 1 and 7),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'snack')),
  dishes jsonb not null default '[]'::jsonb,
  ingredients text,
  allergen_notes text,
  is_published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_start, day_of_week, meal_type)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  type text not null default 'general' check (type in ('general', 'invoice', 'event', 'health', 'incident', 'emergency', 'system')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  target_role text check (target_role is null or target_role in ('admin', 'teacher', 'parent', 'all')),
  target_class_id text,
  target_student_id uuid references public.students(id) on delete cascade,
  channel text not null default 'app' check (channel in ('app', 'email', 'sms', 'zalo', 'all')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent', 'failed', 'cancelled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index if not exists idx_school_holidays_date on public.school_holidays(date);
create index if not exists idx_tuition_plans_active on public.tuition_plans(is_active);
create index if not exists idx_meal_menus_week on public.meal_menus(week_start);
create index if not exists idx_notifications_status on public.notifications(status);
create index if not exists idx_notifications_target_role on public.notifications(target_role);
create index if not exists idx_notifications_target_student on public.notifications(target_student_id);
create index if not exists idx_notifications_created on public.notifications(created_at desc);
create index if not exists idx_notification_reads_user on public.notification_reads(user_id);

alter table public.school_settings enable row level security;
alter table public.academic_years enable row level security;
alter table public.school_holidays enable row level security;
alter table public.tuition_plans enable row level security;
alter table public.meal_menus enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;

-- School-wide configuration: authenticated roles can read, only admin can write.
drop policy if exists "school settings authenticated select" on public.school_settings;
create policy "school settings authenticated select"
on public.school_settings for select
using (public.current_user_role() in ('admin', 'teacher', 'parent'));

drop policy if exists "school settings admin write" on public.school_settings;
create policy "school settings admin write"
on public.school_settings for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

-- Academic calendar and tuition are school-wide read models, admin maintained.
drop policy if exists "academic years authenticated select" on public.academic_years;
create policy "academic years authenticated select"
on public.academic_years for select
using (public.current_user_role() in ('admin', 'teacher', 'parent'));

drop policy if exists "academic years admin write" on public.academic_years;
create policy "academic years admin write"
on public.academic_years for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "school holidays authenticated select" on public.school_holidays;
create policy "school holidays authenticated select"
on public.school_holidays for select
using (public.current_user_role() in ('admin', 'teacher', 'parent'));

drop policy if exists "school holidays admin write" on public.school_holidays;
create policy "school holidays admin write"
on public.school_holidays for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "tuition plans authenticated select" on public.tuition_plans;
create policy "tuition plans authenticated select"
on public.tuition_plans for select
using (public.current_user_role() in ('admin', 'teacher', 'parent'));

drop policy if exists "tuition plans admin write" on public.tuition_plans;
create policy "tuition plans admin write"
on public.tuition_plans for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

-- Meal menus: parents only see published menus; staff can maintain them.
drop policy if exists "meal menus staff select" on public.meal_menus;
create policy "meal menus staff select"
on public.meal_menus for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "meal menus parent published select" on public.meal_menus;
create policy "meal menus parent published select"
on public.meal_menus for select
using (public.current_user_role() = 'parent' and is_published = true);

drop policy if exists "meal menus staff write" on public.meal_menus;
create policy "meal menus staff write"
on public.meal_menus for all
using (public.current_user_role() in ('admin', 'teacher'))
with check (public.current_user_role() in ('admin', 'teacher'));

-- Notifications: staff draft/send; parents only receive sent notifications scoped to them.
drop policy if exists "notifications staff select" on public.notifications;
create policy "notifications staff select"
on public.notifications for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "notifications staff write" on public.notifications;
create policy "notifications staff write"
on public.notifications for all
using (public.current_user_role() in ('admin', 'teacher'))
with check (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "notifications parent sent select" on public.notifications;
create policy "notifications parent sent select"
on public.notifications for select
using (
  public.current_user_role() = 'parent'
  and status = 'sent'
  and (
    target_role is null
    or target_role in ('parent', 'all')
    or exists (
      select 1 from public.parent_student_links psl
      where psl.parent_profile_id = auth.uid()
        and psl.student_id = notifications.target_student_id
    )
  )
);

drop policy if exists "notification reads own select" on public.notification_reads;
create policy "notification reads own select"
on public.notification_reads for select
using (user_id = auth.uid());

drop policy if exists "notification reads own insert" on public.notification_reads;
create policy "notification reads own insert"
on public.notification_reads for insert
with check (user_id = auth.uid());
