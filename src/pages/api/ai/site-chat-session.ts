import type { APIRoute } from 'astro'
import { createClient } from '../../../lib/supabase/server'
import { SITE_CHAT_CONVERSATION_TITLE } from '../../../lib/ai/site-chat/persist'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const WELCOME_OPTIONS = [
  'Find programs',
  'Try Fit Finder',
  'Scholarships',
  'Study guides',
  'Sign in for AI chat',
]

export const GET: APIRoute = async ({ cookies, request }) => {
  const supabase = createClient(cookies, request)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return jsonResponse(200, {
      ok: true,
      authenticated: false,
      welcome_options: WELCOME_OPTIONS,
    })
  }

  const { data: conversations, error: conversationError } = await supabase
    .from('ai_conversations')
    .select('id')
    .eq('user_id', user.id)
    .eq('session_type', 'chat')
    .eq('title', SITE_CHAT_CONVERSATION_TITLE)
    .is('ai_finder_result_id', null)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)

  if (conversationError) {
    console.error('site-chat-session: ai_conversations read error:', conversationError.message)
    return jsonResponse(500, { ok: false, error: 'internal_error' })
  }

  const conversationId = conversations?.[0]?.id ?? null
  let messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

  if (typeof conversationId === 'string' && conversationId.length > 0) {
    const { data: messageRows, error: messageError } = await supabase
      .from('ai_messages')
      .select('role, content')
      .eq('ai_conversation_id', conversationId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true })
      .limit(40)

    if (messageError) {
      console.error('site-chat-session: ai_messages read error:', messageError.message)
      return jsonResponse(500, { ok: false, error: 'internal_error' })
    }

    messages = (messageRows ?? []).filter(
      (row): row is { role: 'user' | 'assistant'; content: string } =>
        (row.role === 'user' || row.role === 'assistant') && typeof row.content === 'string'
    )
  }

  return jsonResponse(200, {
    ok: true,
    authenticated: true,
    has_history: messages.length > 0,
    welcome_options: WELCOME_OPTIONS,
    messages,
  })
}
