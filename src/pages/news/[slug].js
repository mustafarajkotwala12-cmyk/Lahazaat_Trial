import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getArticleBySlugOrId } from '../../lib/articles';

export default function NewsArticlePage() {
  const router = useRouter();
  const { slug } = router.query;
  const [article, setArticle] = useState(null);
  const [sanitizedContent, setSanitizedContent] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!router.isReady || !slug) {
      return;
    }

    async function fetchArticle() {
      const { data, error } = await getArticleBySlugOrId(slug);

      if (error) {
        console.error('Error fetching article:', error);
        setErrorMessage('Unable to load this article right now.');
        return;
      }

      if (!data) {
        setErrorMessage('Article not found.');
        return;
      }

      setArticle(data);
    }

    fetchArticle();
  }, [router.isReady, slug]);

  useEffect(() => {
    if (!article?.content) {
      setSanitizedContent('');
      return undefined;
    }

    let isActive = true;

    async function sanitizeArticleContent() {
      try {
        const domPurifyModule = await import('dompurify');
        const DOMPurify = domPurifyModule.default ?? domPurifyModule;

        if (!isActive) {
          return;
        }

        // Rich text comes from Quill, so sanitize before rendering any stored HTML.
        setSanitizedContent(
          DOMPurify.sanitize(article.content, {
            USE_PROFILES: { html: true },
          })
        );
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.error('Error sanitizing article content:', error);
        setErrorMessage('Unable to render this article safely right now.');
      }
    }

    sanitizeArticleContent();

    return () => {
      isActive = false;
    };
  }, [article?.content]);

  const pageTitle = article ? `${article.title} | Lahazaat` : 'Article | Lahazaat';
  const description = article?.excerpt || 'Read the latest Lahazaat article.';

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={description} />
      </Head>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-7">
        {errorMessage ? (
          <div className="glass-card rounded-[1.75rem] border-rose-200/60 px-4 py-3 text-sm text-rose-600">
            {errorMessage}
          </div>
        ) : null}

        {!article && !errorMessage ? (
          <div className="glass-card rounded-[2rem] border-dashed px-6 py-10 text-center text-slate-500">
            Loading article...
          </div>
        ) : null}

        {article ? (
          <article className="glass-panel rounded-[2.5rem] p-8">
            <header className="mb-7 space-y-3">
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-sky-600">
                Lahazaat story
              </p>
              <h1 className="soft-title text-[2.8rem] font-semibold">
                {article.title}
              </h1>
              <div className="flex flex-wrap gap-3 text-sm text-slate-400">
                <span>{article.author || 'Lahazaat'}</span>
                <span>
                  {article.created_at
                    ? new Date(article.created_at).toLocaleDateString()
                    : 'Unpublished'}
                </span>
              </div>
            </header>

            <div className="prose max-w-none text-slate-600">
              {article.excerpt ? <p>{article.excerpt}</p> : null}
              {sanitizedContent ? (
                <div
                  // Rendering happens only after DOMPurify strips unsafe markup from stored rich text.
                  dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                />
              ) : !article.excerpt ? (
                <p>No content available.</p>
              ) : null}
            </div>
          </article>
        ) : null}
      </div>
    </>
  );
}
