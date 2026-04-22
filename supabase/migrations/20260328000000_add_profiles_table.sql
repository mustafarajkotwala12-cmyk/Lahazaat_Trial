create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.articles
  add column if not exists category_id uuid references public.categories (id) on delete set null,
  add column if not exists author_id uuid references auth.users (id) on delete set null;

alter table public.articles
  alter column author_id set default auth.uid();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- Avoid recursive RLS lookups by resolving admin state through a security definer helper.
create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select profiles.is_admin
      from public.profiles
      where profiles.id = check_user_id
    ),
    false
  );
$$;

grant execute on function public.is_admin(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.articles enable row level security;

create policy "profiles_select_all"
on public.profiles
for select
to anon, authenticated
using (true);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles_update_admin"
on public.profiles
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "categories_select_all"
on public.categories
for select
to anon, authenticated
using (true);

create policy "categories_admin_write"
on public.categories
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "published articles are readable" on public.articles;
drop policy if exists "articles_read_published" on public.articles;
drop policy if exists "articles_read_own_drafts" on public.articles;
drop policy if exists "articles_update_own_drafts" on public.articles;
drop policy if exists "articles_admin_full" on public.articles;
drop policy if exists "articles_insert_authenticated" on public.articles;

create policy "articles_read_published"
on public.articles
for select
to anon, authenticated
using (is_published = true);

create policy "articles_read_own_drafts"
on public.articles
for select
to authenticated
using (author_id = auth.uid() and is_published = false);

-- Students can revise their own unpublished drafts without bypassing admin-only access.
create policy "articles_update_own_drafts"
on public.articles
for update
to authenticated
using (author_id = auth.uid() and is_published = false)
with check (author_id = auth.uid() and is_published = false);

-- Admin access still flows through RLS, with public.is_admin() as the backend guardrail.
create policy "articles_admin_full"
on public.articles
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "articles_insert_authenticated"
on public.articles
for insert
to authenticated
with check (auth.uid() = author_id);
