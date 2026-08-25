-- ============================================================================
-- 017 — Guarda no schema: engine (service_role) nunca sobrescreve linha humana
-- ----------------------------------------------------------------------------
-- CONTEXTO (VISI-42): a invariante "engine never touches gestor/acs rows" está
-- escrita em comentário desde a 006 e não tem enforcement nenhum. O
-- `allocations_upsert_key` (team_id, acs_id, patient_id, period_start) casa em
-- qualquer `ON CONFLICT ... DO UPDATE` do engine, e o engine conecta como
-- `service_role`, que ignora RLS por definição — nenhuma policy protege disso.
-- Decisão e forma alinhadas com o Squad Engine na VISI-2/VISI-9 (ver comentário
-- de despacho da VISI-42).
--
-- Duas partes:
--   1. Trigger BEFORE UPDATE/DELETE em `allocations`: quando quem escreve é
--      `service_role` e a linha já não é 'engine', descarta o write inteiro
--      (RETURN NULL — no-op silencioso, não exceção: uma linha protegida não
--      pode derrubar o batch semanal inteiro). Em qualquer UPDATE de
--      `service_role`, `id`/`origin`/`status` nunca mudam — cobre também o bug
--      do engine remontando `id` com um uuid novo a cada upsert
--      (engine/allocation.py:298), inclusive em linhas 'engine'.
--   2. Trigger AFTER INSERT em `captured_visits`: uma captura do ACS marca a
--      allocation correspondente como 'visited'. É o que faz a guarda acima
--      valer alguma coisa para "visitado" — sem isto, nada nunca escreve
--      status='visited' e o upsert do engine nunca encontraria uma linha não-
--      'engine' para proteger nesse eixo.
--
-- current_user = 'service_role' é o discriminador, não uma GUC de sessão: o
-- PostgREST faz `SET LOCAL ROLE service_role` para a chave de serviço, o PWA
-- entra como `authenticated`, e as RPCs da 013 são SECURITY DEFINER (rodam
-- como owner). O banco distingue sozinho quem está escrevendo.
--
-- Índice único parcial foi descartado como mecanismo: um único parcial
-- `WHERE origin='engine'` deixaria o engine inserir uma SEGUNDA linha para a
-- mesma chave quando já existe linha humana, duplicando o paciente na lista do
-- ACS. `allocations_upsert_key` continua exatamente como está.
--
-- Efeito em RLS: nenhum. As policies de `allocations`/`captured_visits` não
-- mudam — esta migration só adiciona triggers, que rodam independentemente de
-- RLS (e, sendo SECURITY DEFINER a função de reconciliação, correm como o
-- owner, que já não é sujeito às policies hoje — ver nota "sem FORCE ROW LEVEL
-- SECURITY" na 014).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Guarda: service_role não sobrescreve linha cujo origin não é 'engine'
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION allocations_guard_human_rows()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- App e RPCs (authenticated, ou o owner via SECURITY DEFINER) passam
    -- direto: a guarda existe contra o engine, não contra o produto.
    IF current_user <> 'service_role' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.origin <> 'engine' THEN
            RETURN NULL;   -- descarta o DELETE — linha humana não é do engine apagar
        END IF;
        RETURN OLD;
    END IF;

    -- TG_OP = 'UPDATE'
    IF OLD.origin <> 'engine' THEN
        RETURN NULL;   -- no-op silencioso: contrato documentado é "engine never touches"
    END IF;

    -- Linha 'engine': preserva id/origin/status mesmo quando o próprio upsert
    -- do engine tenta trocá-los (bug do id remontado a cada upsert).
    NEW.id     := OLD.id;
    NEW.origin := OLD.origin;
    NEW.status := OLD.status;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS allocations_guard_human_rows ON allocations;
CREATE TRIGGER allocations_guard_human_rows
    BEFORE UPDATE OR DELETE ON allocations
    FOR EACH ROW
    EXECUTE FUNCTION allocations_guard_human_rows();

-- ----------------------------------------------------------------------------
-- 2. Reconciliação: captura do ACS marca a allocation como 'visited'
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER: authenticated não tem UPDATE em allocations (014), e não
-- deveria ganhar — quem marca 'visited' é o banco, no privilégio do owner, não
-- o front. Roda como owner => passa pela guarda acima sem ser 'service_role' e
-- sem estar sujeito às RLS policies de allocations (owner, sem FORCE RLS).
CREATE OR REPLACE FUNCTION captured_visits_mark_allocation_visited()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE allocations
    SET status = 'visited'
    WHERE patient_id = NEW.patient_id
      AND acs_id     = NEW.professional_id
      AND status     = 'pending'
      AND period_start <= NEW.captured_at::date
      AND NEW.captured_at::date < period_start
            + (CASE WHEN period_mode = 'weekly' THEN 7 ELSE 1 END);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS captured_visits_mark_allocation_visited ON captured_visits;
CREATE TRIGGER captured_visits_mark_allocation_visited
    AFTER INSERT ON captured_visits
    FOR EACH ROW
    EXECUTE FUNCTION captured_visits_mark_allocation_visited();

COMMIT;
