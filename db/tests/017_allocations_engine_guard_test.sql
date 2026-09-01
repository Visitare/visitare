-- Ad-hoc acceptance test for 017_allocations_engine_guard.sql. Run against the
-- stub built by test_stub_supabase.sql + test_stub_base_schema.sql. Not part
-- of the migration chain — local verification only.

\set ON_ERROR_STOP on
\pset pager off

BEGIN;

-- fixtures ----------------------------------------------------------------
INSERT INTO teams (team_id) VALUES ('team-1');
INSERT INTO patients (patient_id, team_id) VALUES ('pat-1', 'team-1'), ('pat-2', 'team-1');

-- pat-1: a manager (gestor) hand-added row for this period.
INSERT INTO allocations
    (team_id, acs_id, patient_id, period_start, period_mode, priority_order, score, tier, origin, status)
VALUES
    ('team-1', 'acs-1', 'pat-1', '2026-08-24', 'weekly', 1, 90, 'high', 'manager', 'pending');

-- pat-2: an engine-origin row, pending.
INSERT INTO allocations
    (team_id, acs_id, patient_id, period_start, period_mode, priority_order, score, tier, origin, status)
VALUES
    ('team-1', 'acs-1', 'pat-2', '2026-08-24', 'weekly', 2, 40, 'routine', 'engine', 'pending');

\echo '--- TEST 1: service_role upsert must not touch the manager row ---'
SELECT id, origin, status, priority_order INTO TEMP TABLE pat1_before FROM allocations WHERE patient_id = 'pat-1';

SET ROLE service_role;
INSERT INTO allocations
    (team_id, acs_id, patient_id, period_start, period_mode, priority_order, score, tier, origin, status)
VALUES
    ('team-1', 'acs-1', 'pat-1', '2026-08-24', 'weekly', 99, 10, 'routine', 'engine', 'dropped')
ON CONFLICT ON CONSTRAINT allocations_upsert_key DO UPDATE SET
    priority_order = EXCLUDED.priority_order,
    score           = EXCLUDED.score,
    tier            = EXCLUDED.tier,
    origin          = EXCLUDED.origin,
    status          = EXCLUDED.status,
    id              = gen_random_uuid();
RESET ROLE;

DO $$
DECLARE
    before_row pat1_before%ROWTYPE;
    after_row  allocations%ROWTYPE;
BEGIN
    SELECT * INTO before_row FROM pat1_before;
    SELECT * INTO after_row FROM allocations WHERE patient_id = 'pat-1';
    IF after_row.id = before_row.id
       AND after_row.origin = before_row.origin
       AND after_row.status = before_row.status
       AND after_row.priority_order = before_row.priority_order THEN
        RAISE NOTICE 'PASS: manager row untouched by service_role upsert (id=%, origin=%, status=%, priority_order=%)',
            after_row.id, after_row.origin, after_row.status, after_row.priority_order;
    ELSE
        RAISE EXCEPTION 'FAIL: manager row was overwritten — before=(%,%,%,%) after=(%,%,%,%)',
            before_row.id, before_row.origin, before_row.status, before_row.priority_order,
            after_row.id, after_row.origin, after_row.status, after_row.priority_order;
    END IF;
END $$;

\echo '--- TEST 2: service_role upsert on an engine row keeps id/origin/status but updates score/order ---'
SELECT id, origin, status INTO TEMP TABLE pat2_before FROM allocations WHERE patient_id = 'pat-2';

SET ROLE service_role;
INSERT INTO allocations
    (team_id, acs_id, patient_id, period_start, period_mode, priority_order, score, tier, origin, status)
VALUES
    ('team-1', 'acs-1', 'pat-2', '2026-08-24', 'weekly', 1, 77, 'high', 'engine', 'dropped')
ON CONFLICT ON CONSTRAINT allocations_upsert_key DO UPDATE SET
    priority_order = EXCLUDED.priority_order,
    score           = EXCLUDED.score,
    tier            = EXCLUDED.tier,
    origin          = EXCLUDED.origin,
    status          = EXCLUDED.status,
    id              = gen_random_uuid();
RESET ROLE;

DO $$
DECLARE
    before_row pat2_before%ROWTYPE;
    after_row  allocations%ROWTYPE;
BEGIN
    SELECT * INTO before_row FROM pat2_before;
    SELECT * INTO after_row FROM allocations WHERE patient_id = 'pat-2';
    IF after_row.id = before_row.id
       AND after_row.origin = before_row.origin
       AND after_row.status = before_row.status
       AND after_row.score = 77
       AND after_row.priority_order = 1 THEN
        RAISE NOTICE 'PASS: engine row keeps id/origin/status, score/priority_order still update (id=%, score=%, priority_order=%)',
            after_row.id, after_row.score, after_row.priority_order;
    ELSE
        RAISE EXCEPTION 'FAIL: engine row guard misbehaved — before=(%,%,%) after=(%,%,%,score=%,po=%)',
            before_row.id, before_row.origin, before_row.status,
            after_row.id, after_row.origin, after_row.status, after_row.score, after_row.priority_order;
    END IF;
END $$;

\echo '--- TEST 3: authenticated (app/RPC), allowed by RLS, passes through the guard unaffected ---'
SET LOCAL request.jwt.claims = '{"acs_id":"acs-1"}';
SET ROLE authenticated;
UPDATE allocations SET status = 'skipped' WHERE patient_id = 'pat-2';
RESET ROLE;

DO $$
DECLARE st text;
BEGIN
    SELECT status INTO st FROM allocations WHERE patient_id = 'pat-2';
    IF st = 'skipped' THEN
        RAISE NOTICE 'PASS: authenticated ACS write (allowed by RLS) went through untouched by the guard (status=%)', st;
    ELSE
        RAISE EXCEPTION 'FAIL: authenticated write was altered by the guard (status=%)', st;
    END IF;
END $$;

-- reset pat-2 back to pending for the remaining tests
UPDATE allocations SET status = 'pending' WHERE patient_id = 'pat-2';

\echo '--- TEST 4: captured_visits insert marks the matching allocation visited ---'
-- pat-2 is pending going into this; period_start 2026-08-24 (Mon) + weekly => window is [08-24, 08-31)
INSERT INTO captured_visits (patient_id, professional_id, captured_at, profile_blocks, payload)
VALUES ('pat-2', 'acs-1', '2026-08-26 14:00:00-03', '{}'::jsonb, '{}'::jsonb);

DO $$
DECLARE st text;
BEGIN
    SELECT status INTO st FROM allocations WHERE patient_id = 'pat-2';
    IF st = 'visited' THEN
        RAISE NOTICE 'PASS: captured_visits insert reconciled allocation to visited (status=%)', st;
    ELSE
        RAISE EXCEPTION 'FAIL: allocation status did not reconcile (status=%)', st;
    END IF;
END $$;

\echo '--- TEST 5: once visited, a service_role upsert cannot bounce it back to pending ---'
SET ROLE service_role;
INSERT INTO allocations
    (team_id, acs_id, patient_id, period_start, period_mode, priority_order, score, tier, origin, status)
VALUES
    ('team-1', 'acs-1', 'pat-2', '2026-08-24', 'weekly', 3, 20, 'routine', 'engine', 'pending')
ON CONFLICT ON CONSTRAINT allocations_upsert_key DO UPDATE SET
    priority_order = EXCLUDED.priority_order,
    score           = EXCLUDED.score,
    tier            = EXCLUDED.tier,
    origin          = EXCLUDED.origin,
    status          = EXCLUDED.status,
    id              = gen_random_uuid();
RESET ROLE;

DO $$
DECLARE st text;
BEGIN
    SELECT status INTO st FROM allocations WHERE patient_id = 'pat-2';
    IF st = 'visited' THEN
        RAISE NOTICE 'PASS: status stayed visited across a later service_role upsert (status=%)', st;
    ELSE
        RAISE EXCEPTION 'FAIL: engine upsert bounced visited back to pending (status=%)', st;
    END IF;
END $$;

ROLLBACK;
