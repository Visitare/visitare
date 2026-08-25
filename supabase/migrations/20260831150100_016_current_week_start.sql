-- ============================================================================
-- 016 — current_week_start(): definição canônica de semana (VISI-50)
-- ----------------------------------------------------------------------------
-- CONTEXTO: o aperto de mão Squad App / Squad Engine (VISI-2) fechou a regra
-- de negócio — period_start é a segunda-feira ISO da semana que a lista
-- cobre, com toda a aritmética em America/Sao_Paulo. Engine (Python) e app
-- (SQL) calculam essa data cada um do seu lado; o combinado é que o BANCO
-- carrega a definição canônica e o engine roda um teste de paridade (VISI-15)
-- que afirma igualdade contra ela.
--
-- Extraída da VISI-12 para entrar antes dela e quebrar uma dependência
-- circular: o teste de paridade da VISI-15 precisa desta função existindo, e
-- a VISI-12 (que ia criá-la) está declarada como dependente da VISI-15.
--
-- Migration puramente aditiva: cria uma função nova. Não toca REF_DATE, não
-- altera nenhuma RPC existente, não muda o resultado de nenhuma lista hoje.
--
-- Efeito em RLS: nenhum. Não cria, não altera e não lê nenhuma tabela — não
-- há política de linha para escrever nem PHI para autorizar.
--
-- date_trunc('week', ...) do Postgres é ISO (semana começa na segunda) — bate
-- exatamente com `d - timedelta(days=d.weekday())` do lado Python, dado o
-- mesmo fuso nos dois lados.
--
-- America/Sao_Paulo é UTC−3 fixo desde o fim do horário de verão no Brasil em
-- 2019. NÃO troque pelo literal '-03': se o Brasil reintroduzir DST, o
-- literal para silenciosamente de acompanhar a mudança, enquanto o nome do
-- fuso continua sendo resolvido pelo tzdata do sistema.
-- ============================================================================

-- p_at é o ponto da issue: sem parâmetro, a função só seria testável contra o
-- instante em que o teste roda — e é exatamente o comportamento na virada de
-- domingo à noite e na virada de ano que o teste de paridade da VISI-15
-- precisa afirmar, contra instantes fixos. DEFAULT now() preserva a
-- ergonomia de chamar current_week_start() sem argumento.
CREATE OR REPLACE FUNCTION current_week_start(p_at timestamptz DEFAULT now())
RETURNS date
LANGUAGE sql
IMMUTABLE                      -- dado p_at, o corpo é puro: sem tabela, sem
                                -- GUC de sessão — só o literal de fuso abaixo.
                                -- (a invocação SEM argumento varia a cada
                                -- chamada por causa do DEFAULT now(); isso é
                                -- propriedade do argumento, não do corpo — a
                                -- função em si permanece IMMUTABLE.)
SET search_path = public
AS $$
    SELECT (date_trunc('week', (p_at AT TIME ZONE 'America/Sao_Paulo')))::date;
$$;

-- anon não recebe: a 013 tirou anon de tudo de propósito e a 014 (PR #11,
-- ainda aberto) reforça. A função não lê PHI nenhum, mas não há razão para
-- reabrir a superfície de execução.
REVOKE ALL ON FUNCTION current_week_start(timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION current_week_start(timestamptz) TO authenticated, service_role;
