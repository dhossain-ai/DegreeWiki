-- ============================================================
-- Migration 016: AI Chat Schema Foundation
-- ============================================================
-- Phase 32 — AI Chat Schema Foundation
--
-- Purpose:
--   Add the missing schema and RLS foundation required for future
--   saved-result-bound AI chat. This migration is schema-only.
--   No chat route, no chat API, no AI calls, and no application
--   behavior changes are included.
--
-- Change summary:
--   1. Add ai_finder_result_id (nullable uuid FK) to ai_conversations.
--      References ai_finder_results(id) ON DELETE CASCADE so that
--      deleting a saved result cascades to its bound conversation
--      and all child ai_messages rows.
--
--   2. Add lookup index on ai_finder_result_id.
--
--   3. Add partial unique index enforcing one conversation per
--      (user_id, ai_finder_result_id) pair when ai_finder_result_id
--      is not null. NULL rows (generic or anonymous conversations)
--      are not constrained.
--
--   4. Drop and recreate ai_conversations_insert_own and
--      ai_conversations_update_own RLS policies to add:
--        a. ai_finder_result_id ownership validation via the
--           student_profiles join chain when ai_finder_result_id is set.
--        b. Cross-field consistency check: when both student_profile_id
--           and ai_finder_result_id are set, the referenced result's
--           student_profile_id must equal the conversation's
--           student_profile_id. Prevents linking a conversation to a
--           result that belongs to a different profile than declared.
--           Implemented as a RLS subquery (not a CHECK constraint —
--           PostgreSQL CHECK constraints cannot use subqueries).
--
-- Unchanged:
--   ai_conversations_select_own (user_id = auth.uid() still sufficient)
--   ai_conversations_delete_own (user_id = auth.uid() still sufficient)
--   ai_conversations_select_super_admin
--   ai_conversations_delete_super_admin
--   ai_messages schema and RLS (SELECT via parent conversation unchanged)
--   ai_finder_results and its RLS
--   ai_finder_program_matches and its RLS
--   ai_usage_logs
--
-- Backward compatibility:
--   Column is nullable — existing rows receive ai_finder_result_id = NULL.
--   All existing conversations remain valid and visible.
--   The chk_ai_conversations_owner_context CHECK constraint is unchanged.
--
-- Idempotency:
--   ADD COLUMN IF NOT EXISTS — safe to replay on supabase db reset.
--   CREATE INDEX IF NOT EXISTS — safe to replay.
--   CREATE UNIQUE INDEX IF NOT EXISTS — safe to replay.
--   DROP POLICY IF EXISTS — safe to replay before recreating policies.
--
-- Depends on:
--   012_ai_tables — ai_conversations, ai_finder_results
-- ============================================================


-- ============================================================
-- STEP 1: Add ai_finder_result_id column
-- ============================================================
-- Nullable: existing conversations and future generic chat sessions
-- do not require a linked saved result.
-- ON DELETE CASCADE: deleting the parent ai_finder_results row removes
-- the bound ai_conversations row, which cascades to ai_messages via
-- the existing ai_conversation_id ON DELETE CASCADE FK.
-- ============================================================

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS ai_finder_result_id uuid
    REFERENCES public.ai_finder_results(id) ON DELETE CASCADE;


-- ============================================================
-- STEP 2: Lookup index
-- ============================================================
-- Supports efficient queries by ai_finder_result_id (e.g. loading
-- or checking for an existing conversation for a given saved result).
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ai_conversations_finder_result_id
  ON public.ai_conversations (ai_finder_result_id);


-- ============================================================
-- STEP 3: Partial unique index
-- ============================================================
-- Enforces one conversation per (user_id, ai_finder_result_id) pair
-- when ai_finder_result_id is not null.
-- NULL rows are excluded from the uniqueness constraint, so multiple
-- conversations without a linked result (generic/anonymous) are allowed.
-- PostgreSQL UNIQUE ignores NULLs by default, but the explicit WHERE
-- clause makes the intent unambiguous.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_conversations_unique_user_finder_result
  ON public.ai_conversations (user_id, ai_finder_result_id)
  WHERE ai_finder_result_id IS NOT NULL;


-- ============================================================
-- STEP 4: Update RLS policies on ai_conversations
-- ============================================================
-- Drop and recreate only ai_conversations_insert_own and
-- ai_conversations_update_own. All other policies are unchanged.
--
-- Both policies add three new conditions beyond the existing checks:
--
--   Condition A — ai_finder_result_id ownership:
--     If ai_finder_result_id is set, the referenced ai_finder_results
--     row must belong to auth.uid() via the student_profiles join chain
--     (ai_finder_results.student_profile_id → student_profiles.user_id).
--     Prevents linking a conversation to another user's saved result
--     by guessing its UUID.
--
--   Condition B — Cross-field consistency:
--     If both student_profile_id and ai_finder_result_id are set,
--     the referenced ai_finder_results row's student_profile_id must
--     equal the conversation's student_profile_id. Prevents linking
--     a conversation to a result that belongs to a different profile
--     than the one declared in the conversation row. Implemented as a
--     RLS subquery rather than a table CHECK constraint because
--     PostgreSQL CHECK constraints cannot use subqueries.
-- ============================================================

-- INSERT policy
DROP POLICY IF EXISTS "ai_conversations_insert_own" ON public.ai_conversations;

CREATE POLICY "ai_conversations_insert_own" ON public.ai_conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Must set user_id to own auth uid (no anonymous rows via browser).
    user_id = auth.uid()

    -- If student_profile_id is set, it must belong to auth.uid() and
    -- must be a non-anonymous profile. Prevents linking a conversation
    -- to another user's profile or to an anonymous profile via browser.
    AND (
      student_profile_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.student_profiles sp
        WHERE sp.id           = ai_conversations.student_profile_id
          AND sp.user_id      = auth.uid()
          AND sp.is_anonymous = false
      )
    )

    -- If ai_finder_result_id is set, the linked result must belong to
    -- auth.uid() via the student_profiles join chain.
    AND (
      ai_finder_result_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM   public.ai_finder_results afr
        JOIN   public.student_profiles  sp ON sp.id = afr.student_profile_id
        WHERE  afr.id     = ai_conversations.ai_finder_result_id
          AND  sp.user_id = auth.uid()
      )
    )

    -- Cross-field consistency: when both student_profile_id and
    -- ai_finder_result_id are set, the result's student_profile_id
    -- must equal the conversation's student_profile_id.
    AND (
      student_profile_id IS NULL
      OR ai_finder_result_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM   public.ai_finder_results afr
        WHERE  afr.id                = ai_conversations.ai_finder_result_id
          AND  afr.student_profile_id = ai_conversations.student_profile_id
      )
    )
  );

-- UPDATE policy
DROP POLICY IF EXISTS "ai_conversations_update_own" ON public.ai_conversations;

CREATE POLICY "ai_conversations_update_own" ON public.ai_conversations
  FOR UPDATE TO authenticated
  -- USING: only allows updating rows the user already owns.
  USING (user_id = auth.uid())
  -- WITH CHECK: same ownership and consistency rules as INSERT.
  -- Prevents reassigning user_id, converting to anonymous, linking to
  -- another user's profile or result, or creating a cross-profile mismatch.
  WITH CHECK (
    user_id = auth.uid()

    AND (
      student_profile_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.student_profiles sp
        WHERE sp.id           = ai_conversations.student_profile_id
          AND sp.user_id      = auth.uid()
          AND sp.is_anonymous = false
      )
    )

    AND (
      ai_finder_result_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM   public.ai_finder_results afr
        JOIN   public.student_profiles  sp ON sp.id = afr.student_profile_id
        WHERE  afr.id     = ai_conversations.ai_finder_result_id
          AND  sp.user_id = auth.uid()
      )
    )

    AND (
      student_profile_id IS NULL
      OR ai_finder_result_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM   public.ai_finder_results afr
        WHERE  afr.id                = ai_conversations.ai_finder_result_id
          AND  afr.student_profile_id = ai_conversations.student_profile_id
      )
    )
  );
