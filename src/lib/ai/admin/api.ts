import { createClient } from '../../supabase/server'
import { getAIEnv } from '../env'
import type { AIRuntimeEnv } from '../types'

interface AdminAIGatewayContext {
  supabase: ReturnType<typeof createClient>
  userId: string
  env: AIRuntimeEnv
}

type AdminAIGatewayAuthResult =
  | { ok: true; context: AdminAIGatewayContext }
  | { ok: false; response: Response }

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function requireAIGatewayAdmin(
  cookies: Parameters<typeof createClient>[0],
  request: Request,
  locals: Record<string, unknown>,
): Promise<AdminAIGatewayAuthResult> {
  const supabase = createClient(cookies, request)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (!user || userError) {
    return { ok: false, response: jsonResponse(401, { ok: false, error: 'unauthenticated' }) }
  }

  const { data: allowed, error: permissionError } = await supabase.rpc('has_permission', {
    permission_code: 'manage_ai_settings',
  })

  if (permissionError) {
    console.error('ai gateway admin api: manage_ai_settings permission check failed:', permissionError.message)
    return { ok: false, response: jsonResponse(403, { ok: false, error: 'forbidden' }) }
  }

  if (allowed !== true) {
    return { ok: false, response: jsonResponse(403, { ok: false, error: 'forbidden' }) }
  }

  return {
    ok: true,
    context: {
      supabase,
      userId: user.id,
      env: getAIEnv(locals),
    },
  }
}

export async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new Error('invalid_body')
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('invalid_body')
  }

  return body as Record<string, unknown>
}
