// Mobile bearer-token authentication helper.
// Creates a Supabase client authenticated via an Authorization: Bearer <token>
// header, preserving RLS and authenticated-user scoping without cookies or
// the service-role key.
//
// Usage:
//   const auth = await authenticateMobileRequest(request)
//   if (!auth) return unauthorizedResponse()
//   const { supabase, user } = auth
//
// The returned client runs all queries as the authenticated user.
// RLS policies on saved_items, user_profiles, etc. enforce ownership.

import { createClient } from '@supabase/supabase-js'
import { jsonResponse } from './public'

const BEARER_PREFIX = 'Bearer '

export interface MobileAuthResult {
  supabase: ReturnType<typeof createClient>
  user: { id: string; email: string | undefined; createdAt: string | undefined }
}

/**
 * Validate a bearer token from the Authorization header and return an
 * authenticated Supabase client plus minimal user identity.
 *
 * Returns `null` when the header is missing, malformed, or the token is
 * invalid/expired. Callers should return `unauthorizedResponse()` in that case.
 */
export async function authenticateMobileRequest(
  request: Request,
): Promise<MobileAuthResult | null> {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  const authHeader = request.headers.get('authorization') ?? ''
  if (!authHeader.startsWith(BEARER_PREFIX)) {
    return null
  }

  const accessToken = authHeader.slice(BEARER_PREFIX.length).trim()
  if (!accessToken) {
    return null
  }

  // Create a Supabase client with the user's access token injected as a global
  // header. This makes every subsequent query run as the authenticated user,
  // preserving RLS without cookies or the service-role key.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  })

  // Validate the token through Supabase Auth. getUser() makes a server-side
  // call to verify the JWT — it does not trust the token signature alone.
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    return null
  }

  return {
    supabase,
    user: {
      id: data.user.id,
      email: data.user.email,
      createdAt: data.user.created_at,
    },
  }
}

/** Safe 401 response for missing or invalid bearer tokens. */
export function unauthorizedResponse(): Response {
  return jsonResponse(401, { ok: false, error: 'sign_in_required' })
}

/** Safe 400 response for malformed requests. */
export function badRequestResponse(error = 'bad_request'): Response {
  return jsonResponse(400, { ok: false, error })
}
