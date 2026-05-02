-- Drop all overloads of get_public_landing to resolve ambiguity, then recreate once.

drop function if exists public.get_public_landing();
drop function if exists public.get_public_landing(text);

create or replace function public.get_public_landing(facility_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_facility_id uuid;
  active_student_count integer := 0;
  active_teacher_count integer := 0;
  class_count integer := 0;
  student_label text;
  teacher_label text;
begin
  begin
    if facility_code is not null then
      select id into target_facility_id
      from public.facilities
      where code = facility_code
      limit 1;
    end if;
  exception when undefined_table then
    target_facility_id := null;
  end;

  begin
    select count(*) into active_student_count
    from public.students
    where status = 'active'
      and (target_facility_id is null or facility_id = target_facility_id);
  exception when others then
    active_student_count := 0;
  end;

  begin
    select count(*) into active_teacher_count
    from public.profiles
    where role = 'teacher'
      and is_active = true
      and (target_facility_id is null or facility_id = target_facility_id);
  exception when others then
    active_teacher_count := 0;
  end;

  begin
    select count(distinct nullif(trim(class_name), '')) into class_count
    from public.students
    where status = 'active'
      and (target_facility_id is null or facility_id = target_facility_id);
  exception when others then
    class_count := 0;
  end;

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
      jsonb_build_array('⭐', class_count::text, 'Nhóm lớp mầm non'),
      jsonb_build_array('🔒', 'Riêng tư', 'Phân quyền bảo mật')
    ),
    'statStrip', jsonb_build_array(
      jsonb_build_array(class_count::text, 'Nhóm lớp mầm non'),
      jsonb_build_array('Hằng ngày', 'Điểm danh và nhật ký'),
      jsonb_build_array(teacher_label, 'Giáo viên và nhân sự'),
      jsonb_build_array('Riêng tư', 'Quyền truy cập theo vai trò')
    ),
    'programs', jsonb_build_array(
      jsonb_build_object(
        'id', 'program-mam', 'cls', 'Lớp Mầm', 'age', '3–4 tuổi',
        'icon', '🌱',
        'desc', 'Làm quen môi trường học, phát triển ngôn ngữ và kỹ năng xã hội qua vui chơi.',
        'feats', jsonb_build_array('🎨 Vẽ và tô màu sáng tạo', '🎵 Học qua bài hát & vần điệu', '🤝 Kỹ năng sống căn bản'),
        'bg', '#EDE9FE', 'col', '#6D28D9', 'delay', 'd1'
      ),
      jsonb_build_object(
        'id', 'program-choi', 'cls', 'Lớp Chồi', 'age', '4–5 tuổi',
        'icon', '🌿',
        'desc', 'Phát triển tư duy logic, toán học và vốn từ vựng qua khám phá thế giới.',
        'feats', jsonb_build_array('🔢 Làm quen với con số', '📖 Nhận biết chữ cái', '🌍 Khám phá thiên nhiên'),
        'bg', '#FEF3C7', 'col', '#D97706', 'delay', 'd2'
      ),
      jsonb_build_object(
        'id', 'program-la', 'cls', 'Lớp Lá', 'age', '5–6 tuổi',
        'icon', '🌳',
        'desc', 'Chuẩn bị toàn diện vào lớp 1 với kỹ năng đọc viết, tính toán và tư duy độc lập.',
        'feats', jsonb_build_array('✏️ Tập viết chữ & số', '🧩 Tư duy logic & sáng tạo', '🎤 Tự tin giao tiếp'),
        'bg', '#D1FAE5', 'col', '#059669', 'delay', 'd3'
      )
    ),
    'publicEvents', '[]'::jsonb
  );
end;
$$;

revoke all on function public.get_public_landing(text) from public;
grant execute on function public.get_public_landing(text) to anon, authenticated;
