import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ClientRichTextEditor from '@/components/ClientRichTextEditor';

const quillModules = {
  toolbar: [['bold', 'italic', 'underline', 'link'], ['list']],
};

function stripHtml(value) {
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function buildSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildSlugWithSuffix(baseSlug, suffix) {
  return suffix ? `${baseSlug}-${suffix}` : baseSlug;
}

function createSlugSuffix() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function SubmitPage() {
  const router = useRouter();
  const redirectTimeoutRef = useRef(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState('');
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const plainTextContent = useMemo(() => stripHtml(content), [content]);

  useEffect(() => {
    let isActive = true;

    async function initializePage() {
      setIsCheckingAuth(true);
      setIsCategoriesLoading(true);
      setCategoriesError('');

      try {
        const {
          data: { session },
          error: authError,
        } = await supabase.auth.getSession();

        if (!isActive) {
          return;
        }

        if (authError) {
          console.error('Submit page auth error:', authError);
          setErrorMessage('Unable to verify your session right now.');
          setIsCheckingAuth(false);
          return;
        }

        if (!session?.user) {
          router.push('/');
          return;
        }

        // Categories remain public-read via RLS, so this client query stays inside the normal policy boundary.
        setUser(session.user);

        const { data, error } = await supabase
          .from('categories')
          .select('id, name')
          .order('name', { ascending: true });

        if (!isActive) {
          return;
        }

        if (error) {
          console.error('Submit page category load error:', error);
          setCategoriesError('Unable to load categories right now.');
          setCategories([]);
        } else {
          setCategories(data ?? []);
        }
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.error('Submit page initialization error:', error);
        setErrorMessage('Unable to load the submission form right now.');
      } finally {
        if (!isActive) {
          return;
        }

        setIsCheckingAuth(false);
        setIsCategoriesLoading(false);
      }
    }

    initializePage();

    return () => {
      isActive = false;
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, [router]);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedTitle = title.trim();
    const trimmedCategoryId = categoryId.trim();
    const baseSlug = buildSlug(trimmedTitle);
    const excerpt = `${plainTextContent.substring(0, 200)}...`;

    if (!trimmedTitle || !trimmedCategoryId || !plainTextContent) {
      setErrorMessage('Please fill in the title, category, and content fields.');
      return;
    }

    if (!baseSlug) {
      setErrorMessage('Please enter a title that can be converted into a valid slug.');
      return;
    }

    setIsSubmitting(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Submit page session refresh error:', sessionError);
        setErrorMessage('Unable to verify your account before submitting.');
        setIsSubmitting(false);
        return;
      }

      const currentUser = session?.user;

      if (!currentUser) {
        setErrorMessage('You must be signed in to submit an article.');
        setIsSubmitting(false);
        router.push('/');
        return;
      }

      // Client writes rely on database-side RLS so drafts can only be created for auth.uid().
      let insertError = null;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const slug = buildSlugWithSuffix(
          baseSlug,
          attempt === 0 ? '' : createSlugSuffix()
        );
        const response = await supabase
          .from('articles')
          .insert({
            title: trimmedTitle,
            slug,
            category_id: trimmedCategoryId,
            content,
            author: currentUser.email || currentUser.user_metadata?.email || null,
            author_id: currentUser.id,
            is_published: false,
            excerpt,
            created_at: new Date().toISOString(),
          });

        if (!response.error) {
          insertError = null;
          break;
        }

        insertError = response.error;

        if (response.error.code !== '23505') {
          break;
        }
      }

      if (insertError) {
        console.error('Submit page insert error:', insertError);
        setErrorMessage(insertError.message || 'Unable to submit your draft right now.');
        setIsSubmitting(false);
        return;
      }

      try {
        // Notifications are best-effort: a mail failure should not undo a valid draft row.
        const notifyResponse = await fetch('/api/notify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            articleTitle: trimmedTitle,
            authorName: currentUser.email,
            authorEmail: currentUser.email,
          }),
        });

        if (!notifyResponse.ok) {
          const notifyPayload = await notifyResponse.json().catch(() => null);
          console.error('Submit page notify error:', notifyPayload ?? notifyResponse.statusText);
        }
      } catch (notifyError) {
        console.error('Submit page notify request error:', notifyError);
      }

      setSuccessMessage('Your draft has been submitted! The admin will review it soon.');
      setTitle('');
      setCategoryId('');
      setContent('');
      setUser(currentUser);

      redirectTimeoutRef.current = window.setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (error) {
      console.error('Submit page submit error:', error);
      setErrorMessage('Unexpected error while submitting your draft.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingAuth) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-2xl items-center justify-center">
        <div
          role="status"
          className="glass-panel flex items-center gap-3 rounded-full px-5 py-3 text-sm text-slate-500"
        >
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-500" />
          Checking your session...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="glass-panel rounded-[2rem] px-8 py-8">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-sky-600">
          Student submissions
        </p>
        <h1 className="soft-title mt-3 text-[2.7rem] font-semibold">
          Submit an Article Draft
        </h1>
        <p className="mt-3 text-[0.98rem] leading-7 text-slate-400">
          Draft your article, choose a category, and send it to the admin team for review.
        </p>
      </header>

      <div className="bg-white p-8 shadow rounded-lg">
        {successMessage ? (
          <div className="mb-4 rounded border border-green-300 bg-green-100 px-4 py-3 text-sm text-green-800">
            {successMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mb-4 rounded border border-red-300 bg-red-100 px-4 py-3 text-sm text-red-800">
            {errorMessage}
          </div>
        ) : null}

        {categoriesError ? (
          <div className="mb-4 rounded border border-red-300 bg-red-100 px-4 py-3 text-sm text-red-800">
            {categoriesError}
          </div>
        ) : null}

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Title</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Article Title"
              required
              className="rounded border border-gray-300 px-4 py-2 text-slate-700 outline-none focus:border-sky-500"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Category</span>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              required
              disabled={isCategoriesLoading}
              className="rounded border border-gray-300 px-4 py-2 text-slate-700 outline-none focus:border-sky-500 disabled:bg-slate-100"
            >
              <option value="">
                {isCategoriesLoading ? 'Loading categories...' : 'Select a category'}
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Content</span>
            <div className="overflow-hidden rounded border border-gray-300 bg-white">
              <ClientRichTextEditor
                theme="snow"
                value={content}
                onChange={setContent}
                modules={quillModules}
              />
            </div>
          </label>

          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-800">
              Cancel
            </Link>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
