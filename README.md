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

O ACS do Rio é responsável por visitar ativamente ~750 pessoas em territórios
muitas vezes vulneráveis. Hoje ela decide quem visitar usando **memória,
papel e WhatsApp**. Não tem visão clara, na segunda de manhã, de quem é
prioridade na semana — e perde ~1h por dia transcrevendo no fim do dia o
que anotou em campo.

**ACS Digital** é um web app mobile-first que entrega ao ACS:

1. **Lista priorizada da semana**, com motivo e cadência do manual SUS por
   paciente. A lista reage **em tempo real**: quando o ACS termina uma
   visita, o ranking se reordena sozinho via Supabase Realtime.
2. **Briefing por paciente** — score 0–100 (4 componentes interpretáveis)
   + linha de cuidado + motivo curto, sempre como **insumo de decisão**,
   nunca como comando.
3. **Form contextual** durante a visita, adaptado ao perfil clínico do
   paciente. Salva offline (IndexedDB) e sincroniza com o Supabase quando
   há rede.
4. **Ficha estendida do paciente** que combina o cadastro do Vitacare com
   tudo que o ACS observou em campo — sem alterar a tabela base.

O sistema é **insumo para a decisão da ACS**, não substituto. Esse princípio
veio direto da entrevista com agentes em campo: *"um sistema nunca vai dar
a lista que eu realmente vou fazer"*.

### Impacto esperado

- **Reduzir ~1h/dia** de retrabalho do ACS no fim do dia (extrapolando para
  os 6.200 ACS da cidade, ~6.200h/dia recuperadas).
- **Famílias de alto risco alcançadas em dias, não semanas.**
- **Cuidado mais preventivo, menos reativo.**
- **Equidade:** detectar lacunas de cuidado por equipe/AP para a gestão.

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

🚧 _TBD — preview de Vercel será publicado durante a apresentação._

## Demo video

🚧 _60s de demo gravados antes da entrega aos juízes._

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

Detalhes de integração e schema: [`docs/SUPABASE.md`](docs/SUPABASE.md).

---

## Documentação

- 📋 [`docs/PRD.md`](docs/PRD.md) — produto, princípios e perguntas em aberto.
- 🏗️ [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitetura técnica
  completa, com foco em segurança e LGPD.
- 🗄️ [`docs/SUPABASE.md`](docs/SUPABASE.md) — schema do banco, todas as
  RPCs, padrão de Realtime e exemplos de uso com `supabase-js`.
- 📂 [`db/migrations/`](db/migrations/) — 5 migrations versionadas
  (schema → motor → Realtime → ficha estendida → picker).
- 📂 [`FICHAS/`](FICHAS/) — fichas oficiais SMS-Rio (Ficha A, Crônico,
  Gestante, Primeira Infância, Tuberculose) em PDF + JSON estruturado.
- 📂 [`manuais/`](manuais/) — manuais oficiais do Ministério da Saúde
  consultados na construção das regras.

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

---

## Status — hackathon `2026-05-24`

- [x] Exploração e perfilamento do dataset
- [x] Schema Postgres + carga dos 4 parquets no Supabase
- [x] Motor PRIO-ACS server-side (5 migrations aplicadas)
- [x] Ficha estendida (view + signals do form alimentam o motor)
- [x] Realtime: lista reage à captura em campo
- [x] Multi-ACS via picker + `equipe_do_profissional`
- [x] Web app mobile-first (lista · paciente · visita · supervisor)
- [x] Form contextual com perguntas oficiais e-SUS AB / SMS-Rio
- [x] PRD + arquitetura técnica + segurança/LGPD documentados
- [ ] Deploy preview público no Vercel
- [ ] Vídeo demo 60s

Critério do desafio: **primeiro commit após 09:30 de 24/05** ✅
