begin;

create table if not exists public.giesin_results (
  id text primary key check (id ~ '^[a-f0-9]{32}$'),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  audience text not null check (audience in ('general', 'ingenieria')),
  instagram text check (instagram ~ '^[a-zA-Z0-9_.]{1,30}$'),
  score integer not null check (score >= 0),
  submitted_at timestamptz not null default now()
);

create index if not exists giesin_results_ranking_idx
  on public.giesin_results (audience, score desc, submitted_at, id);

create table if not exists public.giesin_admin_state (
  id boolean primary key default true check (id),
  session_hash text,
  session_expires_at timestamptz,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now()
);

insert into public.giesin_admin_state (id) values (true)
on conflict (id) do nothing;

create or replace function public.giesin_take_admin_attempt()
returns boolean
language sql
set search_path = ''
as $$
  update public.giesin_admin_state
  set attempts = case
        when window_started_at <= now() - interval '1 minute' then 1
        else least(attempts + 1, 9)
      end,
      window_started_at = case
        when window_started_at <= now() - interval '1 minute' then now()
        else window_started_at
      end
  where id = true
  returning attempts <= 8;
$$;

alter table public.giesin_results enable row level security;
alter table public.giesin_admin_state enable row level security;

revoke all on table public.giesin_results, public.giesin_admin_state from public, anon, authenticated, service_role;
grant select, insert on table public.giesin_results to service_role;
grant select, update on table public.giesin_admin_state to service_role;
revoke all on function public.giesin_take_admin_attempt() from public, anon, authenticated, service_role;
grant execute on function public.giesin_take_admin_attempt() to service_role;

commit;
