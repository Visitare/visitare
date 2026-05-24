# Frontend TODOs — ACS Visitas

## Concluído
- [x] Lista semanal (Seg–Sex, máx 5/dia, default segunda)
- [x] Formulário condicional por tipo de paciente (hipertenso, gestante, diabético, criança, vulnerável)
- [x] Dados gerais do paciente (raça/cor, vulnerabilidade)
- [x] Offline-first com IndexedDB (Dexie) + sync bar
- [x] PWA configurável para instalar no Android
- [x] Form hipertensão — sub-form dedicado, ficha histórica (pressão, medicação, sintomas)
- [x] Dados pré-existentes do paciente — card "Último registro" acima das perguntas
- [x] Testes de IndexedDB — 23 testes (persistência, sync, campos clínicos, offline→sync)
- [x] PRIO-ACS score calculado dos parquets reais (18 pacientes, equipe 0206636a)
- [x] `motivoPrioridade` factual — sem texto diagnóstico
- [x] Distância do ACS para o paciente na lista (km) — ACS decide a rota
- [x] Link Google Maps no formulário — endereço do paciente (sem sugestão de rota)
- [x] `RacaCor` corrigido — Branca / Preta / Parda / Amarela / Indígena / Outros
- [x] Deploy Vercel — https://frontend-psi-black-9cdy0n3cqq.vercel.app

---

## 🔴 Must have — 3h restantes

### 1. Formulários oficiais (substituir perguntas mock)

**Ficha B Crônico — substituir SecaoHipertensao pelas P1–P6 reais**
- [ ] P1 — Nas últimas 2 semanas, esqueceu alguma dose? (Sim / Não / Não sei)
- [ ] P2 — Com que frequência é difícil lembrar? (Sempre / Quase sempre / Às vezes / Quase nunca / Nunca / Não sei)
- [ ] P3 — Sente desconforto pela medicação? (Sim / Não / Não sei)
- [ ] P4 — Tem dificuldade ou dúvida sobre o tratamento? (Sim / Não / Não sei)
- [ ] P5 — Mudança de estilo de vida? (Não / Cessando tabagismo / Iniciando atividade física / Mudando alimentação)
- [ ] P6 — Precisou de UPA ou Emergência? (Sim / Não) ⚠️ SIM → badge alerta + flag encaminhamento
- [ ] P7 DM — Machucado no pé? (Sim / Não / Não sei) → SIM: encaminhamento + nota
- [ ] Campo livre observações (1000 chars)

**Ficha B Gestante — substituir SecaoGestante**
- [ ] DUM + DPP + semana gestacional calculada automaticamente
- [ ] P1 (0–41sem) — Mediu a pressão? (Sim / Não / Não sei)
- [ ] P2 (0–41sem) — Precisou de UPA/maternidade? (Sim / Não) ⚠️ SIM → urgência
- [ ] P3 (0–41sem) — Realizou os exames solicitados? (Sim / Não / Não sei)
- [ ] P4 (0–12sem) — Está enjoando? (Sim / Não)
- [ ] P5 (0–12sem) — Teve sangramento? (Sim / Não) ⚠️ SIM → urgência
- [ ] P6 (0–24sem) — Ardência ao urinar? (Sim / Não / Não sei)
- [ ] P7 (13–41sem) — Ganho de peso (Adequado / Muito peso / Pouco peso / Não sei)
- [ ] P8 (13–41sem) — Inchaço nas pernas? (Sim / Não / Não sei)
- [ ] P9 (25–41sem) — Sentiu bebê mexer nas últimas 24h? (Sim / Não) ⚠️ NÃO → urgência imediata
- [ ] P10 (25–41sem) — Visitou a maternidade de referência? (Sim / Não)
- [ ] Fatores de risco (multi-select → alto risco → cadência semanal)

**Ficha C Criança (0–6 anos) — substituir SecaoCrianca**
- [ ] Idade em meses calculada automaticamente
- [ ] P1 (0–28d) — Primeira consulta em até 7 dias? ⚠️ NÃO → urgência
- [ ] P2 (0–5m) — Onde dorme? (Berço / Chão / Cama com outros / Sofá) → triagem SMSL
- [ ] P3 — Comparecendo às consultas? (Sim / Não / Não sei)
- [ ] P4 — Vacinação em dia? (Sim / Não / Não sei)
- [ ] P5 — Alimentação (enum LM / misto / outros)
- [ ] P6 — Sinais de risco (multi-select) ⚠️ sinais críticos → urgência
- [ ] P7 — Alteração no desenvolvimento? (Sim / Não / Não sei)
- [ ] P8 — Perfil BPC sem benefício? (Sim / Não / Não sei)
- [ ] P9 — Comida acabou antes do dinheiro? (Sim / Não)

### 2. "Não sei" em campos clínicos
- [ ] Todo campo clínico que admite incerteza deve ter terceira opção: **Não sei / Não sabe informar**
- [ ] Valor `'nao_sei'` salvo no IndexedDB junto com o registro
- [ ] Quando qualquer campo retornar `'nao_sei'`, flag `precisaEncaminhamento = true` no `RegistroVisita`
- [ ] Ao salvar, se `precisaEncaminhamento == true` → mostrar banner/card: **"Indicar consulta necessária para este paciente"** com botão confirmar
- [ ] Flag salvo no registro offline e sincronizado — permite supervisor filtrar "pacientes a encaminhar"

### 3. Localização da ACS + mapa integrado na lista

**Opção recomendada para 3h: Leaflet + OpenStreetMap (react-leaflet)**
- Sem API key, open source, funciona offline com tiles em cache
- Instala em 1 linha: `npm i react-leaflet leaflet`
- Mostra pin azul para a ACS (ponto fixo da equipe = `EQUIPE_LAT/LNG` do parquet)
- Pins coloridos por prioridade (vermelho/laranja/amarelo/verde) para cada paciente da semana
- Clique no pin → abre VisitaPage
- Distâncias já calculadas no mockData — exibir como label no pin

- [ ] Instalar `react-leaflet` + `leaflet` + `@types/leaflet`
- [ ] Componente `MapaVisitas` na ListaPage — aba "Lista" / "Mapa" (tab toggle)
- [ ] Pin da unidade (azul) em `EQUIPE_LAT, EQUIPE_LNG`
- [ ] Pins de pacientes coloridos por `prioridade` (critica=vermelho, alta=laranja, media=amarelo, baixa=verde)
- [ ] Popup no pin: nome, prioScore, distanciaKm, botão "Registrar visita"
- [ ] Posição da ACS: usar `navigator.geolocation` se disponível; fallback = ponto da equipe

> **Alternativas descartadas para 3h:**
> - Google Maps Static API: imagem não-interativa (5min mas inútil para demo real)
> - Google Maps JS: requer API key com billing habilitado
> - Mapbox: requer API key, mais complexo

---

## 🟡 Testes offline — nice to have

Os testes de IndexedDB (23) já cobrem o fluxo lógico offline. Para simular o ciclo completo na UI:

- [ ] Teste Vitest: mockar `navigator.onLine = false` → salvar visita → `navigator.onLine = true` → disparar sync → verificar `synced = true`
- [ ] Vitest `useSync` hook — testar: fila pendente acumula offline, sync dispara ao voltar online
- [ ] Teste de conflito: dois registros para o mesmo `pacienteId` no mesmo dia → merge strategy (último salvo vence, com flag `conflito: true`)

> Para a demo ao vivo: o sync bar existente já mostra o estado visualmente. Mostrar no celular: colocar em modo avião, registrar visita, tirar do avião → sync automático.

---

## Enums novos em `types.ts`
- [ ] `RespostaSN`: `'sim' | 'nao' | 'nao_sei'` — substituir boolean em campos clínicos que admitem incerteza
- [ ] `Frequencia5pt`: `'sempre' | 'quase_sempre' | 'as_vezes' | 'quase_nunca' | 'nunca' | 'nao_sei'`
- [ ] `MudancaEstiloVida`: `'nao' | 'tabagismo' | 'atividade_fisica' | 'alimentacao'`
- [ ] `GanhoPesoGestante`: `'adequado' | 'muito' | 'pouco' | 'nao_sei'`
- [ ] `AlimentacaoCrianca`: enum 8 valores (LM exclusivo → outros alimentos)
- [ ] `SinalRiscoCrianca`: multi-select 12 valores
- [ ] `OndeDoirmeCrianca`: `'berco' | 'chao' | 'cama_compartilhada' | 'sofa'`
- [ ] Adicionar `precisaEncaminhamento?: boolean` em `RegistroVisita`

---

## Escalação e Alertas
- [ ] P6 Crônico Sim → banner "⚠️ Urgência — UPA/Emergência" + flag encaminhamento
- [ ] P9 Gestante Não (>25sem) → banner "🚨 Não sentiu bebê mexer — encaminhar imediato"
- [ ] P5 Gestante Sim (<12sem) → banner "🚨 Sangramento — urgência"
- [ ] P6 Criança sinais críticos → banner "🚨 Sinal de risco — atendimento imediato"
- [ ] Anti-pattern PRISMATIC: cada alerta tem instrução concreta (não só score)

---

## Dados / API
- [ ] Substituir mockData.ts por dados reais da API (filtrado por equipe_id do ACS logado)
- [ ] Login por profissional_id (simples, sem OAuth)
- [ ] Score engine no backend (FastAPI + DuckDB sobre parquets)
- [ ] Endpoint `/visitas/semana?profissional_id=X&semana=YYYY-WW`
- [ ] Endpoint `/sync` — recebe fila offline, envia ao Vitacare (mock)

---

## Offline / PWA
- [ ] Background Sync API — sync automático ao voltar online
- [ ] Indicador "dados atualizados em X" vs "cache da semana anterior"
- [ ] Service Worker: cache da lista toda manhã

---

## Deploy
- [x] Deploy frontend — https://frontend-psi-black-9cdy0n3cqq.vercel.app
- [ ] Deploy backend FastAPI (Fly.io ou Railway)
- [ ] README hackathon: demo video, link do app, arquitetura, impacto (1.55M horas/ano)
