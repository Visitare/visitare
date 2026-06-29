-- ============================================================================
-- 010 DOWN — reverte o rename para português (rollback da 010)
-- ----------------------------------------------------------------------------
-- ALTER ... RENAME de volta + restaura valores tier/origin. As RPCs/views PT
-- legadas NÃO voltam aqui (foram dropadas); para recuperá-las, reaplique
-- 001_priorization, 003_ficha_extendida, 004_motivo_inclui_captura e
-- 005_acs_demo_options nessa ordem.
-- ============================================================================

-- allocations: valores + colunas
ALTER TABLE allocations DROP CONSTRAINT IF EXISTS allocations_origin_check;
UPDATE allocations SET origin = 'gestor' WHERE origin = 'manager';
ALTER TABLE allocations ADD CONSTRAINT allocations_origin_check
    CHECK (origin IN ('engine', 'gestor', 'acs'));

ALTER TABLE allocations DROP CONSTRAINT IF EXISTS allocations_tier_check;
UPDATE allocations SET tier = CASE tier
    WHEN 'high'    THEN 'alto'
    WHEN 'medium'  THEN 'medio'
    WHEN 'routine' THEN 'habitual'
    ELSE tier END;
ALTER TABLE allocations ADD CONSTRAINT allocations_tier_check
    CHECK (tier IN ('alto', 'medio', 'habitual'));

ALTER TABLE allocations RENAME COLUMN reason     TO motivo;
ALTER TABLE allocations RENAME COLUMN patient_id TO paciente_id;
ALTER TABLE allocations RENAME COLUMN team_id    TO clinic_id;

-- teams -> equipes
ALTER TABLE teams RENAME COLUMN longitude TO endereco_longitude;
ALTER TABLE teams RENAME COLUMN latitude  TO endereco_latitude;
ALTER TABLE teams RENAME COLUMN team_id   TO equipe_id;
ALTER TABLE teams RENAME TO equipes;

-- events -> eventos
ALTER TABLE events RENAME COLUMN reference_date TO data_referencia;
ALTER TABLE events RENAME COLUMN type           TO tipo;
ALTER TABLE events RENAME COLUMN patient_id      TO paciente_id;
ALTER TABLE events RENAME TO eventos;

-- captured_visits -> visitas_capturadas
ALTER TABLE captured_visits RENAME COLUMN synced_at       TO sincronizado_em;
ALTER TABLE captured_visits RENAME COLUMN synced_vitacare TO sincronizado_vitacare;
ALTER TABLE captured_visits RENAME COLUMN profile_blocks  TO perfil_blocos;
ALTER TABLE captured_visits RENAME COLUMN captured_at     TO capturado_em;
ALTER TABLE captured_visits RENAME COLUMN professional_id TO profissional_id;
ALTER TABLE captured_visits RENAME COLUMN patient_id      TO paciente_id;
ALTER TABLE captured_visits RENAME TO visitas_capturadas;

-- visits -> visitas
ALTER TABLE visits RENAME COLUMN daily_visit_order TO ordem_visita_dia;
ALTER TABLE visits RENAME COLUMN recorded_at       TO registrados_em;
ALTER TABLE visits RENAME COLUMN professional_id   TO profissional_id;
ALTER TABLE visits RENAME COLUMN patient_id        TO paciente_id;
ALTER TABLE visits RENAME TO visitas;

-- patients -> pacientes
ALTER TABLE patients RENAME COLUMN pregnant            TO gestacao;
ALTER TABLE patients RENAME COLUMN diabetic            TO diabetico;
ALTER TABLE patients RENAME COLUMN hypertensive        TO hipertenso;
ALTER TABLE patients RENAME COLUMN longitude           TO endereco_longitude;
ALTER TABLE patients RENAME COLUMN latitude            TO endereco_latitude;
ALTER TABLE patients RENAME COLUMN social_vulnerability TO situacao_vulnerabilidade;
ALTER TABLE patients RENAME COLUMN race_color          TO raca_cor;
ALTER TABLE patients RENAME COLUMN sex                 TO sexo;
ALTER TABLE patients RENAME COLUMN age_band            TO faixa_etaria;
ALTER TABLE patients RENAME COLUMN unit_id             TO unidade_id;
ALTER TABLE patients RENAME COLUMN team_id             TO equipe_id;
ALTER TABLE patients RENAME COLUMN patient_id          TO paciente_id;
ALTER TABLE patients RENAME TO pacientes;
