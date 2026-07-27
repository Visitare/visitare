-- ============================================================================
-- 014 — Lockdown: RLS nas 4 tabelas que nunca tiveram + poda das policies órfãs
-- ----------------------------------------------------------------------------
-- CONTEXTO — o que a 013 deixou aberto (auditoria 2026-07-27):
--
--   1. A 013 revogou apenas SELECT de `anon` em patients/visits/events/teams.
--      Essas quatro tabelas NUNCA receberam `ENABLE ROW LEVEL SECURITY` (grep
--      de "ROW LEVEL SECURITY" em db/ só acha allocations, professionals e
--      captured_visits). Como o Supabase concede ALL por default a `anon` nas
--      tabelas criadas em `public`, sobrou INSERT/UPDATE/DELETE anônimo sobre
--      base de saúde — sem RLS e sem policy para barrar.
--
--   2. As policies da 006 em `allocations` foram escritas SEM cláusula `TO`,
--      então valem para PUBLIC, e a 013 só substituiu `acs_read_own_allocations`.
--      Sobreviveram: acs_update_own_status, acs_insert_own_allocation e as três
--      de gestor. Combinadas com o `GRANT SELECT, INSERT, UPDATE ON allocations
--      TO authenticated` da 006:111, um ACS logado insere uma alocação para
--      QUALQUER patient_id da cidade e depois lê o PHI daquele paciente pela
--      `acs_week_list` — que autoriza justamente a partir de `allocations`.
--      A RPC é SECURITY DEFINER, mas confia numa tabela que o próprio chamador
--      escreve. Essa é a cadeia mais séria do banco hoje.
--
--   3. `patient_detail` autoriza por `team_id` (~1.000–2.000 pacientes) em vez
--      da carteira de 25, e devolve o `payload` das capturas de TODOS os ACS —
--      furando a policy `acs_read_own_capture` criada na mesma migration.
--
-- PRINCÍPIO desta migration: o PWA fala com o banco por exatamente 4 caminhos
-- (`teams` SELECT, RPC acs_week_list, RPC patient_detail, `captured_visits`
-- INSERT — ver frontend/src/lib/supabaseAdapter.ts e hooks/useSync.ts). Todo o
-- resto é fechado. Nada aqui quebra o app.
--
-- SEM `FORCE ROW LEVEL SECURITY` de propósito: as RPCs são SECURITY DEFINER e
-- rodam como o owner. FORCE faria o owner obedecer às policies e as duas RPCs
-- passariam a devolver vazio — quebraria a lista da ACS sem fechar nada, já que
-- nem `anon` nem `authenticated` são owner.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Poda as policies órfãs da 006 (sem TO ⇒ PUBLIC) e o grant de escrita
-- ----------------------------------------------------------------------------
-- Corta a cadeia de escalada: sem INSERT em allocations, não dá para puxar
-- paciente de outra equipe para a própria carteira.
DROP POLICY IF EXISTS "acs_update_own_status"            ON allocations;
DROP POLICY IF EXISTS "acs_insert_own_allocation"        ON allocations;
DROP POLICY IF EXISTS "gestor_read_clinic_allocations"   ON allocations;
DROP POLICY IF EXISTS "gestor_update_clinic_allocations" ON allocations;
DROP POLICY IF EXISTS "gestor_insert_clinic_allocations" ON allocations;

-- Quem escreve allocations é o engine (service_role, que ignora RLS).
-- O PWA nunca escreve: o "visitado" vive no IndexedDB e vira captured_visits.
REVOKE INSERT, UPDATE, DELETE ON allocations FROM authenticated;

-- ----------------------------------------------------------------------------
-- 2. RLS fail-closed nas quatro tabelas que nunca tiveram
-- ----------------------------------------------------------------------------
-- Sem policy nenhuma = ninguém que não seja owner lê ou escreve. As RPCs
-- DEFINER continuam funcionando porque rodam como owner (ver nota sobre FORCE).
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits   ENABLE ROW LEVEL SECURITY;
ALTER TABLE events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams    ENABLE ROW LEVEL SECURITY;

-- Efeito colateral desejado: `visits` e `events` estão na publication
-- supabase_realtime com REPLICA IDENTITY FULL (002_realtime.sql:28,34). O
-- Realtime respeita RLS — com RLS ligada e zero policy, o canal para de
-- entregar linha clínica para o cliente.

-- ----------------------------------------------------------------------------
-- 3. `authenticated` não fala direto com tabela clínica — só via RPC
-- ----------------------------------------------------------------------------
REVOKE ALL ON patients FROM authenticated;
REVOKE ALL ON visits   FROM authenticated;
REVOKE ALL ON events   FROM authenticated;

-- `teams` o PWA lê direto (fetchTeamGeo). Mantém SELECT, mas escopado à
-- própria equipe — antes qualquer conta lia a geolocalização das 49 equipes.
REVOKE INSERT, UPDATE, DELETE ON teams FROM authenticated;
DROP POLICY IF EXISTS teams_read_own ON teams;
CREATE POLICY teams_read_own ON teams
    FOR SELECT TO authenticated
    USING (team_id = (auth.jwt() ->> 'team_id'));

-- ----------------------------------------------------------------------------
-- 4. `anon` não tem nada no schema public — nem hoje, nem em tabela futura
-- ----------------------------------------------------------------------------
-- A 013 revogou tabela por tabela e privilégio por privilégio, e foi por isso
-- que sobrou escrita. Aqui é o oposto: revoga tudo, de uma vez, e o default
-- privilege junto, para que a próxima tabela criada já nasça fechada.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES  IN SCHEMA public FROM anon, PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES  FROM anon, PUBLIC;

-- NOTA: ALTER DEFAULT PRIVILEGES só afeta objetos criados pelo MESMO role que
-- roda este comando. Rode esta migration com o mesmo usuário que criou as
-- tabelas (o `postgres` de scripts/setup_supabase.py), ou repita o bloco para
-- cada role que cria objeto em `public`.

-- ----------------------------------------------------------------------------
-- 5. captured_visits: INSERT tem que provar que o paciente é da carteira
-- ----------------------------------------------------------------------------
-- A policy da 013 validava só o professional_id, então um ACS podia gravar
-- registro clínico falso para qualquer um dos ~98k pacientes da base.
DROP POLICY IF EXISTS acs_insert_own_capture ON captured_visits;
CREATE POLICY acs_insert_own_capture ON captured_visits
    FOR INSERT TO authenticated
    WITH CHECK (
        professional_id = (auth.jwt() ->> 'acs_id')
        AND EXISTS (
            SELECT 1 FROM allocations a
            WHERE a.patient_id = captured_visits.patient_id
              AND a.acs_id     = (auth.jwt() ->> 'acs_id')
        )
    );

-- ----------------------------------------------------------------------------
-- 6. patient_detail: autoriza pela carteira, não pela equipe; e não devolve
--    captura de terceiro
-- ----------------------------------------------------------------------------
-- Mesma assinatura e mesmo shape de retorno da 013 — o front não muda.
CREATE OR REPLACE FUNCTION patient_detail(
    p_patient_id   text,
    p_period_start date DEFAULT '2025-12-31'::date
)
RETURNS jsonb
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT CASE WHEN EXISTS (
        -- autorização: o paciente precisa estar na carteira DESTE ACS no
        -- período. Antes era "mesma equipe", 40–80× mais largo que o necessário.
        SELECT 1 FROM allocations a
        WHERE a.patient_id = p_patient_id
          AND a.acs_id     = (auth.jwt() ->> 'acs_id')
          AND a.period_start = p_period_start
    ) THEN jsonb_build_object(
        'patient', (
            SELECT to_jsonb(pp) FROM (
                SELECT
                    p.patient_id, p.team_id, p.age_band, p.sex, p.race_color,
                    p.social_vulnerability, p.latitude, p.longitude,
                    p.hypertensive, p.diabetic, p.pregnant,
                    a.acs_id, a.priority_order, a.score, a.score_icsap,
                    a.score_life_stage, a.score_care_gap, a.score_social,
                    a.tier, a.reason, a.status
                FROM patients p
                LEFT JOIN allocations a
                       ON a.patient_id = p.patient_id
                      AND a.period_start = p_period_start
                WHERE p.patient_id = p_patient_id
                ORDER BY a.allocated_at DESC NULLS LAST
                LIMIT 1
            ) pp
        ),
        'recent_visits', (
            SELECT COALESCE(jsonb_agg(to_jsonb(v) ORDER BY v.recorded_at DESC), '[]'::jsonb)
            FROM (SELECT recorded_at, professional_id FROM visits
                  WHERE patient_id = p_patient_id ORDER BY recorded_at DESC LIMIT 10) v
        ),
        'recent_events', (
            SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.reference_date DESC), '[]'::jsonb)
            FROM (SELECT type, reference_date FROM events
                  WHERE patient_id = p_patient_id ORDER BY reference_date DESC LIMIT 10) e
        ),
        'recent_captures', (
            -- só as capturas do próprio ACS; a 013 devolvia o payload clínico
            -- de todos os profissionais, contornando acs_read_own_capture.
            SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.captured_at DESC), '[]'::jsonb)
            FROM (SELECT captured_at, professional_id, profile_blocks, payload
                  FROM captured_visits
                  WHERE patient_id = p_patient_id
                    AND professional_id = (auth.jwt() ->> 'acs_id')
                  ORDER BY captured_at DESC LIMIT 10) c
        )
    ) ELSE NULL END;
$$;

REVOKE ALL ON FUNCTION patient_detail(text, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION patient_detail(text, date) TO authenticated;

-- `pg_temp` no fim do search_path também na acs_week_list (endurecimento:
-- search_path = public sozinho não neutraliza objetos temporários).
ALTER FUNCTION acs_week_list(date) SET search_path = public, pg_temp;

COMMIT;

-- ============================================================================
-- FORA DO ESCOPO DESTA MIGRATION (precisam de decisão, não de SQL)
-- ----------------------------------------------------------------------------
--  - `audit_acessos`: docs/supabase.md:500-526 traz a tabela e o trigger, mas
--    como CHECKLIST ("antes de qualquer dado real entrar no banco"), não como
--    estado. Nenhuma migration cria. Hoje não há trilha de quem leu qual PHI.
--  - Retenção / eliminação: não há política nem caminho de expurgo no repo.
--  - Postura de signup do projeto Supabase não está fixada em código. Se estiver
--    no default (aberto), `authenticated` == qualquer pessoa com um e-mail, e
--    toda policy acima que exige apenas `authenticated` vale bem menos.
-- ============================================================================
