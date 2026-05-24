-- ============================================================================
-- motivo_curto: cita visita do ACS quando captura recente
-- ----------------------------------------------------------------------------
-- Antes: paciente visitado hoje continuava com motivo "foi a urgencia ha
-- 13 dias", confundindo o ACS sobre se o motor enxergou a visita.
-- Agora: anexa "Visitada hoje pelo ACS." (ou "essa semana") quando o
-- capturado_em mais recente é nas últimas 24h / 7 dias.
-- ============================================================================

CREATE OR REPLACE FUNCTION priorizacao_pacientes(
    p_equipe_id TEXT,
    p_ref_date DATE DEFAULT '2025-12-31'::DATE
)
RETURNS TABLE (
    paciente_id              TEXT,
    equipe_id                TEXT,
    nome_display             TEXT,
    faixa_etaria             TEXT,
    sexo                     TEXT,
    raca_cor                 TEXT,
    hipertenso               BOOLEAN,
    diabetico                BOOLEAN,
    gestacao                 BOOLEAN,
    situacao_vulnerabilidade BOOLEAN,
    endereco_latitude        DOUBLE PRECISION,
    endereco_longitude       DOUBLE PRECISION,
    score                    INT,
    score_icsap              INT,
    score_life_stage         INT,
    score_care_gap           INT,
    score_social             INT,
    tier                     TEXT,
    cadencia_oficial         TEXT,
    linha_de_cuidado         TEXT,
    ultima_visita            DATE,
    dias_gap                 INT,
    gap_limite               INT,
    gap_vencido              BOOLEAN,
    evento_recente_60d       BOOLEAN,
    ultimo_evento_tipo       TEXT,
    ultimo_evento_data       DATE,
    motivo_curto             TEXT
)
LANGUAGE SQL
STABLE
AS $$
WITH pac AS (
    SELECT * FROM pacientes_ficha_extendida WHERE pacientes_ficha_extendida.equipe_id = p_equipe_id
),
last_visit AS (
    SELECT paciente_id, MAX(d) AS ultima_visita
    FROM (
        SELECT v.paciente_id, v.registrados_em AS d
        FROM visitas v
        WHERE v.paciente_id IN (SELECT paciente_id FROM pac)
        UNION ALL
        SELECT vc.paciente_id, vc.capturado_em::date
        FROM visitas_capturadas vc
        WHERE vc.paciente_id IN (SELECT paciente_id FROM pac)
    ) u
    GROUP BY paciente_id
),
last_event AS (
    SELECT DISTINCT ON (e.paciente_id) e.paciente_id, e.tipo, e.data_referencia
    FROM eventos e
    WHERE e.paciente_id IN (SELECT paciente_id FROM pac)
    ORDER BY e.paciente_id, e.data_referencia DESC
),
recent_non_elective AS (
    SELECT DISTINCT paciente_id FROM (
        SELECT e.paciente_id
        FROM eventos e
        WHERE e.paciente_id IN (SELECT paciente_id FROM pac)
          AND e.tipo <> 'agendamento'
          AND e.data_referencia >= p_ref_date - INTERVAL '60 days'
        UNION
        SELECT pac.paciente_id
        FROM pac
        WHERE pac.ultima_captura_em IS NOT NULL
          AND pac.ultima_captura_em::date >= p_ref_date - INTERVAL '60 days'
          AND (
            pac.form_upa_emergencia
            OR pac.form_gestante_upa
            OR pac.form_gestante_sangramento
            OR pac.form_gestante_bebe_nao_mexeu
          )
    ) u
),
features AS (
    SELECT
        pac.*,
        lv.ultima_visita,
        le.tipo                AS ultimo_evento_tipo,
        le.data_referencia     AS ultimo_evento_data,
        (rne.paciente_id IS NOT NULL) AS evento_recente_60d,
        COALESCE((p_ref_date - lv.ultima_visita)::INT, 9999) AS dias_gap,
        CASE
            WHEN pac.gestacao                       THEN 30
            WHEN pac.faixa_etaria = '0-6'           THEN 45
            WHEN pac.hipertenso OR pac.diabetico    THEN 90
            ELSE                                         180
        END AS gap_limite_calc
    FROM pac
    LEFT JOIN last_visit lv         USING (paciente_id)
    LEFT JOIN last_event le         USING (paciente_id)
    LEFT JOIN recent_non_elective rne USING (paciente_id)
),
scored AS (
    SELECT
        f.*,
        LEAST(
            (CASE WHEN f.hipertenso THEN 15 ELSE 0 END) +
            (CASE WHEN f.diabetico  THEN 15 ELSE 0 END) +
            (CASE WHEN f.gestacao   THEN 15 ELSE 0 END),
            35
        ) AS s_icsap,
        CASE
            WHEN f.gestacao                                              THEN 25
            WHEN f.faixa_etaria = '0-6'                                  THEN 20
            WHEN f.faixa_etaria = '66+' AND (f.hipertenso OR f.diabetico) THEN 15
            ELSE 0
        END AS s_life_stage,
        CASE WHEN f.situacao_vulnerabilidade THEN 15 ELSE 0 END AS s_social,
        LEAST(
            (CASE WHEN f.evento_recente_60d           THEN 15 ELSE 0 END) +
            (CASE WHEN f.dias_gap > f.gap_limite_calc THEN 10 ELSE 0 END),
            25
        ) AS s_care_gap,
        (f.dias_gap > f.gap_limite_calc) AS gap_vencido_calc
    FROM features f
),
totals AS (
    SELECT
        s.*,
        (s.s_icsap + s.s_life_stage + s.s_care_gap + s.s_social) AS s_total
    FROM scored s
)
SELECT
    t.paciente_id,
    t.equipe_id,
    'Paciente ' || RIGHT(t.paciente_id, 5)                                 AS nome_display,
    t.faixa_etaria,
    t.sexo,
    t.raca_cor,
    t.hipertenso,
    t.diabetico,
    t.gestacao,
    t.situacao_vulnerabilidade,
    t.endereco_latitude,
    t.endereco_longitude,
    t.s_total                                                              AS score,
    t.s_icsap                                                              AS score_icsap,
    t.s_life_stage                                                         AS score_life_stage,
    t.s_care_gap                                                           AS score_care_gap,
    t.s_social                                                             AS score_social,
    CASE
        WHEN t.s_total >= 61 THEN 'alto'
        WHEN t.s_total >= 31 THEN 'medio'
        ELSE                       'habitual'
    END                                                                    AS tier,
    CASE
        WHEN t.s_total >= 61 THEN 'Semanal'
        WHEN t.s_total >= 31 THEN 'Quinzenal a mensal'
        ELSE                       'Mensal'
    END                                                                    AS cadencia_oficial,
    CASE
        WHEN t.gestacao                          THEN 'ficha_b_gestante'
        WHEN t.faixa_etaria = '0-6'              THEN 'ficha_c_primeira_infancia'
        WHEN t.hipertenso OR t.diabetico         THEN 'ficha_b_cronico'
        ELSE                                          'ficha_a_cadastro_familia'
    END                                                                    AS linha_de_cuidado,
    t.ultima_visita,
    t.dias_gap,
    t.gap_limite_calc                                                      AS gap_limite,
    t.gap_vencido_calc                                                     AS gap_vencido,
    t.evento_recente_60d,
    t.ultimo_evento_tipo,
    t.ultimo_evento_data,
    (
        CASE
            WHEN t.gestacao AND (t.diabetico OR t.hipertenso) THEN
                'Gestante' ||
                CASE WHEN t.diabetico AND t.hipertenso THEN ' diabetica e hipertensa'
                     WHEN t.diabetico THEN ' diabetica'
                     ELSE ' hipertensa' END
            WHEN t.gestacao                                THEN 'Gestante'
            WHEN t.diabetico AND t.hipertenso              THEN 'Diabetico e hipertenso'
            WHEN t.diabetico                               THEN 'Diabetico'
            WHEN t.hipertenso                              THEN 'Hipertenso'
            WHEN t.faixa_etaria = '0-6'                    THEN 'Crianca 0-6 anos'
            WHEN t.faixa_etaria = '66+'                    THEN 'Idoso 66+'
            ELSE                                                'Paciente ' || t.faixa_etaria
        END
        ||
        CASE
            WHEN t.ultimo_evento_tipo = 'urgencia-emergencia-ou-internacao'
                AND (p_ref_date - t.ultimo_evento_data) <= 30
                THEN ', foi a urgencia ha ' || (p_ref_date - t.ultimo_evento_data) || ' dias'
            WHEN t.dias_gap >= 9999 THEN ', nunca visitado em 2025'
            WHEN t.gap_vencido_calc THEN ', sem visita ha ' || t.dias_gap || ' dias'
            ELSE ''
        END
        ||
        CASE WHEN t.situacao_vulnerabilidade THEN ', vulnerabilidade social' ELSE '' END
        || '.'
        ||
        -- NOVO: anota visita recente do ACS — deixa óbvio que o motor sabe
        CASE
            WHEN t.ultima_captura_em IS NOT NULL
             AND t.ultima_captura_em >= NOW() - INTERVAL '24 hours'
            THEN ' Visitada hoje pelo ACS.'
            WHEN t.ultima_captura_em IS NOT NULL
             AND t.ultima_captura_em >= NOW() - INTERVAL '7 days'
            THEN ' Visitada essa semana pelo ACS.'
            ELSE ''
        END
    ) AS motivo_curto
FROM totals t;
$$;

GRANT EXECUTE ON FUNCTION priorizacao_pacientes(TEXT, DATE) TO anon, authenticated;
