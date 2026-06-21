import type { SupabaseClient } from '@supabase/supabase-js'

export const ADMIN_DASHBOARD_PATH = '/admin'
export const STUDENT_DASHBOARD_PATH = '/account'

export const ADMIN_ROLE_CODES = [
  'admin',
  'super_admin',
  'content_admin',
  'reviewer',
  'data_import_manager',
] as const

const STUDENT_DASHBOARD_PATHS = new Set(['/account', '/dashboard'])

export async function userHasAdminRole(supabase: SupabaseClient): Promise<boolean> {
  const roleChecks = await Promise.all(
    ADMIN_ROLE_CODES.map(async (role_code) => {
      const { data, error } = await supabase.rpc('has_role', { role_code })

      if (error) {
        console.error(`auth: has_role(${role_code}) failed:`, error.message)
        return false
      }

      return data === true
    }),
  )

  return roleChecks.some(Boolean)
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
  if (!STUDENT_DASHBOARD_PATHS.has(redirectTo)) {
    return redirectTo
  }

  return getDashboardDestination(supabase)
}
