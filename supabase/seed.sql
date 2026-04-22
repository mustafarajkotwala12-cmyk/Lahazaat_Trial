insert into public.articles (
  id,
  slug,
  title,
  excerpt,
  content,
  image_url,
  author,
  is_published,
  created_at,
  updated_at
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'welcome-to-lahazaat',
    'Welcome to Lahazaat',
    'A short introduction to the local content feed.',
    'Lahazaat is now connected to a local Supabase project for development. This seeded article confirms the articles feed is working end to end.',
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80',
    'Lahazaat',
    true,
    timezone('utc', now()) - interval '3 days',
    timezone('utc', now()) - interval '3 days'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'wordle-is-live',
    'Wordle Is Live',
    'Daily words and per-user streak tracking are now backed by the local database.',
    'The local database now seeds daily Wordle entries so the game can load immediately during development. Signed-in users will also persist their streaks and results in game_stats.',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    'Lahazaat',
    true,
    timezone('utc', now()) - interval '1 day',
    timezone('utc', now()) - interval '1 day'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'editorial-draft',
    'Editorial Draft',
    'This draft should stay hidden from public article queries.',
    'Draft content for testing unpublished article behavior.',
    'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80',
    'Lahazaat',
    false,
    timezone('utc', now()),
    timezone('utc', now())
  )
on conflict (slug) do update
set
  title = excluded.title,
  excerpt = excluded.excerpt,
  content = excluded.content,
  image_url = excluded.image_url,
  author = excluded.author,
  is_published = excluded.is_published,
  updated_at = timezone('utc', now());

insert into public.daily_words (play_date, solution_word)
values
  (current_date, 'table'),
  (current_date + 1, 'heart'),
  (current_date + 2, 'light'),
  (current_date + 3, 'sound'),
  (current_date + 4, 'water')
on conflict (play_date) do update
set
  solution_word = excluded.solution_word;

insert into public.categories (id, name)
values
  ('44444444-4444-4444-8444-444444444444', 'Announcements'),
  ('55555555-5555-4555-8555-555555555555', 'Campus Life'),
  ('66666666-6666-4666-8666-666666666666', 'Student Voices')
on conflict (name) do nothing;

insert into public.categories (name)
values
  ('Sports'),
  ('Academic'),
  ('Campus Life')
on conflict (name) do nothing;

insert into public.profiles (id, full_name, is_admin, created_at, updated_at)
select
  id,
  email,
  true,
  timezone('utc', now()),
  timezone('utc', now())
from auth.users
where email = 'mustafa.rajkotwala12@gmail.com'
on conflict (id) do update
set
  full_name = excluded.full_name,
  is_admin = true,
  updated_at = timezone('utc', now());
