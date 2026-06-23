# PRD — Apoio à decisão de visitas do ACS

## 1. Público-alvo

- **Agente Comunitário de Saúde (ACS)** da Atenção Primária do município do Rio.

## 2. Problema

Hoje o ACS:

1. Planeja visitas com base em memória, papel e conhecimento informal do território.
2. Anota o que observa em campo no **WhatsApp** e, no fim do dia, transcreve para o sistema — o que toma tempo e gera esquecimento de informações importantes.
3. Não tem visão clara, na segunda-feira, de **quem precisa ser visitado naquela semana e por quê**.

## 3. Impacto esperado

- **Reduzir ~1h/dia** que o ACS gasta com registro dos pacientes visitados.
- Fornecer ao ACS **uma visão clara de quem visitar na semana**, com motivo e prioridade.
- Manter a **autonomia do ACS** sobre a decisão final (ver §6).

## 4. Como o sistema funciona

```
Vitacare (dados clínicos)
        │
        ▼
Motor de priorização  ─►  Sugestões priorizadas por ACS
                                  │
                                  ▼
                  ACS escolhe e planeja sua semana
                                  │
                                  ▼
            Form contextual (por situação do paciente)
                                  │
                                  ▼
            Registro estruturado  ─►  Vitacare
```

### 4.1 Origem dos dados

- **Vitacare** é o sistema-fonte: `http://192.168.1.251/vitacare`
- Acessível **apenas dentro do WiFi da clínica** (restrição de rede).
- Para o protótipo: **dados mockados** em `data/` no monorepo (parquets anonimizados —
  pacientes, visitas, eventos clínicos, equipes). Removidos quando o Vitacare conectar.

### 4.2 Motor de priorização

Consome os dados e devolve, por ACS, uma lista de pacientes ordenada por
prioridade. A prioridade combina:

- Condições crônicas e gestação (cadência mínima do manual).
- Vulnerabilidade social.
- Gap desde a última visita vs. cadência esperada.
- Eventos clínicos recentes (urgência sobe; agendamento sobe).
- Distância à unidade (para roteirização).

O motor (fórmula PRIO-ACS v0.2: C1–C4, L_eff dinâmico) vive no repo irmão
`Visitare/visitare-engine` e escreve a tabela `allocations`, que o app lê. Spec
completa em `docs/engine-spec.md`.

### 4.3 Interface do ACS

- Lista priorizada de pacientes, possivelmente **agrupada por tipo de problema**
  (ex.: hipertensos sem visita há X dias; gestantes com agendamento próximo;
  pós-urgência sem follow-up).
- A frequência sugerida de atendimento (regra do manual) é visível por bloco.

### 4.4 Captura em campo

Durante a visita, o ACS preenche um **formulário contextual**, gerado a partir
da situação de saúde do paciente:

- Gestante → bloco pré-natal.
- Hipertenso → aferição de PA, adesão ao medicamento.
- Pós-urgência → motivo da urgência, sintomas atuais.
- Bebê (0-6) → vacinação em dia, marcos do desenvolvimento.

O form serve a dois propósitos:

1. **Lembrete** do que perguntar (reduz esquecimento).
2. **Evitar a re-digitação** no fim do dia.

### 4.5 Devolução ao Vitacare

Não há API pública conhecida do Vitacare. Opções a explorar:

- **(A) Extensão Chrome** que injeta as informações coletadas no front do
  Vitacare quando o ACS está na clínica (rápido, demo-friendly).
- **(B) Integração via API** assumida — caminho oficial, depende de
  conversa com a SMS/equipe técnica do Vitacare.

Para a **apresentação**, simular o envio. Para um piloto, decidir (A) vs. (B).

## 5. Princípio de produto (aprendizado da entrevista com ACS)

> "Um sistema nunca vai dar a lista que eu realmente vou fazer."

O sistema fornece **insumo** para a decisão da ACS, não a decisão. Ela:

- Vê sugestões priorizadas.
- Marca quem vai visitar (e pode adicionar fora da lista).
- Reordena de acordo com o conhecimento de território que só ela tem.

Implicação: a UX precisa parecer um **briefing**, não um **comando**.

## 6. Perguntas em aberto

> Atualizado 2026-06-23: as quatro primeiras foram resolvidas na arquitetura/grill.
> Mantidas aqui com a resolução para rastreabilidade.

- ~~**Segurança**~~ → **Resolvido.** Supabase com RLS por linha (4 níveis de role),
  JWT com `equipe_id`, trigger de auditoria, residência BR (sa-east-1). Ver
  `docs/supabase.md` e `architecture.md §14`.
- ~~**Conectividade**~~ → **Resolvido.** PWA offline-first: trabalho do dia cacheado
  em Dexie (IndexedDB), fila de submissões quando sem sinal. Ver `architecture.md §10`.
- ~~**Autenticação**~~ → **Resolvido (v1).** JWT do Supabase com `equipe_id`; provisão
  de acesso pelo gestor. SSO municipal/SUS fica como `[ROADMAP]`. Ver `architecture.md §5`.
- ~~**Quem vê o quê**~~ → **Resolvido.** 4 níveis de role (ACS / gestor de clínica /
  distrito / município) modelados via RLS. Ver `architecture.md §5`.
- **Vitacare de volta** `[EM ABERTO]`: (A) extensão Chrome vs. (B) API. Decisão da v1 =
  **export único** da carteira de 1 clínica (gated pela base legal/convênio SMS); sync
  contínuo é `[ROADMAP]`. O caminho de write-back automático segue em aberto, dependente
  de conversa com a SMS. Ver `architecture.md §0` (gates) e `prd.md §4.5`.
