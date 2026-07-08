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
    .from('universities')
    .select(`
      id,
      slug,
      name,
      country_id,
      cities(name),
      overview,
      logo:media_assets!universities_logo_id_fkey(cloudinary_public_id)
    `)
    .eq('content_status', 'published')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const payload = (data ?? []).map((u: any) => {
    let logoUrl = null
    if (cloudName && u.logo?.cloudinary_public_id) {
      logoUrl = cloudinaryUrl(cloudName, u.logo.cloudinary_public_id)
    }

    return {
      id: u.id,
      slug: u.slug,
      name: u.name,
      countryId: u.country_id ?? null,
      city: u.cities?.name ?? null,
      logoUrl,
      overview: u.overview ?? null
    }
  })

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
