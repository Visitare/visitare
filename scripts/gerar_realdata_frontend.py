"""
Gera frontend/src/realData.ts no formato esperado pelo frontend do Vini.

Diferenca do gerar_lista_do_dia.py:
- Esse aqui escreve TypeScript com Paciente[] no shape exato de frontend/src/types.ts
- Inclui a funcao getPacientesSemana() compativel (Mon-Fri x 5/dia)
- Vini troca 1 linha de import em ListaPage/VisitaPage:
    -import { ... } from '../mockData'
    +import { ... } from '../realData'

Mapeamento PRIO-ACS tier -> prioridade do front:
  score >= 70 -> critica
  score 50-69 -> alta
  score 30-49 -> media
  score <  30 -> baixa
"""

from __future__ import annotations

import argparse
import math
import re
from datetime import date, datetime
from pathlib import Path

import pandas as pd

# Reusa load/score do outro script
import sys
sys.path.insert(0, str(Path(__file__).parent))
from gerar_lista_do_dia import (  # noqa: E402
    compute_score,
    find_profissional_default,
    load_tables,
    _is_age_0_6,
)

DEFAULT_DATA_DIR = Path("data/raw")
DEFAULT_OUT = Path("frontend/src/realData.ts")
TOP_N_DEFAULT = 25  # 5 dias x 5/dia

# Dicionario pequeno de primeiros nomes BR para tornar a demo mais humana sem PII
NOMES_FEMININOS = [
    "Maria", "Ana", "Francisca", "Luciana", "Sandra", "Patricia", "Carla",
    "Juliana", "Claudia", "Rita", "Mariana", "Beatriz", "Camila", "Bruna",
    "Vanessa", "Renata", "Andreia", "Cristina", "Larissa", "Adriana",
    "Fernanda", "Cassia", "Simone", "Eliane", "Monica", "Vera", "Helena",
    "Rosangela", "Joana", "Lucia",
]
NOMES_MASCULINOS = [
    "Joao", "Pedro", "Carlos", "Marcos", "Antonio", "Paulo", "Jose",
    "Ricardo", "Fernando", "Roberto", "Sergio", "Eduardo", "Luiz", "Andre",
    "Bruno", "Felipe", "Gustavo", "Rafael", "Daniel", "Rodrigo", "Mauricio",
    "Alexandre", "Thiago", "Diego", "Marcelo", "Anderson", "Wagner",
    "Leandro", "Henrique", "Vinicius",
]
SOBRENOMES_INICIAL = list("ABCDFGHILMNOPRSTV")

FAIXA_ETARIA_MAP = {
    # Os Parquets usam strings como "0-6", "65+", etc. Mapeia para o enum do front.
    # Front aceita: '0-6' | '6-18' | '19-45' | '45-65' | '66+'
    "0-6": "0-6",
    "6-18": "6-18",
    "19-45": "19-45",
    "45-65": "45-65",
    "66+": "66+",
    # fallbacks para variacoes
    "7-12": "6-18",
    "13-18": "6-18",
    "18-30": "19-45",
    "30-45": "19-45",
    "45-60": "45-65",
    "60-65": "45-65",
    "65+": "66+",
    "70+": "66+",
}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _hash_to_int(s: str) -> int:
    # Pega os primeiros chars hex do hash p/ deterministico
    return int(s[:8], 16)


def _gen_nome(paciente_id: str, sexo: str) -> str:
    idx = _hash_to_int(paciente_id)
    pool = NOMES_FEMININOS if sexo.lower().startswith("f") else NOMES_MASCULINOS
    primeiro = pool[idx % len(pool)]
    inicial = SOBRENOMES_INICIAL[(idx // len(pool)) % len(SOBRENOMES_INICIAL)]
    return f"{primeiro} {inicial}."


def _map_faixa(raw: str) -> str:
    if not isinstance(raw, str):
        return "19-45"
    if raw in FAIXA_ETARIA_MAP:
        return FAIXA_ETARIA_MAP[raw]
    if raw.startswith("0-"):
        return "0-6"
    if "+" in raw:
        return "66+"
    return "19-45"


def _map_raca(raw: str) -> str:
    valid = {"Branca", "Preta", "Parda", "Amarela", "Indigena", "Indígena", "Outros"}
    if raw in valid:
        return raw if raw != "Indigena" else "Indígena"
    return "Outros"


def _condicoes(row: pd.Series) -> list[str]:
    out: list[str] = []
    if row["gestacao"]:
        out.append("gestante")
    if row["diabetico"]:
        out.append("diabetico")
    if row["hipertenso"]:
        out.append("hipertenso")
    if row["situacao_vulnerabilidade"]:
        out.append("vulneravel")
    if _is_age_0_6(row["faixa_etaria"]):
        out.append("crianca")
    return out


def _prioridade(score: int) -> str:
    if score >= 70:
        return "critica"
    if score >= 50:
        return "alta"
    if score >= 30:
        return "media"
    return "baixa"


def _motivo_pt(row: pd.Series, n_urgencias_12m: int) -> str:
    parts: list[str] = []
    if row["gestacao"]:
        descritor = "gestante"
        if row["diabetico"]:
            descritor += " diabética"
        if row["hipertenso"]:
            descritor += " hipertensa"
        parts.append(descritor)
    elif row["hipertenso"] and row["diabetico"]:
        parts.append("hipertenso + diabético")
    elif row["diabetico"]:
        parts.append("diabético")
    elif row["hipertenso"]:
        parts.append("hipertenso")

    faixa = _map_faixa(row["faixa_etaria"])
    if faixa == "0-6":
        parts.append(f"criança {row['faixa_etaria']}")
    elif faixa == "66+":
        parts.append("idoso 66+")

    if row["situacao_vulnerabilidade"]:
        parts.append("vulnerável")

    if n_urgencias_12m >= 2:
        parts.append(f"{n_urgencias_12m} urgência/internação")

    if row["dias_gap"] >= 9999:
        parts.append("nunca visitado")
    elif row["gap_vencido"]:
        parts.append(f"sem visita há {int(row['dias_gap'])}d")

    return " · ".join(parts) if parts else "acompanhamento de rotina"


def _ultima_visita_iso(row: pd.Series) -> str | None:
    if pd.isna(row.get("ultima_visita")):
        return None
    return row["ultima_visita"].date().isoformat()


def _ts_string_escape(s: str | None) -> str:
    if s is None:
        return "null"
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def _ts_paciente_literal(p: dict) -> str:
    """Renderiza um Paciente como TS object literal."""
    def b(v): return "true" if v else "false"
    flds = []
    flds.append(f"    id: '{p['id']}',")
    flds.append(f"    nome: '{p['nome']}',")
    flds.append(f"    equipeId: '{p['equipeId']}',")
    flds.append(f"    unidadeId: '{p['unidadeId']}',")
    flds.append(f"    faixaEtaria: '{p['faixaEtaria']}',")
    flds.append(f"    sexo: '{p['sexo']}',")
    flds.append(f"    racaCor: '{p['racaCor']}',")
    flds.append(f"    situacaoVulnerabilidade: {b(p['situacaoVulnerabilidade'])},")
    flds.append(f"    lat: {p['lat']:.6f}, lng: {p['lng']:.6f},")
    flds.append(f"    distanciaKm: {p['distanciaKm']},")
    flds.append(f"    enderecoDescricao: '{p['enderecoDescricao']}',")
    flds.append(f"    hipertenso: {b(p['hipertenso'])}, diabetico: {b(p['diabetico'])}, gestante: {b(p['gestante'])},")
    cond_lit = ", ".join(f"'{c}'" for c in p["condicoes"])
    flds.append(f"    condicoes: [{cond_lit}],")
    flds.append(f"    prioridade: '{p['prioridade']}', prioScore: {p['prioScore']},")
    flds.append(f"    motivoPrioridade: {_ts_string_escape(p['motivoPrioridade'])},")
    flds.append(f"    ultimaVisita: {_ts_string_escape(p['ultimaVisita'])},")
    return "  {\n" + "\n".join(flds) + "\n  }"


def gerar_pacientes_para_equipe(
    equipe_id: str,
    pacientes_scored: pd.DataFrame,
    eventos: pd.DataFrame,
    equipe_lat: float,
    equipe_lng: float,
    top_n: int,
) -> list[dict]:
    """Gera top-N pacientes da equipe no formato do front."""
    territory = pacientes_scored[pacientes_scored["equipe_id"] == equipe_id].copy()

    # Conta urgencias/emergencias/internacoes nos ultimos 12 meses
    eventos_nao = eventos[eventos["tipo"] != "agendamento"]
    contagem = eventos_nao.groupby("paciente_id").size().rename("n_urg_12m")
    territory = territory.merge(contagem, on="paciente_id", how="left")
    territory["n_urg_12m"] = territory["n_urg_12m"].fillna(0).astype(int)

    top = territory.sort_values("score", ascending=False).head(top_n)

    out: list[dict] = []
    for _, row in top.iterrows():
        pid_hash = row["paciente_id"]
        sexo = str(row["sexo"])
        lat = float(row["endereco_latitude"]) if pd.notna(row["endereco_latitude"]) else equipe_lat
        lng = float(row["endereco_longitude"]) if pd.notna(row["endereco_longitude"]) else equipe_lng
        dist = _haversine_km(equipe_lat, equipe_lng, lat, lng)
        dist_str = f"{dist:.1f}".replace(".", ",")
        out.append({
            "id": f"p-{pid_hash[:6]}",
            "nome": _gen_nome(pid_hash, sexo),
            "equipeId": equipe_id[:8],  # encurtado para legibilidade
            "unidadeId": str(row["unidade_id"])[:8],
            "faixaEtaria": _map_faixa(row["faixa_etaria"]),
            "sexo": "Feminino" if sexo.lower().startswith("f") else "Masculino",
            "racaCor": _map_raca(str(row["raca_cor"])),
            "situacaoVulnerabilidade": bool(row["situacao_vulnerabilidade"]),
            "lat": lat,
            "lng": lng,
            "distanciaKm": round(dist, 1),
            "enderecoDescricao": f"{dist_str} km da unidade",
            "hipertenso": bool(row["hipertenso"]),
            "diabetico": bool(row["diabetico"]),
            "gestante": bool(row["gestacao"]),
            "condicoes": _condicoes(row),
            "prioridade": _prioridade(int(row["score"])),
            "prioScore": int(row["score"]),
            "motivoPrioridade": _motivo_pt(row, int(row["n_urg_12m"])),
            "ultimaVisita": _ultima_visita_iso(row),
        })

    return out


HEADER = """// AUTO-GERADO por scripts/gerar_realdata_frontend.py
// Dados reais derivados dos 4 Parquets anonimizados (SMS-Rio Hackathon 2026)
// Score PRIO-ACS conforme MASTER_CONTEXT.md secao 6.4
// Para regerar: python scripts/gerar_realdata_frontend.py
//
// Para usar no app, troque o import em ListaPage.tsx e VisitaPage.tsx:
//   - import { ... } from '../mockData'
//   + import { ... } from '../realData'

import type { Paciente } from './types'
"""

FOOTER = """
export function getPacientesSemana(): Map<string, Paciente[]> {
  const hoje = new Date()
  const diaSemana = hoje.getDay()
  const seg = new Date(hoje)
  seg.setDate(hoje.getDate() - ((diaSemana === 0 ? 7 : diaSemana) - 1))

  const diasUteis = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(seg)
    d.setDate(seg.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  const mapa = new Map<string, Paciente[]>()
  diasUteis.forEach((dia) => mapa.set(dia, []))

  const prioOrdem = { critica: 0, alta: 1, media: 2, baixa: 3 } as const
  const ordenados = [...REAL_PACIENTES].sort((a, b) => {
    const diff = prioOrdem[a.prioridade] - prioOrdem[b.prioridade]
    return diff !== 0 ? diff : b.prioScore - a.prioScore
  })

  let diaIdx = 0
  for (const p of ordenados) {
    while (diaIdx < diasUteis.length) {
      const lista = mapa.get(diasUteis[diaIdx])!
      if (lista.length < 5) {
        lista.push(p)
        break
      }
      diaIdx++
    }
  }

  return mapa
}

export function googleMapsUrl(paciente: Paciente): string {
  return `https://www.google.com/maps/search/?api=1&query=${paciente.lat},${paciente.lng}`
}
"""


def write_ts(
    out_path: Path,
    pacientes: list[dict],
    equipe_lat: float,
    equipe_lng: float,
    equipe_id_short: str,
) -> None:
    pacientes_lits = ",\n".join(_ts_paciente_literal(p) for p in pacientes)
    body = (
        HEADER
        + "\n"
        + f"// Equipe demo: {equipe_id_short} (centroide da unidade de saúde)\n"
        + f"export const EQUIPE_LAT = {equipe_lat:.6f}\n"
        + f"export const EQUIPE_LNG = {equipe_lng:.6f}\n\n"
        + f"export const REAL_PACIENTES: Paciente[] = [\n{pacientes_lits}\n]\n\n"
        + "// Backward-compat: front antigo importa MOCK_PACIENTES\n"
        + "export const MOCK_PACIENTES = REAL_PACIENTES\n"
        + FOOTER
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(body, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--data", type=str, default="2025-12-31")
    parser.add_argument("--top-n", type=int, default=TOP_N_DEFAULT)
    parser.add_argument("--equipe", type=str, default=None, help="equipe_id especifico (omita pra escolher automatico)")
    args = parser.parse_args()

    ref_date = datetime.strptime(args.data, "%Y-%m-%d").date()

    print(f"Carregando 4 Parquets de {args.data_dir}/ ...")
    pacientes, eventos, visitas, equipes = load_tables(args.data_dir)

    print(f"Computando PRIO-ACS (ref={ref_date}) ...")
    scored = compute_score(pacientes, eventos, visitas, ref_date)

    if args.equipe:
        equipe_id = args.equipe
    else:
        print("Selecionando equipe com variedade clinica ...")
        _, equipe_id = find_profissional_default(visitas, scored)
    print(f"  equipe: {equipe_id}")

    eq_row = equipes[equipes["equipe_id"] == equipe_id]
    if eq_row.empty:
        eq_lat = float(scored[scored["equipe_id"] == equipe_id]["endereco_latitude"].mean())
        eq_lng = float(scored[scored["equipe_id"] == equipe_id]["endereco_longitude"].mean())
    else:
        eq_lat = float(eq_row["endereco_latitude"].iloc[0])
        eq_lng = float(eq_row["endereco_longitude"].iloc[0])
    print(f"  unidade: lat={eq_lat:.4f}, lng={eq_lng:.4f}")

    pacientes_front = gerar_pacientes_para_equipe(equipe_id, scored, eventos, eq_lat, eq_lng, args.top_n)
    print(f"  pacientes gerados: {len(pacientes_front)}")

    dist = {"critica": 0, "alta": 0, "media": 0, "baixa": 0}
    for p in pacientes_front:
        dist[p["prioridade"]] += 1
    print(f"  prioridades: critica={dist['critica']}, alta={dist['alta']}, media={dist['media']}, baixa={dist['baixa']}")

    write_ts(args.out, pacientes_front, eq_lat, eq_lng, equipe_id[:8])
    print(f"\n  -> {args.out}")
    print("\nPara plugar no frontend, troque o import:")
    print("  ListaPage.tsx:  import { getPacientesSemana } from '../realData'")
    print("  VisitaPage.tsx: import { ... } from '../realData'")


if __name__ == "__main__":
    main()
