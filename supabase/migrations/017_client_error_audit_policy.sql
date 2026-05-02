-- Allow authenticated portals to write UI error reports without granting audit read access.
drop policy if exists "audit logs client error insert" on public.audit_logs;
create policy "audit logs client error insert"
on public.audit_logs for insert
to authenticated
with check (
  action = 'client_error'
  and entity_type = 'ui'
);
