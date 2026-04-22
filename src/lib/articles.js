import { supabase } from './supabase';

export async function getPublishedArticles() {
  return supabase
    .from('articles')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false });
}

export async function getArticleBySlugOrId(slugOrId) {
  const bySlugResponse = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slugOrId)
    .eq('is_published', true)
    .maybeSingle();

  if (bySlugResponse.data || bySlugResponse.error?.code !== 'PGRST116') {
    return bySlugResponse;
  }

  return supabase
    .from('articles')
    .select('*')
    .eq('id', slugOrId)
    .eq('is_published', true)
    .maybeSingle();
}

export function getArticleHref(article) {
  const slug = article?.slug || article?.id;
  return slug ? `/news/${slug}` : '/articles';
}
