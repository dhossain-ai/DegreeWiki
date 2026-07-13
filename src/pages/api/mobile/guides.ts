import type { APIRoute } from 'astro'
import {
  buildCloudinaryImageUrl,
  createPublicMobileClient,
  credentialsErrorResponse,
  internalErrorResponse,
  jsonResponse,
} from '../../../lib/mobile/public'

function relatedNames(rows: any[] | null | undefined, relation: string): string[] {
  return (rows ?? [])
    .map((row: any) => row?.[relation]?.name)
    .filter((name: unknown): name is string => typeof name === 'string' && name.trim().length > 0)
}

export const GET: APIRoute = async () => {
  const supabase = createPublicMobileClient()
  if (!supabase) return credentialsErrorResponse()

  const cloudName = import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME
  const { data, error } = await supabase
    .from('articles')
    .select(`
      id,
      slug,
      title,
      summary,
      published_at,
      updated_at,
      article_categories(id, slug, name),
      article_countries(countries(name)),
      article_subjects(subjects(name)),
      article_degree_levels(degree_levels(name)),
      featured_image:media_assets!articles_featured_image_id_fkey(cloudinary_public_id)
    `)
    .eq('content_status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('title')
    .limit(200)

  if (error) {
    console.error('mobile guides list error:', error.message)
    return internalErrorResponse()
  }

  return jsonResponse(200, (data ?? []).map((guide: any) => ({
    id: guide.id,
    slug: guide.slug,
    title: guide.title,
    summary: guide.summary ?? null,
    category: guide.article_categories
      ? {
          id: guide.article_categories.id,
          slug: guide.article_categories.slug,
          name: guide.article_categories.name,
        }
      : null,
    countries: relatedNames(guide.article_countries, 'countries'),
    subjects: relatedNames(guide.article_subjects, 'subjects'),
    degreeLevels: relatedNames(guide.article_degree_levels, 'degree_levels'),
    publishedAt: guide.published_at ?? null,
    updatedAt: guide.updated_at ?? null,
    coverImageUrl: buildCloudinaryImageUrl(cloudName, guide.featured_image?.cloudinary_public_id),
  })))
}
