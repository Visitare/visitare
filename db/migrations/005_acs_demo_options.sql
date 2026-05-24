-- ============================================================================
-- acs_demo_options — lista de ACSs para o picker da demo
-- ----------------------------------------------------------------------------
-- Em produção, o ACS faz login via ConecteSUS e o profissional_id vem do
-- claim do JWT. Para a demo do hackathon, escolhemos 1 profissional por
-- equipe (o mais ativo), com estatísticas da equipe para o picker
-- mostrar contexto.
-- ============================================================================

CREATE OR REPLACE FUNCTION acs_demo_options()
RETURNS TABLE (
    profissional_id TEXT,
    equipe_id       TEXT,
    n_pacientes     INT,
    n_gestantes     INT,
    n_cronicos      INT,
    n_vulneraveis   INT,
    n_visitas_2025  INT
)
LANGUAGE SQL
STABLE
AS $$
WITH equipe_stats AS (
    SELECT equipe_id,
           COUNT(*)::INT                            AS n_pacientes,
           SUM(gestacao::INT)::INT                  AS n_gestantes,
           SUM((hipertenso OR diabetico)::INT)::INT AS n_cronicos,
           SUM(situacao_vulnerabilidade::INT)::INT  AS n_vulneraveis
    FROM pacientes
    GROUP BY equipe_id
),
prof_da_equipe AS (
    SELECT p.equipe_id, v.profissional_id, COUNT(*)::INT AS visitas_prof
    FROM visitas v JOIN pacientes p USING (paciente_id)
    GROUP BY p.equipe_id, v.profissional_id
),
prof_principal AS (
    SELECT DISTINCT ON (equipe_id)
        equipe_id, profissional_id, visitas_prof
    FROM prof_da_equipe
    ORDER BY equipe_id, visitas_prof DESC
)
SELECT
    pp.profissional_id,
    pp.equipe_id,
    es.n_pacientes,
    es.n_gestantes,
    es.n_cronicos,
    es.n_vulneraveis,
    pp.visitas_prof AS n_visitas_2025
FROM prof_principal pp
JOIN equipe_stats es USING (equipe_id)
ORDER BY es.n_gestantes DESC NULLS LAST, es.n_cronicos DESC
LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION acs_demo_options() TO anon, authenticated;
