-- ============================================================================
-- 017 DOWN — remove a guarda de allocations e a reconciliação de 'visited'
-- ----------------------------------------------------------------------------
-- Volta ao estado sem enforcement: o upsert do engine (service_role) volta a
-- poder sobrescrever linha de gestor/acs, e captura do ACS deixa de marcar
-- 'visited' em allocations. Existe só para reverter um deploy quebrado — não é
-- um estado em que se deva ficar (é exatamente a lacuna que a 017 fechou).
-- ============================================================================

BEGIN;

DROP TRIGGER IF EXISTS captured_visits_mark_allocation_visited ON captured_visits;
DROP FUNCTION IF EXISTS captured_visits_mark_allocation_visited();

DROP TRIGGER IF EXISTS allocations_guard_human_rows ON allocations;
DROP FUNCTION IF EXISTS allocations_guard_human_rows();

COMMIT;
