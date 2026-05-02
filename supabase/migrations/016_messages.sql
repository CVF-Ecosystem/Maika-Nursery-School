-- T2-3: Two-way chat between admin/teacher and parents
create table public.messages (
    id uuid primary key default gen_random_uuid(),
    facility_id uuid references public.facilities(id) on delete cascade,
    from_user_id uuid references auth.users(id) on delete set null,
    from_name text not null default '',
    from_role text not null default 'parent' check (from_role in ('admin', 'teacher', 'parent')),
    to_user_id uuid references auth.users(id) on delete set null,
    student_id uuid references public.students(id) on delete set null,
    subject text not null default '',
    body text not null default '',
    parent_message_id uuid references public.messages(id) on delete cascade,
    is_broadcast boolean not null default false,
    is_read boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

-- Admin/teacher: see all messages in their facility
create policy "staff_read_messages" on public.messages
    for select to authenticated
    using (
        public.current_user_role() = 'admin'
        or (
            public.current_user_role() = 'teacher'
            and facility_id = public.current_facility_id()
        )
    );

-- Parent: see messages sent to them, sent by them, or facility broadcasts for their linked students
create policy "parent_read_messages" on public.messages
    for select to authenticated
    using (
        from_user_id = auth.uid()
        or to_user_id = auth.uid()
        or (
            is_broadcast = true
            and exists (
                select 1
                from public.parent_student_links psl
                join public.students s on s.id = psl.student_id
                where psl.parent_profile_id = auth.uid()
                  and s.facility_id = messages.facility_id
            )
        )
    );

-- Authenticated users can insert only as themselves, scoped to their role/facility.
create policy "insert_own_message" on public.messages
    for insert to authenticated
    with check (
        from_user_id = auth.uid()
        and from_role = public.current_user_role()::text
        and (
            public.current_user_role() = 'admin'
            or (
                public.current_user_role() = 'teacher'
                and facility_id = public.current_facility_id()
                and is_broadcast = false
            )
            or (
                public.current_user_role() = 'parent'
                and is_broadcast = false
                and student_id is not null
                and exists (
                    select 1
                    from public.parent_student_links psl
                    join public.students s on s.id = psl.student_id
                    where psl.parent_profile_id = auth.uid()
                      and psl.student_id = messages.student_id
                      and s.facility_id = messages.facility_id
                )
            )
        )
    );

-- Only read-state changes are allowed; trigger below blocks content/metadata mutation.
create policy "mark_read" on public.messages
    for update to authenticated
    using (
        public.current_user_role() = 'admin'
        or (
            public.current_user_role() = 'teacher'
            and facility_id = public.current_facility_id()
        )
        or to_user_id = auth.uid()
        or from_user_id = auth.uid()
    )
    with check (
        public.current_user_role() = 'admin'
        or (
            public.current_user_role() = 'teacher'
            and facility_id = public.current_facility_id()
        )
        or to_user_id = auth.uid()
        or from_user_id = auth.uid()
    );

create or replace function public.prevent_message_mutation_except_read()
returns trigger
language plpgsql
as $$
begin
    if old.id is distinct from new.id
        or old.facility_id is distinct from new.facility_id
        or old.from_user_id is distinct from new.from_user_id
        or old.from_name is distinct from new.from_name
        or old.from_role is distinct from new.from_role
        or old.to_user_id is distinct from new.to_user_id
        or old.student_id is distinct from new.student_id
        or old.subject is distinct from new.subject
        or old.body is distinct from new.body
        or old.parent_message_id is distinct from new.parent_message_id
        or old.is_broadcast is distinct from new.is_broadcast
        or old.created_at is distinct from new.created_at then
        raise exception 'Only message read state can be updated';
    end if;
    return new;
end;
$$;

drop trigger if exists messages_read_only_update on public.messages;
create trigger messages_read_only_update
    before update on public.messages
    for each row execute function public.prevent_message_mutation_except_read();

-- Realtime
alter table public.messages replica identity full;
do $$ begin
    begin
        alter publication supabase_realtime add table public.messages;
    exception when others then null;
    end;
end $$;

-- Indexes
create index messages_facility_id_idx on public.messages(facility_id);
create index messages_from_user_id_idx on public.messages(from_user_id);
create index messages_to_user_id_idx on public.messages(to_user_id);
create index messages_parent_message_id_idx on public.messages(parent_message_id);
create index messages_created_at_idx on public.messages(created_at desc);
