# Arquitetura — Visitare

> Versão 1.0 — 2026-06-02
> Documento-fonte da arquitetura do sistema. Alimenta geração de tarefas.
> Complementa: `TODO.md` (o quê fazer), `docs/engine-spec.md` (o motor PRIO-ACS),
> `docs/prd.md` (produto), `docs/supabase.md` (schema atual).
>
> Convenção: blocos marcados **[PROPOSTA]** são decisões recomendadas mas ainda
> não confirmadas — não gerar tarefas de implementação a partir delas sem aval.
> Blocos **[EM ABERTO]** são questões para discutir antes de modelar.

---

## 1. O que é o Visitare

Plataforma de apoio ao **Agente Comunitário de Saúde (ACS)** da Atenção Primária.
Coloca no celular da ACS, em campo, na porta do paciente: a lista priorizada de
visitas, a ficha clínica e o formulário de captura — eliminando ~1h/dia de
re-digitação. Funciona offline. Devolve os dados para o sistema oficial do
município (no Rio, o Vitacare).

O Visitare é **multi-cliente (white-label)**: um único produto que cada município
contratante veste com sua própria marca. Não são 300 apps — é um app que se adapta.

Nasceu no **Claude Impact Lab Rio** (1º lugar, 2026). O motor de priorização
PRIO-ACS está em processo de patente (INPI) e vive em repositório próprio.

---

## 2. Topologia do sistema

```
                         ┌─────────────────────────────────────┐
                         │            visitare.app             │
                         │   site/  ·  Astro  (marca Visitare) │  ← marketing + blog
                         └─────────────────────────────────────┘
                                          │  CTA
                                          ▼
   ┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
   │  <muni>.app.visitare │   │  painel.visitare.app │   │   App Store / Play   │
   │  app/  · React+Vite  │   │ dashboard/ React+Vite│   │   mobile/  · Expo    │
   │  PWA, offline, ACS   │   │  gestor, online      │   │  nativo (futuro)     │
   │  WHITE-LABEL         │   │  WHITE-LABEL admin   │   │  WHITE-LABEL         │
   └──────────┬───────────┘   └──────────┬───────────┘   └──────────┬───────────┘
              │  supabase-js              │                          │
              └───────────────┬──────────┴──────────────────────────┘
                              ▼
              ┌───────────────────────────────────┐
              │      Supabase (Postgres)          │   sa-east-1 (São Paulo)
              │  · dados clínicos (pacientes…)    │
              │  · allocations  (motor escreve)   │
              │  · visitas_capturadas (app escreve)│
              │  · tenants  (config white-label)  │
              │  · RLS (4 níveis de role)         │
              │  · materialized views (relatórios)│
              │  · Edge Functions (export PDF/XLS)│
              └───────────────┬───────────────────┘
                  ▲ service_role│           ▲ sync (futuro)
                  │             │           │
   ┌──────────────┴──────┐     │   ┌────────┴──────────┐
   │  PRIO-ACS Engine    │     │   │     Vitacare      │
   │  repo privado·FastAPI│    │   │  sistema oficial  │
   │  cron por clínica   │─────┘   │  (LAN da clínica) │
   │  escreve allocations│         └───────────────────┘
   └─────────────────────┘
```

Quatro superfícies de frontend, um banco, um motor separado.

---

## 3. Monorepo

```
visitare/
├── site/        Astro       → visitare.app           marca Visitare (marketing + blog)
├── app/         React/Vite  → <muni>.app.visitare.app ACS de campo, PWA offline · white-label
├── dashboard/   React/Vite  → painel.visitare.app    gestor da clínica/distrito/município, online · white-label
├── mobile/      Expo        → App Store / Play        nativo (track futuro)
├── db/          Supabase    migrations + funções SQL  (é o backend)
├── data/        parquets    dataset do hackathon (removido quando Vitacare conectar)
├── scripts/     loaders e utilitários
└── docs/        este doc + engine-spec + prd + supabase
```

Dois projetos Vercel apontando para o mesmo repo via `rootDirectory`:
`site/` → `visitare.app`; `app/` e `dashboard/` → seus subdomínios.

> O **motor PRIO-ACS não está no monorepo** — vive em `rafaelbressan/prio-acs-engine`
> (privado), por causa da patente e do ciclo de calibração próprio. Ver §11.

---

## 4. Decisões de stack (e o porquê)

| Superfície | Stack | Por quê |
|---|---|---|
| **site/** | Astro + Content Collections | Marketing estático: rápido, SEO, blog em markdown. Zero JS por padrão. |
| **app/** | React 19 + Vite 8, PWA | Offline-first com `vite-plugin-pwa`+`workbox`, cache em Dexie (IndexedDB), instalável. SSR seria pior aqui — o app roda no device da ACS, sem servidor. |
| **dashboard/** | React 19 + Vite | **Mesma stack do app** → componentes, client Supabase, types e auth compartilhados. Ver decisão Vite-vs-Next abaixo. |
| **mobile/** | Expo (React Native) | iOS App Store, push, features nativas. Espelha o PWA. |
| **db/** | Supabase (Postgres) | É o backend. Funções SQL = lógica de negócio. RLS = segurança por linha. Realtime, Storage, Edge Functions inclusos. Residência BR (sa-east-1). |
| **engine** | FastAPI (Python) | Impl de referência já em Python; calibração e futura camada de ML vivem melhor no ecossistema Python. Repo separado. |

### 4.1 Decisão: dashboard em Vite, **não** Next.js

O painel do gestor é um produto diferente do app de campo (desktop/online vs
mobile/offline) — por isso **não** mora dentro do PWA. Mas **também não precisa
ser Next.js.** Racional, com as contas de escala (§6) na mesa:

- O que o Next agregaria — fetch e agregação no servidor — **o Postgres já faz**.
  Relatório anual = `materialized view`, devolvida via RPC já agregada (payload
  pequeno). O "servidor" pesado é o banco, não um servidor Next.
- Os 4 níveis de role são **RLS no Postgres** — idênticos seja o front Vite ou Next.
- Export de PDF/Excel (o único item que ganha de servidor) = **uma Edge Function**,
  não justifica reescrever o painel inteiro.
- O que parece "base de mercado pra dashboard" (shadcn/ui, TanStack Table/Query,
  Recharts) **roda igual em Vite.** Ganha-se a DX sem a 4ª stack.

**Mantém 3 stacks** (Astro · React · Expo) e reaproveita tudo entre `app/` e
`dashboard/`. Único cenário que viraria a decisão pro Next: o painel virar uma
**fábrica de relatórios server-side** como centro do produto — não é o caso de um
painel operacional. Se a camada Visitare virar BI de verdade (cross-cliente, anos,
bilhões de linhas), a resposta também não é Next — é **data warehouse** (BigQuery /
read-replica / ClickHouse) + camada de BI. Outro problema, outro momento.

### 4.2 Sem LLM em runtime

Decisão deliberada herdada do hackathon: o motor é **determinístico e auditável**
(portarias MS/SUS), sem LLM em produção. LLM entra só como ferramenta de
desenvolvimento. Isso é requisito de confiança institucional, não limitação técnica.

---

## 5. Modelo de dados e os 4 níveis de role

### 5.1 Multi-tenant em um único projeto Supabase ✅ confirmado

Um banco, com `tenant_id` (município) propagado nas tabelas, isolado por RLS —
**não** um projeto Supabase por município. Motivo: o Visitare precisa de queries
**cross-tenant** (ver todos os clientes, agregados por município), o que seria
inviável entre projetos isolados. Hierarquia geográfica:

```
municipio  →  distrito (Área Programática / CAP)  →  clinica (equipe)  →  ACS  →  paciente
```

### 5.2 Os 4 níveis de role

Toda query de escopo vem do **claim no JWT**, nunca do cliente. RLS compara o claim
à coluna correspondente:

| Role | Vê | Policy RLS |
|---|---|---|
| **ACS** | seus pacientes | `acs_id = jwt.acs_id` |
| **gestor_clinica** | sua clínica (5–10 ACS) | `clinica_id = jwt.clinica_id` |
| **gestor_distrito** | todas as clínicas do distrito | `distrito_id = jwt.distrito_id` |
| **gestor_municipal** | todo o município, por distrito | `municipio_id = jwt.municipio_id` |
| **visitare_admin** | **todos os municípios/clientes** | bypass (super-admin) |

Mesmo se a anon key vazasse, os dados ficam protegidos pela policy. O `service_role`
(usado só pelo motor e por jobs) ignora RLS — nunca vai pro frontend.

> Auth: no MVP, seleção de ACS + JWT assinado. Produção: ConecteSUS Profissional
> (OIDC) ou gov.br — não construímos auth própria. Ver §13.

---

## 6. Escala e estratégia de relatórios

### 6.1 Volumetria (Rio: 6.200 ACS, 250 dias úteis/ano)

| | Por ACS/ano | Por clínica/ano (8 ACS) | Rio/ano | Rio/5 anos |
|---|---|---|---|---|
| Visitas (6/dia) | 1.500 | 12.000 | 9,3 M | ~46 M |
| Forms (~1,5/visita) | ~2.250 | ~18.000 | ~14 M | ~70 M |
| Cadastros (15/sem) | 750 | 6.000 | 4,65 M | ~23 M |
| **Total** | **~4.500** | **~36.000** | **~28 M** | **~140 M** |

**Escrita:** ~28M/ano ÷ 250d ÷ 8h ≈ **~3,8 writes/s** em média. Carga trivial pro
Postgres. As tabelas de alto volume (visitas, forms) são **append-only** —
particionar por mês/ano quando passar de dezenas de milhões.

### 6.2 Relatórios = trabalho do Postgres, não do front

Relatório anual municipal agrega ~28M linhas. **Nunca** no browser nem com `select *`:

- **Materialized views** com rollups (por ACS, clínica, distrito, município),
  recalculadas de madrugada. A query devolve o **resumo** (centenas de linhas).
- Funções **RPC** expõem o agregado já pronto; o front renderiza JSON pequeno.
- Métricas-alvo do painel: cumprimento de lista de visitas, cadastros/semana,
  horas em atividade, cobertura por território, indicadores Previne Brasil.

Por isso a escala do Rio **não força o Next** (§4.1): o peso mora no banco.

---

## 7. White-label / motor de temas

O Visitare é **um app** que cada cliente veste. A ideia **não** é fazer release de
N apps — é um app que se adapta por configuração lida do backend.

### 7.1 O que é configurável por tenant

- **Cores** (primária, acento, superfície, tinta)
- **Roundness** de botões e cards (`--radius`)
- **Fonte** (sans/mono)
- **Logo** (claro/escuro/ícone)
- **Nome do app** (no manifest / home screen)

### 7.2 Onde mora a config — tabela `tenants`

```sql
tenants (
  tenant_id   text primary key,   -- 'rio-de-janeiro'
  nome        text,               -- 'Prefeitura do Rio de Janeiro'
  nivel       text,               -- 'municipio'
  subdomain   text,               -- 'rio' → rio.app.visitare.app
  app_name    text,               -- nome no manifest / ícone do celular
  logo_url    text,               -- Supabase Storage
  theme       jsonb,              -- design tokens (ver abaixo)
  ativo       bool
)
```

```jsonc
// tenants.theme
{
  "colors": { "primary": "#173C72", "accent": "#F26849", "surface": "#FFF", "ink": "#15203A" },
  "radius": { "button": "12px", "card": "16px" },
  "font":   { "sans": "IBM Plex Sans", "mono": "IBM Plex Mono" },
  "logo":   { "light": "url", "dark": "url", "icon": "url" }
}
```

### 7.3 Como o tema é aplicado — design tokens via CSS vars

O app já usa **Tailwind 4**, cujo theming é baseado em CSS custom properties. O fluxo:

1. App detecta o tenant (ver 7.4) e busca `tenants.theme`.
2. Injeta os tokens como CSS vars no `:root` (`--color-primary`, `--radius-button`…).
3. Tailwind e os componentes leem as vars → **reskin instantâneo**, sem rebuild.
4. Cacheia o tema no Dexie → funciona offline e não pisca no próximo load.

### 7.4 Detecção de tenant — subdomínio ✅ confirmado

Cada cliente acessa por `<municipio>.app.visitare.app` (ex.: `rio.app.visitare.app`).
Vantagens sobre uma URL única com tenant resolvido pós-login:

- Branding **antes do login** (a tela de entrada já é do município).
- **Manifest dinâmico por subdomínio** → ícone/nome próprios na home screen (7.5).
- Isolamento limpo; tenant conhecido no primeiro byte.

Custo: um wildcard DNS `*.app.visitare.app → Vercel` e o app lendo o tenant do
hostname. Trivial.

### 7.5 Ícone no celular por município — a parede técnica **[EM ABERTO]**

Seu pedido ("mudar o ícone no celular dela conforme o município") esbarra em
limites de plataforma. A realidade honesta:

- **PWA (app/):** ✅ **dá.** Com subdomínio por tenant, servimos um
  `manifest.webmanifest` dinâmico com `name`, `theme_color` e `icons` daquele
  município. Cada município **instala "o app dele"**, com ícone e nome próprios.
  Granularidade = por município (todos os ACS do mesmo município compartilham o
  ícone) — o que é exatamente o desejado. **Isto reforça PWA-first.**
- **Nativo (mobile/ Expo):** ⚠️ **não dá** de forma dinâmica. O ícone é compilado no
  binário. iOS permite "alternate icons" e Android `activity-alias`, mas só entre um
  **conjunto pré-empacotado** — exige conhecer os clientes no build e embutir todos
  os ícones. Ícone verdadeiramente dinâmico por novo cliente = só com build por
  tenant, que você (com razão) não quer manter.

> Conclusão prática: cores/logo/fonte **dentro** do app são dinâmicas em todas as
> plataformas; o **ícone da home screen** é dinâmico no PWA e estático/limitado no
> nativo. ✅ **Decidido:** no Expo, ícone **Visitare genérico** no lançamento;
> pré-empacotar ícones dos clientes grandes só se/quando valer. O PWA cobre o caso
> "ícone do município" sem custo.

### 7.6 Quem edita os temas — o painel Visitare

O role `visitare_admin` no `dashboard/` tem um **editor de tema por tenant**: muda
cores/roundness/fonte/logo → grava em `tenants.theme` → o app daquele município pega
no próximo load (ou via Realtime para preview ao vivo). É assim que "gerimos o estilo
de cada app deployado direto pelo backend" sem tocar em código.

### 7.7 Dois planos de configuração — não confundir

| Config | Onde | Editada por | Frequência |
|---|---|---|---|
| **Tema / marca** (white-label) | tabela `tenants` (Supabase) | painel Visitare, ao vivo | quando o cliente quiser |
| **Pesos do score** (calibração) | YAML no repo do engine | revisão de código + análise matemática | raro, versionado |

Visual é dado operacional editável; matemática do motor é código calibrado. Separados
de propósito.

---

## 8. Painel do gestor (`dashboard/`)

App React/Vite separado, desktop, online, white-label. Funcionalidades por role:

**Gestor de clínica** (5–10 ACS):
- Gerir ACS da clínica (cadastro, ativação)
- Localização das ACS em campo (Leaflet) — **atualização sob demanda** (8.2)
- Cumprimento da lista de visitas (planejado vs realizado)
- Cadastros/semana, horas em atividade por ACS (derivado dos carimbos de visita)
- Editar a lista de qualquer ACS (8.1)
- Relatórios anuais da clínica

**Gestor de distrito:** o acima, agregado por todas as clínicas do distrito.

**Gestor municipal:** tudo do município, quebrado por distrito.

**Visitare admin:** todos os clientes/municípios; busca de dados agregados
cross-tenant; editor de white-label (§7.6).

Itens de relatório saem de materialized views (§6.2). Export PDF/Excel via Edge
Function.

### 8.1 A lista é orientação, não meta — propriedade e origem

O motor **gera** a lista, mas ela é editável depois: o gestor pode sobrescrever,
alterar, reduzir ou aumentar conforme a necessidade. No futuro, a própria ACS poderá
**adicionar um paciente vinculado à clínica** (ex.: está passando perto da casa e
quer registrar como a pessoa está) — buscando por **nome** ou **nome + data de
nascimento** na carteira de pacientes da clínica.

Requisito central: **o backend sempre sabe em qual lista a pessoa está**, tenha a
entrada sido criada pelo motor, pelo gestor ou pela ACS. Isso exige um campo de
**origem** em `allocations` e uma regra de upsert que respeite entradas manuais:

```sql
allocations.origin       text   -- 'engine' | 'gestor' | 'acs'
-- índice em (paciente_id, period_start) → "em qual lista está esta pessoa?"
```

Regra do motor no re-run (detalhe em `engine-spec.md §6`):
- Linhas `origin = 'engine'` e `status = 'pending'` → recalculadas/realocadas
  normalmente.
- Linhas `origin in ('gestor','acs')` → **preservadas intactas** — o motor nunca
  move nem remove o que foi posto à mão.
- Linhas `status in ('visited','skipped')` → preservadas, qualquer origem.

Assim a lista é um **briefing** (consistente com `prd.md §5`): o motor sugere, humano
decide, e a decisão humana é soberana sobre a sugestão.

### 8.2 Atualização do painel — pull manual com cooldown

Sem rastreamento contínuo (decisão de privacidade e bateria): o painel é atualizado
**sob demanda**. O gestor clica "Atualizar" → o backend busca o estado atual das ACS
(últimas visitas registradas, posição do último registro) e repinta o painel. Botão
com **cooldown de 1 minuto** antes de poder acionar de novo. "Horas em atividade"
é derivada dos carimbos de tempo das visitas/cadastros — não de GPS em background.

### 8.3 Indicadores Previne Brasil — feature-âncora [ROADMAP]

O **Previne Brasil** (Portaria MS 2.979/2019) financia a Atenção Primária amarrando
parte do repasse federal a **7 indicadores de pagamento por desempenho**. O trabalho
da ACS alimenta vários deles diretamente — então um painel que mostra ao gestor "onde
sua equipe está nos 7 indicadores que decidem o repasse" **liga o app da ACS ao
financiamento da prefeitura**. É argumento de venda central, não detalhe.

Mapeamento indicador → o app da ACS alimenta?

| # | Indicador Previne | App da ACS alimenta? | Via |
|---|---|---|---|
| 1 | Gestantes com ≥6 consultas pré-natal (1ª até 12ª sem) | parcial | acompanhamento/lembrete de gestante; consulta é na UBS |
| 2 | Gestantes com testes de sífilis e HIV | parcial | sinaliza pendência; coleta é clínica |
| 3 | Gestantes com atendimento odontológico | parcial | sinaliza pendência |
| 4 | Mulheres com citopatológico (Papanicolau) | parcial | busca ativa / lembrete |
| 5 | Crianças <1 ano com vacinas (Penta + Pólio) | **sim** | bloco vacinação no form de visita (0-6) |
| 6 | Hipertensos com PA aferida no semestre | **sim** | aferição de PA no form do hipertenso |
| 7 | Diabéticos com hemoglobina glicada solicitada | parcial | sinaliza pendência de exame |

Onde marca **sim**, a captura em campo da ACS é fonte direta do dado; onde marca
**parcial**, o app faz **busca ativa** (coloca o paciente pendente na lista) mas o
registro oficial vem da UBS. O painel consolida via materialized views (§6.2),
quebrando por ACS / clínica / distrito / município, e — para o gestor — destacando
quem está **abaixo da meta** de cada indicador.

> Roadmap, não MVP. Mas o modelo de dados de captura (`visitas_capturadas`) já deve
> nascer com os campos que alimentam os indicadores 5 e 6, para não exigir migração
> depois.

---

## 9. Site (`site/`, Astro)

Marca **Visitare** (nova identidade em construção — fontes/cores próprias,
distintas do tema dos apps). Porta a LP de `landing/` (8 seções, ver
`landing/landingpage.md`) para componentes Astro.

**Blog:** Astro Content Collections — artigos em markdown em `src/content/blog/*.md`,
com layout próprio e índice. Para publicar conteúdo (casos, resultados, institucional)
sem deploy de código novo a cada artigo.

```
site/src/
├── content/blog/*.md        artigos
├── content.config.ts        schema do collection
├── layouts/                 Base, Post
├── components/              Hero, Problema(Claudia), Solucao, Motor, Impacto, …
└── pages/
    ├── index.astro
    ├── blog/index.astro     listagem
    └── blog/[slug].astro    artigo
```

CTA do site → `<muni>.app.visitare.app` (ou tela de seleção de município).

---

## 10. App de campo (`app/`, React/Vite PWA)

Já existe. Stack: React 19, Vite 8, react-router 7, Tailwind 4, `vite-plugin-pwa`+
`workbox`, **Dexie** (cache offline), **Leaflet** (mapa), `supabase-js`.

- **Lê:** `allocations` (sua lista do período, ordenada por `priority_order`) — uma
  vez no início do período, cacheada no Dexie. Ver `engine-spec.md §7`.
- **Escreve:** `visitas_capturadas` (forms) e `allocations.status = 'visited'`.
- **Offline-first:** trabalho do dia no device, fila de submissões quando sem sinal.
- **White-label:** tema do tenant (§7.3), cacheado offline.
- **Princípio de produto:** briefing, não comando — a ACS reordena e decide
  (`prd.md §5`).

Pendências em `TODO.md §4` (corrigir env Supabase, migrar para ler de `allocations`).

---

## 11. Mobile (`mobile/`, Expo)

Track nativo futuro. Espelha o PWA: 5 telas (Lista, Paciente, Visita, Selecionar ACS,
Supervisor), mesmo Supabase, AsyncStorage offline, EAS Build. White-label dinâmico no
conteúdo; ícone com a limitação de §7.5. Detalhe em `TODO.md §5`.

---

## 12. Motor PRIO-ACS (repo privado)

Resumo — **spec completa em `docs/engine-spec.md`**.

Serviço de **alocação em batch** (não é API por request). Roda em cron por clínica
(config YAML), pontua todos os pacientes (fórmula PRIO-ACS 0–100), distribui entre as
ACS com balanceamento de carga e clustering geográfico, e escreve a `allocations`. O
app só lê. Repo: `rafaelbressan/prio-acs-engine`, FastAPI, deploy Railway. Patente no
INPI.

---

## 13. Fluxo de dados

```
Vitacare (oficial, LAN da clínica)
     ↕  sync job (cron, futuro — TODO §7)
  Supabase
     ├── pacientes, visitas, eventos   ← fonte de verdade (hoje: parquets em data/)
     ├── visitas_capturadas            ← app escreve (captura em campo)
     ├── allocations                   ← motor escreve, app lê
     └── tenants                        ← config white-label (painel edita)

PRIO-ACS Engine (FastAPI, cron por clínica)
     lê  → Supabase (service_role)
     escreve → allocations

Apps (PWA / dashboard / Expo) — leem Supabase direto (anon key + JWT + RLS)
     leem    → allocations, materialized views, tenants
     escrevem → visitas_capturadas, allocations.status
```

Ponte de volta ao Vitacare (sem API pública conhecida): (A) extensão Chrome na LAN,
(B) API oficial via SMS-Rio, (C) relay local. Hoje simulado
(`sincronizado_vitacare=false`). Ver `architecture` histórico e `prd.md §4.5`.

---

## 14. Segurança e LGPD

Dados de saúde = **dado sensível (LGPD art. 11)**. Princípios (válidos do MVP ao piloto):

- **Identity-bound queries:** escopo sempre do JWT, nunca do cliente (§5.2). RLS no
  Postgres como rede de segurança.
- **Residência 100% BR:** Vercel + Supabase sa-east-1. Sem vendor fora do BR sem DPA.
- **Em trânsito:** TLS 1.3, HSTS. Payload de lista sem PII (só id + iniciais + motivo);
  detalhe é fetch separado e auditado.
- **Em repouso:** Postgres cifrado at-rest. No device, só o trabalho do dia ativo,
  storage cifrado (WebCrypto); logout limpa tudo.
- **Audit log:** toda leitura individual de paciente gera linha append-only
  `{ acs_id, paciente_id, ts, motivo }` (LGPD art. 18 — "quem acessou meus dados").
- **Telemetria:** sem PII em erros, mesmo em dev — só id (hash) e código.

Modelo de ameaças: roubo/perda do device da ACS, terceiro em rede pública, insider fora
de escopo. Fora de escopo: ator estatal, comprometimento de vendor (risco residual via
contrato).

**MVP → produção:** auth dropdown+JWT → ConecteSUS/gov.br (OIDC); audit em console →
tabela append-only; offline localStorage → Dexie cifrado; ponte Vitacare simulada →
extensão/API; + cert pinning e pen test antes do piloto.

---

## 15. Decisões em aberto (para discutir)

| # | Tema | Status |
|---|---|---|
| 1 | Detecção de tenant por subdomínio `<muni>.app.visitare.app` | ✅ confirmado §7.4 |
| 2 | Multi-tenant em projeto Supabase único + RLS | ✅ confirmado §5.1 |
| 3 | Ícone nativo (Expo) por município | ✅ Visitare genérico; pré-empacotar grandes depois §7.5 |
| 4 | Atualização do painel ("horas em atividade") | ✅ pull manual + cooldown 1 min §8.2 |
| 5 | Gestor/ACS editam a lista do motor | ✅ lista é orientação editável; campo `origin` §8.1 |
| 6 | Indicadores Previne Brasil no painel | ✅ feature-âncora [ROADMAP]; mapeado §8.3 |
| 7 | Identidade visual nova do Visitare (site) | em construção pelo Rafael |
| 8 | Questões matemáticas do motor | ver `engine-spec.md §9` |

Itens [EM ABERTO] precisam de decisão de produto antes de modelar.
```
