-- ============================================================================
-- 016 DOWN — remove current_week_start() (rollback da 016)
-- ----------------------------------------------------------------------------
-- Reverte para o estado sem a definição canônica de semana no banco. Existe
-- só para reverter um deploy quebrado — o teste de paridade da VISI-15 volta
-- a não ter contra o que comparar.
-- ============================================================================

DROP FUNCTION IF EXISTS current_week_start(timestamptz);
