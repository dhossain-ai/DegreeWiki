import type { APIRoute } from 'astro'
import { createClient } from '@supabase/supabase-js'
import { cloudinaryUrl } from '../../../lib/cloudinary/url'

export const GET: APIRoute = async () => {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  const cloudName = import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'Supabase credentials not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })

  const { data, error } = await supabase
    .from('countries')
    .select(`
      id,
      slug,
      name,
      overview,
      cover_image:media_assets!countries_cover_image_id_fkey(cloudinary_public_id),
      og_image:media_assets!countries_og_image_id_fkey(cloudinary_public_id)
    `)
    .eq('content_status', 'published')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const payload = (data ?? []).map((c: any) => {
    let imageUrl = null
    const publicId = c.cover_image?.cloudinary_public_id ?? c.og_image?.cloudinary_public_id
    if (cloudName && publicId) {
      imageUrl = cloudinaryUrl(cloudName, publicId)
    }

    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      summary: c.overview ?? null,
      imageUrl
    }
  })

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
