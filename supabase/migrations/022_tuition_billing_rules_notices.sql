-- Tuition billing rules, fee notice drafts, and explicit attendance absence types.

alter table public.attendance
add column if not exists absence_type text
check (absence_type is null or absence_type in ('permitted', 'unpermitted', 'holiday'));

alter table public.tuition_plans
add column if not exists facility_id uuid references public.facilities(id) on delete restrict,
add column if not exists class_name text,
add column if not exists refund_per_permitted_absence numeric(12,2) not null default 20000 check (refund_per_permitted_absence >= 0),
add column if not exists meal_price_per_day numeric(12,2) not null default 0 check (meal_price_per_day >= 0),
add column if not exists updated_by uuid references public.profiles(id) on delete set null;

update public.tuition_plans
set class_name = coalesce(class_name, class_id)
where class_name is null and class_id is not null;

create index if not exists idx_tuition_plans_facility_class
on public.tuition_plans(facility_id, class_name)
where is_active;

create table if not exists public.fee_items (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references public.facilities(id) on delete cascade,
  name text not null,
  unit text not null default 'tháng',
  default_amount numeric(12,2) not null default 0 check (default_amount >= 0),
  category text not null default 'optional' check (category in ('tuition', 'meal', 'optional', 'discount', 'adjustment')),
  is_active boolean not null default true,
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_fee_items_unique_scope_name
on public.fee_items(coalesce(facility_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

insert into public.fee_items (name, unit, default_amount, category, display_order)
values
  ('Học phí cơ bản', 'tháng', 0, 'tuition', 10),
  ('Tiền ăn', 'ngày', 0, 'meal', 20),
  ('Nước uống', 'tháng', 0, 'optional', 30),
  ('Bán trú', 'tháng', 0, 'optional', 40),
  ('Sổ liên lạc điện tử', 'tháng', 0, 'optional', 50),
  ('Tiếng Anh tăng cường', 'tháng', 0, 'optional', 60),
  ('Kỹ năng sống', 'tháng', 0, 'optional', 70),
  ('Năng khiếu', 'tháng', 0, 'optional', 80),
  ('STEM', 'tháng', 0, 'optional', 90),
  ('Khác', 'lần', 0, 'optional', 100)
on conflict do nothing;

create table if not exists public.student_tuition_credits (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  year_month text not null check (year_month ~ '^\d{4}-\d{2}$'),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  note text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, year_month),
  foreign key (student_id, facility_id)
    references public.students(id, facility_id)
    on delete cascade
);

create table if not exists public.fee_notices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  year_month text not null check (year_month ~ '^\d{4}-\d{2}$'),
  notice_number text not null unique,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'cancelled', 'adjusted')),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  previous_credit numeric(12,2) not null default 0 check (previous_credit >= 0),
  attendance_summary jsonb not null default '{}'::jsonb,
  linked_invoice_id uuid references public.invoices(id) on delete set null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, year_month),
  foreign key (student_id, facility_id)
    references public.students(id, facility_id)
    on delete cascade
);

create table if not exists public.fee_notice_items (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.fee_notices(id) on delete cascade,
  fee_item_id uuid references public.fee_items(id) on delete set null,
  name text not null,
  quantity numeric(10,2) not null default 1,
  unit text not null default 'tháng',
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  item_type text not null default 'charge' check (item_type in ('charge', 'discount', 'credit', 'adjustment')),
  display_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.fee_notice_adjustments (
  id uuid primary key default gen_random_uuid(),
  original_notice_id uuid not null references public.fee_notices(id) on delete cascade,
  student_id uuid not null,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  year_month text not null check (year_month ~ '^\d{4}-\d{2}$'),
  amount_delta numeric(12,2) not null,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (student_id, facility_id)
    references public.students(id, facility_id)
    on delete cascade
);

create index if not exists idx_fee_notices_facility_month on public.fee_notices(facility_id, year_month);
create index if not exists idx_fee_notice_items_notice on public.fee_notice_items(notice_id);
create index if not exists idx_fee_notice_adjustments_notice on public.fee_notice_adjustments(original_notice_id);
create index if not exists idx_student_tuition_credits_facility_month on public.student_tuition_credits(facility_id, year_month);

alter table public.fee_items enable row level security;
alter table public.student_tuition_credits enable row level security;
alter table public.fee_notices enable row level security;
alter table public.fee_notice_items enable row level security;
alter table public.fee_notice_adjustments enable row level security;

drop policy if exists "fee items authenticated select" on public.fee_items;
create policy "fee items authenticated select"
on public.fee_items for select
using (public.current_user_role() in ('admin', 'teacher', 'parent'));

drop policy if exists "fee items admin all" on public.fee_items;
create policy "fee items admin all"
on public.fee_items for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "student tuition credits admin all" on public.student_tuition_credits;
create policy "student tuition credits admin all"
on public.student_tuition_credits for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "fee notices admin all" on public.fee_notices;
create policy "fee notices admin all"
on public.fee_notices for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "fee notices teacher own facility select" on public.fee_notices;
create policy "fee notices teacher own facility select"
on public.fee_notices for select
using (public.current_user_role() = 'teacher' and facility_id = public.current_facility_id());

drop policy if exists "fee notices parent linked select" on public.fee_notices;
create policy "fee notices parent linked select"
on public.fee_notices for select
using (
  status <> 'cancelled'
  and public.current_user_role() = 'parent'
  and exists (
    select 1 from public.parent_student_links psl
    where psl.parent_profile_id = auth.uid()
      and psl.student_id = fee_notices.student_id
  )
);

drop policy if exists "fee notice items staff select" on public.fee_notice_items;
create policy "fee notice items staff select"
on public.fee_notice_items for select
using (
  public.current_user_role() in ('admin', 'teacher')
  and exists (
    select 1 from public.fee_notices fn
    where fn.id = fee_notice_items.notice_id
      and (public.current_user_role() = 'admin' or fn.facility_id = public.current_facility_id())
  )
);

drop policy if exists "fee notice items parent linked select" on public.fee_notice_items;
create policy "fee notice items parent linked select"
on public.fee_notice_items for select
using (
  exists (
    select 1
    from public.fee_notices fn
    join public.parent_student_links psl on psl.student_id = fn.student_id
    where fn.id = fee_notice_items.notice_id
      and fn.status <> 'cancelled'
      and psl.parent_profile_id = auth.uid()
  )
);

drop policy if exists "fee notice items admin all" on public.fee_notice_items;
create policy "fee notice items admin all"
on public.fee_notice_items for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "fee notice adjustments admin all" on public.fee_notice_adjustments;
create policy "fee notice adjustments admin all"
on public.fee_notice_adjustments for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create or replace function public.mark_attendance(
  p_student_id uuid,
  p_attendance_date date,
  p_status public.attendance_status,
  p_note text default null,
  p_check_in_time time default null,
  p_check_out_time time default null,
  p_pickup_person text default null,
  p_pickup_phone text default null,
  p_late_reason text default null,
  p_early_pickup_reason text default null,
  p_meal_photo_url text default null,
  p_meal_photo_path text default null,
  p_absence_type text default null
)
returns public.attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_profile_facility_id uuid;
  v_student_facility_id uuid;
  v_row public.attendance;
  v_absence_type text;
begin
  select role, facility_id
    into v_role, v_profile_facility_id
  from public.profiles
  where id = auth.uid()
    and is_active = true;

  if v_role is null then
    raise exception 'Chưa đăng nhập hoặc tài khoản chưa được kích hoạt.' using errcode = '28000';
  end if;

  if v_role not in ('admin', 'teacher') then
    raise exception 'Tài khoản này không có quyền điểm danh.' using errcode = '42501';
  end if;

  select facility_id
    into v_student_facility_id
  from public.students
  where id = p_student_id
    and status = 'active';

  if v_student_facility_id is null then
    raise exception 'Không tìm thấy học sinh đang hoạt động.' using errcode = 'P0002';
  end if;

  if v_role = 'teacher' and v_profile_facility_id is distinct from v_student_facility_id then
    raise exception 'Giáo viên không thuộc cơ sở của học sinh này.' using errcode = '42501';
  end if;

  v_absence_type := case
    when p_status = 'absent' then coalesce(nullif(p_absence_type, ''), 'unpermitted')
    else null
  end;

  if v_absence_type is not null and v_absence_type not in ('permitted', 'unpermitted', 'holiday') then
    raise exception 'Loại vắng không hợp lệ.' using errcode = '22023';
  end if;

  insert into public.attendance (
    student_id,
    facility_id,
    attendance_date,
    status,
    absence_type,
    note,
    meal_photo_url,
    meal_photo_path,
    recorded_by,
    check_in_time,
    check_out_time,
    pickup_person,
    pickup_phone,
    late_reason,
    early_pickup_reason,
    updated_at
  )
  values (
    p_student_id,
    v_student_facility_id,
    p_attendance_date,
    p_status,
    v_absence_type,
    nullif(p_note, ''),
    nullif(p_meal_photo_url, ''),
    nullif(p_meal_photo_path, ''),
    auth.uid(),
    p_check_in_time,
    p_check_out_time,
    nullif(p_pickup_person, ''),
    nullif(p_pickup_phone, ''),
    nullif(p_late_reason, ''),
    nullif(p_early_pickup_reason, ''),
    now()
  )
  on conflict (student_id, attendance_date)
  do update set
    facility_id = excluded.facility_id,
    status = excluded.status,
    absence_type = excluded.absence_type,
    note = excluded.note,
    meal_photo_url = excluded.meal_photo_url,
    meal_photo_path = excluded.meal_photo_path,
    recorded_by = auth.uid(),
    check_in_time = excluded.check_in_time,
    check_out_time = excluded.check_out_time,
    pickup_person = excluded.pickup_person,
    pickup_phone = excluded.pickup_phone,
    late_reason = excluded.late_reason,
    early_pickup_reason = excluded.early_pickup_reason,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.mark_attendance(
  uuid,
  date,
  public.attendance_status,
  text,
  time,
  time,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;
