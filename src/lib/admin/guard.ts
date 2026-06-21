import type { User } from '@supabase/supabase-js'
import type { AstroCookies } from 'astro'
import { userHasAdminRole } from '../auth/dashboard'
import { createClient } from '../supabase/server'

type GuardResult =
  | { type: 'redirect'; to: string }
  | { type: 'forbidden' }
  | { type: 'ok'; user: User; supabase: ReturnType<typeof createClient> }

export async function requireAdminUser(
  cookies: AstroCookies,
  request: Request,
  requestPath: string,
): Promise<GuardResult> {
  const supabase = createClient(cookies, request)

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (!user || userError) {
    return { type: 'redirect', to: `/login?redirect=${encodeURIComponent(requestPath)}` }
  }

  if (!(await userHasAdminRole(supabase))) {
    return { type: 'forbidden' }
  }

  return { type: 'ok', user, supabase }
}

export const requireSuperAdmin = requireAdminUser

export function forbiddenAdminResponse(): Response {
  return new Response(
    '403 Forbidden: an admin role is required to access DegreeWiki admin pages.',
    {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    },
  )
}
