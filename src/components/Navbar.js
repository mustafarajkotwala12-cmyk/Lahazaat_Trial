import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const THEMES = [
  { id: 'white', label: 'White' },
  { id: 'teal', label: 'Teal Green' },
  { id: 'violet', label: 'Violet' },
  { id: 'dark', label: 'Dark' },
];

export default function Navbar({ theme = 'white', onThemeChange }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);
    }

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogin() {
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: redirectTo
        ? {
            redirectTo,
          }
        : undefined,
    });

    if (error) {
      console.error('Error logging in:', error.message);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Error logging out:', error.message);
    }
  }

  function handleSearchSubmit(event) {
    event.preventDefault();

    const trimmedQuery = searchQuery.trim();
    const destination = trimmedQuery
      ? `/articles?search=${encodeURIComponent(trimmedQuery)}`
      : '/articles';

    router.push(destination);
  }

  const displayName =
    user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Signed in';

  return (
    <nav className="sticky top-0 z-40 px-5 pt-4">
      <div className="glass-panel mx-auto flex w-full max-w-6xl flex-col gap-3 rounded-[2rem] px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-[1.08rem] font-semibold tracking-[-0.045em] theme-link">
            Lahazaat
          </Link>

          <div className="hidden items-center gap-3.5 lg:flex">
            <Link href="/" className="theme-link text-[0.95rem]">
              Home
            </Link>
            <Link href="/articles" className="theme-link text-[0.95rem]">
              Articles
            </Link>
            <Link href="/games" className="theme-link text-[0.95rem]">
              Games
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search articles"
              aria-label="Search articles"
              className="theme-input w-full min-w-0 rounded-full px-4 py-2 text-sm outline-none ring-0 lg:w-100"
            />
            <button
              type="submit"
              className="theme-button rounded-full px-4 py-2 text-sm"
            >
              Search
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsThemeMenuOpen((value) => !value)}
                className="theme-button rounded-full px-4 py-2 text-sm"
              >
                Theme
              </button>

              {isThemeMenuOpen ? (
                <div className="theme-menu absolute right-0 top-full mt-2 flex w-44 flex-col gap-1 rounded-[1.25rem] p-2">
                  {THEMES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        onThemeChange?.(option.id);
                        setIsThemeMenuOpen(false);
                      }}
                      className={`rounded-[1rem] px-3 py-2 text-left text-sm ${
                        theme === option.id ? 'theme-option-active' : 'theme-link'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-3.5 lg:hidden">
              <Link href="/" className="theme-link text-[0.95rem]">
                Home
              </Link>
              <Link href="/articles" className="theme-link text-[0.95rem]">
                Articles
              </Link>
              <Link href="/games" className="theme-link text-[0.95rem]">
                Games
              </Link>
            </div>

            {user ? (
              <div className="flex items-center gap-3">
                <span className="theme-muted max-w-40 truncate text-sm">
                  Hi, {displayName}
                </span>
                <button
                  onClick={handleLogout}
                  className="theme-button rounded-full px-4 py-2 text-sm"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="theme-button-solid rounded-full px-4 py-2 text-sm font-medium hover:-translate-y-px"
              >
                Sign in with Google
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
