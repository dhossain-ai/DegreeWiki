import type { APIRoute } from 'astro'
import { createClient } from '@supabase/supabase-js'

export const GET: APIRoute = async () => {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

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
    .from('programs')
    .select(`
      id,
      slug,
      title,
      tuition_min_amount,
      duration_months,
      universities(name),
      countries(name),
      degree_levels(name),
      subjects!programs_primary_subject_id_fkey(name)
    `)
    .eq('content_status', 'published')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const payload = (data ?? []).map((p: any) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    universityName: p.universities?.name ?? '',
    countryName: p.countries?.name ?? '',
    degreeLevel: p.degree_levels?.name ?? '',
    subject: p.subjects?.name ?? null,
    tuition: p.tuition_min_amount ? Number(p.tuition_min_amount) : null,
    duration: p.duration_months ? `${p.duration_months} months` : null
  }))

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
