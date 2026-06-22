// Safe for import anywhere — no secrets, no config.ts dependency.
// Defines the allowed Cloudinary upload subfolders.

export const ALLOWED_SUBFOLDERS = [
  'general',
  'universities',
  'countries',
  'cities',
  'subjects',
  'scholarships',
  'articles',
] as const

export type AllowedSubfolder = (typeof ALLOWED_SUBFOLDERS)[number]

export function isAllowedSubfolder(value: unknown): value is AllowedSubfolder {
  return typeof value === 'string' && (ALLOWED_SUBFOLDERS as readonly string[]).includes(value)
}
