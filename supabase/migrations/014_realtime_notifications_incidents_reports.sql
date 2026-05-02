-- Enable Supabase Realtime for notifications, incidents, daily_reports
alter table public.notifications replica identity full;
alter table public.incidents replica identity full;
alter table public.daily_reports replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.incidents;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.daily_reports;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
