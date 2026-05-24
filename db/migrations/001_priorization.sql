-- ============================================================================
-- PRIO-ACS — Motor de priorização (heurística baseada em manuais MS/SUS)
-- ============================================================================
-- Porta o `scripts/gerar_lista_do_dia.py` para SQL puro.
-- Score 0–100 dividido em 4 componentes (ver MASTER_CONTEXT.md §6.4).
--
-- Funções expostas ao frontend via supabase.rpc():
--   priorizacao_pacientes(p_equipe_id, p_ref_date)
--   dashboard_equipe(p_equipe_id, p_ref_date)
--   paciente_detalhe(p_paciente_id, p_ref_date)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. priorizacao_pacientes
-- ----------------------------------------------------------------------------
-- Retorna todos os pacientes de uma equipe com PRIO-ACS calculado.
-- Frontend ordena/limita conforme a tela (ex.: top 8 para a lista do dia).

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
    SELECT * FROM pacientes WHERE pacientes.equipe_id = p_equipe_id
),
last_visit AS (
    SELECT v.paciente_id, MAX(v.registrados_em) AS ultima_visita
    FROM visitas v
    WHERE v.paciente_id IN (SELECT paciente_id FROM pac)
    GROUP BY v.paciente_id
),
last_event AS (
    SELECT DISTINCT ON (e.paciente_id)
        e.paciente_id, e.tipo, e.data_referencia
    FROM eventos e
    WHERE e.paciente_id IN (SELECT paciente_id FROM pac)
    ORDER BY e.paciente_id, e.data_referencia DESC
),
recent_non_elective AS (
    SELECT DISTINCT e.paciente_id
    FROM eventos e
    WHERE e.paciente_id IN (SELECT paciente_id FROM pac)
      AND e.tipo <> 'agendamento'
      AND e.data_referencia >= p_ref_date - INTERVAL '60 days'
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
        -- ICSAP proxy (cap 35) — Portaria SAS/MS 221/2008
        LEAST(
            (CASE WHEN f.hipertenso THEN 15 ELSE 0 END) +
            (CASE WHEN f.diabetico  THEN 15 ELSE 0 END) +
            (CASE WHEN f.gestacao   THEN 15 ELSE 0 END),
            35
        ) AS s_icsap,
        -- Vulnerable life-stage (pega o maior, não soma)
        CASE
            WHEN f.gestacao                                              THEN 25
            WHEN f.faixa_etaria = '0-6'                                  THEN 20
            WHEN f.faixa_etaria = '66+' AND (f.hipertenso OR f.diabetico) THEN 15
            ELSE 0
        END AS s_life_stage,
        -- Social vulnerability
        CASE WHEN f.situacao_vulnerabilidade THEN 15 ELSE 0 END AS s_social,
        -- Care gap / urgency (cap 25)
        LEAST(
            (CASE WHEN f.evento_recente_60d            THEN 15 ELSE 0 END) +
            (CASE WHEN f.dias_gap > f.gap_limite_calc  THEN 10 ELSE 0 END),
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
    -- Tier (Escala de Risco Familiar SIAB/SISAB)
    CASE
        WHEN t.s_total >= 61 THEN 'alto'
        WHEN t.s_total >= 31 THEN 'medio'
        ELSE                       'habitual'
    END                                                                    AS tier,
    -- Cadência sugerida do manual SUS
    CASE
        WHEN t.s_total >= 61 THEN 'Semanal'
        WHEN t.s_total >= 31 THEN 'Quinzenal a mensal'
        ELSE                       'Mensal'
    END                                                                    AS cadencia_oficial,
    -- Linha de cuidado primária (qual Ficha SMS-Rio aplica)
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
    -- motivo_curto (templated)
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
    ) AS motivo_curto
FROM totals t;
$$;


-- ----------------------------------------------------------------------------
-- 2. dashboard_equipe
-- ----------------------------------------------------------------------------
-- Cobertura por linha de cuidado da equipe + alertas críticos.

CREATE OR REPLACE FUNCTION dashboard_equipe(
    p_equipe_id TEXT,
    p_ref_date DATE DEFAULT '2025-12-31'::DATE
)
RETURNS JSONB
LANGUAGE SQL
STABLE
AS $$
WITH terr AS (
    SELECT * FROM priorizacao_pacientes(p_equipe_id, p_ref_date)
),
cob AS (
    SELECT
        linha,
        COUNT(*)                                  AS alvo,
        SUM((NOT gap_vencido)::INT)               AS em_dia,
        SUM(gap_vencido::INT)                     AS atrasados
    FROM (
        SELECT 'gestantes'      AS linha, gap_vencido FROM terr WHERE gestacao UNION ALL
        SELECT 'criancas_0_6',   gap_vencido FROM terr WHERE faixa_etaria = '0-6' UNION ALL
        SELECT 'hipertensos',    gap_vencido FROM terr WHERE hipertenso UNION ALL
        SELECT 'diabeticos',     gap_vencido FROM terr WHERE diabetico
    ) x
    GROUP BY linha
),
alertas AS (
    SELECT
        paciente_id, dias_gap, evento_recente_60d, score
    FROM terr
    WHERE gestacao AND (gap_vencido OR evento_recente_60d)
    ORDER BY score DESC
    LIMIT 5
)
SELECT jsonb_build_object(
    'equipe_id', p_equipe_id,
    'data', p_ref_date,
    'cobertura_por_linha', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'linha', linha,
            'alvo', alvo,
            'em_dia', em_dia,
            'atrasados', atrasados,
            'pct', ROUND(em_dia * 100.0 / alvo, 1)
        )), '[]'::jsonb)
        FROM cob
    ),
    'pacientes_nunca_visitados_pct', (
        SELECT ROUND(SUM((dias_gap >= 9999)::INT) * 100.0 / NULLIF(COUNT(*), 0), 1)
        FROM terr
    ),
    'alertas_criticos', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'tipo', 'gestante_alto_risco_alerta',
            'paciente_id', paciente_id,
            'dias_sem_visita', CASE WHEN dias_gap < 9999 THEN dias_gap END,
            'evento_recente_60d', evento_recente_60d
        )), '[]'::jsonb)
        FROM alertas
    )
);
$$;


-- ----------------------------------------------------------------------------
-- 3. paciente_detalhe
-- ----------------------------------------------------------------------------
-- Detalhe de um paciente: features de priorização + últimos eventos e visitas.

CREATE OR REPLACE FUNCTION paciente_detalhe(
    p_paciente_id TEXT,
    p_ref_date DATE DEFAULT '2025-12-31'::DATE
)
RETURNS JSONB
LANGUAGE SQL
STABLE
AS $$
WITH eq AS (
    SELECT equipe_id FROM pacientes WHERE paciente_id = p_paciente_id
),
prio AS (
    SELECT * FROM priorizacao_pacientes((SELECT equipe_id FROM eq), p_ref_date)
    WHERE paciente_id = p_paciente_id
),
hist_visitas AS (
    SELECT registrados_em, profissional_id
    FROM visitas
    WHERE paciente_id = p_paciente_id
    ORDER BY registrados_em DESC
    LIMIT 10
),
hist_eventos AS (
    SELECT tipo, data_referencia
    FROM eventos
    WHERE paciente_id = p_paciente_id
    ORDER BY data_referencia DESC
    LIMIT 10
)
SELECT jsonb_build_object(
    'paciente', to_jsonb(prio.*),
    'visitas_recentes', (
        SELECT COALESCE(jsonb_agg(to_jsonb(hv)), '[]'::jsonb) FROM hist_visitas hv
    ),
    'eventos_recentes', (
        SELECT COALESCE(jsonb_agg(to_jsonb(he)), '[]'::jsonb) FROM hist_eventos he
    )
) FROM prio;
$$;


-- ----------------------------------------------------------------------------
-- 4. Grants para o role anon (PostgREST expõe via supabase.rpc())
-- ----------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION priorizacao_pacientes(TEXT, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION dashboard_equipe(TEXT, DATE)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION paciente_detalhe(TEXT, DATE)     TO anon, authenticated;
