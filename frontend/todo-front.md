# Frontend TODOs — ACS Visitas

## Concluído
- [x] Lista semanal (Seg–Sex, visão semanal completa, sem filtro diário)
- [x] Formulário condicional por tipo de paciente (hipertenso, gestante, diabético, criança, vulnerável)
- [x] Dados gerais do paciente (raça/cor, vulnerabilidade)
- [x] Offline-first com IndexedDB (Dexie) + sync bar
- [x] PWA configurável para instalar no Android
- [x] Form hipertensão — Ficha B Crônico SMS-Rio P1–P7 oficial
- [x] Dados pré-existentes do paciente — card "Último registro" acima das perguntas
- [x] Testes de IndexedDB — 23 testes (persistência, sync, campos clínicos, offline→sync)
- [x] PRIO-ACS score calculado dos parquets reais (18 pacientes, equipe 0206636a)
- [x] `motivoPrioridade` factual — sem texto diagnóstico
- [x] Distância do ACS para o paciente na lista (km) — ACS decide a rota
- [x] Link Google Maps no formulário — endereço do paciente (sem sugestão de rota)
- [x] `RacaCor` corrigido — Branca / Preta / Parda / Amarela / Indígena / Outros
- [x] Deploy Vercel — https://frontend-psi-black-9cdy0n3cqq.vercel.app
- [x] **Painel de gestão** (`/supervisor`): KPIs, cobertura por linha de cuidado, ranking Previne, alertas críticos
- [x] **Ficha B Crônico completa** — P1–P7 (P7 só DM), campo observações
- [x] **Ficha B Gestante completa** — DUM + semana gestacional calculada + P1–P10 condicionais por semana
- [x] **Ficha C Criança completa** — P1–P9 com condicionais por idade em meses
- [x] **"Não sei"** — OpcaoSN (Sim/Não/Não sei) em todos os campos clínicos
- [x] **`precisaEncaminhamento`** — auto-computed quando qualquer `nao_sei` ou urgência; modal pós-salvar
- [x] **Enums** — `RespostaSN`, `Frequencia5pt`, `MudancaEstiloVida`, `GanhoPesoGestante`, `AlimentacaoCrianca`, `SinalRiscoCrianca`, `OndeDormeCrianca`
- [x] **Alertas/banners** — P6 Crônico Sim, P5 Gestante Sim, P9 Gestante Não, sinais críticos criança, pé diabético
- [x] **Leaflet + OpenStreetMap** — `MapaVisitas`, tab Lista/Mapa, pins coloridos por prioridade, popup com botão navegar
- [x] **Tela de paciente** (`/paciente/:id`) — dados demográficos, score, localização, último registro, botão "Começar visita"
- [x] **Validação de campos obrigatórios** — botão "Salvar" bloqueado com lista de campos faltando por perfil

---

## 🔴 Must have — ainda pendente

### Mapa
- [ ] `navigator.geolocation` para posicionar a ACS no mapa (fallback = ponto da equipe)

### Dados / API
- [ ] Substituir `mockData.ts` por dados reais da API (filtrado por `equipe_id` do ACS logado)
- [ ] Login por `profissional_id` (simples, sem OAuth) — hoje hardcoded como `'acs-demo-001'`
- [ ] Endpoint `/visitas/semana?profissional_id=X&semana=YYYY-WW`
- [ ] Endpoint `/sync` — envia fila offline ao backend

### Apresentação / entrega
- [ ] README hackathon: demo video, link do app, arquitetura, impacto (1.55M horas/ano)

---

## 🟡 Nice to have

### Testes offline
- [ ] Vitest: mockar `navigator.onLine = false` → salvar → voltar online → sync → `synced = true`
- [ ] Vitest `useSync` hook — fila pendente acumula offline, sync dispara ao voltar online

### PWA / offline avançado
- [ ] Background Sync API — sync automático ao voltar online
- [ ] Indicador "dados atualizados em X" vs "cache da semana anterior"
- [ ] Service Worker: pré-cache da lista toda manhã

### Dados
- [ ] DPP calculado a partir da DUM (hoje só semana gestacional é calculada)
- [ ] Score engine no backend (FastAPI + DuckDB sobre parquets)

---

## Deploy
- [x] Deploy frontend — https://frontend-psi-black-9cdy0n3cqq.vercel.app
- [ ] Deploy backend FastAPI (Fly.io ou Railway)
