import type { APIRoute } from 'astro'
import {
  buildCloudinaryImageUrl,
  createPublicMobileClient,
  credentialsErrorResponse,
  internalErrorResponse,
  jsonResponse,
  notFoundResponse,
} from '../../../../lib/mobile/public'
import { parseArticleMarkdown, type ArticleBlock, type InlineNode } from '../../../../lib/public/markdown'

function relationItems(rows: any[] | null | undefined, relation: string) {
  return (rows ?? []).flatMap((row: any) => {
    const item = row?.[relation]
    return item?.id && item?.name
      ? [{ id: item.id, slug: item.slug ?? null, name: item.name, code: item.code ?? null }]
      : []
  })
}

function inlineText(nodes: InlineNode[]): string {
  return nodes.map((node) => node.text).join('').trim()
}

function sectionHeadings(blocks: ArticleBlock[]) {
  return blocks.flatMap((block) => block.type === 'heading'
    ? [{ level: block.level, text: inlineText(block.children) }]
    : [])
}

function readTimeMinutes(content: string | null | undefined): number | null {
  const words = content?.trim().split(/\s+/).filter(Boolean).length ?? 0
  return words > 0 ? Math.ceil(words / 200) : null
}

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug?.trim()
  if (!slug) return notFoundResponse('guide_not_found')

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
      content,
      published_at,
      updated_at,
      verification_status,
      last_verified_at,
      source_confidence_score,
      article_categories(id, slug, name),
      article_countries(countries(id, slug, name)),
      article_subjects(subjects(id, slug, name)),
      article_degree_levels(degree_levels(id, name, code)),
      featured_image:media_assets!articles_featured_image_id_fkey(cloudinary_public_id)
    `)
    .eq('slug', slug)
    .eq('content_status', 'published')
    .maybeSingle()

  if (error) {
    console.error('mobile guide detail error:', error.message)
    return internalErrorResponse()
  }
  if (!data) return notFoundResponse('guide_not_found')

  const guide = data as any
  const body = parseArticleMarkdown(guide.content)
  let relatedGuides: any[] = []

  if (guide.article_categories?.id) {
    const { data: related, error: relatedError } = await supabase
      .from('articles')
      .select(`
        id,
        slug,
        title,
        summary,
        published_at,
        article_categories(id, slug, name),
        featured_image:media_assets!articles_featured_image_id_fkey(cloudinary_public_id)
      `)
      .eq('content_status', 'published')
      .eq('article_category_id', guide.article_categories.id)
      .neq('id', guide.id)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(3)

    if (relatedError) {
      console.error('mobile guide detail related guides error:', relatedError.message)
      return internalErrorResponse()
    }
    relatedGuides = related ?? []
  }

  return jsonResponse(200, {
    ok: true,
    item: {
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
      countries: relationItems(guide.article_countries, 'countries'),
      subjects: relationItems(guide.article_subjects, 'subjects'),
      degreeLevels: relationItems(guide.article_degree_levels, 'degree_levels'),
      publishedAt: guide.published_at ?? null,
      updatedAt: guide.updated_at ?? null,
      readTimeMinutes: readTimeMinutes(guide.content),
      contentFormat: 'structured_blocks_v1',
      body,
      sectionHeadings: sectionHeadings(body),
      coverImageUrl: buildCloudinaryImageUrl(cloudName, guide.featured_image?.cloudinary_public_id),
      verificationStatus: guide.verification_status ?? null,
      lastVerifiedAt: guide.last_verified_at ?? null,
      sourceConfidenceScore: guide.source_confidence_score ?? null,
      relatedGuides: relatedGuides.map((related: any) => ({
        id: related.id,
        slug: related.slug,
        title: related.title,
        summary: related.summary ?? null,
        category: related.article_categories
          ? {
              id: related.article_categories.id,
              slug: related.article_categories.slug,
              name: related.article_categories.name,
            }
          : null,
        publishedAt: related.published_at ?? null,
        coverImageUrl: buildCloudinaryImageUrl(cloudName, related.featured_image?.cloudinary_public_id),
      })),
    },
  })
}
