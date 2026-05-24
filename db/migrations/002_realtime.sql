-- ============================================================================
-- Habilita Supabase Realtime nas tabelas que afetam a priorização
-- ============================================================================
-- O cliente assina mudanças via supabase.channel().on('postgres_changes', ...)
-- e re-chama priorizacao_pacientes para refletir o estado atual.
-- ============================================================================

-- Garante REPLICA IDENTITY FULL nas tabelas — necessário pro Realtime
-- emitir o payload completo dos updates/deletes (não só PKs).
ALTER TABLE pacientes          REPLICA IDENTITY FULL;
ALTER TABLE eventos            REPLICA IDENTITY FULL;
ALTER TABLE visitas            REPLICA IDENTITY FULL;
ALTER TABLE visitas_capturadas REPLICA IDENTITY FULL;

-- Adiciona as tabelas à publicação que o Supabase Realtime escuta.
DO $$
BEGIN
    -- visitas_capturadas: principal — toda vez que o ACS termina uma visita
    -- no app, o resto do time vê a lista reordenar.
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE visitas_capturadas;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    -- eventos: futuro — quando a ponte com Vitacare empurrar agendamentos /
    -- urgências novas, a priorização reage.
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE eventos;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    -- visitas: idem — registro oficial vindo do Vitacare.
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE visitas;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;


-- ============================================================================
-- Helper: equipe_do_profissional
-- ============================================================================
-- Mapeia profissional_id → equipe_id (moda das equipes dos pacientes que
-- ele/ela visita). Usado pelo front pra resolver "qual equipe esse ACS
-- atende" sem precisar de query auxiliar.

CREATE OR REPLACE FUNCTION equipe_do_profissional(p_profissional_id TEXT)
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
    SELECT p.equipe_id
    FROM visitas v
    JOIN pacientes p USING (paciente_id)
    WHERE v.profissional_id = p_profissional_id
    GROUP BY p.equipe_id
    ORDER BY COUNT(*) DESC
    LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION equipe_do_profissional(TEXT) TO anon, authenticated;
