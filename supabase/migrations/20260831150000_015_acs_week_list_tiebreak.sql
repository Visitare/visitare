-- ============================================================================
-- 015 — Desempate determinístico no ORDER BY de acs_week_list (VISI-48)
-- ----------------------------------------------------------------------------
-- Antes: `ORDER BY a.priority_order` sem desempate. Hoje isso não aparece
-- porque só o engine escreve em `allocations` e numera 1..N sem repetir
-- (enumerate(sorted_list, start=1) no visitare-engine).
--
-- Isso deixa de valer assim que existirem linhas com origin='manager'/'acs'
-- (não numeradas pelo engine) e assim que o engine passar a pular linhas
-- protegidas no upsert (VISI-9 do Squad Engine, ver também a trigger da
-- VISI-46 em allocations): uma linha protegida mantém, por exemplo,
-- priority_order = 3, enquanto a renumeração do restante atribui 3 a outro
-- paciente. Dois cards disputam a mesma posição e a ordem pode trocar entre
-- um reload e outro — para o ACS em campo, a lista muda de ordem sozinha.
--
-- Agora: ORDER BY a.priority_order, a.allocated_at, a.patient_id
--   - priority_order   : critério de negócio (score/ranking do engine ou
--                        do gestor/ACS) — continua sendo o critério primário.
--   - allocated_at     : em empate de priority_order, a linha alocada há
--                        mais tempo aparece primeiro. É o desempate mais
--                        intuitivo em campo: a linha "mais antiga" (em geral
--                        a humana/protegida, que não é reescrita) não pula
--                        atrás de uma linha recém-inserida pelo engine no
--                        mesmo re-run. Como nada mais grava em `allocations`
--                        entre uma leitura e outra da mesma semana, o valor
--                        é estável de um reload para o outro.
--   - patient_id       : desempate final, incondicional. allocated_at é um
--                        timestamptz — duas linhas gravadas na mesma
--                        transação (ex.: upsert em lote do engine) podem
--                        colidir também nesse valor. patient_id é único por
--                        (acs_id, period_start) e imutável, então fecha o
--                        ORDER BY numa ordem total: não sobra empate possível.
--
-- Assinatura e RETURNS TABLE inalterados — mesmas 21 colunas consumidas por
-- frontend/src/lib/supabaseAdapter.ts (AcsWeekRow). Nenhuma coluna nova
-- (em particular, sem allocations.id).
--
-- Efeito em RLS: nenhum. Esta migration não toca em ALTER TABLE / POLICY —
-- só troca o ORDER BY do corpo da função. SECURITY DEFINER, SET search_path
-- e os REVOKE/GRANT seguem os da 013 (reafirmados abaixo por clareza; o
-- CREATE OR REPLACE preserva os grants existentes porque a assinatura da
-- função não muda).
-- ============================================================================

CREATE OR REPLACE FUNCTION acs_week_list(
    p_period_start date DEFAULT '2025-12-31'::date
)
RETURNS TABLE (
    patient_id text, team_id text, age_band text, sex text, race_color text,
    social_vulnerability boolean, latitude double precision, longitude double precision,
    hypertensive boolean, diabetic boolean, pregnant boolean,
    priority_order int, score int, score_icsap int, score_life_stage int,
    score_care_gap int, score_social int, tier text, reason text, status text,
    last_visit date
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        a.patient_id, a.team_id, p.age_band, p.sex, p.race_color,
        p.social_vulnerability, p.latitude, p.longitude,
        p.hypertensive, p.diabetic, p.pregnant,
        a.priority_order, a.score, a.score_icsap, a.score_life_stage,
        a.score_care_gap, a.score_social, a.tier, a.reason, a.status,
        (
            SELECT MAX(d) FROM (
                SELECT v.recorded_at AS d FROM visits v WHERE v.patient_id = a.patient_id
                UNION ALL
                SELECT cv.captured_at::date FROM captured_visits cv WHERE cv.patient_id = a.patient_id
            ) u
        ) AS last_visit
    FROM allocations a
    JOIN patients p ON p.patient_id = a.patient_id
    WHERE a.acs_id = (auth.jwt() ->> 'acs_id')      -- autorização: só a própria lista
      AND a.period_start = p_period_start
    ORDER BY a.priority_order, a.allocated_at, a.patient_id;
$$;

-- Reafirmação explícita (CREATE OR REPLACE preserva isso por si só, já que
-- a assinatura acs_week_list(date) não mudou — mantido aqui por clareza e
-- para deixar a migration auto-suficiente caso alguém a leia isolada).
REVOKE ALL ON FUNCTION acs_week_list(date) FROM public, anon;
GRANT EXECUTE ON FUNCTION acs_week_list(date) TO authenticated;
