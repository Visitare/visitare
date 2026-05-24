# ACS Digital

Inteligência no território para apoiar a decisão diária dos Agentes
Comunitários de Saúde (ACS) da Atenção Primária do Rio de Janeiro.

> Hackathon **Claude Impact Lab 2026** — Anthropic + Prefeitura do Rio de
> Janeiro · `2026-05-24`

---

## Team

**Time:** ACS Digital

**Integrantes:**

- Vinicius Saraiva Andrade
- Rafael Bressan — [@rafaelbressan](https://github.com/rafaelbressan)
- Daniel Seraphim — [@danielseraphim](https://github.com/danielseraphim)
- Laura Soares Anderaus

**Tema:** Saúde

---

## Solution summary

O ACS do Rio é responsável por visitar ativamente ~750 pessoas em territórios
muitas vezes vulneráveis. Hoje ela decide quem visitar usando **memória,
papel e WhatsApp**. Não tem visão clara, na segunda de manhã, de quem é
prioridade na semana — e perde ~1h por dia transcrevendo no fim do dia o
que anotou em campo.

**ACS Digital** é um web app mobile-first que entrega ao ACS:

1. **Lista priorizada da semana**, agrupada por motivo (gestante sem visita,
   pós-urgência sem follow-up, hipertenso fora da cadência do manual, etc.).
2. **Briefing por paciente** com o porquê da prioridade — sempre como insumo,
   nunca como comando.
3. **Form contextual** durante a visita, gerado dinamicamente a partir do
   perfil clínico do paciente, usando os blocos do **e-SUS AB** e dos
   manuais do MS/SUS.

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
┌───────────────────────────────────────────────────────────────────────┐
│  PWA mobile (Next.js App Router) — Vercel, região São Paulo           │
│  · lista priorizada · briefing · form contextual · modo offline (PWA) │
└──────────────────────────────┬────────────────────────────────────────┘
                               │  supabase-js (anon key + JWT do ACS)
                               ▼
┌───────────────────────────────────────────────────────────────────────┐
│  Supabase Postgres (sa-east-1 · São Paulo)                            │
│  · pacientes · equipes · eventos · visitas · visitas_capturadas       │
│  · índices por equipe/paciente/data · RLS [roadmap]                   │
└───────────────────────────────────────────────────────────────────────┘
```

### Motor de priorização — heurística determinística

O score por paciente combina, no SQL/server, sinais cuja **regra está nos
manuais oficiais do MS/SUS** (não em pesos aprendidos):

- **Cadência mínima do manual** (criança 0–6 → 7–8 visitas/ano; gestante →
  mensal; hipertenso/diabético → 60–90 dias; idoso → trimestral).
- **Gap desde a última visita** vs. cadência esperada.
- **Eventos clínicos recentes** (urgência sobe; agendamento próximo sobe).
- **Vulnerabilidade social** (peso adicional).
- **Distância à unidade** (entra na roteirização, não no triagem clínica).

Optamos por **heurística sobre LLM em runtime** porque decisões de saúde
precisam ser auditáveis (critério de Engenharia do desafio) e os manuais já
codificam o conhecimento clínico necessário.

### Claude's role

Claude entrou no **desenvolvimento**, não na inferência clínica em produção:

- **Claude Code (CLI)** como copiloto durante o hackathon — exploração de
  dados (DuckDB sobre os parquets anonimizados), scaffolding do app,
  modelagem do schema Postgres, redação do PRD/arquitetura e do README do
  desafio.
- **Princípio de produto** validado em conversa — "briefing, não comando" —
  veio da entrevista com ACS e foi consolidado iterativamente com Claude.

A escolha de **não** usar LLM em runtime é deliberada: clínica é domínio
regulado, os manuais SUS são a fonte de verdade, e a auditabilidade do
ranking é um requisito.

📄 Detalhes em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Application URL

🚧 _TBD — preview de Vercel será publicado durante a apresentação._

## Demo video

🚧 _60s de demo gravados antes da entrega ao judges._

---

## Repositórios relacionados

- **Este repo** (`acs-digital`): documentação consolidada para os juízes.
- [`impact-lab-saude-app`](https://github.com/vinicius-saraiva/impact-lab-saude-app)
  — código do app (Next.js) em desenvolvimento.
- [`impact-lab-saude-17`](https://github.com/vinicius-saraiva/impact-lab-saude-17)
  — exploração de dados (marimo + DuckDB) e notas do desafio.
- [`prefeitura-rio/claude-impact-lab-saude`](https://github.com/prefeitura-rio/claude-impact-lab-saude)
  — dataset oficial anonimizado da Prefeitura.

> Tudo será **consolidado neste repositório** antes do final do hackathon.

---

## Documentação

- 📋 [`docs/PRD.md`](docs/PRD.md) — Product Requirements Document.
- 🏗️ [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitetura técnica
  com foco em segurança e LGPD.
- 🗄️ [`docs/SUPABASE.md`](docs/SUPABASE.md) — schema do banco e exemplos de
  uso para o frontend.

---

## Status — hackathon `2026-05-24`

- [x] Exploração e perfilamento do dataset
- [x] Modelagem do schema Postgres + carga no Supabase
- [x] PRD e arquitetura técnica (incl. segurança/LGPD)
- [ ] Motor de priorização — implementação server-side
- [ ] Web app mobile-first
- [ ] Form contextual com blocos do e-SUS AB
- [ ] Deploy + demo

Critério do desafio: **primeiro commit após 09:30 de 24/05** ✅
