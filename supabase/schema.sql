-- Cardamom tables. Safe to run in a project shared with other apps: everything is prefixed cardamom_.
create table if not exists public.cardamom_households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique,
  feed_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create table if not exists public.cardamom_members (
  household_id uuid not null references public.cardamom_households on delete cascade,
  user_id uuid not null default auth.uid(),
  primary key (household_id, user_id)
);
create table if not exists public.cardamom_items (
  household_id uuid not null references public.cardamom_households on delete cascade,
  id text not null,
  kind text not null,
  data jsonb not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);
create index if not exists cardamom_items_pull on public.cardamom_items (household_id, updated_at);

create or replace function public.cardamom_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := clock_timestamp(); return new; end $$;
drop trigger if exists cardamom_items_touch on public.cardamom_items;
create trigger cardamom_items_touch before insert or update on public.cardamom_items for each row execute function public.cardamom_touch();

create or replace function public.cardamom_is_member(h uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cardamom_members m where m.household_id = h and m.user_id = (select auth.uid()));
$$;

alter table public.cardamom_households enable row level security;
alter table public.cardamom_members enable row level security;
alter table public.cardamom_items enable row level security;

drop policy if exists cardamom_households_read on public.cardamom_households;
create policy cardamom_households_read on public.cardamom_households for select to authenticated using (public.cardamom_is_member(id));
drop policy if exists cardamom_members_read on public.cardamom_members;
create policy cardamom_members_read on public.cardamom_members for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists cardamom_items_all on public.cardamom_items;
create policy cardamom_items_all on public.cardamom_items for all to authenticated using (public.cardamom_is_member(household_id)) with check (public.cardamom_is_member(household_id));

create or replace function public.cardamom_create_household(p_name text) returns uuid language plpgsql security definer set search_path = '' as $$
declare h uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists (select 1 from public.cardamom_members where user_id = auth.uid()) then raise exception 'You are already in a household'; end if;
  insert into public.cardamom_households (name, join_code, created_by)
    values (coalesce(nullif(trim(p_name), ''), 'Our kitchen'), upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), auth.uid()) returning id into h;
  insert into public.cardamom_members (household_id, user_id) values (h, auth.uid());
  return h;
end $$;

create or replace function public.cardamom_join_household(p_code text) returns uuid language plpgsql security definer set search_path = '' as $$
declare h uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select id into h from public.cardamom_households where join_code = upper(trim(p_code));
  if h is null then raise exception 'No household with that code'; end if;
  delete from public.cardamom_members where user_id = auth.uid();
  insert into public.cardamom_members (household_id, user_id) values (h, auth.uid());
  return h;
end $$;
revoke execute on function public.cardamom_create_household(text), public.cardamom_join_household(text), public.cardamom_is_member(uuid) from anon, public;
grant execute on function public.cardamom_create_household(text), public.cardamom_join_household(text), public.cardamom_is_member(uuid) to authenticated;

-- Photos: private bucket, files stored as <household id>/<recipe id>/<n>
insert into storage.buckets (id, name, public) values ('cardamom-photos', 'cardamom-photos', false) on conflict (id) do nothing;
drop policy if exists cardamom_photos_all on storage.objects;
create policy cardamom_photos_all on storage.objects for all to authenticated
  using (bucket_id = 'cardamom-photos' and public.cardamom_is_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'cardamom-photos' and public.cardamom_is_member(((storage.foldername(name))[1])::uuid));
