-- Durable attendance writer for teacher/admin portals.
-- Keeps the permission check in the database so frontend saves do not depend on
-- PostgREST upsert behavior across RLS policies.

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
  p_meal_photo_path text default null
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

  insert into public.attendance (
    student_id,
    facility_id,
    attendance_date,
    status,
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
  text
) to authenticated;
