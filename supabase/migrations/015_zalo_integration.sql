-- Zalo OA / ZNS integration config stored alongside school settings
alter table public.school_settings
    add column if not exists zalo_oa_token              text,
    add column if not exists zalo_zns_invoice_template  text,
    add column if not exists zalo_zns_incident_template text;

-- Track ZNS send log (optional, helps with debugging + audit)
create table if not exists public.zns_logs (
    id           uuid primary key default gen_random_uuid(),
    facility_id  uuid references public.facilities(id) on delete cascade,
    template_id  text not null,
    phone        text not null,
    ref_type     text,        -- 'invoice' | 'incident' | 'notification'
    ref_id       uuid,
    status       text not null default 'sent',
    zalo_msg_id  text,
    error        text,
    created_at   timestamptz not null default now()
);

alter table public.zns_logs enable row level security;

create policy "zns_logs_admin" on public.zns_logs
    using (auth.role() = 'service_role' or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('admin','teacher') and p.is_active = true
    ));
