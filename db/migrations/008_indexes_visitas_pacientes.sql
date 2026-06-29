-- ============================================================================
-- 008_indexes_visitas_pacientes — índices de performance nas tabelas base
-- ----------------------------------------------------------------------------
-- As tabelas `visitas` (~160k linhas) e `pacientes` (~98k linhas) foram
-- importadas por bulk load e não tinham nenhum índice além da PK. Sem índice,
-- toda query que junta visitas↔pacientes ou filtra/agrupa por equipe faz
-- sequential scan e estoura o `statement_timeout` do role `anon` (~3s).
--
-- Sintoma: o RPC `acs_demo_options` (primeira tela do PWA) intermitentemente
-- retornava `57014 — canceling statement due to statement timeout` (HTTP 500),
-- resultando em tela branca no acs.visitare.app.
--
-- Estes índices são a base de performance durável — valem para o dataset de
-- demo E para o banco vivo da prefeitura, acelerando acs_demo_options,
-- priorizacao_pacientes, equipe_do_profissional e as inserções de captura.
-- ============================================================================

-- JOIN visitas v JOIN pacientes p USING (paciente_id)
CREATE INDEX IF NOT EXISTS visitas_paciente_id_idx
    ON visitas (paciente_id);

-- GROUP BY profissional_id + lookups "visitas do profissional"
CREATE INDEX IF NOT EXISTS visitas_profissional_id_idx
    ON visitas (profissional_id);

-- GROUP BY equipe_id (equipe_stats) + filtro p_equipe_id em priorizacao
CREATE INDEX IF NOT EXISTS pacientes_equipe_id_idx
    ON pacientes (equipe_id);

-- Atualiza estatísticas do planner para os novos índices entrarem em uso
ANALYZE visitas;
ANALYZE pacientes;
