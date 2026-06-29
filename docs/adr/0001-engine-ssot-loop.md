# ADR 0001 — visitare-engine é a fonte da verdade da priorização (loop allocations → PWA)

- **Status:** aceito
- **Data:** 2026-06-28
- **Contexto do piloto:** Rocinha / SMS-Rio

## Contexto

Existiam **dois** motores de priorização em paralelo:

1. **SQL** — RPC `priorizacao_pacientes` (migration 001), calculado ao vivo no Postgres. Era o que o PWA consumia (`supabaseAdapter.fetchPacientesPriorizados` + `distribuirSemana` no cliente). **Não** tem atribuição por ACS — devolve todos os pacientes da equipe e o front fatia a semana.
2. **Python** — `visitare-engine` (PRIO-ACS), que pontua C1–C4, atribui paciente→ACS, ordena e grava na tabela `allocations`. Mais completo, mas **estava desconectado** do front.

Manter os dois diverge a lógica e impede o modelo correto (lista semanal **por ACS**).

## Decisão

O **`visitare-engine` é a única fonte da verdade** da priorização e alocação. O fluxo é:

```
cron (semanal) → engine pontua + atribui ACS + aplica cap → grava `allocations`
              → PWA lê `allocations` do ACS logado (PostgREST/RPC) → ACS visita
              → captura offline (Dexie) → sync `visitas_capturadas`
              → realimenta a "última visita" do próximo ciclo
```

O PWA **nunca chama o engine** — só lê `allocations` do Supabase. O engine é um batch; não precisa estar "no ar" para o app funcionar (Railway/cron é só para regenerar periodicamente).

### Regras de alocação (implementadas)

- **Continuidade (microárea):** paciente com histórico de visita fica com o **último ACS** que o atendeu. Em produção isso virá do vínculo microárea→ACS do cadastro da prefeitura; hoje é proxy pelo `visitas.profissional_id` mais recente.
- **Balanceamento:** pacientes nunca-visitados são distribuídos por **score_sum guloso** (menor carga clínica primeiro) entre o roster de ACS da equipe — em vez de despejar todos num só.
- **Cap semanal:** **25 pacientes/ACS** (`patient_cap`). A lista da semana são os top-25 por prioridade; o excedente é **deferido** para semanas seguintes (o gap cresce → a prioridade sobe), **não realocado** — continuidade prevalece.

## Estado da implementação (2026-06-28)

Validado contra o dataset anonimizado (equipe demo: 1998 pacientes, 93 ACS):

- `allocations` aplicada no Supabase (migrations 006+007); RLS **off** na postura demo (`anon` lê) — ⚠️ reativar RLS+JWT (006 §RLS) antes de dado real.
- Índices em `visitas`/`pacientes` (migration 008) — resolveram timeout do role `anon`.
- Bugs do engine corrigidos: schema `equipes.endereco_*`, paginação/chunking PostgREST (URL-too-long + cap de 1000 linhas).
- Resultado com cap=25: max 25/ACS (mediana 10), 1026 alocados/semana, 972 deferidos.

## Rollback

- DB: `DROP TABLE allocations CASCADE;` (+ `DROP INDEX` dos 008) volta ao estado anterior.
- Dados do engine: `DELETE FROM allocations WHERE origin='engine';` (re-run é idempotente, upsert por `(clinic_id, acs_id, paciente_id, period_start)`).
- Código: `git revert` por commit.

## Pendências (próximos passos)

- RPC `acs_lista_semana(acs_id, period_start)` lendo `allocations JOIN pacientes`.
- Religar `supabaseAdapter` ao `acs_id` logado (substitui o RPC antigo + `distribuirSemana`).
- Modelo de identidade/login extensível para o SSO da prefeitura — ver ADR 0002 (a definir).
- Produção: reativar RLS+JWT; Railway+cron; vínculo microárea→ACS vindo do cadastro real.
