// SERVER-ONLY. Authenticated JSON API endpoint to clear the chat conversation
// for a specific saved Fit Finder result.
//
// POST /api/ai/chat-clear
//   Body: { ai_finder_result_id: string }
//   Success: { ok: true }
//   Errors: 400 (invalid_body, invalid_request), 401 (unauthenticated),
//           404 (not_found), 500 (internal_error)
//
// Uses only the authenticated SSR Supabase client (no service role).
// RLS enforces ownership on both the result check and the conversation delete.
// ai_messages rows are removed via ON DELETE CASCADE from ai_conversation_id FK.
import type { APIRoute } from 'astro'
import { createClient } from '../../../lib/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ cookies, request }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse(400, { ok: false, error: 'invalid_body' })
  }

  const b = body as Record<string, unknown>
  const resultId = b['ai_finder_result_id']

  if (typeof resultId !== 'string' || !UUID_RE.test(resultId)) {
    return jsonResponse(400, { ok: false, error: 'invalid_request' })
  }

  const supabase = createClient(cookies, request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return jsonResponse(401, { ok: false, error: 'unauthenticated' })
  }

  // Confirm the saved result exists and belongs to this user.
  // RLS (ai_finder_results_select_own) enforces ownership — returns no row if not found or not owned.
  const { data: result, error: resultError } = await supabase
    .from('ai_finder_results')
    .select('id')
    .eq('id', resultId)
    .maybeSingle()

  if (resultError) {
    console.error('chat-clear: ai_finder_results read error:', resultError.message)
    return jsonResponse(500, { ok: false, error: 'internal_error' })
  }

  if (!result) {
    return jsonResponse(404, { ok: false, error: 'not_found' })
  }

  // Delete the conversation for this result.
  // RLS (ai_conversations_delete_own: user_id = auth.uid()) enforces ownership.
  // If no conversation exists this is a no-op — still a success.
  // ai_messages rows cascade via ai_conversation_id ON DELETE CASCADE.
  const { error: deleteError } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('ai_finder_result_id', resultId)
    .eq('user_id', user.id)

  if (deleteError) {
    console.error('chat-clear: ai_conversations delete error:', deleteError.message)
    return jsonResponse(500, { ok: false, error: 'internal_error' })
  }

  return jsonResponse(200, { ok: true })
}
