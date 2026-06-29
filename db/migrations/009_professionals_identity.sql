-- ============================================================================
-- 009 — Identity: `professionals` table + Custom Access Token Hook
-- ----------------------------------------------------------------------------
-- Claim-based model, extensible to the city's SSO (see ADR 0002). The hook
-- injects `acs_id`, `team_id`, `role` into the JWT from `professionals`, with
-- names aligned to the allocations RLS policies — enabling RLS later is just a
-- matter of (re)applying those policies, no rewrite.
--
-- Does NOT enable RLS on allocations here (that is migration 011, after the
-- login works end-to-end).
-- ============================================================================

CREATE TABLE IF NOT EXISTS professionals (
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

CREATE INDEX IF NOT EXISTS professionals_acs_id_idx  ON professionals (acs_id);
CREATE INDEX IF NOT EXISTS professionals_team_id_idx ON professionals (team_id);
CREATE UNIQUE INDEX IF NOT EXISTS professionals_cns_uniq ON professionals (cns) WHERE cns IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Custom Access Token Hook — injects claims into the JWT on every token issue.
-- Runs in the supabase_auth_admin context (see grants below).
-- ----------------------------------------------------------------------------
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
        claims := jsonb_set(claims, '{acs_id}',  to_jsonb(prof.acs_id));
        claims := jsonb_set(claims, '{team_id}', to_jsonb(prof.team_id));
        claims := jsonb_set(claims, '{role}',    to_jsonb(prof.role));
    END IF;

    RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- ----------------------------------------------------------------------------
-- Grants — the hook runs as supabase_auth_admin and reads professionals.
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;
GRANT SELECT ON public.professionals TO supabase_auth_admin;

-- ----------------------------------------------------------------------------
-- RLS on professionals — each reads its own row; auth_admin (hook) reads all.
-- ----------------------------------------------------------------------------
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_admin_read_professionals" ON professionals
    FOR SELECT TO supabase_auth_admin USING (true);

CREATE POLICY "self_read_professional" ON professionals
    FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
