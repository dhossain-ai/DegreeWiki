import type { User } from '@supabase/supabase-js'
import type { AstroCookies } from 'astro'
import { userHasAdminRole, userHasSuperAdminRole } from '../auth/dashboard'
import { createClient } from '../supabase/server'

type GuardResult =
  | { type: 'redirect'; to: string }
  | { type: 'forbidden' }
  | { type: 'ok'; user: User; supabase: ReturnType<typeof createClient> }

async function requireSignedInUser(
  cookies: AstroCookies,
  request: Request,
  requestPath: string,
): Promise<GuardResult> {
  const supabase = createClient(cookies, request)

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (!user || userError) {
    return { type: 'redirect', to: `/login?redirect=${encodeURIComponent(requestPath)}` }
  }

  return { type: 'ok', user, supabase }
}

async function hasPermission(
  supabase: ReturnType<typeof createClient>,
  permissionCode: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_permission', { permission_code: permissionCode })
  if (error) {
    console.error(`admin guard: has_permission(${permissionCode}) failed:`, error.message)
    return false
  }

  return data === true
}

async function hasAnyPermission(
  supabase: ReturnType<typeof createClient>,
  permissionCodes: readonly string[],
): Promise<boolean> {
  const checks = await Promise.all(permissionCodes.map((permissionCode) => hasPermission(supabase, permissionCode)))
  return checks.some(Boolean)
}

export async function requireAdminUser(
  cookies: AstroCookies,
  request: Request,
  requestPath: string,
): Promise<GuardResult> {
  const guard = await requireSignedInUser(cookies, request, requestPath)
  if (guard.type !== 'ok') return guard

  if (!(await userHasAdminRole(guard.supabase))) {
    return { type: 'forbidden' }
  }

  return guard
}

export async function requireSuperAdmin(
  cookies: AstroCookies,
  request: Request,
  requestPath: string,
): Promise<GuardResult> {
  const guard = await requireSignedInUser(cookies, request, requestPath)
  if (guard.type !== 'ok') return guard

  if (!(await userHasSuperAdminRole(guard.supabase))) {
    return { type: 'forbidden' }
  }

  return guard
}

export async function requireAdminPermission(
  cookies: AstroCookies,
  request: Request,
  requestPath: string,
  permissionCode: string,
): Promise<GuardResult> {
  const guard = await requireAdminUser(cookies, request, requestPath)
  if (guard.type !== 'ok') return guard

  if (!(await hasPermission(guard.supabase, permissionCode))) {
    return { type: 'forbidden' }
  }

  return guard
}

export async function requireAnyAdminPermission(
  cookies: AstroCookies,
  request: Request,
  requestPath: string,
  permissionCodes: readonly string[],
): Promise<GuardResult> {
  const guard = await requireAdminUser(cookies, request, requestPath)
  if (guard.type !== 'ok') return guard

  if (!(await hasAnyPermission(guard.supabase, permissionCodes))) {
    return { type: 'forbidden' }
  }

  return guard
}

export function forbiddenAdminResponse(
  message = '403 Forbidden: you do not have access to this DegreeWiki admin page.',
): Response {
  return new Response(
    message,
    {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    },
  )
}
