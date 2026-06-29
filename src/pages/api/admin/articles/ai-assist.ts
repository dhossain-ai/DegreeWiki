import type { APIRoute } from 'astro'
import { userHasAdminRole } from '../../../../lib/auth/dashboard'
import { jsonResponse, parseJsonBody } from '../../../../lib/ai/admin/api'
import { runArticleAssist } from '../../../../lib/ai/article-assist'
import { getAIEnv } from '../../../../lib/ai/env'
import { createClient } from '../../../../lib/supabase/server'

export const POST: APIRoute = async ({ cookies, request, locals }) => {
  const supabase = createClient(cookies, request)
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (!user || userError) {
    return jsonResponse(401, {
      ok: false,
      error: 'unauthenticated',
      message: 'Sign in as an admin to use the article AI assistant.',
    })
  }

  if (!(await userHasAdminRole(supabase))) {
    return jsonResponse(403, {
      ok: false,
      error: 'forbidden',
      message: 'You do not have access to the article AI assistant.',
    })
  }

  try {
    const body = await parseJsonBody(request)
    const result = await runArticleAssist(body, getAIEnv(locals as Record<string, unknown>), user.id)

    if (!result.ok) {
      return jsonResponse(result.status, {
        ok: false,
        error: result.error,
        message: result.message,
      })
    }

    return jsonResponse(200, result)
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid_body') {
      return jsonResponse(400, {
        ok: false,
        error: 'invalid_body',
        message: 'Send a valid JSON request body for the article AI assistant.',
      })
    }

    console.error('admin article ai assist api: unexpected failure')
    return jsonResponse(500, {
      ok: false,
      error: 'ai_unavailable',
      message: 'AI article assistant is temporarily unavailable. Please try again later.',
    })
  }
}
