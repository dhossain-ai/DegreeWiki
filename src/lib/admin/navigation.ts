import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminNavItem = {
  href: string
  label: string
  requiredPermissions?: string[]
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/countries', label: 'Countries', requiredPermissions: ['edit_content', 'publish_content', 'manage_settings'] },
  { href: '/admin/cities', label: 'Cities', requiredPermissions: ['edit_content', 'publish_content', 'manage_settings'] },
  { href: '/admin/universities', label: 'Universities', requiredPermissions: ['edit_content', 'publish_content', 'manage_universities'] },
  { href: '/admin/degree-levels', label: 'Degree Levels', requiredPermissions: ['manage_settings'] },
  { href: '/admin/subjects', label: 'Subjects', requiredPermissions: ['edit_content', 'publish_content', 'manage_settings'] },
  { href: '/admin/programs', label: 'Programs', requiredPermissions: ['edit_content', 'publish_content', 'manage_programs'] },
  { href: '/admin/scholarships', label: 'Scholarships', requiredPermissions: ['edit_content', 'publish_content', 'manage_scholarships'] },
  { href: '/admin/articles', label: 'Articles', requiredPermissions: ['edit_content', 'publish_content', 'manage_articles'] },
  { href: '/admin/media', label: 'Media', requiredPermissions: ['manage_media'] },
  { href: '/admin/data-quality', label: 'Data Quality', requiredPermissions: ['view_data_quality', 'manage_data_sources'] },
  { href: '/admin/imports', label: 'Imports', requiredPermissions: ['manage_imports', 'approve_import', 'reject_import'] },
  { href: '/admin/users', label: 'Users', requiredPermissions: ['manage_users', 'manage_roles'] },
  { href: '/admin/system', label: 'System', requiredPermissions: ['manage_roles', 'manage_settings'] },
]

async function hasAnyPermission(
  supabase: SupabaseClient,
  permissionCodes: string[],
): Promise<boolean> {
  const checks = await Promise.all(
    permissionCodes.map(async (permission_code) => {
      const { data, error } = await supabase.rpc('has_permission', { permission_code })

      if (error) {
        console.error(`admin nav: has_permission(${permission_code}) failed:`, error.message)
        return false
      }

      return data === true
    }),
  )

  return checks.some(Boolean)
}

export async function getAdminNavItems(supabase: SupabaseClient): Promise<AdminNavItem[]> {
  const items = await Promise.all(
    ADMIN_NAV_ITEMS.map(async (item) => {
      if (!item.requiredPermissions?.length) {
        return item
      }

      return (await hasAnyPermission(supabase, item.requiredPermissions)) ? item : null
    }),
  )

  return items.filter((item): item is AdminNavItem => item !== null)
}
