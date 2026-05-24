# Arquitetura — ACS Digital

Visão técnica do MVP do hackathon, com foco em **segurança e LGPD**, mesmo
que a auth real só entre no piloto pós-hackathon. O objetivo é deixar
explícito o que está implementado hoje, o que é roadmap, e por que cada
decisão foi tomada.

---

## 1. Stack

```
PWA mobile (Next.js App Router) — Vercel sa-east (São Paulo)
        │
        │  supabase-js
        ▼
Supabase Postgres + Auth — sa-east (São Paulo)
```

| Camada | Escolha | Por quê |
|---|---|---|
| Frontend | **Next.js** App Router, mobile-first, PWA | TypeScript end-to-end, deploy em 1 clique no Vercel, PWA cobre o caso de campo |
| Hospedagem | **Vercel** região sa-east-1 | residência BR, fluid compute, preview por PR |
| Backend | **Supabase** (Postgres + Auth + REST/Realtime) | esquema relacional bate com o dataset, RLS nativo mapeia identidade-bound queries, anon key + JWT são o suficiente pro MVP |
| Motor de priorização | **SQL puro** + funções server-side | auditável, determinístico, sem dependência de LLM |

Decisão deliberada: **sem LLM em runtime**. Manuais MS/SUS + forms do
e-SUS AB já dão as regras. LLM entra só como ferramenta de desenvolvimento
(Claude Code).

---

## 2. Modelo de ameaças

| Ativo | Sensibilidade | Ameaças realistas |
|---|---|---|
| PII + condições clínicas | **LGPD art. 11 — dado sensível** | device perdido, sniffing em WiFi, acesso indevido por terceiro, exfiltração via screenshot |
| Token/sessão do ACS | Alta | roubo de device, phishing, replay |
| Lista priorizada por território | Média | inferência de vulnerabilidade de famílias específicas |
| Registro de visita | Alta | integridade, repúdio |
| Logs e telemetria | Média | PII vazando |

**Adversários considerados:** roubo/perda do celular do ACS, terceiro
malicioso em rede pública, insider acessando fora do escopo.

**Fora de escopo:** ator estatal, comprometimento de vendor — risco residual
gerenciado por contrato e por design.

---

## 3. Decisões por camada

### 3.1 Identidade

**MVP (hackathon):**
- Dropdown na tela inicial seleciona o ACS (mapeia para `profissional_id`
  real do dataset). Backend assina um JWT curto (`HS256`, segredo em env)
  com claims `{ acs_id, equipe_id }`.

**Produção:**
- **ConecteSUS Profissional** (OIDC) ou gov.br. Não construímos auth própria.
- Token curto (5–15 min) + refresh rotativo.
- Vinculação do CPF do ACS via cadastro do gestor da unidade.

### 3.2 Autorização — identity-bound queries

Em **todas** as rotas do servidor, o filtro de escopo (`equipe_id`,
`unidade_id`) vem do JWT, **nunca** do cliente.

- ACS vê só seus pacientes.
- Gerente vê só sua unidade.
- Coordenador vê só sua área programática.

**Implementação Supabase:** Row Level Security com policies que comparam
`auth.jwt() -> 'equipe_id'` à coluna `equipe_id`. Mesmo se o anon key
vazasse, dados ficariam protegidos pela policy.

### 3.3 Dados em trânsito

- TLS 1.3 obrigatório (Vercel + Supabase default).
- HSTS preload.
- Cert pinning no PWA quando viramos app real (roadmap).
- Payloads enxutos por tela — lista não traz PII (CPF, endereço), só id
  + iniciais + motivo. Detalhe é fetch separado, registrado em audit.

### 3.4 Dados em repouso

- **Backend:** Postgres com criptografia at-rest (Supabase default).
  Backups na mesma região (sa-east-1).
- **Device:** PWA armazena só o **trabalho do dia ativo**. Storage cifrado
  (chave derivada da sessão via WebCrypto). Logout limpa tudo.
- Nenhum cache durável de dados de paciente fora da sessão ativa.

### 3.5 Residência de dados

**100% Brasil.** Vercel sa-east-1 + Supabase sa-east-1. Nenhum vendor de
logging/analytics fora do BR sem DPA explícito.

### 3.6 Audit log

Toda leitura individual de paciente (lista é agregada; detalhe é PII) gera
linha de log: `{ acs_id, paciente_id, ts, motivo }`. Append-only.

**MVP:** stub em console. **Produção:** tabela `audit_log` separada ou
`pg_audit`.

LGPD art. 18: titular pode pedir "quem acessou meus dados" — o audit log
responde.

### 3.7 Telemetria

Sem PII em mensagens de erro, mesmo em dev. Erros retornam `paciente_id`
(hash) e código — nunca nome/CPF/endereço.

---

## 4. A ponte com o Vitacare

O Vitacare é o sistema-fonte oficial (`http://192.168.1.251/vitacare`) e é
**LAN-only** por design — só acessível dentro do WiFi da clínica.

Três opções para devolver os dados capturados:

| Opção | Como funciona | Trade-off |
|---|---|---|
| **A. Extensão Chrome** | Injeta no front do Vitacare quando ACS está logada na clínica | Funciona sem mudar o Vitacare; superfície de ataque alta (XSS na extensão = acesso à sessão); exige hardening |
| **B. API oficial via SMS-Rio** | Convênio servidor-a-servidor | Caminho correto, único que escala e audita bem; depende de aprovação da SMS |
| **C. Relay local na unidade** | App detecta WiFi da clínica e empurra para um relay que fala com Vitacare na LAN | Preserva isolamento; precisa instalar relay em cada unidade |

**Hoje (demo):** o envio é **simulado** — registramos em
`visitas_capturadas` com `sincronizado_vitacare=false`. **Piloto:** começar
por (A) com escopo mínimo enquanto se negocia (B).

---

## 5. O que está no MVP do hackathon vs. roadmap

| Item | MVP | Roadmap pós-piloto |
|---|---|---|
| Auth | dropdown de ACS + JWT assinado | ConecteSUS Profissional (OIDC) |
| Autorização | filtro server-side pelo claim | RLS no Postgres com policies |
| Audit log | console | tabela append-only + retenção legal |
| Modo offline | localStorage simples | PWA + IndexedDB cifrado |
| Ponte Vitacare | simulada (flag no banco) | extensão Chrome ou API SMS-Rio |
| Cert pinning | — | sim |
| Pen test | — | antes do piloto |
| DPO | — | designar canal |

---

## 6. Mapeamento aos critérios do desafio

| Critério (peso) | Como atendemos |
|---|---|
| **Real Impact (40%)** | -1h/dia de ACS × 6.200 = ~6.200h/dia recuperadas. Dataset e equipes reais. Direção clara para piloto (Vitacare bridge). |
| **Product Quality (20%)** | Mobile-first, ACS opera sem treino, form contextual reduz esquecimento; princípio "briefing, não comando" vindo da entrevista com ACS. |
| **Engineering (20%)** | Identity-bound queries, audit log, residência BR, schema relacional indexado, motor de priorização determinístico e interpretável. Caminho explícito para produção. |
| **Idea (10%)** | Não-LLM em runtime + form contextual ancorado no e-SUS AB. Princípio de produto não-óbvio. |
| **Presentation (10%)** | Demo ao vivo do mobile, narrativa de 6 min, README completo. |

---

## 7. Premissas e questões em aberto

- **ConecteSUS vs gov.br** — qual está disponível para ACS hoje?
- **Acordo com SMS-Rio** — quem aprova a bridge oficial?
- **DPO/encarregado** — quem é o DPO designado pela prefeitura?
- **Treinamento do ACS** — phishing, perda de device, screenshots —
  política clara.
- **Pen test** — orçar antes do piloto.
