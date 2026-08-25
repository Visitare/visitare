-- Minimal reconstruction of the schema state AS OF migration 013, for local
-- testing of migration 015 only. `pacientes`/`visitas`/`equipes`/
-- `visitas_capturadas` are base tables that predate db/migrations/ (never
-- created by any tracked migration — 001 already assumes `pacientes` exists),
-- so the full chain cannot be replayed from scratch. This stub reconstructs
-- only the columns migrations 006/009/010/011/013 read or write, in their
-- final (English, post-010) shape, to exercise 015 in isolation.
-- Local test scaffolding only — never applied to a real Supabase project.

CREATE TABLE patients (
    patient_id text PRIMARY KEY,
    team_id    text NOT NULL
);

CREATE TABLE teams (
    team_id text PRIMARY KEY
);

CREATE TABLE visits (
    patient_id      text NOT NULL,
    professional_id text NOT NULL,
    recorded_at     date NOT NULL
);

CREATE TABLE captured_visits (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      text NOT NULL,
    professional_id text NOT NULL,
    captured_at     timestamptz NOT NULL DEFAULT now(),
    profile_blocks  jsonb,
    payload         jsonb,
    synced_vitacare boolean NOT NULL DEFAULT false,
    synced_at       timestamptz
);

-- allocations as of 010 (team_id/patient_id/reason, origin: engine|manager|acs)
CREATE TABLE allocations (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id          text NOT NULL,
    acs_id           text NOT NULL,
    patient_id       text NOT NULL,
    period_start     date NOT NULL,
    period_mode      text NOT NULL DEFAULT 'weekly',
    priority_order   int  NOT NULL,
    score            int  NOT NULL,
    score_icsap      int  NOT NULL DEFAULT 0,
    score_life_stage int  NOT NULL DEFAULT 0,
    score_care_gap   int  NOT NULL DEFAULT 0,
    score_social     int  NOT NULL DEFAULT 0,
    tier             text NOT NULL,
    reason           text,
    status           text NOT NULL DEFAULT 'pending',
    origin           text NOT NULL DEFAULT 'engine',
    allocated_at     timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT allocations_status_check
        CHECK (status IN ('pending', 'visited', 'skipped', 'overflow', 'dropped')),
    CONSTRAINT allocations_origin_check
        CHECK (origin IN ('engine', 'manager', 'acs')),
    CONSTRAINT allocations_tier_check
        CHECK (tier IN ('high', 'medium', 'routine')),
    CONSTRAINT allocations_upsert_key
        UNIQUE (team_id, acs_id, patient_id, period_start)
);

ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE captured_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acs_read_own_allocations" ON allocations
    FOR SELECT TO authenticated
    USING (acs_id = (auth.jwt() ->> 'acs_id'));

-- Still live on main today (013 replaced only the SELECT policy; this UPDATE
-- policy from 006 has not been dropped — that's PR #11 / migration 014, not
-- yet merged). Reproduced here so the guard is tested against the real
-- current RLS shape, not an idealized one.
CREATE POLICY "acs_update_own_status" ON allocations
    FOR UPDATE
    USING (acs_id = (auth.jwt() ->> 'acs_id'))
    WITH CHECK (
        status IN ('visited', 'skipped')
        AND (auth.jwt() ->> 'acs_id') IS NOT NULL
    );

GRANT SELECT, INSERT, UPDATE ON allocations TO authenticated;
GRANT INSERT, SELECT ON captured_visits TO authenticated;
GRANT SELECT ON teams TO authenticated;

-- table owner for this test session (whatever role ran the migrations, i.e. postgres)
-- is the implicit RPC/trigger DEFINER owner, matching prod where migrations run
-- as the project owner and RPCs/triggers are SECURITY DEFINER.
