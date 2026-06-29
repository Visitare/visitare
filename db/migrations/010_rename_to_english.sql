-- ============================================================================
-- 010 — Rename schema to English (see docs/naming-map.md)
-- ----------------------------------------------------------------------------
-- ALTER ... RENAME preserves data, indexes and constraints (they track column
-- identity, not name). Legacy PT RPCs/views are DROPPED — they are superseded
-- by the engine-SSOT model (ADR 0001); the surviving ones are rebuilt lean in
-- English in migration 011 during the PWA rewire.
--
-- The engine reads tables directly (not RPCs), so dropping RPCs does not affect
-- the engine→allocations loop.
--
-- Rollback: this is a wide rename; restore from a pre-010 snapshot/branch DB.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Drop legacy PT RPCs/views first (they reference the old names).
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS priorizacao_pacientes(TEXT, DATE);
DROP FUNCTION IF EXISTS dashboard_equipe(TEXT, DATE);
DROP FUNCTION IF EXISTS paciente_detalhe(TEXT, DATE);
DROP FUNCTION IF EXISTS acs_demo_options();
DROP FUNCTION IF EXISTS equipe_do_profissional(TEXT);
DROP VIEW IF EXISTS pacientes_ficha_extendida;

-- ----------------------------------------------------------------------------
-- 1. patients (ex pacientes)
-- ----------------------------------------------------------------------------
ALTER TABLE pacientes RENAME TO patients;
ALTER TABLE patients RENAME COLUMN paciente_id              TO patient_id;
ALTER TABLE patients RENAME COLUMN equipe_id                TO team_id;
ALTER TABLE patients RENAME COLUMN unidade_id               TO unit_id;
ALTER TABLE patients RENAME COLUMN faixa_etaria             TO age_band;
ALTER TABLE patients RENAME COLUMN sexo                     TO sex;
ALTER TABLE patients RENAME COLUMN raca_cor                 TO race_color;
ALTER TABLE patients RENAME COLUMN situacao_vulnerabilidade TO social_vulnerability;
ALTER TABLE patients RENAME COLUMN endereco_latitude        TO latitude;
ALTER TABLE patients RENAME COLUMN endereco_longitude       TO longitude;
ALTER TABLE patients RENAME COLUMN hipertenso               TO hypertensive;
ALTER TABLE patients RENAME COLUMN diabetico                TO diabetic;
ALTER TABLE patients RENAME COLUMN gestacao                 TO pregnant;

-- ----------------------------------------------------------------------------
-- 2. visits (ex visitas)
-- ----------------------------------------------------------------------------
ALTER TABLE visitas RENAME TO visits;
ALTER TABLE visits RENAME COLUMN paciente_id      TO patient_id;
ALTER TABLE visits RENAME COLUMN profissional_id  TO professional_id;
ALTER TABLE visits RENAME COLUMN registrados_em   TO recorded_at;
ALTER TABLE visits RENAME COLUMN ordem_visita_dia TO daily_visit_order;

-- ----------------------------------------------------------------------------
-- 3. captured_visits (ex visitas_capturadas)
-- ----------------------------------------------------------------------------
ALTER TABLE visitas_capturadas RENAME TO captured_visits;
ALTER TABLE captured_visits RENAME COLUMN paciente_id           TO patient_id;
ALTER TABLE captured_visits RENAME COLUMN profissional_id       TO professional_id;
ALTER TABLE captured_visits RENAME COLUMN capturado_em          TO captured_at;
ALTER TABLE captured_visits RENAME COLUMN perfil_blocos         TO profile_blocks;
ALTER TABLE captured_visits RENAME COLUMN sincronizado_vitacare TO synced_vitacare;
ALTER TABLE captured_visits RENAME COLUMN sincronizado_em       TO synced_at;

-- ----------------------------------------------------------------------------
-- 4. events (ex eventos)
-- ----------------------------------------------------------------------------
ALTER TABLE eventos RENAME TO events;
ALTER TABLE events RENAME COLUMN paciente_id     TO patient_id;
ALTER TABLE events RENAME COLUMN tipo            TO type;
ALTER TABLE events RENAME COLUMN data_referencia TO reference_date;

-- ----------------------------------------------------------------------------
-- 5. teams (ex equipes)
-- ----------------------------------------------------------------------------
ALTER TABLE equipes RENAME TO teams;
ALTER TABLE teams RENAME COLUMN equipe_id          TO team_id;
ALTER TABLE teams RENAME COLUMN endereco_latitude  TO latitude;
ALTER TABLE teams RENAME COLUMN endereco_longitude TO longitude;

-- ----------------------------------------------------------------------------
-- 6. allocations — column renames + value/constraint migration
-- ----------------------------------------------------------------------------
ALTER TABLE allocations RENAME COLUMN clinic_id   TO team_id;
ALTER TABLE allocations RENAME COLUMN paciente_id TO patient_id;
ALTER TABLE allocations RENAME COLUMN motivo      TO reason;

-- tier: alto/medio/habitual -> high/medium/routine
ALTER TABLE allocations DROP CONSTRAINT IF EXISTS allocations_tier_check;
UPDATE allocations SET tier = CASE tier
    WHEN 'alto'     THEN 'high'
    WHEN 'medio'    THEN 'medium'
    WHEN 'habitual' THEN 'routine'
    ELSE tier END;
ALTER TABLE allocations ADD CONSTRAINT allocations_tier_check
    CHECK (tier IN ('high', 'medium', 'routine'));

-- origin: gestor -> manager
ALTER TABLE allocations DROP CONSTRAINT IF EXISTS allocations_origin_check;
UPDATE allocations SET origin = 'manager' WHERE origin = 'gestor';
ALTER TABLE allocations ADD CONSTRAINT allocations_origin_check
    CHECK (origin IN ('engine', 'manager', 'acs'));
