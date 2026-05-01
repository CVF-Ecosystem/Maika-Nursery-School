-- Public-safe landing data and admission requests.

create table if not exists public.tour_requests (
  id uuid primary key default gen_random_uuid(),
  parent_name text not null,
  phone text not null,
  child_age text,
  note text,
  status text not null default 'new' check (status in ('new', 'contacted', 'scheduled', 'closed')),
  source text not null default 'landing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tour_requests_status_created
on public.tour_requests(status, created_at desc);

alter table public.tour_requests enable row level security;

drop policy if exists "tour requests public insert" on public.tour_requests;
create policy "tour requests public insert"
on public.tour_requests for insert
to anon, authenticated
with check (true);

drop policy if exists "tour requests staff select" on public.tour_requests;
create policy "tour requests staff select"
on public.tour_requests for select
to authenticated
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "tour requests staff update" on public.tour_requests;
create policy "tour requests staff update"
on public.tour_requests for update
to authenticated
using (public.current_user_role() in ('admin', 'teacher'))
with check (public.current_user_role() in ('admin', 'teacher'));

grant insert on public.tour_requests to anon;
grant select, insert, update on public.tour_requests to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tour_requests_updated_at on public.tour_requests;
create trigger trg_tour_requests_updated_at
before update on public.tour_requests
for each row execute function public.touch_updated_at();

create or replace function public.get_public_landing(facility_code text default 'CS1')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_facility_id uuid;
  active_student_count integer;
  active_teacher_count integer;
  class_count integer;
  student_label text;
  teacher_label text;
begin
  select id into target_facility_id
  from public.facilities
  where code = facility_code
  limit 1;

  select count(*) into active_student_count
  from public.students
  where status = 'active'
    and (target_facility_id is null or facility_id = target_facility_id);

  select count(*) into active_teacher_count
  from public.profiles
  where role = 'teacher'
    and is_active = true
    and (target_facility_id is null or facility_id = target_facility_id);

  select count(distinct nullif(class_name, '')) into class_count
  from public.students
  where status = 'active'
    and (target_facility_id is null or facility_id = target_facility_id);

  class_count := greatest(coalesce(class_count, 0), 3);
  student_label := case when active_student_count > 0 then active_student_count::text || '+' else '—' end;
  teacher_label := case when active_teacher_count > 0 then active_teacher_count::text || '+' else '—' end;

  return jsonb_build_object(
    'stats', jsonb_build_object(
      'activeStudentCount', active_student_count,
      'activeTeacherCount', active_teacher_count,
      'classCount', class_count
    ),
    'heroCards', jsonb_build_array(
      jsonb_build_array('👦', student_label, 'Học sinh đang học'),
      jsonb_build_array('👩‍🏫', teacher_label, 'Giáo viên phụ trách'),
      jsonb_build_array('⭐', class_count, 'Nhóm lớp mầm non'),
      jsonb_build_array('🔒', 'Riêng tư', 'Phân quyền bảo mật')
    ),
    'statStrip', jsonb_build_array(
      jsonb_build_array(class_count, 'Nhóm lớp mầm non'),
      jsonb_build_array('Hằng ngày', 'Điểm danh và nhật ký'),
      jsonb_build_array(teacher_label, 'Giáo viên và nhân sự'),
      jsonb_build_array('Riêng tư', 'Quyền truy cập theo vai trò')
    ),
    'programs', jsonb_build_array(
      jsonb_build_object(
        'id', 'program-mam',
        'cls', 'Lớp Mầm',
        'age', '3–4 tuổi',
        'icon', '🌱',
        'desc', 'Làm quen môi trường học, phát triển ngôn ngữ và kỹ năng xã hội qua vui chơi.',
        'feats', jsonb_build_array('🎨 Vẽ và tô màu sáng tạo', '🎵 Học qua bài hát & vần điệu', '🤝 Kỹ năng sống căn bản'),
        'bg', '#EDE9FE',
        'col', '#6D28D9',
        'delay', 'd1'
      ),
      jsonb_build_object(
        'id', 'program-choi',
        'cls', 'Lớp Chồi',
        'age', '4–5 tuổi',
        'icon', '🌿',
        'desc', 'Phát triển tư duy logic, toán học và vốn từ vựng qua khám phá thế giới.',
        'feats', jsonb_build_array('🔢 Làm quen với con số', '📖 Nhận biết chữ cái', '🌍 Khám phá thiên nhiên'),
        'bg', '#FEF3C7',
        'col', '#D97706',
        'delay', 'd2'
      ),
      jsonb_build_object(
        'id', 'program-la',
        'cls', 'Lớp Lá',
        'age', '5–6 tuổi',
        'icon', '🌳',
        'desc', 'Chuẩn bị toàn diện vào lớp 1 với kỹ năng đọc viết, tính toán và tư duy độc lập.',
        'feats', jsonb_build_array('✏️ Tập viết chữ & số', '🧩 Tư duy logic & sáng tạo', '🎤 Tự tin giao tiếp'),
        'bg', '#D1FAE5',
        'col', '#059669',
        'delay', 'd3'
      )
    ),
    'publicEvents', '[]'::jsonb
  );
end;
$$;

revoke all on function public.get_public_landing(text) from public;
grant execute on function public.get_public_landing(text) to anon, authenticated;
