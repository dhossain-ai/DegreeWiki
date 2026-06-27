import type { SupabaseClient } from '@supabase/supabase-js'

const IMPORT_STAGING_DELETE_TABLES = [
  'staging_errors',
  'import_files',
  'staging_programs',
  'staging_universities',
  'staging_scholarships',
  'staging_articles',
] as const

export async function hardDeleteImportBatchStaging(
  supabase: SupabaseClient,
  batchId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  for (const table of IMPORT_STAGING_DELETE_TABLES) {
    const { error } = await supabase.from(table).delete().eq('import_batch_id', batchId)
    if (error) {
      return {
        ok: false,
        message: 'Could not delete this batch. Your current admin permissions or database rules blocked staging cleanup, so no production content was touched.',
      }
    }
  }

  const { error } = await supabase.from('import_batches').delete().eq('id', batchId)
  if (error) {
    return {
      ok: false,
      message: 'Staging rows were cleared, but the batch record could not be deleted. Production content was not touched.',
    }
  }

  return { ok: true }
}
