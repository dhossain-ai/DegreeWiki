import type { APIContext } from 'astro'
import { createClient } from '../lib/supabase/server'
import { SITE_URL } from '../lib/site'

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toDateStr(ts: string): string {
  return ts.slice(0, 10)
}

function urlEntry(loc: string, lastmod?: string): string {
  const locLine = `    <loc>${escXml(loc)}</loc>`
  const lmLine  = lastmod ? `\n    <lastmod>${escXml(lastmod)}</lastmod>` : ''
  return `  <url>\n${locLine}${lmLine}\n  </url>`
}

const STATIC_PATHS = ['/', '/programs', '/scholarships', '/universities', '/guides', '/about', '/privacy', '/terms', '/disclaimer']

export async function GET(context: APIContext): Promise<Response> {
  const supabase = createClient(context.cookies, context.request)

  const [
    { data: programs,     error: programsErr },
    { data: scholarships, error: scholarshipsErr },
    { data: universities, error: univErr },
    { data: articles,     error: articlesErr },
  ] = await Promise.all([
    supabase
      .from('programs')
      .select('slug, updated_at')
      .eq('content_status', 'published')
      .eq('indexing_status', 'index'),
    supabase
      .from('scholarships')
      .select('slug, updated_at')
      .eq('content_status', 'published')
      .eq('indexing_status', 'index'),
    supabase
      .from('universities')
      .select('slug, updated_at')
      .eq('content_status', 'published')
      .eq('indexing_status', 'index'),
    supabase
      .from('articles')
      .select('slug, updated_at')
      .eq('content_status', 'published')
      .eq('indexing_status', 'index'),
  ])

  if (programsErr)     console.error('sitemap programs error:',     programsErr.message)
  if (scholarshipsErr) console.error('sitemap scholarships error:', scholarshipsErr.message)
  if (univErr)         console.error('sitemap universities error:', univErr.message)
  if (articlesErr)     console.error('sitemap articles error:',     articlesErr.message)

  const entries: string[] = [
    ...STATIC_PATHS.map(path => urlEntry(SITE_URL + path)),
    ...(programs ?? []).map((r: any) =>
      urlEntry(
        `${SITE_URL}/programs/${r.slug}`,
        r.updated_at ? toDateStr(r.updated_at) : undefined,
      )
    ),
    ...(scholarships ?? []).map((r: any) =>
      urlEntry(
        `${SITE_URL}/scholarships/${r.slug}`,
        r.updated_at ? toDateStr(r.updated_at) : undefined,
      )
    ),
    ...(universities ?? []).map((r: any) =>
      urlEntry(
        `${SITE_URL}/universities/${r.slug}`,
        r.updated_at ? toDateStr(r.updated_at) : undefined,
      )
    ),
    ...(articles ?? []).map((r: any) =>
      urlEntry(
        `${SITE_URL}/guides/${r.slug}`,
        r.updated_at ? toDateStr(r.updated_at) : undefined,
      )
    ),
  ]

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
  ].join('\n')

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
