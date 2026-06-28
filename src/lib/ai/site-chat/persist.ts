import { createServiceClient } from '../../supabase/service'
import type { AIMessageContextSnapshot, AIRuntimeEnv } from '../types'

export const SITE_CHAT_CONVERSATION_TITLE = 'DegreeWiki site chat'
const STATIC_PROMPT_TEMPLATE_VERSION = 'site-static-v1'

export async function getOrCreateSiteConversation(
  userId: string,
  env: AIRuntimeEnv,
): Promise<string | null> {
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null

  const serviceClient = createServiceClient(key)
  const { data: existing, error: selectError } = await serviceClient
    .from('ai_conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('session_type', 'chat')
    .eq('title', SITE_CHAT_CONVERSATION_TITLE)
    .is('ai_finder_result_id', null)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)

  if (selectError) {
    console.error('site chat persist: ai_conversations select failed:', selectError.message)
    return null
  }

  const existingId = existing?.[0]?.id
  if (typeof existingId === 'string' && existingId.length > 0) return existingId

  const { data: created, error: insertError } = await serviceClient
    .from('ai_conversations')
    .insert({
      user_id: userId,
      student_profile_id: null,
      ai_finder_result_id: null,
      session_type: 'chat',
      title: SITE_CHAT_CONVERSATION_TITLE,
      expires_at: null,
    })
    .select('id')
    .single()

  if (!insertError && created?.id) return created.id as string

  console.error('site chat persist: ai_conversations insert failed:', insertError?.message)
  return null
}

export interface PersistSiteChatTurnParams {
  conversationId: string
  userMessage: string
  assistantText: string
  modelUsed: string
  promptTokens: number
  completionTokens: number
  contextUsed: AIMessageContextSnapshot
}

export async function persistSiteChatTurn(
  params: PersistSiteChatTurnParams,
  env: AIRuntimeEnv,
): Promise<boolean> {
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return false

  const serviceClient = createServiceClient(key)

  const { error: userMsgError } = await serviceClient
    .from('ai_messages')
    .insert({
      ai_conversation_id: params.conversationId,
      role: 'user',
      content: params.userMessage,
      context_used: null,
      ai_model_used: null,
      prompt_token_count: 0,
      completion_token_count: 0,
    })

  if (userMsgError) {
    console.error('site chat persist: user message insert failed:', userMsgError.message)
    return false
  }

  const { error: assistantMsgError } = await serviceClient
    .from('ai_messages')
    .insert({
      ai_conversation_id: params.conversationId,
      role: 'assistant',
      content: params.assistantText,
      context_used: params.contextUsed,
      ai_model_used: params.modelUsed,
      prompt_token_count: params.promptTokens,
      completion_token_count: params.completionTokens,
    })

  if (assistantMsgError) {
    console.error('site chat persist: assistant message insert failed:', assistantMsgError.message)
    return false
  }

  const { error: updateError } = await serviceClient
    .from('ai_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', params.conversationId)

  if (updateError) {
    console.error('site chat persist: last_message_at update failed:', updateError.message)
  }

  return true
}

export interface PersistSiteStaticTurnParams {
  conversationId: string
  currentPath: string
  pageType: string
  userMessage: string
  assistantText: string
  safetyPolicyVersion: string
  promptTemplateVersion?: string
  responseSource?: 'static' | 'preset'
  staticCategory?: string | null
  presetAnswerId?: string | null
  presetCategory?: string | null
}

export async function persistSiteStaticTurn(
  params: PersistSiteStaticTurnParams,
  env: AIRuntimeEnv,
): Promise<boolean> {
  return persistSiteChatTurn(
    {
      conversationId: params.conversationId,
      userMessage: params.userMessage,
      assistantText: params.assistantText,
      modelUsed: 'static',
      promptTokens: 0,
      completionTokens: 0,
      contextUsed: {
        chatMode: 'site',
        promptTemplateVersion: params.promptTemplateVersion ?? STATIC_PROMPT_TEMPLATE_VERSION,
        safetyPolicyVersion: params.safetyPolicyVersion,
        currentPath: params.currentPath,
        pageType: params.pageType,
        responseSource: params.responseSource ?? 'static',
        staticCategory: params.staticCategory ?? null,
        presetAnswerId: params.presetAnswerId ?? null,
        presetCategory: params.presetCategory ?? null,
      },
    },
    env,
  )
}
