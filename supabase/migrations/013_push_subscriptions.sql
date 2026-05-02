-- Push subscriptions for Web Push API
create table if not exists public.push_subscriptions (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references auth.users(id) on delete cascade,
    facility_id   uuid references public.facilities(id) on delete cascade,
    student_ids   uuid[] not null default '{}',
    endpoint      text not null,
    p256dh        text not null,
    auth_key      text not null,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

-- Parents can manage only their own subscriptions
create policy "push_subscriptions_owner" on public.push_subscriptions
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Service role can read all (for Edge Function)
create policy "push_subscriptions_service_read" on public.push_subscriptions
    for select
    using (auth.role() = 'service_role');
