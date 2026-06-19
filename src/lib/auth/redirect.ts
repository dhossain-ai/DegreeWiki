export const DEFAULT_AUTH_REDIRECT = '/account'

export function sanitizeAuthRedirect(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT,
) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback
  }

  try {
    const parsed = new URL(value, 'https://degreewiki.com')
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}
