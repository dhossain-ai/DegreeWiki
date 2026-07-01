import type { SupabaseClient } from '@supabase/supabase-js'

export const ADMIN_DASHBOARD_PATH = '/admin'
export const STUDENT_DASHBOARD_PATH = '/account'
export const SUPER_ADMIN_ROLE_CODE = 'super_admin'

export const ADMIN_ROLE_CODES = [
  'admin',
  SUPER_ADMIN_ROLE_CODE,
  'content_admin',
  'reviewer',
  'data_import_manager',
] as const

const STUDENT_DASHBOARD_PATHS = new Set(['/account', '/dashboard'])
const AUTH_ENTRY_PATH_PREFIXES = ['/login', '/signup', '/auth/callback']

export async function userHasRole(
  supabase: SupabaseClient,
  roleCode: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_role', { role_code: roleCode })

  if (error) {
    console.error(`auth: has_role(${roleCode}) failed:`, error.message)
    return false
  }

  return data === true
}

export async function userHasAnyRole(
  supabase: SupabaseClient,
  roleCodes: readonly string[],
): Promise<boolean> {
  const roleChecks = await Promise.all(roleCodes.map((roleCode) => userHasRole(supabase, roleCode)))
  return roleChecks.some(Boolean)
}

export async function userHasAdminRole(supabase: SupabaseClient): Promise<boolean> {
  return userHasAnyRole(supabase, ADMIN_ROLE_CODES)
}

export async function userHasSuperAdminRole(supabase: SupabaseClient): Promise<boolean> {
  return userHasRole(supabase, SUPER_ADMIN_ROLE_CODE)
}

function isAuthEntryPath(path: string): boolean {
  return AUTH_ENTRY_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}?`))
}

function isAdminPath(path: string): boolean {
  return path === ADMIN_DASHBOARD_PATH || path.startsWith(`${ADMIN_DASHBOARD_PATH}/`)
}

export async function getDashboardDestination(supabase: SupabaseClient): Promise<string> {
  return (await userHasAdminRole(supabase))
    ? ADMIN_DASHBOARD_PATH
    : STUDENT_DASHBOARD_PATH
}

export async function resolveAuthRedirectForUser(
  supabase: SupabaseClient,
  redirectTo: string,
): Promise<string> {
  const isAdminUser = await userHasAdminRole(supabase)

  if (isAuthEntryPath(redirectTo) || STUDENT_DASHBOARD_PATHS.has(redirectTo)) {
    return isAdminUser ? ADMIN_DASHBOARD_PATH : STUDENT_DASHBOARD_PATH
  }

  if (isAdminPath(redirectTo)) {
    return isAdminUser ? redirectTo : STUDENT_DASHBOARD_PATH
  }

  return redirectTo
}
