import type { User } from '@supabase/supabase-js'
import type { AstroCookies } from 'astro'
import { createClient } from '../supabase/server'

type GuardResult =
  | { type: 'redirect'; to: string }
  | { type: 'forbidden' }
  | { type: 'ok'; user: User; supabase: ReturnType<typeof createClient> }

export async function requireSuperAdmin(
  cookies: AstroCookies,
  request: Request,
  requestPath: string,
): Promise<GuardResult> {
  const supabase = createClient(cookies, request)

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (!user || userError) {
    return { type: 'redirect', to: `/login?redirect=${encodeURIComponent(requestPath)}` }
  }

  const { data: isSuperAdmin, error: roleError } = await supabase.rpc('has_role', {
    role_code: 'super_admin',
  })

  if (roleError || !isSuperAdmin) {
    return { type: 'forbidden' }
  }

  return { type: 'ok', user, supabase }
}
