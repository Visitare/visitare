# ACS Digital

Inteligência no território para apoiar a decisão diária dos Agentes
Comunitários de Saúde (ACS) da Atenção Primária do Rio de Janeiro.

> Hackathon **Claude Impact Lab 2026** — Anthropic + Prefeitura do Rio de
> Janeiro · `2026-05-24`

---

## Team

**Time:** ACS Digital

**Integrantes:**

- Laura Soares Anderaus
- Vinicius Saraiva Andrade
- Rafael Bressan
- Daniel Seraphim
- Leonardo Santos

**Tema:** Saúde

---

## Solution summary

**Claudia** é ACS há 8 anos no Rio. Responsável por ~750 pessoas. Toda segunda de manhã ela decide quem visitar de cabeça, com caderno e WhatsApp. Não sabe se a Dona Maria — diabética, sumida do posto há 3 meses — está bem. No fim do dia gasta ~1h transcrevendo em papel para o sistema. Todo dia.

O problema não é dedicação. É falta de informação organizada na hora certa.

**ACS Digital** entrega a Claudia:

1. **Lista priorizada da semana** — quem visitar, por quê, com que cadência. A lista reage em tempo real: ao registrar uma visita, o ranking se reordena sozinho.
2. **Briefing antes de bater na porta** — condições crônicas, última visita, alertas clínicos do Vitacare + o que ela mesma anotou em campo.
3. **Formulário contextual durante a visita** — adaptado ao perfil do paciente, funciona offline, sincroniza quando volta à cobertura.

Claudia não perde mais 1h transcrevendo. E a Dona Maria não cai no esquecimento.

> *"um sistema nunca vai dar a lista que eu realmente vou fazer"* — ACS entrevistada no desenvolvimento. O ACS Digital é **insumo para a decisão da Claudia, nunca substituto.**

### Impacto esperado

- **~1h/dia recuperada por ACS** — 6.200 ACS no Rio: ~6.200h/dia devolvidas ao cuidado.
- **Famílias de alto risco alcançadas em dias, não semanas.**
- **Cuidado preventivo, não reativo** — o motor prioriza quem está no limiar, não só quem já está em crise.
- **Equidade e gestão** — supervisores enxergam lacunas de cobertura por equipe e AP.

---

## Architecture / approach

```
┌──────────────────────────────────────────────────────────────────────┐
│  PWA mobile (Vite + React 19, mobile-first, IndexedDB offline)       │
│  Deploy: Vercel sa-east-1 (São Paulo)                                │
│  · /selecionar-acs · lista priorizada · ficha · form · supervisor    │
└──────────────────────────────┬───────────────────────────────────────┘
                               │  supabase-js (anon key + JWT no piloto)
                               │  Realtime via WebSocket
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Supabase Postgres 17 — sa-east-1 (São Paulo, residência BR)         │
│                                                                      │
│  Tabelas: pacientes · equipes · eventos · visitas · visitas_capturadas
│                                                                      │
│  VIEW pacientes_ficha_extendida = pacientes (Vitacare)               │
│                               + LATERAL JOIN última captura do ACS   │
│                                                                      │
│  RPCs (PRIO-ACS — heurística determinística, sem LLM):               │
│  · priorizacao_pacientes(equipe, ref_date)                           │
│  · paciente_detalhe(paciente_id, ref_date)                           │
│  · dashboard_equipe(equipe, ref_date)                                │
│  · equipe_do_profissional(profissional_id)                           │
│  · acs_demo_options()                                                │
│                                                                      │
│  Realtime ligado em: visitas_capturadas, eventos, visitas            │
└──────────────────────────────────────────────────────────────────────┘
```

### Motor de priorização — heurística determinística (PRIO-ACS)

Score 0–100 por paciente, 4 componentes aditivos baseados em fontes
oficiais (Portaria SAS/MS 221/2008, manuais ACS-MS, fichas SMS-Rio):

```
ICSAP proxy (35)        +  Vulnerable life-stage (25)
  +15 hipertenso             25 gestação
  +15 diabético              20 0-6 anos
  +15 gestação               15 idoso crônico

Care gap / urgency (25) +  Social vulnerability (15)
  +15 evento não-eletivo     15 vulnerabilidade social
       60d (Vitacare OU
       sinal do ACS no
       form)
  +10 gap > cadência         = score 0–100
       manual                = tier alto (≥61) /
                              medio (31–60) /
                              habitual (≤30)
```

**Por que heurística (não LLM em runtime):** decisões de saúde precisam ser
**auditáveis** (critério de Engenharia do desafio). Os manuais SUS já
codificam o conhecimento. LLM em decisão clínica é risco regulatório sem
ganho. O motor é SQL puro — qualquer um pode inspecionar a regra.

### Loop fechado de tempo real

```
ACS termina visita no app
  ↓
INSERT em visitas_capturadas (jsonb com 60+ campos do form)
  ↓
Supabase Realtime emite postgres_changes
  ↓
Todos os clients refazem priorizacao_pacientes
  ↓
Motor recalcula:
  - ultima_visita = MAX(visitas, capturado_em)  ← gap zera
  - se ACS reportou UPA no form: evento_recente_60d = TRUE
  - motivo_curto cita "Visitada hoje pelo ACS."
  ↓
Lista se reordena sozinha
```

### Identidade do ACS → equipe

Cada ACS pertence a uma equipe. Cada equipe tem ~2 000 pacientes
amostrados. O flow:

1. ACS faz login (MVP: picker mostra 10 ACSs reais do dataset; piloto:
   ConecteSUS Profissional via OIDC).
2. `equipe_do_profissional(profissional_id)` resolve a equipe.
3. `priorizacao_pacientes(equipe_id)` retorna só os pacientes daquela
   equipe — **identity-bound queries** server-side.
4. Trocar de ACS no app muda toda a lista; multi-tenant nativo.

### Claude's role

Claude entrou no **desenvolvimento**, não na inferência clínica em produção:

- **Claude Code (CLI da Anthropic)** atuou como copiloto durante as ~7h
  do hackathon — exploração de dados (DuckDB sobre os parquets
  anonimizados), modelagem do schema Postgres, codificação das funções
  SQL do motor PRIO-ACS, scaffolding dos hooks e páginas do app,
  redação do PRD, da arquitetura técnica e do README.
- **Princípio de produto** "briefing, não comando" — validado em
  conversa, vindo da entrevista com ACS e consolidado iterativamente
  com Claude.

A escolha de **não** usar LLM em runtime é deliberada: clínica é domínio
regulado, os manuais SUS são a fonte de verdade, e a auditabilidade do
ranking é um requisito (não opcional). Detalhes em
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Application URL

**https://acs-digital.vercel.app**

## Demo video

**[Assistir no Google Drive](https://drive.google.com/file/d/1-GGOJNMB0wRv3bVE9JJEJ8ZuEJsQX9lj/view?usp=sharing)**

---

## Como rodar localmente

```bash
# 1. backend (Supabase já está no ar — sa-east-1)
#    URL: https://gyutcqmrbbtftrowcyhv.supabase.co
#    schema + dados aplicados via db/migrations/ + scripts/setup_supabase.py

# 2. frontend
cd frontend
cp .env.example .env.local
# preencher VITE_SUPABASE_ANON_KEY (Dashboard Supabase → Settings → API → anon public)
npm install
npm run dev
# → http://localhost:5173
```

Detalhes de integração e schema: [`docs/supabase.md`](docs/supabase.md).

---

## Documentação

- [`docs/prd.md`](docs/prd.md) — produto, princípios e perguntas em aberto.
- [`docs/architecture.md`](docs/architecture.md) — arquitetura técnica completa, com foco em segurança e LGPD.
- [`docs/supabase.md`](docs/supabase.md) — schema do banco, todas as RPCs, padrão de Realtime e exemplos de uso com `supabase-js`.
- [`db/migrations/`](db/migrations/) — migrations versionadas (schema → motor → Realtime → ficha estendida → picker).
- [`docs/fichas/`](docs/fichas/) — fichas oficiais SMS-Rio (Ficha A, Crônico, Gestante, Primeira Infância, Tuberculose) em PDF + JSON estruturado.
- [`docs/manuais/`](docs/manuais/) — manuais oficiais do Ministério da Saúde consultados na construção das regras.

---

## Stack técnica

| Camada | Tecnologia | Por quê |
|---|---|---|
| Frontend | **Vite + React 19**, Tailwind v4, react-router, **Dexie (IndexedDB)** | Mobile-first, offline-first, deploy 1-clique no Vercel |
| Mapa | **Leaflet + react-leaflet** | OpenStreetMap, sem chave de API |
| Realtime | **Supabase Realtime (WebSocket)** | Loop fechado captura → score |
| Backend | **Supabase Postgres 17** (sa-east-1) | RLS pronto, REST/RPC auto-gerado, Realtime nativo |
| Motor | **SQL puro** com `STABLE` functions | Auditável, determinístico, sem dependência de LLM |
| Dataset | **4 parquets anonimizados** (Prefeitura do Rio) | k-anon ≥ 5, date-shifted, ruído geo 100m |

