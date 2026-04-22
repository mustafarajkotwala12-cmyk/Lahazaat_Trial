import Head from 'next/head';
import { useEffect, useState } from 'react';
import NewsCard from '../components/NewsCard';
import { getArticleHref, getPublishedArticles } from '../lib/articles';

export default function ArticlesPage() {
  const [articles, setArticles] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function fetchArticles() {
      const { data, error } = await getPublishedArticles();

      if (error) {
        console.error('Error fetching articles:', error);
        setErrorMessage('Unable to load articles right now.');
        return;
      }

      setArticles(data ?? []);
    }

    fetchArticles();
  }, []);

  return (
    <>
      <Head>
        <title>Articles | Lahazaat</title>
        <meta name="description" content="Browse all published Lahazaat articles and updates." />
      </Head>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-7">
        <header className="glass-panel rounded-[2.5rem] px-8 py-9">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-sky-600">
            Archive
          </p>
          <h1 className="soft-title mt-3 text-[3.2rem] font-semibold">
            Articles
          </h1>
          <p className="mt-3 max-w-2xl text-[0.98rem] leading-7 text-slate-400">
            Browse the full list of published Lahazaat articles and updates.
          </p>
        </header>

        {errorMessage ? (
          <div className="glass-card rounded-[1.75rem] border-rose-200/60 px-4 py-3 text-sm text-rose-600">
            {errorMessage}
          </div>
        ) : null}

        {articles.length === 0 && !errorMessage ? (
          <div className="glass-card rounded-[2rem] border-dashed px-6 py-10 text-center text-slate-500">
            No published articles found.
          </div>
        ) : (
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => (
              <NewsCard
                key={article.id}
                title={article.title}
                image={article.image_url}
                description={
                  article.excerpt || article.content?.slice(0, 120) || 'No summary available.'
                }
                date={
                  article.created_at
                    ? new Date(article.created_at).toLocaleDateString()
                    : 'Draft'
                }
                author={article.author || 'Lahazaat'}
                href={getArticleHref(article)}
              />
            ))}
          </section>
        )}
      </div>
    </>
  );
}
