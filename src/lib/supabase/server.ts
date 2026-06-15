import { createServerClient } from '@supabase/ssr'
import type { AstroCookies } from 'astro'

function parseCookieHeader(header: string): { name: string; value: string }[] {
  if (!header) return []
  return header.split(';').flatMap(pair => {
    const eq = pair.indexOf('=')
    if (eq < 0) return []
    return [{ name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim() }]
  })
}

export function createClient(cookies: AstroCookies, request: Request) {
  return createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get('cookie') ?? '')
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookies.set(name, value, options)
          }
        },
      },
    },
  )
}
