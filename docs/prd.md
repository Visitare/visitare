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
- Para o protótipo: **dados mockados** em
  `/Users/viniciusandrade/Documents/Projects/impact-lab/claude-impact-lab-saude/dados/`
  (parquets anonimizados — pacientes, visitas, eventos clínicos, equipes).

### 4.2 Motor de priorização

Consome os dados e devolve, por ACS, uma lista de pacientes ordenada por
prioridade. A prioridade combina:

- Condições crônicas e gestação (cadência mínima do manual).
- Vulnerabilidade social.
- Gap desde a última visita vs. cadência esperada.
- Eventos clínicos recentes (urgência sobe; agendamento sobe).
- Distância à unidade (para roteirização).

Ver `claude-impact-lab-saude/exploration.py` — mapa de features e exemplo
extraído de um paciente real.

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

- **Segurança**: dados de saúde são sensíveis (LGPD art. 11). Como
  transmitimos com segurança entre o app do ACS, nosso backend e o Vitacare?
- **Conectividade**: ACS está em campo, fora do WiFi da clínica e
  frequentemente em áreas com sinal ruim. Modo offline?
- **Autenticação**: como o ACS faz login? Via SUS? Single sign-on do
  município? Token gerado pelo gestor?
- **Quem vê o quê**: ACS vê os seus; gerente vê a equipe; coordenador vê a
  área programática. Como modelamos isso?
- **Vitacare de volta**: (A) extensão Chrome vs. (B) API — qual é factível
  até a demo, qual é o caminho de produção?
