-- ============================================================================
-- 012 — Fix: hook não pode sobrescrever o claim reservado `role`
-- ----------------------------------------------------------------------------
-- O claim `role` do JWT é usado pelo PostgREST como o ROLE do Postgres
-- (authenticated/anon). A 009 sobrescrevia `role` com o papel da aplicação
-- ('acs'), fazendo o PostgREST tentar `SET ROLE "acs"` → erro 22023
-- "role acs does not exist" em toda query autenticada.
--
-- Correção: o papel da aplicação vai em `user_role`; `role` fica intacto.
-- ============================================================================

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
