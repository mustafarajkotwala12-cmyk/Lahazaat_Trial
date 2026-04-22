-- Mirror Supabase Auth users into public.profiles so frontend/admin checks always
-- have a profile row to read under normal RLS policies.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    avatar_url,
    is_admin,
    created_at,
    updated_at
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.email
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.email = 'mustafa.rajkotwala12@gmail.com', false),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (id) do update
  set
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    is_admin = public.profiles.is_admin or excluded.is_admin,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Backfill any auth users created before the trigger existed so current local data
-- does not need manual repair.
insert into public.profiles (
  id,
  full_name,
  avatar_url,
  is_admin,
  created_at,
  updated_at
)
select
  users.id,
  coalesce(
    users.raw_user_meta_data ->> 'full_name',
    users.raw_user_meta_data ->> 'name',
    users.email
  ),
  users.raw_user_meta_data ->> 'avatar_url',
  coalesce(users.email = 'mustafa.rajkotwala12@gmail.com', false),
  timezone('utc', now()),
  timezone('utc', now())
from auth.users as users
on conflict (id) do update
set
  full_name = coalesce(public.profiles.full_name, excluded.full_name),
  avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
  is_admin = public.profiles.is_admin or excluded.is_admin,
  updated_at = timezone('utc', now());
