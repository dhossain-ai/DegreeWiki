import type { APIRoute } from 'astro'
import { createClient } from '../../../lib/supabase/server'
import { SITE_CHAT_CONVERSATION_TITLE } from '../../../lib/ai/site-chat/persist'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const supabase = createClient(cookies, request)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return jsonResponse(401, { ok: false, error: 'unauthenticated' })
  }

  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('user_id', user.id)
    .eq('session_type', 'chat')
    .eq('title', SITE_CHAT_CONVERSATION_TITLE)
    .is('ai_finder_result_id', null)

  if (error) {
    console.error('site-chat-clear: ai_conversations delete error:', error.message)
    return jsonResponse(500, { ok: false, error: 'internal_error' })
  }

  return jsonResponse(200, { ok: true })
}
