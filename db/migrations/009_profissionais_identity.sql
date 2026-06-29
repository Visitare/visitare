-- ============================================================================
-- 009 — Identidade: tabela `profissionais` + Custom Access Token Hook
-- ----------------------------------------------------------------------------
-- Modelo claim-based extensível para o SSO da prefeitura (ver ADR 0002).
-- O hook injeta `acs_id`, `clinica_id`, `role` no JWT a partir de profissionais,
-- com nomes alinhados às policies da migration 006 — ligar a RLS depois é só
-- reaplicar 006 §RLS, sem reescrever policy.
--
-- NÃO liga a RLS de allocations aqui (isso é a migration 010, após o login E2E).
-- ============================================================================

CREATE TABLE IF NOT EXISTS profissionais (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id  uuid UNIQUE REFERENCES auth.users (id) ON DELETE SET NULL,

    -- ids operacionais (casam com os dados existentes)
    acs_id        text NOT NULL,          -- = visitas.profissional_id / allocations.acs_id
    clinica_id    text NOT NULL,          -- = equipe_id / allocations.clinic_id

    -- âncoras de identidade (uma delas vira a chave do SSO; CNS é o padrão SUS)
    cns           text,
    cpf           text,
    matricula     text,

    nome          text,
    microarea     text,
    role          text NOT NULL DEFAULT 'acs',
    ativo         boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT profissionais_role_check
        CHECK (role IN ('acs', 'gestor_clinica', 'gestor_municipal', 'admin'))
);

CREATE INDEX IF NOT EXISTS profissionais_acs_id_idx     ON profissionais (acs_id);
CREATE INDEX IF NOT EXISTS profissionais_clinica_id_idx ON profissionais (clinica_id);
CREATE UNIQUE INDEX IF NOT EXISTS profissionais_cns_uniq ON profissionais (cns) WHERE cns IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Custom Access Token Hook — injeta claims no JWT em cada emissão de token.
-- Roda no contexto do supabase_auth_admin (ver grants abaixo).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    claims jsonb := COALESCE(event -> 'claims', '{}'::jsonb);
    prof   public.profissionais%ROWTYPE;
BEGIN
    SELECT * INTO prof
    FROM public.profissionais
    WHERE auth_user_id = (event ->> 'user_id')::uuid
      AND ativo
    LIMIT 1;

    IF FOUND THEN
        claims := jsonb_set(claims, '{acs_id}',     to_jsonb(prof.acs_id));
        claims := jsonb_set(claims, '{clinica_id}', to_jsonb(prof.clinica_id));
        claims := jsonb_set(claims, '{role}',       to_jsonb(prof.role));
    END IF;

    RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- ----------------------------------------------------------------------------
-- Grants — o hook precisa rodar como supabase_auth_admin e ler profissionais.
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;
GRANT SELECT ON public.profissionais TO supabase_auth_admin;

-- ----------------------------------------------------------------------------
-- RLS de profissionais — cada um lê o próprio registro; auth_admin (hook) lê tudo.
-- ----------------------------------------------------------------------------
ALTER TABLE profissionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_admin_read_profissionais" ON profissionais
    FOR SELECT TO supabase_auth_admin USING (true);

CREATE POLICY "self_read_profissional" ON profissionais
    FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
