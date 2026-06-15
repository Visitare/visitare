---
version: alpha
name: Visitare
description: >-
  Identidade visual mestra do Visitare — plataforma de apoio ao Agente
  Comunitário de Saúde (ACS) da Atenção Primária. Esta é a MARCA Visitare
  (teal + coral). Cada tenant white-label herda tipografia, formas, espaçamento,
  componentes e prosa, e sobrescreve apenas os tokens de `colors`. Ver
  docs/architecture.md §7.3 / §7.7.

# Paleta-marca Visitare: 5 cores + ivory. teal (primary/ação) · mint
# (secondary/sustenta) · coral+pêssego (accent/acolhimento) · vermelho separado
# para urgência. Tintas escuras evitam preto puro (viés teal). Contexto
# (success/warning/info) de escalas Tailwind. Derivados marcados "# derivado".
colors:
  # — Teal: PRIMARY (ação, marca, confiança institucional) —
  primary: "#006D77"            # teal — CTA de trabalho, headers, estados ativos
  on-primary: "#FFFEF1"         # ivory
  primary-dark: "#00565E"       # derivado — hover, faixas de marca, header
  # — Mint: SECONDARY (sustenta; preenche área, tinta escura por cima) —
  secondary: "#83C5BE"          # mint — botão secundário, selecionado, faixa
  on-secondary: "#13272A"       # tinta escura: branco sobre mint reprova AA
  secondary-container: "#C9E6E2" # derivado — chips de categoria, realce sutil
  on-secondary-container: "#13403C" # derivado
  # — Coral / pêssego: ACCENT (acolhimento; escasso, NÃO urgência) —
  tertiary: "#C66B4F"           # coral — acento de marca, destaque pontual
  on-tertiary: "#2B0F07"        # espresso — coral é meio-tom: só passa AA c/ ESTA
                                #            tinta (4,8:1); branco daria 3,7 (reprova)
  tertiary-container: "#EAAFA0" # pêssego — chips/realces suaves
  on-tertiary-container: "#5A2616"
  # — Superfícies (ivory quente de base, azul-claro frio nos containers) / tinta —
  surface: "#FAF9F6"            # off-white neutro (nunca branco puro)
  surface-container: "#EDF6F9"  # azul pálido — áreas agrupadas, inputs
  surface-container-high: "#DDEBEF" # derivado — hover/elevado
  on-surface: "#13272A"         # teal-charcoal — tinta principal (~15:1, sem preto puro)
  on-surface-variant: "#36454F" # Charcoal — metadados, captions, bordas
  # foco/focus-ring = primary (teal), sempre — ver prosa em Components. Nunca o azul default.
  # — Urgência / erro (vermelho ≠ coral) —
  error: "#C62828"              # vermelho sólido — ação destrutiva, ponto de urgência
  on-error: "#FFFEF1"
  error-container: "#F7D6D2"    # subtle — fundo de alerta de erro / tier ALTO
  on-error-container: "#5A1410"
  error-strong: "#B42318"       # intenso — texto/borda de erro sobre subtle
  # — Contexto: subtle (fundo) + strong (texto/borda). Nunca solid. —
  success-subtle: "#E7F4EA"
  success-strong: "#1F7A33"
  warning-subtle: "#FBEEDA"
  warning-strong: "#8A4A09"
  info-subtle: "#E4F0FB"
  info-strong: "#0369A1"        # azul-céu (mais azul, menos verde que o teal)

typography:
  # Prompt (Google Fonts) — geométrica, muitos pesos, casa com o wordmark.
  # IBM Plex Mono p/ dados tabulares: timestamps de tempo-em-tarefa (§0.2/§10),
  # indicadores Previne. Número que alinha pede mono.
  display:
    fontFamily: Prompt
    fontSize: 44px
    fontWeight: "600"
    lineHeight: 1.15
    letterSpacing: 0.01em
  headline-lg:
    fontFamily: Prompt
    fontSize: 32px
    fontWeight: "500"
    lineHeight: 1.2
    letterSpacing: 0.01em
  headline-md:
    fontFamily: Prompt
    fontSize: 24px
    fontWeight: "500"
    lineHeight: 1.3
  title-lg:
    fontFamily: Prompt
    fontSize: 20px
    fontWeight: "600"
    lineHeight: 1.3
  body-lg:
    fontFamily: Prompt
    fontSize: 18px
    fontWeight: "400"
    lineHeight: 1.55
  body-md:
    fontFamily: Prompt
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 1.5
  label-md:
    fontFamily: Prompt
    fontSize: 14px
    fontWeight: "500"
    lineHeight: 1.4
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Prompt
    fontSize: 12px
    fontWeight: "500"
    lineHeight: 1.35
  data-md:
    fontFamily: IBM Plex Mono
    fontSize: 14px
    fontWeight: "500"
    lineHeight: 1.4

rounded:
  sm: 6px
  md: 10px
  lg: 14px
  xl: 20px
  full: 9999px

spacing:
  base: 8px
  xxs: 2px
  xs: 4px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 40px
  xxl: 64px
  xxxl: 96px
  gutter: 16px
  margin: 24px

components:
  # CTA primário = teal (passa AA com texto branco). Coral fica de acento.
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.on-primary}"
  # Header / faixa de marca em teal escuro.
  header:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.on-primary}"
    padding: "{spacing.md}"
  # Acento de marca: coral com TINTA ESCURA (espresso). Texto branco reprova AA.
  button-accent:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  # Secundário = MINT + tinta escura (mint sustenta; branco sobre mint reprova).
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  # Chip de categoria (não-urgente) em mint-container.
  chip-category:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
  list-item-visit:
    backgroundColor: transparent
    rounded: "{rounded.md}"
    padding: "{spacing.sm}"
  list-item-visit-hover:
    backgroundColor: "{colors.surface-container}"
  # Tiers de prioridade = URGÊNCIA (vermelho/âmbar/neutro), nunca coral de marca.
  badge-tier-alto:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.on-error-container}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"
  badge-tier-medio:
    backgroundColor: "{colors.tertiary-container}"
    textColor: "{colors.on-tertiary-container}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"
  badge-tier-habitual:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"
  data-timestamp:
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.data-md}"
  # Alerts de contexto: fundo SUBTLE + texto/borda STRONG (nunca solid).
  # Borda = a mesma cor strong do texto (ver prosa; o schema não tem borderColor).
  alert-success:
    backgroundColor: "{colors.success-subtle}"
    textColor: "{colors.success-strong}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm}"
  alert-warning:
    backgroundColor: "{colors.warning-subtle}"
    textColor: "{colors.warning-strong}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm}"
  alert-info:
    backgroundColor: "{colors.info-subtle}"
    textColor: "{colors.info-strong}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm}"
  alert-error:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.error-strong}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm}"
  # Vermelho sólido fica para AÇÃO destrutiva (descartar/excluir), não para alerta.
  button-danger:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-error}"
    typography: "{typography.label-md}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  # Faixa/seção em mint — sustenta área sem o peso do teal cheio (tinta escura).
  section-muted:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
---

## Overview

**Referência: a visita domiciliar de saúde — a porta que se abre para receber o
cuidado.** *Visitare* é "visitar" em latim. A cena que a marca evoca é concreta:
a ACS chega à casa, bate; a pessoa abre a porta e a recebe; e há **aconchego** no
gesto — o alívio de estar sendo atendido, bem tratado, em casa. Não é o hospital
frio nem o SaaS corporativo; é o acolhimento de saúde na soleira da porta.

A ferramenta serve **os dois lados da porta**. Para o paciente: uma consulta mais
atenciosa, sem burocracia nem espera enquanto a agente preenche papel — a atenção
fica na pessoa, não no documento. Para a ACS: uma visita mais eficiente, que
sobra tempo para visitar mais gente depois. O app é o que torna a visita ao mesmo
tempo mais humana e mais produtiva.

O caráter: **sério sem ser frio, humano sem ser fofo.** O teal entrega a
credibilidade clínica/institucional que a integração com a SMS-Rio e o Vitacare
exigem; o coral entrega o calor do acolhimento — a recepção na porta, o cuidado,
a pessoa. A interface é um **briefing, não um comando** (`prd.md §5`): orienta a
prioridade, mas a ACS decide. Densa o suficiente pra trabalhar, espaçosa o
suficiente pra ler rápido. Zero decoração que não sirva à visita.

Público: agentes comunitárias de saúde com **baixa literacia digital**, lendo na
rua, em celular barato, sob sol. Toque grande, contraste alto, texto legível.
Tudo que não ajuda a fazer a próxima visita acontecer — melhor e mais rápida — é
ruído.

## Colors

Cinco cores + ivory. A dinâmica é **teal age · mint sustenta · coral acentua**,
com o **vermelho à parte** para urgência. Três papéis de marca que, com o
vermelho, **nunca se confundem**.

- **Primary — teal {colors.primary}:** o encontro de azul (confiança clínica,
  institucional — SMS-Rio, Vitacare) e verde (vida, APS, calma). Conduz **ação**:
  CTA de trabalho, estados ativos, headers, a marca. Ivory sobre teal passa AA
  (~6:1). `primary-dark` {colors.primary-dark} é o tom de hover/header.
- **Secondary — mint {colors.secondary}:** o **meio-tom que sustenta**. Teal em
  volume, quando o teal cheio pesaria: botão secundário, item selecionado, faixas
  e seções, chips de categoria, ilustração, 2ª série de gráfico. **Mint é claro —
  texto branco sobre ele reprova AA**, então mint é superfície/preenchimento com
  **tinta escura por cima** ({colors.on-secondary}), nunca botão de texto branco.
- **Tertiary — coral {colors.tertiary}:** **acento de acolhimento, não de
  urgência.** Escasso — sua raridade é o valor. Destaque pontual, ilustração,
  calor humano. Coral é meio-tom difícil: **nem branco (3,7:1) nem tinta média
  passam AA**; só a tinta espresso {colors.on-tertiary} chega a 4,8:1. Por isso o
  CTA de trabalho é teal, e o coral aparece sobretudo em **ícone, traço,
  ilustração e realce** — não como botão-texto de uso intenso.
- **Tertiary container — pêssego {colors.tertiary-container}:** a versão suave do
  coral, para chips e realces calmos (tinta escura por cima).
- **Surface — ivory {colors.surface}:** o **papel** quente da marca — nunca
  branco puro. `surface-container` {colors.surface-container} é o azul pálido frio
  das áreas agrupadas e inputs. O quente da base com o frio dos containers é
  intencional: aconchego de papel + clareza funcional.
- **On-surface — teal-charcoal {colors.on-surface}:** tinta principal, com viés
  teal e **sem preto puro** (~14:1 sobre o ivory — contraste que o sol exige).
  `on-surface-variant` {colors.on-surface-variant} (Charcoal) é a tinta de
  metadados, captions e bordas.
- **Error — vermelho {colors.error}:** **urgência, erro e tier ALTO.** Vermelho
  de verdade, de hue claramente distinto do coral (terracota), justamente pra que
  prioridade no campo nunca seja lida como "cor de marca". Separação deliberada.

Cores de contexto (`success` / `warning` / `info` / `error`) são **subtle, nunca
solid**: cada uma tem um **fundo claro** (`*-subtle` / `error-container`) e uma
**cor intensa** (`*-strong`) para **texto e borda**. Assim o alerta informa sem
gritar nem competir com a marca. O `info` é **azul-céu** {colors.info-strong} —
mais azul, menos verde, distinto do teal. O vermelho **sólido** ({colors.error})
fica reservado para **ação destrutiva** e o ponto de urgência, não para o fundo
de um alerta.

## Typography

**Prompt** (Google Fonts) em toda a interface — geométrica, muitos pesos, casa
com o wordmark Visitare. Pareada com **IBM Plex Mono** apenas para dados
tabulares.

- **Display / Headlines:** Prompt em 600–700 estabelece voz institucional e
  confiável; hierarquia por tamanho, não por excesso de peso.
- **Body:** Prompt 400 a 16–18px com entrelinha generosa — legibilidade longa
  em tela de celular, sob sol.
- **Labels:** Prompt 500 para botões e metadados; distinto mesmo em escala
  pequena.
- **Data (mono):** IBM Plex Mono carrega **timestamps de tempo-em-tarefa**
  (a métrica de 1h/dia, `architecture.md §0.2 / §10`) e números de indicadores
  (Previne). Número que precisa alinhar em coluna pede mono; texto narrativo,
  nunca.

## Layout

Grade fluida mobile-first (o app roda no celular da ACS, em campo). Ritmo numa
escala de **8px** (meio-passo de 4px para micro-ajustes). Conteúdo agrupado em
cards com padding interno generoso ({spacing.lg}) — respiro que reforça o caráter
calmo e legível. Alvos de toque largos: a mão está em movimento, na rua.

## Elevation & Depth

Profundidade por **camadas tonais**, não por sombra pesada. O fundo é o off-white
neutro ({colors.surface}); cards de conteúdo sobem um nível e áreas agrupadas usam
o azul pálido ({colors.surface-container}). Sombras, quando houver, são difusas e
sutis — leve tom de teal misturado, nunca cinza "sujo". Hierarquia também por
contraste de cor e borda (`on-surface-variant` em traço fino), pra funcionar mesmo
em tela barata e sob sol.

## Shapes

Cantos **arredondados moderados** — suave o bastante pra parecer cuidado e
acessível, firme o bastante pra parecer ferramenta de trabalho, não brinquedo.
Botões em {rounded.lg}; cards em {rounded.xl}; inputs em {rounded.md}. O
`--radius` é um dos eixos configuráveis por tenant (`architecture.md §7.1`), mas
o default da marca Visitare é este.

## Components

- **Botões:** o CTA de trabalho (`button-primary`) é **teal com texto branco** —
  o cavalo de batalha. `button-secondary` é **mint com tinta escura**;
  `button-accent` (coral, tinta espresso) é momento de marca, com parcimônia;
  `button-danger` (vermelho sólido) só para ação destrutiva.
- **Tiers de prioridade:** `badge-tier-alto` usa o **vermelho de urgência**
  (`error-container`), `medio` o pêssego, `habitual` o neutro. **Nenhum usa o
  coral de marca** — prioridade no campo é semântica, não estética.
- **Alerts de contexto:** fundo **subtle** + texto/borda **strong** — informam
  sem gritar. A borda usa a mesma cor `*-strong` do texto.
- **Foco:** o anel de foco é **sempre `primary` (teal)** — `outline` ou `box-shadow`
  de 2px na cor teal. **Nunca** o azul default do navegador (vem do user-agent;
  precisa ser sobrescrito explicitamente). Vale para input, botão e link.
- **Inputs:** fundo `surface-container`, borda discreta; no **foco**, borda teal +
  anel teal. Toque largo. `Cards`/`Listas`: superfícies claras, bordas finas.
- **Timestamp / dados:** `data-timestamp` em IBM Plex Mono — carimbos de tempo e
  números de indicador.

## Do's and Don'ts

- **Do** usar teal para a ação principal de cada tela. Uma ação primária por tela.
- **Do** manter o coral como acento escasso — sua raridade é o que o torna
  significativo. Calor humano, não preenchimento.
- **Do** manter contraste WCAG AA (4.5:1) em todo texto. Validar no linter.
- **Do** tratar número tabular (timestamp, indicador) como mono; texto narrativo
  como Prompt.
- **Don't** usar coral como cor de urgência, alerta ou erro. Urgência é vermelho
  ({colors.error}). Esta é a regra que protege a leitura de prioridade no campo.
- **Don't** pôr texto branco sobre coral — reprova AA. Coral de fundo pede tinta
  escura.
- **Don't** usar branco puro de fundo nem preto puro de texto. A marca vive no
  off-white neutro ({colors.surface}) e no teal-charcoal.
- **Don't** deixar o foco no azul default do navegador — o anel de foco é teal.
- **Don't** decorar. Se um elemento não ajuda a ACS a decidir a próxima visita,
  ele é ruído.
- **Don't** confiar em peso de fonte pesado pra hierarquia — hierarquia é
  tamanho e espaço, Prompt 600 no máximo para títulos.
