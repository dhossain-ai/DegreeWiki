import type { APIRoute } from 'astro'
import { CHAT_SITE_PROMPT_VERSION } from '../../../lib/ai/prompts/chat-answer'
import { getSiteStaticAnswerSource, type SiteStaticCategory } from '../../../lib/ai/site-chat/router'
import { createClient } from '../../../lib/supabase/server'
import { SITE_CHAT_CONVERSATION_TITLE } from '../../../lib/ai/site-chat/persist'
import type { SiteChatAnswerSource, SiteChatContextUsedSnapshot } from '../../../lib/ai/types'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const WELCOME_OPTIONS = [
  'How can you help?',
  'Find programs',
  'Try Fit Finder',
  'Scholarships',
  'Study guides',
]

function isAnswerSource(value: unknown): value is SiteChatAnswerSource {
  return value === 'knowledge_base'
    || value === 'assistant'
    || value === 'safety_notice'
    || value === 'system_notice'
}

function readContextUsed(value: unknown): Partial<SiteChatContextUsedSnapshot> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Partial<SiteChatContextUsedSnapshot>
}

function inferAssistantSource(
  contextUsedValue: unknown,
  aiModelUsed: unknown,
): SiteChatAnswerSource {
  const contextUsed = readContextUsed(contextUsedValue)
  if (contextUsed?.answerSource && isAnswerSource(contextUsed.answerSource)) {
    return contextUsed.answerSource
  }

  if (contextUsed?.responseSource === 'preset') {
    return 'knowledge_base'
  }

  if (contextUsed?.responseSource === 'static') {
    if (typeof contextUsed.staticCategory === 'string') {
      return getSiteStaticAnswerSource(contextUsed.staticCategory as SiteStaticCategory)
    }

    return 'knowledge_base'
  }

  if (contextUsed?.promptTemplateVersion === CHAT_SITE_PROMPT_VERSION) {
    return 'assistant'
  }

  if (typeof aiModelUsed === 'string' && aiModelUsed.length > 0 && aiModelUsed !== 'static') {
    return 'assistant'
  }

  return 'knowledge_base'
}

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
  let messages: Array<{ role: 'user' | 'assistant'; content: string; answer_source?: SiteChatAnswerSource }> = []

  if (typeof conversationId === 'string' && conversationId.length > 0) {
    const { data: messageRows, error: messageError } = await supabase
      .from('ai_messages')
      .select('role, content, context_used, ai_model_used')
      .eq('ai_conversation_id', conversationId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true })
      .limit(40)

    if (messageError) {
      console.error('site-chat-session: ai_messages read error:', messageError.message)
      return jsonResponse(500, { ok: false, error: 'internal_error' })
    }

    messages = (messageRows ?? [])
      .filter(
        (
          row,
        ): row is {
          role: 'user' | 'assistant'
          content: string
          context_used?: unknown
          ai_model_used?: unknown
        } =>
          (row.role === 'user' || row.role === 'assistant') && typeof row.content === 'string'
      )
      .map((row) => {
        if (row.role === 'user') {
          return {
            role: row.role,
            content: row.content,
          }
        }

        return {
          role: row.role,
          content: row.content,
          answer_source: inferAssistantSource(row.context_used, row.ai_model_used),
        }
      })
  }

  return jsonResponse(200, {
    ok: true,
    authenticated: true,
    has_history: messages.length > 0,
    welcome_options: WELCOME_OPTIONS,
    messages,
  })
}
