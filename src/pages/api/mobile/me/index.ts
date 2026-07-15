// GET /api/mobile/me
// Returns the authenticated user's identity, profile, and saved-item summary.
// Requires Authorization: Bearer <access_token>.
// Does not depend on browser cookies or the service-role key.
import type { APIRoute } from 'astro'
import {
  authenticateMobileRequest,
  unauthorizedResponse,
} from '../../../../lib/mobile/auth'
import {
  credentialsErrorResponse,
  jsonResponse,
} from '../../../../lib/mobile/public'

export const GET: APIRoute = async ({ request }) => {
  const auth = await authenticateMobileRequest(request)
  if (!auth) {
    return unauthorizedResponse()
  }

  const { supabase, user } = auth

  // Fetch the user_profiles row. RLS enforces user_id = auth.uid().
  // A missing row is safe — the user may not have a profile yet.
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('display_name, avatar_url, account_status, created_at')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('mobile me: profile fetch failed:', profileError.message)
    return credentialsErrorResponse()
  }

  // Count saved programs. RLS scopes to the authenticated user.
  const { count: programCount, error: countError } = await supabase
    .from('saved_items')
    .select('id', { count: 'exact', head: true })
    .eq('entity_type', 'program')

  if (countError) {
    console.error('mobile me: saved count failed:', countError.message)
    return credentialsErrorResponse()
  }

  return jsonResponse(200, {
    ok: true,
    user: {
      id: user.id,
      email: user.email ?? null,
      displayName: profile?.display_name ?? null,
      createdAt: user.createdAt ?? null,
    },
    profile: profile
      ? {
          displayName: profile.display_name ?? null,
          avatarUrl: profile.avatar_url ?? null,
          accountStatus: profile.account_status ?? null,
        }
      : null,
    savedSummary: {
      programCount: programCount ?? 0,
    },
  })
}
