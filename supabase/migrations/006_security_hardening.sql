-- Security hardening for parent-scoped updates and notification targeting.

drop policy if exists "incidents parent linked update ack" on public.incidents;

create or replace function public.acknowledge_incident(
  p_incident_id uuid,
  p_parent_note text default null
)
returns public.incidents
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.incidents;
begin
  if public.current_user_role() <> 'parent' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.incidents i
  set
    status = 'parent_acknowledged',
    parent_acknowledged_at = coalesce(i.parent_acknowledged_at, now()),
    parent_note = coalesce(p_parent_note, i.parent_note),
    updated_at = now()
  where i.id = p_incident_id
    and i.status in ('open', 'resolved', 'parent_acknowledged')
    and exists (
      select 1
      from public.parent_student_links psl
      where psl.parent_profile_id = auth.uid()
        and psl.student_id = i.student_id
    )
  returning i.* into result;

  if result.id is null then
    raise exception 'incident not found or not allowed' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

grant execute on function public.acknowledge_incident(uuid, text) to authenticated;

drop policy if exists "notifications parent sent select" on public.notifications;
create policy "notifications parent sent select"
on public.notifications for select
using (
  public.current_user_role() = 'parent'
  and status = 'sent'
  and (
    target_role is null
    or target_role = 'all'
    or (
      target_role = 'parent'
      and target_student_id is null
      and target_class_id is null
    )
    or exists (
      select 1
      from public.parent_student_links psl
      join public.students s on s.id = psl.student_id
      where psl.parent_profile_id = auth.uid()
        and (
          notifications.target_student_id = s.id
          or notifications.target_class_id = s.class_name
        )
    )
  )
);
