-- ============================================================================
-- 017 — Trigger que protege linhas humanas e resolvidas em allocations
-- ----------------------------------------------------------------------------
-- Hoje o engine PRIO-ACS roda `INSERT ... ON CONFLICT (team_id, acs_id,
-- patient_id, period_start) DO UPDATE` em `allocations`, conectado como
-- `service_role`. Não existe nenhuma proteção no banco: um re-run do mesmo
-- `period_start` reverte `status='visited'` para `'pending'` e
-- `origin='manager'` para `'engine'`. `service_role` bypassa RLS por
-- definição, então as policies da 006/013 não seguram isso.
--
-- Puramente DDL — sem leitura/escrita de linha, sem backfill. `origin` e
-- `status` já existem desde a 006 com os defaults corretos.
--
-- SECURITY INVOKER (o default — omitido de propósito): a função corre como
-- quem chamou o UPDATE, não como o dono da função. Se fosse SECURITY DEFINER,
-- `current_user` dentro da função viraria o dono (o role que rodou a
-- migration), e a checagem de role abaixo nunca casaria com `service_role`.
--
-- O discriminador de autoria é o papel da conexão, não uma coluna:
--   - o engine é o único que fala como `service_role`
--     (`engine/supabase_client.py` usa `create_client(url, SUPABASE_SERVICE_ROLE_KEY)`);
--   - o PostgREST faz `SET LOCAL ROLE service_role` para essa chave;
--   - `db/reset_demo.sql:43` roda colado no SQL Editor do Supabase, como
--     `postgres` (≠ `service_role`) — continua funcionando sem alteração
--     porque só altera `status`, nunca `id`.
--
-- `RETURN OLD` e não `RAISE EXCEPTION`, de propósito: o engine grava centenas
-- de linhas numa única transação; um `RAISE` faria uma única visita registrada
-- derrubar a regeneração semanal inteira da equipe. Pular a linha é o
-- comportamento certo em campo.
--
-- `RETURN OLD` ainda grava uma nova versão física da tupla (é um UPDATE que
-- vira no-op de valor, não a ausência de um UPDATE). `allocations` não está em
-- `supabase_realtime` hoje — a 002_realtime.sql só adicionou
-- `visitas_capturadas`, `eventos` e `visitas`. Se `allocations` entrar nessa
-- publicação no futuro, revisar isto antes: cada run do engine passaria a
-- emitir um evento Realtime por linha protegida, acordando o device de cada
-- ACS sem nenhuma mudança de valor real.
-- ============================================================================

CREATE OR REPLACE FUNCTION allocations_protect_human_rows()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Regra 1: id é imutável para qualquer autor — nenhum UPDATE muda a
    -- identidade da linha.
    NEW.id := OLD.id;

    -- Regra 2: linha humana (origin <> 'engine') ou já resolvida
    -- (status visited/skipped) é imune ao engine.
    IF current_user = 'service_role'
       AND (OLD.origin <> 'engine' OR OLD.status IN ('visited', 'skipped')) THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS allocations_protect_human_rows ON allocations;
CREATE TRIGGER allocations_protect_human_rows
    BEFORE UPDATE ON allocations
    FOR EACH ROW
    EXECUTE FUNCTION allocations_protect_human_rows();
