-- Sensitive operational domains for Supabase cutover.
-- Moves the highest-risk child/parent data toward RLS-protected Postgres tables.

create extension if not exists pgcrypto;

create table if not exists public.health_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  allergies text,
  blood_type text,
  medications text,
  medical_notes text,
  emergency_contact_name text,
  emergency_contact_relation text,
  emergency_contact_phone text,
  doctor_name text,
  doctor_phone text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id),
  foreign key (student_id, facility_id)
    references public.students(id, facility_id)
    on delete cascade
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  reported_by uuid references public.profiles(id) on delete set null,
  reporter_name text,
  severity text not null default 'minor' check (severity in ('minor', 'moderate', 'severe')),
  description text not null,
  initial_action text,
  status text not null default 'draft' check (status in ('draft', 'open', 'resolved', 'parent_acknowledged')),
  parent_acknowledged_at timestamptz,
  parent_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (student_id, facility_id)
    references public.students(id, facility_id)
    on delete cascade
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  invoice_number text not null unique,
  type text not null default 'tuition',
  description text,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  due_date date,
  paid_at timestamptz,
  payment_method text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'cancelled')),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (student_id, facility_id)
    references public.students(id, facility_id)
    on delete cascade
);

create table if not exists public.student_consents (
  student_id uuid primary key,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  allow_photos boolean not null default true,
  allow_notifications boolean not null default true,
  contact_channels jsonb not null default '["app"]'::jsonb,
  allow_photo_sharing boolean not null default false,
  data_retention_days integer not null default 365 check (data_retention_days > 0),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (student_id, facility_id)
    references public.students(id, facility_id)
    on delete cascade
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.health_records
  add column if not exists blood_type text,
  add column if not exists emergency_contact_relation text;

create index if not exists idx_health_records_facility on public.health_records(facility_id);
create index if not exists idx_incidents_student on public.incidents(student_id);
create index if not exists idx_incidents_facility_status on public.incidents(facility_id, status);
create index if not exists idx_incidents_occurred on public.incidents(occurred_at desc);
create index if not exists idx_invoices_student on public.invoices(student_id);
create index if not exists idx_invoices_facility_status on public.invoices(facility_id, status);
create index if not exists idx_invoices_due on public.invoices(due_date);
create index if not exists idx_student_consents_facility on public.student_consents(facility_id);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);

alter table public.health_records enable row level security;
alter table public.incidents enable row level security;
alter table public.invoices enable row level security;
alter table public.student_consents enable row level security;
alter table public.audit_logs enable row level security;

-- Health records: admin full, teacher own facility, parent read own child.
drop policy if exists "health records admin all" on public.health_records;
create policy "health records admin all"
on public.health_records for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "health records teacher own facility" on public.health_records;
create policy "health records teacher own facility"
on public.health_records for all
using (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
)
with check (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
);

drop policy if exists "health records parent linked select" on public.health_records;
create policy "health records parent linked select"
on public.health_records for select
using (
  public.current_user_role() = 'parent'
  and exists (
    select 1 from public.parent_student_links psl
    where psl.parent_profile_id = auth.uid()
      and psl.student_id = health_records.student_id
  )
);

-- Incidents: admin full, teacher own facility, parent read/ack own child.
drop policy if exists "incidents admin all" on public.incidents;
create policy "incidents admin all"
on public.incidents for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "incidents teacher own facility" on public.incidents;
create policy "incidents teacher own facility"
on public.incidents for all
using (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
)
with check (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
);

drop policy if exists "incidents parent linked select" on public.incidents;
create policy "incidents parent linked select"
on public.incidents for select
using (
  status <> 'draft'
  and public.current_user_role() = 'parent'
  and exists (
    select 1 from public.parent_student_links psl
    where psl.parent_profile_id = auth.uid()
      and psl.student_id = incidents.student_id
  )
);

drop policy if exists "incidents parent linked update ack" on public.incidents;
create policy "incidents parent linked update ack"
on public.incidents for update
using (
  status in ('open', 'resolved', 'parent_acknowledged')
  and public.current_user_role() = 'parent'
  and exists (
    select 1 from public.parent_student_links psl
    where psl.parent_profile_id = auth.uid()
      and psl.student_id = incidents.student_id
  )
)
with check (
  status in ('parent_acknowledged', 'resolved')
  and public.current_user_role() = 'parent'
  and exists (
    select 1 from public.parent_student_links psl
    where psl.parent_profile_id = auth.uid()
      and psl.student_id = incidents.student_id
  )
);

-- Invoices: admin writes, teacher reads own facility, parent reads own child except cancelled.
drop policy if exists "invoices admin all" on public.invoices;
create policy "invoices admin all"
on public.invoices for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "invoices teacher own facility select" on public.invoices;
create policy "invoices teacher own facility select"
on public.invoices for select
using (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
);

drop policy if exists "invoices parent linked select" on public.invoices;
create policy "invoices parent linked select"
on public.invoices for select
using (
  status <> 'cancelled'
  and public.current_user_role() = 'parent'
  and exists (
    select 1 from public.parent_student_links psl
    where psl.parent_profile_id = auth.uid()
      and psl.student_id = invoices.student_id
  )
);

-- Consents: admin full, teacher read own facility, parent read/update own child.
drop policy if exists "student consents admin all" on public.student_consents;
create policy "student consents admin all"
on public.student_consents for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "student consents teacher own facility select" on public.student_consents;
create policy "student consents teacher own facility select"
on public.student_consents for select
using (
  public.current_user_role() = 'teacher'
  and facility_id = public.current_facility_id()
);

drop policy if exists "student consents parent linked select" on public.student_consents;
create policy "student consents parent linked select"
on public.student_consents for select
using (
  public.current_user_role() = 'parent'
  and exists (
    select 1 from public.parent_student_links psl
    where psl.parent_profile_id = auth.uid()
      and psl.student_id = student_consents.student_id
  )
);

drop policy if exists "student consents parent linked update" on public.student_consents;
create policy "student consents parent linked update"
on public.student_consents for update
using (
  public.current_user_role() = 'parent'
  and exists (
    select 1 from public.parent_student_links psl
    where psl.parent_profile_id = auth.uid()
      and psl.student_id = student_consents.student_id
  )
)
with check (
  public.current_user_role() = 'parent'
  and exists (
    select 1 from public.parent_student_links psl
    where psl.parent_profile_id = auth.uid()
      and psl.student_id = student_consents.student_id
  )
);

drop policy if exists "student consents parent linked insert" on public.student_consents;
create policy "student consents parent linked insert"
on public.student_consents for insert
with check (
  public.current_user_role() = 'parent'
  and exists (
    select 1 from public.parent_student_links psl
    where psl.parent_profile_id = auth.uid()
      and psl.student_id = student_consents.student_id
  )
);

-- Audit logs are append-only from admin/client perspective; service role bypasses RLS for server imports.
drop policy if exists "audit logs admin select" on public.audit_logs;
create policy "audit logs admin select"
on public.audit_logs for select
using (public.current_user_role() = 'admin');

drop policy if exists "audit logs admin insert" on public.audit_logs;
create policy "audit logs admin insert"
on public.audit_logs for insert
with check (public.current_user_role() = 'admin');
