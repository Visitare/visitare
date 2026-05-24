# Frontend Spec — ACS Visitas
> Atualizado em 2026-05-24. App PWA mobile-first para Agentes Comunitários de Saúde (ACS) do Rio de Janeiro.

---

## Stack

| Camada | Tecnologia |
|---|---|
| UI | React 19 + TypeScript |
| Build | Vite 8 |
| Estilo | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Roteamento | React Router v7 |
| Banco local | IndexedDB via Dexie.js v4 |
| PWA | vite-plugin-pwa (Workbox) |
| Testes | Vitest + fake-indexeddb |
| Deploy | Vercel (HTTPS obrigatório para PWA) |

**URL de produção:** https://frontend-psi-black-9cdy0n3cqq.vercel.app

---

## Estrutura de arquivos

```
frontend/
├── src/
│   ├── types.ts            — interfaces e enums globais
│   ├── db.ts               — ACSDatabase (Dexie), helpers salvarVisita / getVisitasPendentes
│   ├── mockData.ts         — 18 pacientes com scores reais dos parquets + googleMapsUrl()
│   ├── App.tsx             — rotas: / → ListaPage, /visita/:id → VisitaPage
│   ├── pages/
│   │   ├── ListaPage.tsx   — lista semanal seg–sex, máx 5/dia, aba lista/mapa (TODO)
│   │   └── VisitaPage.tsx  — formulário de visita com seções condicionais
│   ├── components/
│   │   ├── CondicaoBadge   — badge colorido por condição (hipertenso, gestante…)
│   │   ├── PrioridadeBadge — badge crítica/alta/média/baixa
│   │   └── SyncBar         — indicador offline / pendente / sincronizando
│   ├── hooks/
│   │   └── useSync.ts      — detecta onLine, dispara marcarComoSynced
│   └── test/
│       ├── setup.ts        — injeta fake-indexeddb/auto globalmente
│       └── db.test.ts      — 23 testes (persistência, sync, campos clínicos, offline→sync)
└── vite.config.ts          — PWA manifest, Workbox, Vitest config
```

---

## Modelo de dados principal

### `Paciente` (em memória / mockData)

```typescript
interface Paciente {
  id: string
  nome: string
  equipeId: string          // hash da equipe (parquet)
  unidadeId: string
  faixaEtaria: '0-6' | '6-18' | '19-45' | '45-65' | '66+'
  sexo: 'Masculino' | 'Feminino'
  racaCor: 'Branca' | 'Preta' | 'Parda' | 'Amarela' | 'Indígena' | 'Outros'
  situacaoVulnerabilidade: boolean
  lat: number               // coordenadas reais do parquet
  lng: number
  distanciaKm: number       // haversine até EQUIPE_LAT/LNG
  hipertenso: boolean
  diabetico: boolean
  gestante: boolean
  condicoes: Condicao[]     // derivado
  prioridade: 'critica' | 'alta' | 'media' | 'baixa'
  prioScore: number         // 0–100, PRIO-ACS Score
  motivoPrioridade: string  // factual, sem diagnóstico
  ultimaVisita: string | null
  ultimoRegistroHipertensao?: RegistroHipertensao
}
```

### `RegistroVisita` (persiste no IndexedDB)

```typescript
interface RegistroVisita {
  id?: number               // auto-incremento IndexedDB
  pacienteId: string
  profissionalId: string
  dataVisita: string        // YYYY-MM-DD
  hora: string              // HH:MM
  synced: boolean           // NÃO indexado (boolean inválido como índice IDB)
  createdAt: number         // Date.now()
  estavaCasa: boolean
  recusouVisita: boolean
  observacoesGerais: string
  precisaEncaminhamento?: boolean  // true quando algum campo retornou 'nao_sei'

  // Crônico (HAS/DM) — Ficha B
  p1_esqueceu_dose?: RespostaSN
  p2_dificuldade_lembrar?: Frequencia5pt
  p3_desconforto_medicacao?: RespostaSN
  p4_duvida_tratamento?: RespostaSN
  p5_mudanca_estilo_vida?: MudancaEstiloVida
  p6_upa_emergencia?: 'sim' | 'nao'   // sem 'nao_sei' — resposta binária crítica
  p7_machucado_pe?: RespostaSN        // DM only

  // Gestante — Ficha B
  dum?: string
  dpp?: string
  semanaGestacional?: number          // calculado: Math.floor((today - dum) / 7)
  p1g_mediu_pressao?: RespostaSN
  p2g_upa_maternidade?: 'sim' | 'nao'
  p8g_inchaco_pernas?: RespostaSN
  p9g_bebe_mexeu?: 'sim' | 'nao'      // sem 'nao_sei' — urgência crítica

  // Criança — Ficha C
  idadeMeses?: number                 // calculado
  p3c_consultas?: RespostaSN
  p4c_vacinacao?: RespostaSN
  p5c_alimentacao?: AlimentacaoCrianca
  p6c_sinais_risco?: SinalRiscoCrianca[]
}
```

---

## PRIO-ACS Score (0–100)

Score aditivo calculado dos parquets reais. Determina a ordem na lista semanal.

| Componente | Peso | Critério |
|---|---|---|
| ICSAP proxy | 0–35 | HAS +15, DM +15, urgência/internação +1–5 |
| Life-stage | 0–25 | gestante +25, criança 0-6 +20, idoso 66+ +15 |
| Care gap | 0–25 | dias sem visita / 365 × 25 |
| Vulnerabilidade social | 0–15 | `situacao_vulnerabilidade == true` |

Limites de rótulo: `critica ≥ 70 | alta ≥ 50 | media ≥ 30 | baixa < 30`

---

## Fluxo principal

```
ACS abre app
  └─ ListaPage (offline-first — dados do IndexedDB ou mockData)
       ├─ Aba "Lista": pacientes da semana, ordenados por prioScore desc
       │    Cards mostram: nome · condições · distanciaKm · motivoPrioridade
       └─ Aba "Mapa" (TODO): react-leaflet + OpenStreetMap
            Pin azul = unidade da equipe (EQUIPE_LAT/LNG)
            Pins coloridos = pacientes por prioridade
            Clique no pin → VisitaPage

  └─ VisitaPage (id)
       ├─ Header: nome, faixaEtaria, racaCor, badges de condição, motivoPrioridade
       │    Link "📍 X km da unidade — abrir no Maps" → google.com/maps?q=lat,lng
       ├─ Seção: Presença (estava em casa / não estava / recusou)
       ├─ Seção: Dados gerais (raça/cor, vulnerabilidade)
       ├─ [Se hipertenso/diabetico] SecaoCronico (P1–P7 Ficha B)
       ├─ [Se gestante] SecaoGestante (P1–P10 Ficha B Gestante)
       ├─ [Se criança 0-6] SecaoCrianca (P1–P9 Ficha C)
       ├─ [Se vulneravel] SecaoVulneravel
       └─ Botão "Salvar visita"
            → salvarVisita() → IndexedDB (synced: false)
            → Se precisaEncaminhamento: mostrar banner "Indicar consulta"
            → Navega de volta para ListaPage
```

---

## Regra "Não sei / Não sabe informar"

Qualquer campo clínico com incerteza (ex.: familiar não sabe a medicação, paciente confuso) aceita a terceira opção `'nao_sei'`.

- Valor persistido no IndexedDB junto ao registro
- Se **qualquer** campo do registro retornar `'nao_sei'`, `precisaEncaminhamento = true`
- Ao salvar com `precisaEncaminhamento: true`: exibir card de confirmação antes de navegar
- Flag sincroniza com o backend → permite supervisor filtrar pacientes que precisam de consulta agendada

---

## Offline / Sync

```
Offline:
  salvarVisita() → IndexedDB { synced: false }
  SyncBar mostra "N pendentes"

Online (useSync hook):
  window.addEventListener('online', ...)
  getVisitasPendentes() → filtra synced == false (in-memory, não indexado)
  POST /sync → [{ ... }]
  marcarComoSynced([ids]) → transaction rw → synced = true
  SyncBar mostra "Sincronizado"
```

**Nota técnica:** `synced` não é indexado no schema Dexie — booleans são tipos inválidos como chave IndexedDB. Filtragem feita in-memory (`toArray().filter(!v.synced)`). Volume < 100 registros/semana, sem impacto de performance.

---

## Dados de referência (parquets)

| Dataset | Linhas | Campos-chave |
|---|---|---|
| pacientes | 97,938 | lat, lng, hipertenso, diabetico, gestacao, vulnerabilidade |
| visitas | 159,599 | profissional_id, paciente_id, data |
| eventos_clinicos | 100,503 | tipo (agendamento / urgencia-emergencia-ou-internacao) |
| equipes | 49 | equipe_id, lat, lng (posição da unidade) |

Equipe de demo: `0206636a` — 1,998 pacientes, unidade em `-22.928956, -43.233984`

---

## Como rodar localmente

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm test             # 23 testes Vitest
npm run build        # build de produção + PWA
```

## Deploy

Push para `main` do repo `vinicius-saraiva/impact-lab-saude-17` não aciona Vercel automaticamente ainda (projeto linkado manualmente via CLI). Para re-deployar:

```bash
cd frontend
vercel --prod
```
