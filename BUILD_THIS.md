# BUILD_THIS — Handoff Engenharia → Front

> **Pra quem:** Vini (front end) + quem for codar API
> **Status:** complemento do [MASTER_CONTEXT.md](MASTER_CONTEXT.md) — leia-o primeiro pra entender o porquê
> **Deadline:** 16:15 BRT, 2026-05-24
> **Princípio:** tudo neste doc é direto. Cole, rode, ajuste.

---

## 1. O que JÁ está pronto (não reinvente)

| Artefato | Onde | Para quê |
|----------|------|----------|
| Score PRIO-ACS spec | [MASTER_CONTEXT.md §6.4](MASTER_CONTEXT.md) | Fórmula aditiva 0-100, 4 componentes |
| Dataset perfilado | [MASTER_CONTEXT.md §5](MASTER_CONTEXT.md) | Schema + distribuições + 49,9% nunca visitados |
| Screens mockup | [MASTER_CONTEXT.md §7.3](MASTER_CONTEXT.md) | 3 telas em ASCII |
| 5 fichas oficiais SMS | [FICHAS/](FICHAS/) | JSON dev-ready, renderiza dinâmico |
| Parquets reais | [data/raw/](data/raw/) | 4 arquivos: pacientes, eventos, visitas, equipes |
| Failure modes | [MASTER_CONTEXT.md §8](MASTER_CONTEXT.md) | O que NÃO fazer (PRISMATIC etc.) |
| Citações Camila + SMS | [docs/context/FIELD_NOTES_CAMILA_ACS.md](docs/context/FIELD_NOTES_CAMILA_ACS.md) | Texto pro pitch |

---

## 2. Contrato Engenharia → Front (LOAD-BEARING)

A engenharia produz **2 artefatos JSON** que o front consome. Tudo o que o front precisa renderizar sai daqui:

### 2.1 `lista_do_dia.json` (por profissional)

```json
{
  "profissional_id": "ACS_007",
  "equipe_id": "EQUIPE_023",
  "data": "2026-05-24",
  "pacientes": [
    {
      "paciente_id": "PT_98765",
      "nome_display": "Maria S.",
      "score": 78,
      "tier": "alto",
      "cadencia_oficial": "Semanal",
      "motivo_curto": "Gestante há 35 dias sem visita + foi à UPA há 5d",
      "motivo_componentes": {
        "icsap": 30,
        "life_stage": 25,
        "care_gap": 23,
        "social": 0
      },
      "linha_de_cuidado": "ficha_b_gestante",
      "ultima_visita": "2026-04-19",
      "ultimo_evento": {"tipo": "urgencia-emergencia-ou-internacao", "data": "2026-05-19"},
      "flags": {"hipertenso": false, "diabetico": false, "gestacao": true, "vulnerabilidade": false},
      "endereco_lat": -22.988,
      "endereco_lon": -43.247,
      "bundle_acao": [
        "Aferir PA (alto risco se >=140/90)",
        "Perguntar sangramento e movimentos do bebê",
        "Confirmar exames solicitados",
        "Confirmar consulta pré-natal agendada"
      ],
      "script_abordagem": "Oi Maria, soube que você passou na UPA semana passada — vim ver como você e o bebê estão..."
    }
  ]
}
```

### 2.2 `dashboard_supervisor.json` (por equipe)

```json
{
  "equipe_id": "EQUIPE_023",
  "data": "2026-05-24",
  "cobertura_por_linha": [
    {"linha": "gestantes", "alvo": 12, "em_dia": 11, "atrasados": 1, "pct": 91.7},
    {"linha": "criancas_0_6", "alvo": 42, "em_dia": 38, "atrasados": 4, "pct": 90.5},
    {"linha": "hipertensos", "alvo": 210, "em_dia": 178, "atrasados": 32, "pct": 84.8},
    {"linha": "diabeticos", "alvo": 52, "em_dia": 45, "atrasados": 7, "pct": 86.5}
  ],
  "indicadores_previne": {
    "ranking_equipe": 3,
    "total_equipes_unidade": 49,
    "indicadores_batidos": 11,
    "indicadores_total": 15
  },
  "pacientes_nunca_visitados_pct": 27.4,
  "alertas_criticos": [
    {"tipo": "gestante_alto_risco_sem_visita", "paciente_id": "PT_98765", "dias": 35}
  ]
}
```

**Engenharia entrega esses 2 JSON** (gerados via pandas dos 4 Parquets) num `out/` ou via endpoint FastAPI `/api/lista/{profissional_id}` e `/api/supervisor/{equipe_id}`. Front mocka primeiro lendo do arquivo, depois pluga.

---

## 3. O que o Front constrói (ordem de prioridade)

### Ecrã 1 — Lista do Dia (mobile-first) ⭐ PRIORIDADE 1
**Input:** `lista_do_dia.json`
**Mockup:** [MASTER_CONTEXT.md §7.3 Ecrã 1](MASTER_CONTEXT.md)
**Comportamento:**
- Card por paciente, ordenado por score DESC
- Mostra: nome_display, badge tier (vermelho/laranja/verde), motivo_curto, último evento
- Tap no card abre detalhe (ecrã 1b) com bundle_acao + script_abordagem + componentes do score
- Botão "Iniciar visita" → vai pro Ecrã 2

### Ecrã 1b — Por Que Esse Paciente (transparência)
**Mostra:** breakdown dos 4 componentes do score (ICSAP / Life-stage / Care gap / Social) com a citação da framework (ex: "ICSAP grupo 19 — Portaria SAS/MS 221/2008")
**Por quê:** critério #2 (produto) + #3 (engenharia) — explicabilidade pesa

### Ecrã 2 — Formulário de Visita ⭐ PRIORIDADE 1
**Input:** [FICHAS/ficha_b_gestante.json](FICHAS/ficha_b_gestante.json) (ou crônico/criança/TB conforme `linha_de_cuidado` do paciente)
**Renderização dinâmica:**
- `tipo` → widget (string=input, enum=select, multi_enum=checkboxes, date=date picker, sim_nao=toggle)
- `obrigatorio: true` → validação
- `visivel_se: "semana_gestacao <= 12"` → condicional (tem que avaliar expressão simples)
- **Sempre começa pelo cabeçalho compartilhado** (`_shared.cabecalho_comum`)
- **Sempre offline:** salva em IndexedDB, sync ao bater ponto (15:30)

**Pelo Camila explicitamente:** checkbox sim/não, nada de campos livres longos. Áudio→texto pra "observações" é nice-to-have.

### Ecrã 3 — Dashboard Supervisor (desktop) ⭐ PRIORIDADE 2
**Input:** `dashboard_supervisor.json`
**Componentes:**
- Tabela "Cobertura por linha de cuidado" (cor verde/amarelo/vermelho por pct)
- Card "Ranking Previne Brasil" (X/49 da unidade)
- Lista "Alertas críticos" (clica vai pro paciente)
- KPI gigante: "% nunca visitados" — pra Carol Canedo ficar com a mandíbula caída

---

## 4. Stack sugerido (negociável)

| Camada | Sugestão | Por quê |
|--------|----------|---------|
| Backend | FastAPI + DuckDB | Lê Parquet nativo, zero infra, tipagem |
| Frontend ACS | **Streamlit** se pressa OU React+Vite PWA se temos tempo | Streamlit roda em 1h; PWA ganha critério "produto" |
| Frontend Supervisor | Mesmo stack do ACS | Reusa componentes |
| Persistência cliente | IndexedDB (PWA) ou localStorage (Streamlit) | Offline-first |
| Claude | `claude-sonnet-4-6` via Anthropic SDK | Sonnet — créditos limitados ($70/pessoa) |
| Deploy | Cloudflare Pages ou Railway | Free, 5 min |

**Importante:** se Vini já está construindo em algo, NÃO troque o stack. Adapta a UI ao que ele tem.

---

## 5. Claude prompts prontos (copy-paste)

### 5.1 Motivo curto (1 frase)

```
Você é assistente de Agente Comunitário de Saúde (ACS) em UBS do Rio.
Gere UMA FRASE em português brasileiro, linguagem ensino médio, explicando por que esse paciente foi priorizado HOJE.

DADOS DO PACIENTE:
- Idade: {faixa_etaria}
- Sexo: {sexo}
- Flags clínicos: {flags_list}  // ex: ["gestante", "diabética"]
- Dias desde última visita: {dias_gap}
- Último evento não-eletivo: {dias_ultimo_evento} dias atrás (tipo: {tipo_evento}) ou "nenhum nos últimos 90d"
- Tier de risco: {tier}

REGRAS:
- MAX 18 palavras
- Sempre cite o sinal mais forte primeiro
- Nada de jargão (sem "ICSAP", "LACE", "comorbidade")
- Tom factual, sem alarmismo

EXEMPLOS:
"Gestante há 35 dias sem visita e passou pela UPA semana passada."
"Idoso diabético, sem visita há 4 meses — risco de pé diabético."
"Criança de 1 ano em atraso vacinal e família em vulnerabilidade social."

Retorne só a frase.
```

### 5.2 Bundle de ação (3-5 bullets)

```
Você é assistente clínico de ACS no Rio. Liste 3 a 5 verificações que o ACS DEVE fazer nesta visita, em PT-BR ensino médio.

PACIENTE:
- Linha de cuidado: {linha_cuidado}  // ex: "gestante alto risco"
- Última visita: {data_ultima_visita}
- Último evento: {ultimo_evento}
- Flags: {flags_list}

REGRA: cada bullet começa com verbo (Aferir, Perguntar, Confirmar, Verificar, Orientar). Concreto. Sem encheção.

EXEMPLO para gestante:
- Aferir pressão arterial (alto risco se ≥140/90)
- Perguntar sangramento e movimentos do bebê
- Confirmar exames solicitados na última consulta
- Reforçar próxima consulta pré-natal agendada

Retorne só a lista (markdown bullets), sem cabeçalho.
```

### 5.3 Script de abordagem (1 frase de quebra-gelo)

```
Sugira UMA frase amigável de abertura pro ACS dizer ao entrar na casa, considerando o contexto. PT-BR informal carioca, máximo 20 palavras.

PACIENTE: {nome_display}, {flags_list}, último evento: {ultimo_evento}.

EXEMPLO: "Oi Maria, soube que você passou na UPA semana passada — vim ver como você e o bebê estão."
```

**Cache:** essas 3 chamadas viram batch overnight (ou na manhã 7am) — não chame Claude em tempo real durante a demo. Pre-compute e serve do JSON.

---

## 6. Demo Script — 60 a 90 segundos (gravado)

> Roteiro para o screen recording. Quem grava: definir. Quem narra: Laura ou Daniel (PT-BR fluente).

| Tempo | Tela | Ação | Narração |
|-------|------|------|----------|
| 0-5s | Title slide | "Inteligência no território: a lista do dia do ACS" | "Hoje, 6.200 ACS no Rio decidem quem visitar com memória e papel." |
| 5-15s | Ecrã 1 (Lista do dia) | Scroll na lista | "Toda manhã, abre o app: 8 famílias priorizadas por risco real." |
| 15-25s | Tap em Maria S. (gestante) | Mostra detalhe + bundle | "Maria, gestante, sem visita há 35 dias e foi à UPA. O app explica por quê." |
| 25-40s | Tap em "Iniciar visita" → Ecrã 2 | Marca sim/não em campos da Ficha B Gestante | "A ficha é a oficial da SMS. ACS preenche em campo, offline. Acabou registro duplo." |
| 40-50s | Volta lista → Ecrã 3 supervisor | Mostra cobertura por linha | "Supervisor vê em tempo real: ranking Previne, gestantes em dia, alertas." |
| 50-60s | Slide final | Métricas: 49,9% nunca visitados / 43% gestantes com urgência / ICSAP | "Reduz mortalidade materno-infantil, aumenta financiamento Previne, libera 1h/dia." |

---

## 7. Quick Start — comandos

### 7.1 Engenharia (gera os 2 JSON)

✅ **Script já implementado:** [scripts/gerar_lista_do_dia.py](scripts/gerar_lista_do_dia.py)
✅ **Outputs de exemplo já versionados:** [out/lista_do_dia.json](out/lista_do_dia.json) + [out/dashboard_supervisor.json](out/dashboard_supervisor.json)
✅ **Adaptador pro front React:** [scripts/gerar_realdata_frontend.py](scripts/gerar_realdata_frontend.py) → gera [frontend/src/realData.ts](frontend/src/realData.ts) (mesma assinatura de mockData; Vini troca 1 import)

```bash
# Setup (pandas + duckdb já em requirements.txt)
pip install -r requirements.txt

# Gerar com profissional demo automático (variedade clínica)
python scripts/gerar_lista_do_dia.py --demo

# Ou com profissional específico
python scripts/gerar_lista_do_dia.py --profissional <hash_id> --data 2025-12-31 --top-n 8
```

**Distribuição PRIO-ACS no dataset real:** alto 0,4% (350) · médio 17,9% (17.550) · habitual 81,7% (80.038). Top 8 do demo: 7 crônicos+vulneráveis + 1 gestante com urgência recente (combo prioridade zero).

### 7.2 Front (Streamlit caminho rápido)

```bash
pip install streamlit
streamlit run acs_app.py --server.port 8501
# nota: criar acs_app.py NOVO; deixe o app.py de dengue intacto até decidir
```

### 7.3 Deploy

- **Cloudflare Pages** (PWA): `wrangler pages deploy ./dist`
- **Railway** (Streamlit): conectar repo, deploy automático

---

## 8. Divisão de trabalho sugerida

| Tarefa | Owner | Tempo |
|--------|-------|-------|
| Schema validação + perfilagem extra | Eng (Daniel?) | 30 min — já tá feita pelo MASTER_CONTEXT |
| Gerar `lista_do_dia.json` e `dashboard_supervisor.json` (pandas/duckdb) | Eng | 1h |
| Integrar Claude (pré-cache motivo + bundle) | Eng | 30 min |
| Ecrã 1 (Lista do dia) + Ecrã 1b (Por quê) | Vini (FE) | 1h |
| Ecrã 2 (Formulário Ficha B Gestante apenas — MVP) | Vini (FE) | 1h |
| Ecrã 3 (Dashboard supervisor) | Vini (FE) ou Rafael | 1h |
| Polimento UX/design system + cor | Rafael | paralelo |
| Validação clínica das frases Claude | Laura | 20 min |
| Screen recording 60-90s | Daniel/Rafael | 20 min |
| Pitch deck 6 min (skill `maua-deck`) | PM (quem?) | 1h |
| README final do repo + GitHub limpo | Eng | 30 min |

---

## 9. Decisões pendentes — destravar AGORA

Perguntas que precisam de resposta no grupo antes de codar:

1. **Quem escreve `gerar_lista_do_dia.py`?** Tem que estar pronto em 1h pra desbloquear o front.
2. **Streamlit ou React/PWA?** Default: Streamlit (vence prazo). React PWA ganha mais ponto em produto.
3. **Qual ficha implementar primeiro?** Recomendação: **B Gestante** — alinha com prioridade zero (mortalidade materno-infantil) e tem dados no Parquet.
4. **Quem grava a demo + quem narra?** Camila gravar em vídeo (citação) >>> nossa voz.
5. **Qual equipe/profissional vira a demo?** Recomendação: filtrar 1 ACS com lista variada (1 gestante alto risco + 2 crônicos + 2 atrasos).

---

## 10. O que NÃO fazer (failure modes confirmados)

- ❌ Score sem bundle de ação (PRISMATIC Wales: aumentou internações em 230k pacientes)
- ❌ Ditar ordem de visita (Camila: "eu sei onde moram")
- ❌ App paralelo ao VitaCare (Índia ASHA: ACS digita em 4-6 sistemas)
- ❌ Exigir conectividade real-time (favela = wifi inconfiável)
- ❌ Black-box ML sem explicabilidade — ecrã 1b é mandatório
- ❌ Substituir Monitor da Gestante — complementar

---

*Este doc é o handoff. MASTER_CONTEXT.md é a fonte de verdade. Em conflito, MASTER_CONTEXT vence.*
