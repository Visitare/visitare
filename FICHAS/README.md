# Fichas Oficiais SMS-Rio / SUBPAV — Spec Dev-Ready

> **Fonte:** Secretaria Municipal de Saúde do Rio de Janeiro · Subsecretaria de Atenção Primária à Saúde (versão 1.0 — 2022)
> **Propósito:** Especificação canônica dos formulários do ACS para o aplicativo do Rio Impact Lab 2026
> **Para:** Backend + Frontend devs

---

## TL;DR

- **6 JSONs** descrevem 5 fichas oficiais + enums compartilhadas
- Cada JSON tem `secoes`, `campos` tipados, `regras_negocio`, `indicadores_gerados`
- Backend valida payload + dispara `regras_negocio` para alimentar o score PRIO-ACS
- Frontend renderiza dinamicamente — `tipo` controla widget, `obrigatorio` valida, `visivel_se` aplica condicionais

---

## Arquivos

| Arquivo | O que é |
|---------|---------|
| `_shared.json` | 30+ enumerações reusáveis + cabeçalho comum a todas as fichas |
| `ficha_a_cadastro_familia.json` | Cadastro de família e cidadão (porta de entrada) |
| `ficha_b_cronico.json` | Acompanhamento HAS / DM / Asma / DPOC / Idoso vulnerável |
| `ficha_b_gestante.json` | Acompanhamento de gestante |
| `ficha_c_primeira_infancia.json` | Acompanhamento criança 0-6 anos |
| `ficha_b_tuberculose.json` | Acompanhamento TB / TDO diário |
| `SMS_SUBPAV_FICHA *.pdf` | PDFs originais — referência visual |
| `README.md` | Este arquivo |

---

## Tabela mestre — quando cada ficha é usada

| Ficha | Quando | Cadência mínima oficial |
|-------|--------|-------------------------|
| **FICHA A** | No 1º contato + a cada mudança de moradia/família | Pontual + atualização anual |
| **FICHA B CRÔNICO** | Paciente com HAS, DM, Asma, DPOC ou idoso vulnerável | **Mensal** (descompensado: quinzenal) |
| **FICHA B GESTANTE** | Mulher gestante | **Mensal** (risco habitual) · **Semanal** (alto risco) |
| **FICHA C** | Criança de 0 a 6 anos | **Mensal** |
| **FICHA B TB** | Paciente com TB em tratamento | **Diário** (TDO supervisionado) |

> Um mesmo paciente pode ter **múltiplas fichas ativas** (ex: gestante diabética = Ficha A + Ficha B Gestante + Ficha B Crônico).

---

## Estrutura padrão de cada ficha JSON

```json
{
  "ficha_id": "FICHA_A",
  "codigo_oficial": "SMSDC008_SIAB",
  "nome": "Ficha de Cadastro...",
  "versao_oficial": "1.0",
  "ano": 2022,
  "publico_alvo": "Família + cidadão",
  "linha_de_cuidado": "Base",
  "frequencia_aplicacao": "Pontual",
  "descricao": "...",
  "secoes": [
    {
      "id": "cabecalho",
      "label": "Cabeçalho",
      "ordem": 1,
      "shared_ref": "_shared.cabecalho_comum"
    },
    {
      "id": "visitas",
      "label": "Visitas",
      "tipo": "array",
      "min_items": 0,
      "max_items": 12,
      "item_schema": {
        "campos": [ ... ]
      }
    }
  ],
  "regras_negocio": [
    {
      "id": "RN001",
      "descricao": "P6 == 'S' dispara escalonamento",
      "tipo": "downstream"
    }
  ],
  "indicadores_gerados": [
    "Cobertura de pré-natal",
    "..."
  ]
}
```

### Anatomia de um campo

```json
{
  "id": "p9_sentiu_bebe_mexer",       // ID estável snake_case
  "label": "9) Você sentiu...",       // Texto exibido ao ACS (PT-BR)
  "tipo": "enum",                     // Widget e validação
  "obrigatorio": false,               // true = asterisco no PDF
  "enum_ref": "_shared.enums.sim_nao",// Referência a _shared.json
  "visivel_se": "semana_gestacao >= 25",
  "descricao": "URGÊNCIA: NÃO sentir > 24h → encaminhamento"
}
```

### Tipos suportados

| `tipo` | Widget recomendado | Validação |
|--------|--------------------|-----------|
| `string` | Input text | `max_length`, `pattern` |
| `text` | Textarea | `max_length` |
| `integer` | Input number | `min`, `max` |
| `decimal` | Input number | `min`, `max`, `precision` |
| `date` | Date picker | ISO 8601 (YYYY-MM-DD) |
| `datetime` | Datetime picker | ISO 8601 |
| `boolean` | Toggle | — |
| `enum` | Radio / Select | `enum_values` ou `enum_ref` |
| `multi_enum` | Multi-select / Checkboxes | `enum_values` ou `enum_ref` |
| `cpf` | Input formatado | Algoritmo validador CPF |
| `cep` | Input formatado | `\d{5}-?\d{3}` |
| `phone` | Input formatado | E.164 ou nacional |
| `array` | Lista repetível | `item_schema`, `min_items`, `max_items` |
| `object` | Subgrupo | `schema` |
| `geo_point` | Mapa + GPS | lat/lon |

### Propriedades opcionais do campo

- `obrigatorio: true` → equivale ao asterisco `*` no PDF oficial
- `obrigatorio_condicional: "<expressão>"` → obrigatório só se a expressão for verdadeira
- `visivel_se: "<expressão>"` → renderiza o campo apenas se a expressão for verdadeira
- `calculo_sugerido: "<expressão>"` → valor pode ser sugerido automaticamente (ex: `dpp = dum + 280 dias`)
- `enum_ref: "_shared.enums.<nome>"` → reusa enumeração compartilhada
- `enum_values: [...]` → lista inline (use quando não vale a pena reusar)
- `item_schema: {...}` → schema do item, quando `tipo == "array"`
- `descricao: "..."` → ajuda/contexto clínico (pode ser tooltip no frontend)

---

## Quick-start Backend (Python / FastAPI)

```python
import json
from pathlib import Path
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

FICHAS_DIR = Path("docs/FICHAS")
SHARED = json.load(open(FICHAS_DIR / "_shared.json"))
FICHAS = {
    f.stem: json.load(open(f))
    for f in FICHAS_DIR.glob("ficha_*.json")
}

app = FastAPI()


@app.get("/fichas/{ficha_id}")
def get_ficha_spec(ficha_id: str):
    """Retorna o JSON da ficha (frontend renderiza)."""
    spec = FICHAS.get(ficha_id.lower())
    if not spec:
        raise HTTPException(404, "Ficha não encontrada")
    return spec


class FichaSubmission(BaseModel):
    ficha_id: str
    versao_oficial: str
    paciente_id: str
    profissional_id: str
    payload: dict  # respeita o schema de `secoes`/`campos` da ficha


@app.post("/visitas")
def registrar_visita(submission: FichaSubmission):
    spec = FICHAS.get(submission.ficha_id.lower())
    if not spec:
        raise HTTPException(404, "Ficha desconhecida")

    # 1. valida payload contra o schema
    errors = validate_payload(spec, submission.payload)
    if errors:
        raise HTTPException(422, {"erros": errors})

    # 2. persiste com versão
    visita_id = save_visita(submission)

    # 3. dispara regras_negocio para atualizar PRIO-ACS
    for regra in spec.get("regras_negocio", []):
        if regra["tipo"] == "downstream":
            evaluate_regra(regra, submission.payload, submission.paciente_id)

    return {"visita_id": visita_id, "status": "ok"}


def validate_payload(spec: dict, payload: dict) -> list[str]:
    """Valida obrigatórios + tipos + enums."""
    errors = []
    for secao in spec["secoes"]:
        # ... resolve shared_ref se necessário
        for campo in secao.get("campos", []):
            value = payload.get(campo["id"])
            if campo.get("obrigatorio") and value is None:
                errors.append(f"{campo['id']} é obrigatório")
            # tipo, enum_ref, etc...
    return errors
```

---

## Quick-start Frontend (React + TypeScript)

```tsx
import { useEffect, useState } from "react";

type Campo = {
  id: string;
  label: string;
  tipo: string;
  obrigatorio?: boolean;
  enum_ref?: string;
  enum_values?: { codigo: string; label: string }[];
  visivel_se?: string;
  descricao?: string;
};

type FichaSpec = {
  ficha_id: string;
  nome: string;
  secoes: Array<{ id: string; label: string; campos?: Campo[]; tipo?: string; item_schema?: any; shared_ref?: string }>;
};

function FichaRenderer({ fichaId, paciente }: { fichaId: string; paciente: any }) {
  const [spec, setSpec] = useState<FichaSpec | null>(null);
  const [payload, setPayload] = useState<Record<string, any>>({});

  useEffect(() => {
    fetch(`/fichas/${fichaId}`)
      .then((r) => r.json())
      .then(setSpec);
  }, [fichaId]);

  if (!spec) return <Loading />;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await fetch("/visitas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ficha_id: spec.ficha_id,
            paciente_id: paciente.id,
            payload,
          }),
        });
      }}
    >
      {spec.secoes.map((secao) => (
        <fieldset key={secao.id}>
          <legend>{secao.label}</legend>
          {(secao.campos || []).map((c) => (
            <CampoRenderer
              key={c.id}
              campo={c}
              value={payload[c.id]}
              onChange={(v) => setPayload((p) => ({ ...p, [c.id]: v }))}
              context={payload}
            />
          ))}
        </fieldset>
      ))}
      <button type="submit">Salvar visita</button>
    </form>
  );
}

function CampoRenderer({ campo, value, onChange, context }: any) {
  // 1. visibilidade condicional
  if (campo.visivel_se && !evaluate(campo.visivel_se, context)) return null;

  // 2. widget por tipo
  switch (campo.tipo) {
    case "string":
      return <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} required={campo.obrigatorio} />;
    case "boolean":
      return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
    case "enum":
      return (
        <select value={value || ""} onChange={(e) => onChange(e.target.value)}>
          {(campo.enum_values || resolveEnum(campo.enum_ref)).map((opt: any) => (
            <option key={opt.codigo} value={opt.codigo}>{opt.label}</option>
          ))}
        </select>
      );
    case "date":
      return <input type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
    // ... text, integer, multi_enum, array, geo_point, etc.
    default:
      return <span>Tipo {campo.tipo} não suportado</span>;
  }
}
```

### Offline-first (PWA)

Camila confirma: **mandatório**. Pattern:

```ts
// Service Worker + IndexedDB
async function salvarVisitaOffline(submission: any) {
  const db = await openDB("rio-acs", 1);
  await db.add("pending_visitas", {
    ...submission,
    ficha_id: submission.ficha_id,
    versao_oficial: submission.versao_oficial,
    saved_at: new Date().toISOString(),
    sync_status: "pending",
  });

  // Tenta sync agora; se falhar, fica na fila
  if (navigator.onLine) {
    await sincronizar();
  }
}

async function sincronizar() {
  const db = await openDB("rio-acs", 1);
  const pendentes = await db.getAll("pending_visitas");
  for (const v of pendentes) {
    try {
      await fetch("/visitas", { method: "POST", body: JSON.stringify(v) });
      await db.delete("pending_visitas", v.id);
    } catch {
      // tenta depois (na próxima volta à clínica às 15:30)
    }
  }
}
```

---

## Exemplo de payload preenchido (Ficha B Gestante)

```json
{
  "ficha_id": "FICHA_B_GESTANTE",
  "versao_oficial": "1.0",
  "paciente_id": "uuid-maria-silva",
  "profissional_id": "uuid-camila-acs",
  "payload": {
    "cabecalho": {
      "unidade_saude": "CMS Rocinha",
      "equipe_id": "Cachopinha",
      "codigo_equipe": "0123",
      "microarea": "MA-3",
      "nome_agente_saude": "Camila",
      "data_abertura_ficha": "2026-05-24"
    },
    "identificacao_gestante": {
      "nome": "Maria Silva",
      "idade": 28,
      "data_nascimento": "1997-03-15",
      "cpf": "12345678900",
      "telefones": ["21988887777"],
      "endereco": "Rua Y, beco Z",
      "numero": "10",
      "bairro": "Rocinha"
    },
    "marcos_gestacionais": {
      "dum": "2026-01-10",
      "dpp": "2026-10-17"
    },
    "visitas": [
      {
        "data_visita": "2026-05-24",
        "semana_gestacao": 19,
        "p1_mediu_pressao": "S",
        "p2_atendida_upa_maternidade": "N",
        "p3_realizou_exames": "S",
        "p6_ardencia_urinar": "N",
        "p7_ganho_peso": "1",
        "p8_inchaco_pernas": "N",
        "pa_sistolica": 120,
        "pa_diastolica": 80,
        "pa_data_aferida": "2026-05-22",
        "observacoes": "Sem queixas, próxima consulta em 28d"
      }
    ],
    "informacoes_gestacao": {
      "fatores_risco": []
    },
    "vacinas": {
      "dtpa": "2026-05-10"
    }
  }
}
```

---

## Mapeamento Ficha → PRIO-ACS Score

| Ficha | Impacto no score (componentes) |
|-------|--------------------------------|
| FICHA A | Cadastra base (4 flags + situacao_vulnerabilidade) + horário melhor visita |
| FICHA B Gestante | +25 life-stage + 35 ICSAP grupo 19 + alertas urgência |
| FICHA B Crônico | +15 ICSAP grupo 9 (HAS) ou 13 (DM) + sinal P6 (UPA) |
| FICHA C | +20 life-stage (criança 0-6) + indicadores Previne crianças |
| FICHA B TB | Linha de cuidado diária (TDO) — sobrescreve cadência normal |

---

## Triggers críticos (alimentam alertas para o supervisor)

| Origem | Trigger | Ação |
|--------|---------|------|
| Gestante P5 | Sangramento < 12 sem | URGÊNCIA — risco de aborto |
| Gestante P9 | Não sentiu bebê > 25 sem | URGÊNCIA — maternidade imediata |
| Gestante PA | Sistólica ≥ 140 ou diastólica ≥ 90 | Alerta pré-eclâmpsia |
| Crônico P6 | UPA/Emergência (qualquer perfil) | Visita prioritária + bundle egresso |
| Crônico P7 | Machucado no pé (DM) | Encaminhamento pé diabético |
| Criança P1 | Sem primeira consulta em 7d | Encaminhamento urgente |
| Criança P6 | Gemido / cansaço respiratório | URGÊNCIA pediátrica |
| TB | 2+ doses TDO faltando | Risco de abandono |
| TB P2 | Urina escura / pele amarelada | URGÊNCIA — hepatotoxicidade |

---

## Versionamento

- Cada visita persistida deve carregar `ficha_id` + `versao_oficial` (ex: `"FICHA_B_GESTANTE@1.0"`)
- Quando a SMS-Rio publicar v1.1, novos campos ficam opcionais e `versao_oficial` muda
- Migration: nunca apague payloads antigos — converta sob demanda

---

## Referências cruzadas

- `../2026-05-24-problem-deep-dive/MASTER_CONTEXT.md` — contexto completo do problema
- `../2026-05-24-problem-deep-dive/OFFICIAL_SMS_RIO_FRAMEWORK.md` — Escala de Risco Familiar + 8 linhas de cuidado
- `../Livro_GuiaRapido-PreNatal2025_PDFDigital_20250318.pdf` — guia clínico pré-natal 2025 (complementa Ficha B Gestante)

---

*Versão 1.0 — 2026-05-24 · Time Rio Impact Lab 2026*
