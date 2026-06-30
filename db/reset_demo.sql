-- ============================================================================
-- reset_demo.sql — reset da conta de demonstração do PWA (acs@visitare.app)
-- ============================================================================
--
-- Contexto:
--   O PWA (acs.visitare.app) só escreve em UMA tabela no servidor:
--   `captured_visits` (insert via frontend/src/hooks/useSync.ts). A tabela
--   `allocations` (as 25 pacientes, scores, prioridade) NÃO é tocada pelo app —
--   o status fica sempre 'pending'. Logo, resetar o demo = apagar as visitas
--   capturadas dessa conta.
--
-- Como rodar:
--   Cole no SQL Editor do Supabase (projeto gyutcqmrbbtftrowcyhv) e execute.
--   É IDEMPOTENTE — pode rodar quantas vezes quiser (antes, durante e depois do evento).
--
-- Pegadinha do front (não some só com o reset de banco):
--   O selo "Visitado" na lista vem do IndexedDB LOCAL do navegador
--   (frontend/src/pages/ListaPage.tsx), não do servidor. Num device que JÁ marcou,
--   o badge persiste até fazer "Clear site data" + reload. Devices novos entram
--   limpos. Drift documentado na issue #7 (Visitare/visitare).
-- ============================================================================

do $$
declare
  v_acs_id text;
begin
  select pr.acs_id
    into v_acs_id
  from professionals pr
  join auth.users u on u.id = pr.auth_user_id
  where u.email = 'acs@visitare.app';

  if v_acs_id is null then
    raise exception 'ACS acs@visitare.app não encontrado';
  end if;

  -- 1) apaga TODAS as visitas capturadas pelo PWA nessa conta
  delete from captured_visits where professional_id = v_acs_id;

  -- 2) defensivo: se algum dia algo marcar status (hoje o front não marca),
  --    volta só 'visited'/'skipped' para 'pending'.
  --    NÃO toca 'overflow'/'dropped' — esses são estado do motor de priorização.
  update allocations
     set status = 'pending'
   where acs_id = v_acs_id
     and status in ('visited', 'skipped');

  raise notice 'Reset do demo concluído para acs_id=%', v_acs_id;
end $$;
