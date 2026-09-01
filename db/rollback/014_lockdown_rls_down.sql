-- ============================================================================
-- 014 DOWN — reverte o lockdown, voltando ao estado da 013
-- ----------------------------------------------------------------------------
-- ATENÇÃO: rodar isto reabre o banco. A 013 deixava `anon` com
-- INSERT/UPDATE/DELETE em patients/visits/events/teams e permitia que um ACS
-- logado puxasse qualquer paciente da cidade para a própria carteira.
-- Existe só para destravar o demo se a 014 quebrar algo em cima da hora —
-- não é um estado em que se deva ficar.
-- ============================================================================

BEGIN;

ALTER TABLE patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE visits   DISABLE ROW LEVEL SECURITY;
ALTER TABLE events   DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams    DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teams_read_own ON teams;
GRANT SELECT ON teams TO authenticated;

GRANT SELECT, INSERT, UPDATE ON allocations TO authenticated;

-- Volta a policy de INSERT da 013 (valida só o professional_id).
DROP POLICY IF EXISTS acs_insert_own_capture ON captured_visits;
CREATE POLICY acs_insert_own_capture ON captured_visits
    FOR INSERT TO authenticated
    WITH CHECK (professional_id = (auth.jwt() ->> 'acs_id'));

COMMIT;

-- NOTA: não desfaz os REVOKE de `anon` nem os ALTER DEFAULT PRIVILEGES — esses
-- fecham a escrita anônima sobre PHI e não há motivo legítimo para reabrir.
-- Também não restaura as policies órfãs da 006 (gestor_*, acs_insert_own_*):
-- elas apontavam para o claim `clinica_id`, que nenhum hook emite, e eram a
-- porta da escalada. Se o papel de gestor for construído, escreva policies
-- novas com cláusula `TO` explícita.
