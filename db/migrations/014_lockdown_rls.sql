-- ============================================================================
-- 014 — Lockdown: RLS nas 4 tabelas que nunca tiveram + poda das policies órfãs
-- ----------------------------------------------------------------------------
-- CONTEXTO — auditoria 2026-07-27, VERIFICADA CONTRA O BANCO AO VIVO
-- (projeto gyutcqmrbbtftrowcyhv, via `supabase db query --linked`). Onde o
-- estado real divergiu das migrations, vale o real — está anotado abaixo.
--
--   1. [CONFIRMADO AO VIVO, E PIOR] A 013 revogou apenas SELECT de `anon` em
--      patients/visits/events/teams, e essas quatro nunca receberam
--      `ENABLE ROW LEVEL SECURITY`. Os grants reais do `anon` hoje:
--          patients, visits, events, teams
--            → DELETE, INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER
--      Ou seja: escrita e destruição anônimas sobre base de saúde, com a chave
--      pública que está no bundle. E `TRUNCATE` **não é sujeito a RLS** no
--      Postgres — então `anon` também esvazia `allocations`, `captured_visits`
--      e `professionals`, que TÊM RLS ligada. Nenhuma tabela do schema escapa.
--      É por isso que aqui o REVOKE é em bloco, e não privilégio por privilégio
--      como na 013 — foi exatamente a enumeração que deixou o buraco.
--
--   2. [REFUTADO PELO ESTADO REAL] A leitura estática apontava uma escalada via
--      as policies sem cláusula `TO` da 006 (acs_insert_own_allocation + as de
--      gestor), que permitiria a um ACS puxar qualquer paciente para a própria
--      carteira e lê-lo pela `acs_week_list`. No banco real essas policies NÃO
--      existem: `allocations` tem exatamente uma, `acs_read_own_allocations`
--      (SELECT, authenticated). Com RLS ligada e sem policy de INSERT, o GRANT
--      de INSERT é inerte. Os DROP POLICY abaixo ficam como no-op idempotente,
--      para que um banco recriado do zero pelas migrations não herde o furo.
--
--   3. [NOVO — só aparece ao vivo] Existe `public.allocations_baseline`, 25
--      linhas, mesma forma de `allocations`, que NÃO está em nenhuma migration.
--      RLS desligada e `anon` com SELECT — é hoje o único caminho de LEITURA
--      anônima de PHI que restou (patient_id + score + tier + reason).
--
--   4. [CONFIRMADO AO VIVO] `authenticated` tem ALL em todas as tabelas. Como
--      patients/visits/events/teams não têm RLS, qualquer conta logada lê os
--      97.938 pacientes direto pelo PostgREST, sem passar pelas RPCs.
--
--   5. `patient_detail` autoriza por `team_id` (~1.000–2.000 pacientes) em vez
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

-- allocations_baseline: artefato de trabalho do engine que não está em nenhuma
-- migration e hoje é o único SELECT anônimo sobre PHI. Fecha aqui; a decisão de
-- DROPAR fica para quem sabe se ainda serve de baseline (ver rodapé).
ALTER TABLE IF EXISTS allocations_baseline ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON allocations_baseline FROM anon, authenticated;

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

-- ----------------------------------------------------------------------------
-- 7. Hook de JWT com search_path fixo (Advisor: function_search_path_mutable)
-- ----------------------------------------------------------------------------
-- A 012 define custom_access_token_hook sem cláusula SET. Ele roda como
-- `supabase_auth_admin` a cada emissão de token e é o que injeta acs_id/team_id
-- nos claims — ou seja, é o que toda policy acima usa para autorizar.
-- Todas as referências dentro dele já são schema-qualified (public.professionals),
-- então fixar o search_path não muda comportamento.
ALTER FUNCTION public.custom_access_token_hook(jsonb) SET search_path = public, pg_temp;

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
--  - `allocations_baseline`: esta migration fecha o acesso, mas a tabela segue
--    existindo fora do versionamento, com 25 pacientes reais. Se era rascunho
--    de baseline do engine, `DROP TABLE allocations_baseline` é o certo. Se
--    serve para comparar antes/depois da alocação, precisa virar migration.
--  - Advisor também acusa `auth_leaked_password_protection` desligado
--    (checagem contra HaveIBeenPwned). É toggle de painel, não SQL — e importa
--    porque a conta de demo tem senha dita em voz alta em evento.
-- ============================================================================
