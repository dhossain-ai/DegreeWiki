import type { SupabaseClient } from '@supabase/supabase-js'

export type ReviewEntityType = 'universities' | 'programs' | 'scholarships' | 'articles'
export type ReviewAction = 'approve' | 'reject' | 'skip' | 'reset'

const VALID_ENTITY_TYPES: readonly ReviewEntityType[] = [
  'universities', 'programs', 'scholarships', 'articles',
]

const VALID_REVIEW_ACTIONS: readonly ReviewAction[] = [
  'approve', 'reject', 'skip', 'reset',
]

const BLOCKED_STATUSES = new Set(['processing', 'error', 'merged'])

const STAGING_TABLE: Record<ReviewEntityType, string> = {
  universities: 'staging_universities',
  programs: 'staging_programs',
  scholarships: 'staging_scholarships',
  articles: 'staging_articles',
}

const ACTION_STATUS: Record<ReviewAction, string> = {
  approve: 'approved',
  reject: 'rejected',
  skip: 'skipped',
  reset: 'pending',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function applyReviewAction(
  supabase: SupabaseClient,
  params: {
    entityType: string
    rowId: string
    batchId: string
    action: string
    reviewNotes: string
    reviewerUserId: string
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { entityType, rowId, batchId, action, reviewNotes, reviewerUserId } = params

  if (!(VALID_ENTITY_TYPES as readonly string[]).includes(entityType)) {
    return { ok: false, error: 'Invalid entity type.' }
  }
  if (!(VALID_REVIEW_ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, error: 'Invalid review action.' }
  }
  if (!UUID_RE.test(rowId)) {
    return { ok: false, error: 'Invalid row ID.' }
  }
  if (!UUID_RE.test(batchId)) {
    return { ok: false, error: 'Invalid batch ID.' }
  }

  const table = STAGING_TABLE[entityType as ReviewEntityType]
  const reviewAction = action as ReviewAction

  // Confirm row belongs to this batch and check its current status.
  const { data: current, error: fetchError } = await supabase
    .from(table)
    .select('import_status')
    .eq('id', rowId)
    .eq('import_batch_id', batchId)
    .single()

  if (fetchError || !current) {
    return { ok: false, error: 'Staged row not found in this batch.' }
  }

  const currentStatus = (current as { import_status: string }).import_status
  if (BLOCKED_STATUSES.has(currentStatus)) {
    return { ok: false, error: `Cannot review a row with status "${currentStatus}".` }
  }

  const newStatus = ACTION_STATUS[reviewAction]
  const isReset = reviewAction === 'reset'

  const updatePayload = isReset
    ? {
        import_status: newStatus,
        review_notes: null,
        reviewed_by_user_id: null,
        reviewed_at: null,
      }
    : {
        import_status: newStatus,
        review_notes: reviewNotes.trim() || null,
        reviewed_by_user_id: reviewerUserId,
        reviewed_at: new Date().toISOString(),
      }

  const { error: updateError } = await supabase
    .from(table)
    .update(updatePayload)
    .eq('id', rowId)
    .eq('import_batch_id', batchId)

  if (updateError) {
    return { ok: false, error: 'Failed to update staged row.' }
  }

  return { ok: true }
}
