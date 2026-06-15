import type { APIRoute } from 'astro'
import { createClient } from '../../../lib/supabase/server'

export const POST: APIRoute = async ({ cookies, request, redirect }) => {
  const supabase = createClient(cookies, request)
  await supabase.auth.signOut()
  return redirect('/login', 302)
}
