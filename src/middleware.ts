import { defineMiddleware } from 'astro:middleware'
import { createServerClient } from '@supabase/ssr'

function parseCookieHeader(header: string): { name: string; value: string }[] {
  if (!header) return []
  return header.split(';').flatMap(pair => {
    const eq = pair.indexOf('=')
    if (eq < 0) return []
    return [{ name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim() }]
  })
}

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(context.request.headers.get('cookie') ?? '')
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            context.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // Refresh session tokens and write updated cookies before the page renders.
  await supabase.auth.getUser()

  return next()
})
