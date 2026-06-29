-- ============================================================================
-- 007 — disable RLS on allocations (MVP/demo posture)
-- ----------------------------------------------------------------------------
-- The PWA demo authenticates with the publishable (anon) key, which maps to
-- the `anon` role. Migration 006 enabled RLS + JWT-based policies and granted
-- only to `authenticated`, so the demo could not read/write allocations.
--
-- This migration reverts allocations to the same open posture as the other 5
-- demo tables ("Sem RLS no MVP", docs/supabase.md): RLS off + grant to anon.
--
-- ⚠️ Re-enable RLS (re-apply 006 §Row-Level Security) before real production
--    data. The JWT policies from 006 are the intended prod design.
-- ============================================================================

ALTER TABLE allocations DISABLE ROW LEVEL SECURITY;

-- Match the demo grant pattern (anon = publishable key in the browser).
GRANT SELECT, INSERT, UPDATE ON allocations TO anon;
