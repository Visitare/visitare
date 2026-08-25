-- ============================================================================
-- 000 — Base schema (squash of db/migrations/001..010)
-- ----------------------------------------------------------------------------
-- Consolida, já em inglês (docs/naming-map.md), o efeito líquido do que hoje
-- só existe fora de versionamento (scripts/setup_supabase.py:SCHEMA) mais as
-- migrations históricas 001-010 (db/migrations/, ver VISI-11).
--
-- O que NÃO entra aqui, de propósito:
--   - RPCs/view em português (priorizacao_pacientes, dashboard_equipe,
--     paciente_detalhe, equipe_do_profissional, pacientes_ficha_extendida,
--     acs_demo_options): criadas em 001/003/004/005 e DROPADAS pela 010
--     original — nunca chegam ao estado atual, então squash não as recria.
--   - Policies de allocations criadas na 006 (acs_read_own_allocations,
--     acs_update_own_status, acs_insert_own_allocation, gestor_*): a 007
--     (abaixo) desliga RLS antes de qualquer uma delas importar, e a 013/014
--     (supabase/migrations seguintes) recriam/derrubam do zero. Recriar aqui
--     um estado que nunca fica ativo só para ser dropado depois é ruído.
--
-- O que ENTRA, como efeito líquido de 002 (realtime) + 006 (allocations) +
-- 007 (RLS off no MVP) + 008 (índices) + 009 (professionals + hook) + 010
-- (rename PT→EN, incluindo os valores de tier/origin):
--   - as 5 tabelas base já com nomes/colunas em inglês;
--   - allocations, já com team_id/patient_id/reason e os CHECKs em inglês;
--   - professionals + custom_access_token_hook (mesmo corpo de 009 — 012, a
--     próxima migration desta pasta, reaplica o mesmo corpo, um no-op hoje);
--   - REPLICA IDENTITY + supabase_realtime publication;
--   - os índices de performance da 008.
--
-- supabase/migrations/*_011.. em diante são os arquivos históricos originais,
-- só renomeados com timestamp — conteúdo inalterado.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- teams (ex equipes)
-- ----------------------------------------------------------------------------
CREATE TABLE teams (
    team_id   text PRIMARY KEY,
    latitude  double precision NOT NULL,
    longitude double precision NOT NULL
);

-- ----------------------------------------------------------------------------
-- patients (ex pacientes)
-- ----------------------------------------------------------------------------
CREATE TABLE patients (
    patient_id            text PRIMARY KEY,
    team_id                text NOT NULL REFERENCES teams (team_id),
    unit_id                text NOT NULL,
    age_band               text NOT NULL,
    sex                     text NOT NULL,
    race_color              text,
    social_vulnerability    boolean NOT NULL,
    longitude               double precision NOT NULL,
    latitude                double precision NOT NULL,
    hypertensive             boolean NOT NULL,
    diabetic                 boolean NOT NULL,
    pregnant                 boolean NOT NULL
);
CREATE INDEX patients_team_id_idx ON patients (team_id);
CREATE INDEX patients_unit_id_idx ON patients (unit_id);

-- ----------------------------------------------------------------------------
-- events (ex eventos)
-- ----------------------------------------------------------------------------
CREATE TABLE events (
    id             bigserial PRIMARY KEY,
    patient_id      text NOT NULL REFERENCES patients (patient_id),
    type            text NOT NULL,
    reference_date  date NOT NULL
);
CREATE INDEX events_patient_date_idx ON events (patient_id, reference_date DESC);
CREATE INDEX events_type_idx         ON events (type);

-- ----------------------------------------------------------------------------
-- visits (ex visitas)
-- ----------------------------------------------------------------------------
CREATE TABLE visits (
    id                  bigserial PRIMARY KEY,
    professional_id      text NOT NULL,
    recorded_at           date NOT NULL,
    daily_visit_order      integer,
    patient_id            text NOT NULL REFERENCES patients (patient_id)
);
CREATE INDEX visits_patient_date_idx      ON visits (patient_id, recorded_at DESC);
CREATE INDEX visits_professional_idx      ON visits (professional_id, recorded_at DESC);
-- índices extras da 008 (join visits<->patients e listagem por profissional
-- sem depender da data como primeira coluna)
CREATE INDEX visits_patient_id_idx       ON visits (patient_id);
CREATE INDEX visits_professional_id_idx  ON visits (professional_id);

-- ----------------------------------------------------------------------------
-- captured_visits (ex visitas_capturadas) — forms preenchidos em campo
-- ----------------------------------------------------------------------------
CREATE TABLE captured_visits (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id             text NOT NULL REFERENCES patients (patient_id),
    professional_id         text NOT NULL,
    captured_at              timestamptz NOT NULL DEFAULT now(),
    profile_blocks           text[] NOT NULL,
    payload                  jsonb NOT NULL,
    synced_vitacare           boolean NOT NULL DEFAULT false,
    synced_at                 timestamptz
);
CREATE INDEX captured_visits_patient_idx     ON captured_visits (patient_id, captured_at DESC);
CREATE INDEX captured_visits_professional_idx ON captured_visits (professional_id, captured_at DESC);

-- ----------------------------------------------------------------------------
-- Realtime (002) — REPLICA IDENTITY FULL + publication
-- ----------------------------------------------------------------------------
ALTER TABLE patients        REPLICA IDENTITY FULL;
ALTER TABLE events          REPLICA IDENTITY FULL;
ALTER TABLE visits          REPLICA IDENTITY FULL;
ALTER TABLE captured_visits REPLICA IDENTITY FULL;

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE captured_visits;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE events;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE visits;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- ----------------------------------------------------------------------------
-- allocations (006 + 010) — saída do engine PRIO-ACS
-- ----------------------------------------------------------------------------
CREATE TABLE allocations (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id          text NOT NULL,
    acs_id           text NOT NULL,
    patient_id       text NOT NULL,
    period_start     date NOT NULL,
    period_mode      text NOT NULL DEFAULT 'weekly',  -- 'daily' | 'weekly'
    priority_order   int  NOT NULL,
    score            int  NOT NULL,
    score_icsap      int  NOT NULL DEFAULT 0,
    score_life_stage int  NOT NULL DEFAULT 0,
    score_care_gap   int  NOT NULL DEFAULT 0,
    score_social     int  NOT NULL DEFAULT 0,
    tier             text NOT NULL,           -- 'high' | 'medium' | 'routine'
    reason           text,
    status           text NOT NULL DEFAULT 'pending',
    --   'pending'  — not yet visited this period
    --   'visited'  — ACS marked done
    --   'skipped'  — ACS explicitly skipped
    --   'overflow' — above patient_cap; flagged for supervisor
    --   'dropped'  — engine removed (engine-origin only)
    origin           text NOT NULL DEFAULT 'engine',
    --   'engine'   — engine-generated; engine may recalculate on re-run
    --   'manager'  — supervisor-added; engine never touches
    --   'acs'      — ACS field-added; engine never touches
    allocated_at     timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT allocations_status_check
        CHECK (status IN ('pending', 'visited', 'skipped', 'overflow', 'dropped')),
    CONSTRAINT allocations_origin_check
        CHECK (origin IN ('engine', 'manager', 'acs')),
    CONSTRAINT allocations_tier_check
        CHECK (tier IN ('high', 'medium', 'routine')),

    -- Upsert key: one engine row per (patient, acs, period)
    CONSTRAINT allocations_upsert_key
        UNIQUE (team_id, acs_id, patient_id, period_start)
);

CREATE INDEX allocations_patient_period_idx
    ON allocations (patient_id, period_start);
CREATE INDEX allocations_acs_period_idx
    ON allocations (acs_id, period_start, priority_order);
CREATE INDEX allocations_team_tier_idx
    ON allocations (team_id, period_start, tier, status);

-- RLS desligada (007 — postura de MVP/demo). A 013, mais adiante nesta
-- mesma pasta, liga de novo com policy por JWT antes de qualquer dado real.
GRANT SELECT, INSERT, UPDATE ON allocations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON allocations TO anon;

-- ----------------------------------------------------------------------------
-- professionals + Custom Access Token Hook (009)
-- ----------------------------------------------------------------------------
CREATE TABLE professionals (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id  uuid UNIQUE REFERENCES auth.users (id) ON DELETE SET NULL,

    -- operational ids (match existing data)
    acs_id        text NOT NULL,          -- = visits.professional_id / allocations.acs_id
    team_id       text NOT NULL,          -- = teams.team_id / allocations.team_id

    -- identity anchors (one becomes the SSO key; CNS is the SUS default)
    cns           text,
    cpf           text,
    registration  text,                   -- matrícula funcional

    name          text,
    microarea     text,
    role          text NOT NULL DEFAULT 'acs',
    active        boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT professionals_role_check
        CHECK (role IN ('acs', 'clinic_manager', 'city_manager', 'admin'))
);

CREATE INDEX professionals_acs_id_idx  ON professionals (acs_id);
CREATE INDEX professionals_team_id_idx ON professionals (team_id);
CREATE UNIQUE INDEX professionals_cns_uniq ON professionals (cns) WHERE cns IS NOT NULL;

-- Mesmo corpo de db/migrations/009_professionals_identity.sql (já usa
-- `user_role`, não o claim reservado `role`). A 012, na sequência desta
-- mesma pasta, reaplica este mesmo corpo (é como ficou registrada a
-- história real — na prática um no-op hoje).
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    claims jsonb := COALESCE(event -> 'claims', '{}'::jsonb);
    prof   public.professionals%ROWTYPE;
BEGIN
    SELECT * INTO prof
    FROM public.professionals
    WHERE auth_user_id = (event ->> 'user_id')::uuid
      AND active
    LIMIT 1;

    IF FOUND THEN
        claims := jsonb_set(claims, '{acs_id}',    to_jsonb(prof.acs_id));
        claims := jsonb_set(claims, '{team_id}',   to_jsonb(prof.team_id));
        claims := jsonb_set(claims, '{user_role}', to_jsonb(prof.role));
    END IF;

    RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;
GRANT SELECT ON public.professionals TO supabase_auth_admin;

ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_admin_read_professionals" ON professionals
    FOR SELECT TO supabase_auth_admin USING (true);

CREATE POLICY "self_read_professional" ON professionals
    FOR SELECT TO authenticated USING (auth_user_id = auth.uid());

-- Atualiza estatísticas do planner para os índices novos entrarem em uso
-- (efeito da 008 original, redundante logo após CREATE TABLE mas inofensivo).
ANALYZE visits;
ANALYZE patients;
