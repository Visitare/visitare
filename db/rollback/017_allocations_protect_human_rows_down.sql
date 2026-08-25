-- ============================================================================
-- 017 DOWN — reverte a proteção de linhas humanas/resolvidas em allocations
-- ----------------------------------------------------------------------------
-- Remove o trigger e a função. Volta ao estado da 013: nada impede um upsert
-- do engine (service_role) de sobrescrever origin/status/id em allocations.
-- ============================================================================

DROP TRIGGER IF EXISTS allocations_protect_human_rows ON allocations;
DROP FUNCTION IF EXISTS allocations_protect_human_rows();
