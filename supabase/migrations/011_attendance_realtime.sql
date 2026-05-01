-- Enable live attendance updates for teacher/admin attendance screens.
alter table public.attendance replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.attendance;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
