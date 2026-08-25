-- ============================================================================
-- 011 — RPCs do PWA lendo o engine (SSOT): acs_week_list + patient_detail
-- ----------------------------------------------------------------------------
-- Substituem as RPCs PT legadas (dropadas na 010). A lista da semana agora vem
-- de `allocations` (saída do engine), filtrada pelo `acs_id` do ACS logado
-- (claim do JWT). Ver ADR 0001.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- acs_week_list — a lista da semana de UM ACS (allocations JOIN patients)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION acs_week_list(
    p_acs_id       text,
    p_period_start date DEFAULT '2025-12-31'::date
)
RETURNS TABLE (
    patient_id          text,
    team_id             text,
    age_band            text,
    sex                 text,
    race_color          text,
    social_vulnerability boolean,
    latitude            double precision,
    longitude           double precision,
    hypertensive        boolean,
    diabetic            boolean,
    pregnant            boolean,
    priority_order      int,
    score               int,
    score_icsap         int,
    score_life_stage    int,
    score_care_gap      int,
    score_social        int,
    tier                text,
    reason              text,
    status              text,
    last_visit          date
)
LANGUAGE SQL
STABLE
AS $$
    SELECT
        a.patient_id,
        a.team_id,
        p.age_band,
        p.sex,
        p.race_color,
        p.social_vulnerability,
        p.latitude,
        p.longitude,
        p.hypertensive,
        p.diabetic,
        p.pregnant,
        a.priority_order,
        a.score,
        a.score_icsap,
        a.score_life_stage,
        a.score_care_gap,
        a.score_social,
        a.tier,
        a.reason,
        a.status,
        (
            SELECT MAX(d) FROM (
                SELECT v.recorded_at AS d
                FROM visits v WHERE v.patient_id = a.patient_id
                UNION ALL
                SELECT cv.captured_at::date
                FROM captured_visits cv WHERE cv.patient_id = a.patient_id
            ) u
        ) AS last_visit
    FROM allocations a
    JOIN patients p ON p.patient_id = a.patient_id
    WHERE a.acs_id = p_acs_id
      AND a.period_start = p_period_start
    ORDER BY a.priority_order;
$$;

-- ----------------------------------------------------------------------------
-- patient_detail — ficha do paciente: alocação atual + visitas/eventos/capturas
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION patient_detail(
    p_patient_id   text,
    p_period_start date DEFAULT '2025-12-31'::date
)
RETURNS jsonb
LANGUAGE SQL
STABLE
AS $$
    SELECT jsonb_build_object(
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
            ) pp
        ),
        'recent_visits', (
            SELECT COALESCE(jsonb_agg(to_jsonb(v) ORDER BY v.recorded_at DESC), '[]'::jsonb)
            FROM (
                SELECT recorded_at, professional_id
                FROM visits WHERE patient_id = p_patient_id
                ORDER BY recorded_at DESC LIMIT 10
            ) v
        ),
        'recent_events', (
            SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.reference_date DESC), '[]'::jsonb)
            FROM (
                SELECT type, reference_date
                FROM events WHERE patient_id = p_patient_id
                ORDER BY reference_date DESC LIMIT 10
            ) e
        ),
        'recent_captures', (
            SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.captured_at DESC), '[]'::jsonb)
            FROM (
                SELECT captured_at, professional_id, profile_blocks, payload
                FROM captured_visits WHERE patient_id = p_patient_id
                ORDER BY captured_at DESC LIMIT 10
            ) c
        )
    );
$$;

GRANT EXECUTE ON FUNCTION acs_week_list(text, date)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION patient_detail(text, date) TO anon, authenticated;
