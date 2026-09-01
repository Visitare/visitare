-- Minimal stub of the Supabase runtime pieces the migrations assume exist but
-- a plain Postgres does not provide: roles anon/authenticated/service_role,
-- schema auth with auth.users + auth.jwt(), supabase_auth_admin, and the
-- supabase_realtime publication. Apply this first, then replay
-- supabase/migrations/ in filename order to get the real schema.
-- Local-only, never applied to a real Supabase project.

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
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        CREATE ROLE supabase_auth_admin NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator NOLOGIN;
    END IF;
END
$$;

GRANT anon, authenticated, service_role TO authenticator;
GRANT CREATE ON DATABASE postgres TO supabase_auth_admin;

CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;

CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE
AS $$
    SELECT COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb
$$;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
    SELECT (auth.jwt() ->> 'sub')::uuid
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

-- Real Supabase grants service_role ALL PRIVILEGES on every table in public
-- (on top of BYPASSRLS) — reproduce that here so it can actually write.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;

-- 000_base_schema adds tables to this publication; Supabase creates it as part
-- of provisioning, so a bare Postgres needs it up front.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END
$$;
