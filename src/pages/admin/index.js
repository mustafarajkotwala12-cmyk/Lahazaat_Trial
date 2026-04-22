import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';

const quillModules = {
  toolbar: [['bold', 'italic', 'underline', 'link'], ['list']],
};

function stripHtml(value) {
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function ensureFindDomNode(reactDomModule) {
  const reactDom = reactDomModule?.default ?? reactDomModule;

  if (typeof reactDom?.findDOMNode === 'function') {
    return;
  }

  reactDom.findDOMNode = (instance) => {
    if (!instance) {
      return null;
    }

    if (typeof instance.nodeType === 'number') {
      return instance;
    }

    return null;
  };
}

const ReactQuill = dynamic(
  async () => {
    const reactDomModule = await import('react-dom');
    ensureFindDomNode(reactDomModule);

    const quillModule = await import('react-quill');
    return quillModule.default;
  },
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-gray-300 bg-white px-4 py-6 text-sm text-gray-500">
        Loading editor...
      </div>
    ),
  }
);

function formatSubmittedAt(value) {
  if (!value) {
    return 'Unknown date';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Unknown date';
  }

  return parsedDate.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getToastClasses(type) {
  if (type === 'error') {
    return 'border-red-300 bg-red-100 text-red-800';
  }

  return 'border-green-300 bg-green-100 text-green-800';
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [isDenied, setIsDenied] = useState(false);
  const [pageError, setPageError] = useState('');
  const [draftsError, setDraftsError] = useState('');
  const [categoriesError, setCategoriesError] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState('');
  const [editorTitle, setEditorTitle] = useState('');
  const [editorCategoryId, setEditorCategoryId] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [toast, setToast] = useState(null);

  const activeDraft = drafts.find((draft) => draft.id === activeDraftId) || null;

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 3500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  function showToast(type, message) {
    setToast({
      id: Date.now(),
      type,
      message,
    });
  }

  function getCategoryName(categoryId) {
    const category = categories.find((option) => option.id === categoryId);
    return category?.name || 'Uncategorized';
  }

  function openDraft(draft) {
    setActiveDraftId(draft.id);
    setEditorTitle(draft.title || '');
    setEditorCategoryId(draft.category_id || '');
    setEditorContent(draft.content || '');
  }

  function closeEditor() {
    setActiveDraftId('');
    setEditorTitle('');
    setEditorCategoryId('');
    setEditorContent('');
  }

  const loadCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    setCategoriesError('');

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        console.error('Admin dashboard category load error:', error);
        setCategories([]);
        setCategoriesError('Unable to load categories right now.');
        return;
      }

      setCategories(data ?? []);
    } catch (error) {
      console.error('Admin dashboard category request error:', error);
      setCategories([]);
      setCategoriesError('Unable to load categories right now.');
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  const loadDrafts = useCallback(async (selectedDraftId = '') => {
    setIsLoadingDrafts(true);
    setDraftsError('');

    try {
      // The UI performs a friendly admin check first, but RLS is still the backend permission boundary here.
      const { data, error } = await supabase
        .from('articles')
        .select('id, title, category_id, content, author_id, author, created_at, categories(name)')
        .eq('is_published', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Admin dashboard draft load error:', error);
        setDrafts([]);
        setDraftsError('Unable to load drafts right now.');
        return;
      }

      const authorIds = [...new Set((data ?? []).map((draft) => draft.author_id).filter(Boolean))];
      const fallbackAuthorMap = new Map();

      if (authorIds.length > 0) {
        // Browser clients cannot read auth.users emails directly, so profile metadata is only a display fallback.
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', authorIds);

        if (profileError) {
          console.error('Admin dashboard author profile load error:', profileError);
        } else {
          for (const profile of profileData ?? []) {
            fallbackAuthorMap.set(profile.id, profile.full_name);
          }
        }
      }

      const normalizedDrafts = (data ?? []).map((draft) => ({
        ...draft,
        author_email:
          draft.author ||
          fallbackAuthorMap.get(draft.author_id) ||
          'Author unavailable',
        category_name: draft.categories?.name || 'Uncategorized',
      }));

      setDrafts(normalizedDrafts);

      if (selectedDraftId && !normalizedDrafts.some((draft) => draft.id === selectedDraftId)) {
        setActiveDraftId('');
        setEditorTitle('');
        setEditorCategoryId('');
        setEditorContent('');
      }
    } catch (error) {
      console.error('Admin dashboard draft request error:', error);
      setDrafts([]);
      setDraftsError('Unable to load drafts right now.');
    } finally {
      setIsLoadingDrafts(false);
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    async function initializePage() {
      setIsCheckingAccess(true);
      setHasAccess(false);
      setIsDenied(false);
      setPageError('');

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!isActive) {
          return;
        }

        if (sessionError) {
          console.error('Admin dashboard session error:', sessionError);
          setPageError('Unable to verify your session right now.');
          return;
        }

        const user = session?.user ?? null;

        if (!user) {
          router.push('/');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();

        if (!isActive) {
          return;
        }

        if (profileError) {
          console.error('Admin dashboard profile error:', profileError);
          setPageError('Unable to verify admin access right now.');
          return;
        }

        if (!profile?.is_admin) {
          setIsDenied(true);
          return;
        }

        setHasAccess(true);
        await Promise.allSettled([loadCategories(), loadDrafts('')]);
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.error('Admin dashboard initialization error:', error);
        setPageError('Unable to load the admin dashboard right now.');
      } finally {
        if (!isActive) {
          return;
        }

        setIsCheckingAccess(false);
      }
    }

    initializePage();

    return () => {
      isActive = false;
    };
  }, [loadCategories, loadDrafts, router]);

  async function handleSaveEdits(event) {
    event.preventDefault();

    if (!activeDraft) {
      return;
    }

    const trimmedTitle = editorTitle.trim();
    const trimmedCategoryId = editorCategoryId.trim();
    const plainTextContent = stripHtml(editorContent);

    if (!trimmedTitle || !trimmedCategoryId || !plainTextContent) {
      showToast('error', 'Please fill in the title, category, and content fields.');
      return;
    }

    setIsSaving(true);

    try {
      const updatedAt = new Date().toISOString();
      const { error } = await supabase
        .from('articles')
        .update({
          title: trimmedTitle,
          category_id: trimmedCategoryId,
          content: editorContent,
          updated_at: updatedAt,
        })
        .eq('id', activeDraft.id);

      if (error) {
        console.error('Admin dashboard save error:', error);
        showToast('error', error.message || 'Unable to save changes right now.');
        return;
      }

      setDrafts((currentDrafts) =>
        currentDrafts.map((draft) =>
          draft.id === activeDraft.id
            ? {
                ...draft,
                title: trimmedTitle,
                category_id: trimmedCategoryId,
                category_name: getCategoryName(trimmedCategoryId),
                content: editorContent,
                updated_at: updatedAt,
              }
            : draft
        )
      );

      showToast('success', 'Changes saved');
    } catch (error) {
      console.error('Admin dashboard save request error:', error);
      showToast('error', 'Unable to save changes right now.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleApproveAndPublish() {
    if (!activeDraft) {
      return;
    }

    const trimmedTitle = editorTitle.trim();
    const trimmedCategoryId = editorCategoryId.trim();
    const plainTextContent = stripHtml(editorContent);

    if (!trimmedTitle || !trimmedCategoryId || !plainTextContent) {
      showToast('error', 'Please fill in the title, category, and content fields.');
      return;
    }

    setIsPublishing(true);

    try {
      const updatedAt = new Date().toISOString();
      const { error } = await supabase
        .from('articles')
        .update({
          title: trimmedTitle,
          category_id: trimmedCategoryId,
          content: editorContent,
          is_published: true,
          updated_at: updatedAt,
        })
        .eq('id', activeDraft.id);

      if (error) {
        console.error('Admin dashboard publish error:', error);
        showToast('error', error.message || 'Unable to publish this article right now.');
        return;
      }

      setDrafts((currentDrafts) => currentDrafts.filter((draft) => draft.id !== activeDraft.id));
      closeEditor();
      showToast('success', 'Article published!');
      await loadDrafts('');
    } catch (error) {
      console.error('Admin dashboard publish request error:', error);
      showToast('error', 'Unable to publish this article right now.');
    } finally {
      setIsPublishing(false);
    }
  }

  if (isCheckingAccess) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center">
        <div
          role="status"
          className="glass-panel flex items-center gap-3 rounded-full px-5 py-3 text-sm text-slate-500"
        >
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-500" />
          Checking admin access...
        </div>
      </div>
    );
  }

  if (isDenied) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-4 text-center">
        <p className="text-xl font-semibold text-red-600">Access Denied</p>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <div className="rounded-lg border border-red-300 bg-red-100 px-4 py-3 text-sm text-red-800">
          {pageError}
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-fit rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center">
        <div
          role="status"
          className="glass-panel flex items-center gap-3 rounded-full px-5 py-3 text-sm text-slate-500"
        >
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-500" />
          Redirecting...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      {toast ? (
        <div
          className={`fixed right-5 top-24 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg ${getToastClasses(
            toast.type
          )}`}
        >
          {toast.message}
        </div>
      ) : null}

      <header className="glass-panel rounded-[2rem] px-8 py-8">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-sky-600">
          Editorial controls
        </p>
        <h1 className="soft-title mt-3 text-[2.5rem] font-semibold">
          Review and Publish Drafts
        </h1>
        <p className="mt-3 text-[0.98rem] leading-7 text-slate-500">
          Review incoming submissions, make final edits, and publish approved articles.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        <section className="flex min-h-[34rem] flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Pending drafts</h2>
              <p className="mt-1 text-sm text-slate-500">
                {drafts.length} {drafts.length === 1 ? 'draft' : 'drafts'} awaiting review
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadDrafts(activeDraftId)}
              disabled={isLoadingDrafts}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-sky-500 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingDrafts ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {draftsError ? (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-100 px-4 py-3 text-sm text-red-800">
              <div>{draftsError}</div>
              <button
                type="button"
                onClick={() => loadDrafts(activeDraftId)}
                className="mt-3 rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          ) : null}

          {isLoadingDrafts ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              Loading drafts...
            </div>
          ) : drafts.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
              No drafts to review
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {drafts.map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => openDraft(draft)}
                  className={`cursor-pointer rounded-xl border p-5 text-left shadow transition hover:-translate-y-0.5 hover:shadow-lg ${
                    activeDraftId === draft.id
                      ? 'border-sky-500 bg-sky-50 shadow-lg'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">{draft.title}</h3>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {draft.category_name}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">Author: {draft.author_email}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Submitted {formatSubmittedAt(draft.created_at)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-gray-200 border-l-gray-300 bg-white p-8 shadow-sm">
          {!activeDraft ? (
            <div className="flex min-h-[34rem] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
              Select a draft to review, edit, and publish.
            </div>
          ) : (
            <form className="flex min-h-[34rem] flex-col gap-5" onSubmit={handleSaveEdits}>
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.22em] text-sky-600">
                  Draft editor
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  {editorTitle || activeDraft.title}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Submitted by {activeDraft.author_email} on{' '}
                  {formatSubmittedAt(activeDraft.created_at)}
                </p>
              </div>

              {categoriesError ? (
                <div className="rounded-lg border border-red-300 bg-red-100 px-4 py-3 text-sm text-red-800">
                  <div>{categoriesError}</div>
                  <button
                    type="button"
                    onClick={loadCategories}
                    className="mt-3 rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Retry categories
                  </button>
                </div>
              ) : null}

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">Title</span>
                <input
                  type="text"
                  value={editorTitle}
                  onChange={(event) => setEditorTitle(event.target.value)}
                  placeholder="Article Title"
                  required
                  className="rounded border border-gray-300 px-4 py-2 text-slate-700 outline-none focus:border-sky-500"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">Category</span>
                <select
                  value={editorCategoryId}
                  onChange={(event) => setEditorCategoryId(event.target.value)}
                  required
                  disabled={isLoadingCategories}
                  className="rounded border border-gray-300 px-4 py-2 text-slate-700 outline-none focus:border-sky-500 disabled:bg-slate-100"
                >
                  <option value="">
                    {isLoadingCategories ? 'Loading categories...' : 'Select a category'}
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
                  <ReactQuill
                    theme="snow"
                    value={editorContent}
                    onChange={setEditorContent}
                    modules={quillModules}
                  />
                </div>
              </label>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-400 hover:text-slate-800"
                >
                  Cancel
                </button>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={isSaving || isPublishing}
                    className="rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? 'Saving...' : 'Save Edits'}
                  </button>
                  <button
                    type="button"
                    onClick={handleApproveAndPublish}
                    disabled={isSaving || isPublishing}
                    className="rounded bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPublishing ? 'Publishing...' : 'Approve & Publish'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
