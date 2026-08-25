-- Ad-hoc acceptance test for 016_current_week_start.sql. current_week_start()
-- has no table/RLS dependency, so this only bootstraps the three Supabase
-- roles its GRANT/REVOKE touch, then applies the migration and asserts
-- against it. Not part of the migration chain — local verification only.
--
-- Run against a throwaway Postgres:
--   docker run -d --rm --name visitare_test_pg -e POSTGRES_PASSWORD=postgres -p 5435:5432 postgres:17-alpine
--   createdb -h 127.0.0.1 -p 5435 -U postgres visitare_test   # PGPASSWORD=postgres
--   psql -h 127.0.0.1 -p 5435 -U postgres -d visitare_test -v ON_ERROR_STOP=1 -f db/tests/016_current_week_start_test.sql
--   docker stop visitare_test_pg
--
-- The migration itself is applied by this file (via \ir below) — no separate
-- step needed.

\set ON_ERROR_STOP on
\pset pager off

-- roles the migration's GRANT/REVOKE reference (idempotent, not part of the
-- transaction below — mirrors how Supabase provisions them once per project)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN BYPASSRLS;
    END IF;
END
$$;

\ir ../../supabase/migrations/20260831150100_016_current_week_start.sql

BEGIN;

\echo '--- TEST 1: domingo 23h BRT -> segunda que comecou seis dias antes ---'
DO $$
DECLARE got date;
BEGIN
    SELECT current_week_start('2026-08-23 23:00:00-03'::timestamptz) INTO got;
    IF got = '2026-08-17'::date THEN
        RAISE NOTICE 'PASS: domingo 23h BRT -> % (semana ISO que ja estava terminando)', got;
    ELSE
        RAISE EXCEPTION 'FAIL: domingo 23h BRT -> % (esperado 2026-08-17)', got;
    END IF;
END $$;

\echo '--- TEST 2: segunda 00h05 BRT -> o proprio dia ---'
DO $$
DECLARE got date;
BEGIN
    SELECT current_week_start('2026-08-24 00:05:00-03'::timestamptz) INTO got;
    IF got = '2026-08-24'::date THEN
        RAISE NOTICE 'PASS: segunda 00h05 BRT -> % (proprio dia)', got;
    ELSE
        RAISE EXCEPTION 'FAIL: segunda 00h05 BRT -> % (esperado 2026-08-24)', got;
    END IF;
END $$;

\echo '--- TEST 3: virada de ano dentro de semana partida ---'
DO $$
DECLARE got date;
BEGIN
    SELECT current_week_start('2025-12-31 15:00:00-03'::timestamptz) INTO got;
    IF got = '2025-12-29'::date THEN
        RAISE NOTICE 'PASS: quarta 31/12/2025 -> % (segunda 29/12/2025)', got;
    ELSE
        RAISE EXCEPTION 'FAIL: quarta 31/12/2025 -> % (esperado 2025-12-29)', got;
    END IF;
END $$;

\echo '--- TEST 4: instante qualquer no meio da semana, como controle ---'
DO $$
DECLARE got date;
BEGIN
    SELECT current_week_start('2026-08-26 12:00:00-03'::timestamptz) INTO got;
    IF got = '2026-08-24'::date THEN
        RAISE NOTICE 'PASS: quarta meio-dia BRT -> % (segunda da mesma semana)', got;
    ELSE
        RAISE EXCEPTION 'FAIL: quarta meio-dia BRT -> % (esperado 2026-08-24)', got;
    END IF;
END $$;

\echo '--- TEST 5: DEFAULT now() funciona sem argumento ---'
DO $$
DECLARE got date;
BEGIN
    SELECT current_week_start() INTO got;
    IF got = (date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo')))::date THEN
        RAISE NOTICE 'PASS: current_week_start() sem argumento -> %', got;
    ELSE
        RAISE EXCEPTION 'FAIL: current_week_start() sem argumento -> % inesperado', got;
    END IF;
END $$;

\echo '--- TEST 6: authenticated e service_role tem EXECUTE; anon nao tem ---'
SET ROLE authenticated;
SELECT current_week_start('2026-08-24 00:05:00-03'::timestamptz);
RESET ROLE;

SET ROLE service_role;
SELECT current_week_start('2026-08-24 00:05:00-03'::timestamptz);
RESET ROLE;

DO $$
BEGIN
    SET ROLE anon;
    PERFORM current_week_start('2026-08-24 00:05:00-03'::timestamptz);
    RESET ROLE;
    RAISE EXCEPTION 'FAIL: anon conseguiu executar current_week_start (deveria estar revogado)';
EXCEPTION
    WHEN insufficient_privilege THEN
        RESET ROLE;
        RAISE NOTICE 'PASS: anon sem EXECUTE em current_week_start (insufficient_privilege)';
END $$;

ROLLBACK;
