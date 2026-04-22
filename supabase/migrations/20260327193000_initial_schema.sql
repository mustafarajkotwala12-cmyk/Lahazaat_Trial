create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  content text,
  image_url text,
  author text,
  is_published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.daily_words (
  id uuid primary key default gen_random_uuid(),
  play_date date not null unique,
  solution_word text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint daily_words_solution_word_format
    check (solution_word ~ '^[a-z]{5}$')
);

create table if not exists public.game_stats (
  user_id uuid not null references auth.users (id) on delete cascade,
  game_type text not null,
  game_name text not null,
  last_played_date date,
  last_result text,
  current_streak integer not null default 0,
  max_streak integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  games_played integer not null default 0,
  last_guess_count integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint game_stats_pkey primary key (user_id, game_type),
  constraint game_stats_last_result_check
    check (last_result is null or last_result in ('won', 'lost'))
);

create index if not exists articles_published_created_at_idx
  on public.articles (created_at desc)
  where is_published = true;

create trigger set_articles_updated_at
before update on public.articles
for each row
execute function public.set_updated_at();

create trigger set_game_stats_updated_at
before update on public.game_stats
for each row
execute function public.set_updated_at();

alter table public.articles enable row level security;
alter table public.daily_words enable row level security;
alter table public.game_stats enable row level security;

create policy "published articles are readable"
on public.articles
for select
to anon, authenticated
using (is_published = true);

create policy "daily words are readable"
on public.daily_words
for select
to anon, authenticated
using (true);

create policy "users can read own game stats"
on public.game_stats
for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert own game stats"
on public.game_stats
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can update own game stats"
on public.game_stats
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);