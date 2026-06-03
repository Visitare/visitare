---
type: entity
category: concept
created: 2026-06-03
updated: 2026-06-03
date: '2026-06-03'
month: '06'
monthyear: '2026-06'
quarter: 'Q2'
quarteryear: '2026-Q2'
aliases: [ACS Digital]
tags: [y2026, healthtech, sus, atencao-primaria, architecture, multi-tenant, white-label, supabase, astro, expo, pwa]
title: Visitare
summary: Plataforma de apoio ao Agente Comunitário de Saúde — da vitória no Claude Impact Lab Rio à arquitetura multi-tenant white-label. A história das decisões: monorepo de 4 apps, motor PRIO-ACS separado, Vite-vs-Next resolvido na conta, e a lista como orientação, não comando.
---

# Visitare

> Findings da sessão de arquitetura — 28/mai a 03/jun 2026.
> Docs-fonte no repo: `visitare/docs/architecture.md`, `docs/engine-spec.md`, `TODO.md`.

## O que é, em linguagem de gente

Imagina a Claudia. Ela é Agente Comunitária de Saúde na Rocinha. Todo dia ela sobe e
desce o morro visitando famílias — checa a pressão do hipertenso, vê se a gestante fez
o pré-natal, percebe quando a Dona Maria não abre a porta há três semanas. Ela é os
olhos do SUS na ponta. O problema: quando volta pra clínica, gasta **uma hora por dia**
re-digitando no sistema tudo que anotou no caderninho e no WhatsApp. Sem lista de
prioridades, sem registro em tempo real, sem nada no celular.

São **6.200 Claudias só no Rio**. O Visitare é o copiloto dela: a lista priorizada de
quem visitar hoje, a ficha clínica e o formulário de captura — tudo no bolso, na porta
da casa, funcionando **offline** (sinal é luxo na favela). Devolve uma hora por dia ao
cuidado de verdade. No Rio inteiro isso é ~1,5 milhão de horas/ano.

Nasceu no **Claude Impact Lab Rio** e **ganhou em 1º lugar (2026)**. Time: Laura
Anderaus (médica), Vinicius Saraiva, Rafael Bressan, Daniel Seraphim, Leonardo Junio.
O coração do produto — o motor de priorização PRIO-ACS — está em processo de **patente
no INPI**.

Esta sessão foi a travessia do *protótipo de hackathon* para uma *plataforma de
verdade*: multi-município, white-label, vendável a qualquer prefeitura do Brasil.

## A arquitetura, e como as peças se conectam

A grande virada mental foi parar de pensar "um app" e pensar **quatro superfícies, um
banco, um motor à parte**:

```
visitare.app           site/        Astro       → marketing + blog (marca Visitare)
<muni>.app.visitare.app app/        React+Vite  → ACS de campo, PWA offline · white-label
painel.visitare.app    dashboard/   React+Vite  → gestor da clínica/distrito/município
App Store / Play        mobile/      Expo        → nativo (track futuro)
                        db/          Supabase    → É O BACKEND
PRIO-ACS Engine (repo privado, FastAPI, cron)    → escreve a lista de alocação
```

O fluxo de dados, contado como rio: o **Vitacare** (sistema oficial do Rio, que só
roda na LAN da clínica) é a nascente dos dados clínicos. Hoje, no lugar dele, usamos
parquets anonimizados do hackathon (97 mil pacientes reais). Esses dados desaguam no
**Supabase**. O **motor PRIO-ACS** acorda no cron, lê o Supabase com a `service_role`,
pontua cada paciente, distribui entre as ACS da clínica e escreve uma tabela
`allocations`. O **app** só lê essa tabela (a lista do dia da ACS) e escreve de volta
duas coisas: o formulário da visita (`visitas_capturadas`) e o "visitei" (`status`).
Os apps nunca chamam o motor — ele roda sozinho, eles só consomem o resultado.

### A descoberta do "backend que não parecia backend"

Um momento-chave: olhei a pasta `db/` e perguntei "isso é um banco ou um backend?". A
resposta foi surpreendente — **as duas coisas**. O Vinicius implementou o motor inteiro
como *stored procedures* PostgreSQL (`priorizacao_pacientes`, `dashboard_equipe`,
`paciente_detalhe`), chamadas do front via `supabase.rpc()`. Não existe framework de
backend nenhum. O Supabase + SQL puro **é** a lógica de negócio. Isso é elegante e
contra-intuitivo pra quem vem de "preciso de um Express/Django no meio".

## As decisões — e os caminhos não tomados

**Por que separar o motor num repo privado próprio.** O PRIO-ACS é o que se patenteia e
o que se vende para outras prefeituras. Misturá-lo no monorepo do app acoplaria o ciclo
de calibração matemática (que é raro, revisado, versionado) ao ciclo do produto (que é
diário). Escolhemos **FastAPI** — não Go, não Flask, não Django — porque a impl de
referência já é Python, calibração itera melhor no ecossistema científico, e a futura
camada de ML vai querer Python do lado.

**Por que o motor virou alocador em batch, não scorer por request.** A intuição inicial
estava errada: imaginei um endpoint "pontue este paciente". O Rafael corrigiu — o motor
precisa olhar **a clínica inteira de uma vez**: quantas ACS tem, e distribuir os
pacientes de forma *balanceada* (uma ACS não pode ficar só com os críticos enquanto
outra pega só os tranquilos), com clustering geográfico (lat/lon, distância da clínica)
e respeitando uma capacidade máxima por ACS. É um *problema de atribuição com
restrições*, rodando em cron — diário num município, semanal noutro — configurado por
YAML por clínica. A lição: **não modele o caso fácil (um item) quando o domínio é o
caso difícil (a equipe toda)**.

**Vite vs Next.js — o falso dilema.** Esta foi a discussão mais rica. O Rafael queria um
painel pro gestor (relatórios, localização das ACS, cumprimento de visitas) e perguntou
se valia Next.js. A tentação era óbvia: "Next é o padrão de mercado pra dashboard". O
reframe que destravou tudo: **o que você quer do Next não é o Next — é o ecossistema de
componentes** (shadcn/ui, TanStack Table, Recharts), e *todos rodam igual em Vite*. O
que só o Next dá é servidor (SSR, server components). Então a pergunta real virou: *o
painel precisa de servidor?*

Aí fizemos a **conta**. 6.200 ACS × 6 visitas/dia × 250 dias = 9,3M visitas/ano; com
forms e cadastros, ~28M linhas/ano, ~140M em 5 anos. Parece assustador — até você
perceber que a escrita é ~3,8 writes/segundo (trivial) e que **o relatório anual não se
faz no browser nem com `select *`**: se faz com *materialized views* no Postgres,
recalculadas de madrugada, devolvendo o resumo já agregado (centenas de linhas). Ou
seja: **a escala do Rio cai no Postgres, não no frontend**. O que o Next agregaria
(agregação no servidor) o Supabase já faz no banco — pôr um Next na frente seria um
proxy redundante. Os 4 níveis de permissão? RLS no Postgres, idêntico em Vite ou Next.
Export de PDF? Uma Edge Function, não justifica reescrever o painel.

Veredito: **dashboard em Vite, mesma stack do app**, reaproveitando componentes, client
Supabase e auth. Ficamos com 3 stacks (Astro · React · Expo) em vez de 4. A regra que
ficou: *Next só se o painel virar uma fábrica de relatórios server-side como centro do
produto* — e mesmo o BI cross-cliente futuro não pede Next, pede data warehouse.
**Lição-mãe: faça a conta antes de escolher a stack. A volumetria diz onde a carga mora,
e a carga aqui mora no banco.**

**Multi-tenant num Supabase só, com RLS de 4 níveis.** O Visitare precisa ver *todos os
clientes* (queries cross-município), o que seria inviável entre projetos Supabase
isolados. Então: um banco, `tenant_id` propagado, e RLS comparando claims do JWT à
linha. Hierarquia: ACS → gestor de clínica → gestor de distrito → gestor municipal →
visitare_admin (bypass). O escopo *sempre* vem do JWT, nunca do cliente — mesmo que a
anon key vaze, a policy protege.

**White-label: um app que se veste, não 300 apps.** A ideia é um produto que cada
prefeitura adapta à própria marca mudando poucos parâmetros vindos do backend: cores,
roundness de botão/card, fonte, logo. Mora numa tabela `tenants` com um `theme` JSONB;
o app injeta os tokens como **CSS custom properties** (o Tailwind 4 já é var-based), e
o painel Visitare tem um editor que grava o tema ao vivo. Caching no Dexie pra funcionar
offline.

Aqui bateu uma **parede de plataforma** que vale ouro como lição. O Rafael queria que
*até o ícone no celular* mudasse por município. A realidade honesta:
- **No PWA, dá** — com subdomínio por tenant (`rio.app.visitare.app`), serve-se um
  `manifest.webmanifest` dinâmico com o ícone/nome daquele município. Cada prefeitura
  *instala "o app dela"*.
- **No nativo (Expo), não dá** dinamicamente — o ícone é compilado no binário. iOS tem
  "alternate icons" e Android `activity-alias`, mas só entre um conjunto
  *pré-empacotado*. Ícone por novo cliente = build por cliente, que ninguém quer manter.

Decidimos: ícone Visitare genérico no nativo, e o PWA cobre o caso "ícone do município"
de graça. **Isso reforçou a estratégia PWA-first.** Lição: *antes de prometer uma
feature white-label, descubra o teto da plataforma — às vezes a web ganha do nativo.*

**A lista é orientação, não comando.** Princípio que veio direto de entrevista com ACS:
*"um sistema nunca vai dar a lista que eu realmente vou fazer."* O motor sugere, mas o
gestor pode editar (aumentar, reduzir, reatribuir) e a própria ACS poderá adicionar um
paciente da clínica na hora (porque está passando perto da casa). Isso virou um campo
`allocations.origin` (`engine`/`gestor`/`acs`): no re-run, o motor **só toca no que ele
mesmo criou** — o que humano pôs à mão é intocável. Mais um índice `(paciente_id,
period_start)` pro back sempre responder "em qual lista esta pessoa está?". **A decisão
humana é soberana sobre a sugestão da máquina** — design de produto codificado em
esquema de banco.

**Previne Brasil como feature-âncora.** O Previne Brasil (Portaria MS 2.979/2019)
amarra parte do **repasse federal** da Atenção Primária a 7 indicadores de desempenho —
pré-natal, vacinação infantil, PA do hipertenso, etc. E o trabalho da ACS alimenta
vários deles diretamente. Logo, um painel que mostra "onde sua equipe está nos 7
indicadores que decidem seu dinheiro" liga o app da ACS ao **caixa da prefeitura**.
Isso não é detalhe — é argumento de venda. Mapeamos quais dos 7 a captura de campo
alimenta (vacinação 0-6 e PA do hipertenso são diretos) e decidimos que
`visitas_capturadas` já deve nascer com esses campos pra não exigir migração depois.

**Dois planos de configuração que não se misturam.** Tema/marca vive no banco (editável
ao vivo pelo painel); matemática do score vive em YAML versionado no repo do engine
(revisão de código, calibração). Visual é operacional; matemática é código. Separados de
propósito.

## Tecnologias e o porquê de cada uma

- **Astro** (site) — marketing estático: rápido, SEO, e blog em markdown via Content
  Collections. Zero JS por padrão.
- **React 19 + Vite 8** (app e dashboard) — PWA offline com `vite-plugin-pwa`+`workbox`,
  cache em **Dexie** (IndexedDB), mapa com **Leaflet**. SSR seria *pior* no app (roda no
  device, sem servidor).
- **Expo** (mobile) — track nativo futuro, espelha o PWA.
- **Supabase/Postgres** (db) — é o backend: funções SQL = lógica, RLS = segurança por
  linha, Realtime, Storage, Edge Functions. Residência BR (sa-east-1) por LGPD.
- **FastAPI** (engine) — Python pela calibração e ML futuros; repo privado pela patente.
- **Tailwind 4** — theming var-based, que é o que torna o white-label instantâneo.

## Pitfalls e bugs ao longo do caminho (as melhores lições)

- **`git clone git@...` falhou no WSL** (sem chave SSH). Fix:
  `git config --global url."https://github.com/".insteadOf "git@github.com:"` e clonar
  via HTTPS. Lição: em ambiente novo, prefira HTTPS pra Git read.
- **Vercel não conectava o repo do Vinicius** (conta GitHub diferente). Fix: *forkar*
  pra `rafaelbressan/visitare` e linkar o fork. Deploy não atravessa fronteira de conta.
- **CNAME circular no GoDaddy** (`www → visitare.app.`). Fix: `www → cname.vercel-dns.com`.
- **`supabaseUrl is required`** — o app crashava porque faltavam as env vars do Supabase
  no Vercel. Lembrete de que PWA quebra cedo e feio sem config de ambiente.
- **`/browse` só abre arquivos em `/tmp`** — pra screenshotar HTML local, copiar pra
  `/tmp` antes.
- **Deploy de produção bloqueado pelo classificador de segurança** do Claude Code
  (`vercel deploy --prod` sem confirmação explícita). Resolvido rodando manualmente.
  Lição: ações outward-facing pedem confirmação — e isso é bom.

## O meta-aprendizado: como um bom engenheiro pensa aqui

O fio condutor de toda a sessão foi **resistir à resposta default e perguntar "por
quê"**. "Quero um dashboard" não virou "ok, Next.js" — virou uma conta de volumetria
que revelou que a carga mora no banco. "Quero ícone por município" não virou um "claro"
— virou um mapa honesto do teto de cada plataforma. "O motor pontua um paciente" não
virou um endpoint — virou um alocador de equipe. E todas essas decisões foram
**escritas em três documentos** (`architecture.md`, `engine-spec.md`, `TODO.md`) com
marcações explícitas de `✅ decidido`, `[PROPOSTA]` e `[EM ABERTO]` — porque o próximo
passo é alimentar esses docs a um agente que vai *executar*, e ele não pode gerar tarefa
em cima de coisa não-decidida. **Documentar a decisão e o seu porquê é o que impede você
de re-litigar a mesma escolha toda semana.**

%% [[Concepts MOC]] %%
