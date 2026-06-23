-- ============================================================================
-- allocations — output table written by the PRIO-ACS engine
-- ----------------------------------------------------------------------------
-- The engine scores all patients and writes one row per patient-ACS pair.
-- The app reads this table; it never calls the engine directly.
-- Human edits (gestor, acs) are preserved across engine re-runs via origin.
-- Spec: docs/engine-spec.md §6 + prio-acs-engine-upgrade-spec-v0.2.md
-- ============================================================================

CREATE TABLE IF NOT EXISTS allocations (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id        text NOT NULL,          -- equipe_id
    acs_id           text NOT NULL,          -- profissional_id
    paciente_id      text NOT NULL,
    period_start     date NOT NULL,
    period_mode      text NOT NULL DEFAULT 'weekly',  -- 'daily' | 'weekly'
    priority_order   int  NOT NULL,
    score            int  NOT NULL,
    score_icsap      int  NOT NULL DEFAULT 0,
    score_life_stage int  NOT NULL DEFAULT 0,
    score_care_gap   int  NOT NULL DEFAULT 0,
    score_social     int  NOT NULL DEFAULT 0,
    tier             text NOT NULL,           -- 'alto' | 'medio' | 'habitual'
    motivo           text,
    status           text NOT NULL DEFAULT 'pending',
    --   'pending'  — not yet visited this period
    --   'visited'  — ACS marked done
    --   'skipped'  — ACS explicitly skipped
    --   'overflow' — above patient_cap; flagged for supervisor
    --   'dropped'  — engine removed (engine-origin only)
    origin           text NOT NULL DEFAULT 'engine',
    --   'engine'   — engine-generated; engine may recalculate on re-run
    --   'gestor'   — supervisor-added; engine never touches
    --   'acs'      — ACS field-added; engine never touches
    allocated_at     timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT allocations_status_check
        CHECK (status IN ('pending', 'visited', 'skipped', 'overflow', 'dropped')),
    CONSTRAINT allocations_origin_check
        CHECK (origin IN ('engine', 'gestor', 'acs')),
    CONSTRAINT allocations_tier_check
        CHECK (tier IN ('alto', 'medio', 'habitual')),

    -- Upsert key: one engine row per (patient, acs, period)
    CONSTRAINT allocations_upsert_key
        UNIQUE (clinic_id, acs_id, paciente_id, period_start)
);

-- "Which list is this patient on right now?"
CREATE INDEX IF NOT EXISTS allocations_paciente_period_idx
    ON allocations (paciente_id, period_start);

-- "Give me this ACS's current ordered list"
CREATE INDEX IF NOT EXISTS allocations_acs_period_idx
    ON allocations (acs_id, period_start, priority_order);

-- "Show supervisor all pending Alto for this clinic"
CREATE INDEX IF NOT EXISTS allocations_clinic_tier_idx
    ON allocations (clinic_id, period_start, tier, status);

-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;

-- ACS: read own list for the current period
CREATE POLICY "acs_read_own_allocations" ON allocations
    FOR SELECT
    USING (acs_id = (auth.jwt() ->> 'acs_id'));

-- ACS: update status (mark visited / skipped)
CREATE POLICY "acs_update_own_status" ON allocations
    FOR UPDATE
    USING (acs_id = (auth.jwt() ->> 'acs_id'))
    WITH CHECK (
        status IN ('visited', 'skipped')
        AND (auth.jwt() ->> 'acs_id') IS NOT NULL
    );

-- ACS: insert a patient they found on the route (case b — existing patient)
CREATE POLICY "acs_insert_own_allocation" ON allocations
    FOR INSERT
    WITH CHECK (
        origin = 'acs'
        AND acs_id = (auth.jwt() ->> 'acs_id')
    );

-- Gestor de clínica: read + edit all allocations in their clinic
CREATE POLICY "gestor_read_clinic_allocations" ON allocations
    FOR SELECT
    USING (clinic_id = (auth.jwt() ->> 'clinica_id'));

CREATE POLICY "gestor_update_clinic_allocations" ON allocations
    FOR UPDATE
    USING (clinic_id = (auth.jwt() ->> 'clinica_id'));

CREATE POLICY "gestor_insert_clinic_allocations" ON allocations
    FOR INSERT
    WITH CHECK (
        origin = 'gestor'
        AND clinic_id = (auth.jwt() ->> 'clinica_id')
    );

-- Engine (service_role) bypasses RLS — no policy needed.

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON allocations TO authenticated;
