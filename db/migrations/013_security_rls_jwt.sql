-- ============================================================================
-- 013 — Segurança: RLS + RPCs autorizadas por JWT (fecha achados do review)
-- ----------------------------------------------------------------------------
-- Antes: RLS off em allocations + anon com acesso; acs_week_list/patient_detail
-- aceitavam acs_id/patient_id como parâmetro livre (IDOR) e expunham PHI ao
-- role anon (publishable key, pública). Ver security review.
--
-- Agora:
--   - RPCs viram SECURITY DEFINER e derivam acs_id/team_id do JWT (auth.jwt()),
--     não confiam mais em parâmetro. São o ÚNICO caminho de leitura de dado
--     clínico do PWA.
--   - anon perde EXECUTE nas RPCs e SELECT/INSERT/UPDATE nas tabelas de dado.
--   - RLS ligada em allocations + captured_visits.
--   - Só `authenticated` (ACS logado) acessa.
--
-- search_path fixo em DEFINER para evitar hijack de objetos.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. acs_week_list — deriva o acs_id do JWT (remove o parâmetro p_acs_id)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS acs_week_list(text, date);

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
    ORDER BY a.priority_order;
$$;

REVOKE ALL ON FUNCTION acs_week_list(date) FROM public, anon;
GRANT EXECUTE ON FUNCTION acs_week_list(date) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. patient_detail — LIMIT 1 (robustez) + autorização por team do JWT
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS patient_detail(text, date);

CREATE OR REPLACE FUNCTION patient_detail(
    p_patient_id   text,
    p_period_start date DEFAULT '2025-12-31'::date
)
RETURNS jsonb
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE WHEN EXISTS (
        -- autorização: paciente precisa ser do team do ACS logado
        SELECT 1 FROM patients
        WHERE patient_id = p_patient_id
          AND team_id = (auth.jwt() ->> 'team_id')
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
                LIMIT 1                         -- robustez: nunca >1 linha
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
            SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.captured_at DESC), '[]'::jsonb)
            FROM (SELECT captured_at, professional_id, profile_blocks, payload FROM captured_visits
                  WHERE patient_id = p_patient_id ORDER BY captured_at DESC LIMIT 10) c
        )
    ) ELSE NULL END;
$$;

REVOKE ALL ON FUNCTION patient_detail(text, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION patient_detail(text, date) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. RLS em allocations + tira anon (defesa em profundidade; RPC já é DEFINER)
-- ----------------------------------------------------------------------------
ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE ON allocations FROM anon;

DROP POLICY IF EXISTS acs_read_own_allocations ON allocations;
CREATE POLICY acs_read_own_allocations ON allocations
    FOR SELECT TO authenticated
    USING (acs_id = (auth.jwt() ->> 'acs_id'));

-- ----------------------------------------------------------------------------
-- 4. Tira o anon das tabelas de dado (leitura clínica só via RPC DEFINER)
-- ----------------------------------------------------------------------------
REVOKE SELECT ON patients FROM anon;
REVOKE SELECT ON visits   FROM anon;
REVOKE SELECT ON events   FROM anon;
REVOKE SELECT, INSERT, UPDATE ON captured_visits FROM anon;

-- O front (autenticado) precisa: ler geo da equipe + inserir captura.
GRANT SELECT ON teams TO authenticated;
REVOKE SELECT ON teams FROM anon;
GRANT INSERT ON captured_visits TO authenticated;

-- Integridade da captura: ACS só insere/lê as próprias.
ALTER TABLE captured_visits ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON captured_visits TO authenticated;   -- realtime precisa de SELECT

DROP POLICY IF EXISTS acs_insert_own_capture ON captured_visits;
CREATE POLICY acs_insert_own_capture ON captured_visits
    FOR INSERT TO authenticated
    WITH CHECK (professional_id = (auth.jwt() ->> 'acs_id'));

DROP POLICY IF EXISTS acs_read_own_capture ON captured_visits;
CREATE POLICY acs_read_own_capture ON captured_visits
    FOR SELECT TO authenticated
    USING (professional_id = (auth.jwt() ->> 'acs_id'));
