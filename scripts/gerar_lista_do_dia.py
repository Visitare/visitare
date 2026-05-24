"""
Gera os 2 JSONs do contrato BUILD_THIS.md a partir dos 4 Parquets reais.

Outputs:
  - out/lista_do_dia.json         (1 profissional, top-N pacientes por PRIO-ACS)
  - out/dashboard_supervisor.json (1 equipe, cobertura por linha de cuidado)

Uso:
    python scripts/gerar_lista_do_dia.py --demo
    python scripts/gerar_lista_do_dia.py --profissional <id> --data 2025-12-31

Score PRIO-ACS (ver MASTER_CONTEXT.md secao 6.4):
  ICSAP proxy (max 35) + Vulnerable life-stage (max 25)
  + Care gap/urgency (max 25) + Social vulnerability (max 15)
"""

from __future__ import annotations

import argparse
import json
from datetime import date, datetime, timedelta
from pathlib import Path

import duckdb
import pandas as pd

DEFAULT_DATA_DIR = Path("data/raw")
DEFAULT_OUT_DIR = Path("out")
TOP_N_DEFAULT = 8


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def load_tables(data_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    con = duckdb.connect()
    pacientes = con.execute(
        f"SELECT * FROM read_parquet('{data_dir.as_posix()}/pacientes_anonimizados.parquet')"
    ).df()
    eventos = con.execute(
        f"SELECT * FROM read_parquet('{data_dir.as_posix()}/eventos_clinicos_anonimizados.parquet')"
    ).df()
    visitas = con.execute(
        f"SELECT * FROM read_parquet('{data_dir.as_posix()}/visitas_anonimizadas.parquet')"
    ).df()
    equipes = con.execute(
        f"SELECT * FROM read_parquet('{data_dir.as_posix()}/equipes_anonimizadas.parquet')"
    ).df()
    eventos["data_referencia"] = pd.to_datetime(eventos["data_referencia"])
    visitas["registrados_em"] = pd.to_datetime(visitas["registrados_em"])
    return pacientes, eventos, visitas, equipes


# ---------------------------------------------------------------------------
# Score PRIO-ACS
# ---------------------------------------------------------------------------

def _is_age_0_6(faixa: str) -> bool:
    if not isinstance(faixa, str):
        return False
    return faixa.startswith("0-") or faixa in {"0", "0-1", "0-4", "0-5", "0-6"}


def _is_age_idoso(faixa: str) -> bool:
    if not isinstance(faixa, str):
        return False
    for marker in ("65", "70", "75", "80", "85", "90", "+"):
        if marker in faixa:
            return True
    return False


def _gap_limit_for_row(row: pd.Series) -> int:
    if row["gestacao"]:
        return 30
    if _is_age_0_6(row["faixa_etaria"]):
        return 45
    if row["hipertenso"] or row["diabetico"]:
        return 90
    return 180


def compute_score(
    pacientes: pd.DataFrame,
    eventos: pd.DataFrame,
    visitas: pd.DataFrame,
    ref_date: date,
) -> pd.DataFrame:
    """Adiciona colunas: score_icsap, score_life_stage, score_care_gap, score_social,
    score, tier, cadencia_oficial, linha_de_cuidado, ultima_visita, dias_gap,
    gap_limite, gap_vencido, evento_recente_60d."""
    df = pacientes.copy()

    # 1) ICSAP proxy (cap 35)
    icsap = (
        df["hipertenso"].astype(int) * 15
        + df["diabetico"].astype(int) * 15
        + df["gestacao"].astype(int) * 15
    )
    df["score_icsap"] = icsap.clip(upper=35)

    # 2) Vulnerable life-stage (pega o maior, nao soma)
    age_0_6 = df["faixa_etaria"].apply(_is_age_0_6)
    age_idoso = df["faixa_etaria"].apply(_is_age_idoso)
    chronic = df["hipertenso"] | df["diabetico"]
    life = pd.Series(0, index=df.index, dtype=int)
    life = life.where(~df["gestacao"], 25)
    mask_0_6 = age_0_6 & (life < 20)
    life = life.where(~mask_0_6, 20)
    mask_idoso = age_idoso & chronic & (life < 15)
    life = life.where(~mask_idoso, 15)
    df["score_life_stage"] = life

    # 3) Care gap / urgency (max 25)
    cutoff_60 = pd.Timestamp(ref_date - timedelta(days=60))
    eventos_naoeletivos = eventos[eventos["tipo"] != "agendamento"]
    eventos_recentes = eventos_naoeletivos[eventos_naoeletivos["data_referencia"] >= cutoff_60]
    pacientes_com_evento = set(eventos_recentes["paciente_id"].unique())
    df["evento_recente_60d"] = df["paciente_id"].isin(pacientes_com_evento)

    last_visit = (
        visitas.groupby("paciente_id")["registrados_em"]
        .max()
        .reset_index()
        .rename(columns={"registrados_em": "ultima_visita"})
    )
    df = df.merge(last_visit, on="paciente_id", how="left")
    df["dias_gap"] = (pd.Timestamp(ref_date) - df["ultima_visita"]).dt.days
    df["dias_gap"] = df["dias_gap"].fillna(9999).astype(int)
    df["gap_limite"] = df.apply(_gap_limit_for_row, axis=1)
    df["gap_vencido"] = df["dias_gap"] > df["gap_limite"]

    care_gap = (
        df["evento_recente_60d"].astype(int) * 15
        + df["gap_vencido"].astype(int) * 10
    )
    df["score_care_gap"] = care_gap.clip(upper=25)

    # 4) Social vulnerability (max 15)
    df["score_social"] = df["situacao_vulnerabilidade"].astype(int) * 15

    # Total
    df["score"] = (
        df["score_icsap"]
        + df["score_life_stage"]
        + df["score_care_gap"]
        + df["score_social"]
    )

    # Tier (Escala de Risco Familiar oficial SIAB/SISAB)
    def _tier(s: int) -> str:
        if s >= 61:
            return "alto"
        if s >= 31:
            return "medio"
        return "habitual"

    df["tier"] = df["score"].apply(_tier)

    cad = {"alto": "Semanal", "medio": "Quinzenal a mensal", "habitual": "Mensal"}
    df["cadencia_oficial"] = df["tier"].map(cad)

    # Linha de cuidado primaria (qual Ficha aplica)
    def _linha(row: pd.Series) -> str:
        if row["gestacao"]:
            return "ficha_b_gestante"
        if _is_age_0_6(row["faixa_etaria"]):
            return "ficha_c_primeira_infancia"
        if row["hipertenso"] or row["diabetico"]:
            return "ficha_b_cronico"
        return "ficha_a_cadastro_familia"

    df["linha_de_cuidado"] = df.apply(_linha, axis=1)

    return df


# ---------------------------------------------------------------------------
# Demo profissional picker
# ---------------------------------------------------------------------------

def find_profissional_default(visitas: pd.DataFrame, pacientes: pd.DataFrame) -> tuple[str, str]:
    """Escolhe um profissional cuja microarea tem variedade clinica (gestante + cronicos)."""
    counts = visitas.groupby("profissional_id").size().sort_values(ascending=False)
    for prof_id in counts.head(50).index:
        their_patients_ids = visitas.loc[visitas["profissional_id"] == prof_id, "paciente_id"].unique()
        their_patients = pacientes[pacientes["paciente_id"].isin(their_patients_ids)]
        if len(their_patients) < 30:
            continue
        equipe_mode = their_patients["equipe_id"].mode()
        if equipe_mode.empty:
            continue
        equipe_id = equipe_mode.iloc[0]
        territory = pacientes[pacientes["equipe_id"] == equipe_id]
        has_gest = territory["gestacao"].sum() >= 1
        has_cronicos = ((territory["hipertenso"]) | (territory["diabetico"])).sum() >= 5
        if has_gest and has_cronicos:
            return prof_id, equipe_id

    # fallback: o mais ativo + sua equipe mais frequente
    prof_id = counts.index[0]
    their_patients_ids = visitas.loc[visitas["profissional_id"] == prof_id, "paciente_id"].unique()
    their_patients = pacientes[pacientes["paciente_id"].isin(their_patients_ids)]
    equipe_id = their_patients["equipe_id"].mode().iloc[0] if not their_patients["equipe_id"].mode().empty else pacientes["equipe_id"].iloc[0]
    return prof_id, equipe_id


# ---------------------------------------------------------------------------
# Per-patient enrichment (motivo, bundle, script) -- templated for MVP
# ---------------------------------------------------------------------------

def _build_motivo_curto(row: pd.Series, dias_ultimo_evento: int | None) -> str:
    parts: list[str] = []
    if row["gestacao"]:
        descritor = "Gestante"
        adendos: list[str] = []
        if row["diabetico"]:
            adendos.append("diabetica")
        if row["hipertenso"]:
            adendos.append("hipertensa")
        if adendos:
            descritor += " " + " e ".join(adendos)
        parts.append(descritor)
    elif row["diabetico"] and row["hipertenso"]:
        parts.append("Diabetico e hipertenso")
    elif row["diabetico"]:
        parts.append("Diabetico")
    elif row["hipertenso"]:
        parts.append("Hipertenso")
    elif _is_age_0_6(row["faixa_etaria"]):
        parts.append(f"Crianca {row['faixa_etaria']} anos")
    elif _is_age_idoso(row["faixa_etaria"]):
        parts.append(f"Idoso {row['faixa_etaria']}")
    else:
        parts.append(f"Paciente {row['faixa_etaria']}")

    if dias_ultimo_evento is not None and dias_ultimo_evento <= 30:
        parts.append(f"foi a urgencia ha {dias_ultimo_evento} dias")
    elif row["dias_gap"] >= 9999:
        parts.append("nunca visitado em 2025")
    elif row["gap_vencido"]:
        parts.append(f"sem visita ha {int(row['dias_gap'])} dias")

    if row["situacao_vulnerabilidade"]:
        parts.append("vulnerabilidade social")

    return ", ".join(parts) + "."


_BUNDLES = {
    "ficha_b_gestante": [
        "Aferir pressao arterial (alto risco se >=140/90)",
        "Perguntar sobre sangramento e movimentos do bebe",
        "Confirmar exames solicitados na ultima consulta",
        "Reforcar proxima consulta pre-natal agendada",
    ],
    "ficha_b_cronico": [
        "Aferir pressao arterial",
        "Verificar adesao a medicacao",
        "Perguntar sintomas (tontura, dor de cabeca, dor no peito)",
        "Reforcar proxima consulta na unidade",
    ],
    "ficha_c_primeira_infancia": [
        "Verificar caderneta de vacinacao",
        "Pesar e medir a crianca (curva de crescimento)",
        "Perguntar sobre alimentacao e amamentacao",
        "Orientar sobre proxima puericultura",
    ],
    "ficha_a_cadastro_familia": [
        "Atualizar cadastro da familia",
        "Identificar membros faltantes",
        "Avaliar condicoes de moradia e saneamento",
        "Mapear demandas de saude da familia",
    ],
}


def _build_script_abordagem(nome: str, linha: str, dias_ultimo_evento: int | None) -> str:
    if dias_ultimo_evento is not None and dias_ultimo_evento <= 30:
        return f"Oi {nome}, soube que voce passou na UPA. Vim ver como esta a recuperacao."
    if linha == "ficha_b_gestante":
        return f"Oi {nome}, vim ver como voce e o bebe estao."
    if linha == "ficha_c_primeira_infancia":
        return f"Oi, vim ver como esta a crianca e o desenvolvimento dela."
    return f"Oi {nome}, vim fazer a visita de acompanhamento. Tudo bem hoje?"


# ---------------------------------------------------------------------------
# Output builders
# ---------------------------------------------------------------------------

def _last_event_for_patient(eventos: pd.DataFrame, paciente_id: str) -> dict | None:
    events = eventos[eventos["paciente_id"] == paciente_id]
    if events.empty:
        return None
    last = events.loc[events["data_referencia"].idxmax()]
    return {"tipo": str(last["tipo"]), "data": last["data_referencia"].date().isoformat()}


def gerar_lista_do_dia(
    profissional_id: str,
    equipe_id: str,
    ref_date: date,
    pacientes_scored: pd.DataFrame,
    eventos: pd.DataFrame,
    top_n: int = TOP_N_DEFAULT,
) -> dict:
    territory = pacientes_scored[pacientes_scored["equipe_id"] == equipe_id]
    top = territory.sort_values("score", ascending=False).head(top_n)

    out_patients: list[dict] = []
    for _, row in top.iterrows():
        pid = row["paciente_id"]
        last_event = _last_event_for_patient(eventos, pid)
        dias_evento: int | None = None
        if last_event is not None:
            ev_date = date.fromisoformat(last_event["data"])
            dias_evento = max((ref_date - ev_date).days, 0)

        nome_display = f"Paciente {pid[-5:]}"
        motivo = _build_motivo_curto(row, dias_evento)
        out_patients.append({
            "paciente_id": pid,
            "nome_display": nome_display,
            "score": int(row["score"]),
            "tier": row["tier"],
            "cadencia_oficial": row["cadencia_oficial"],
            "motivo_curto": motivo,
            "motivo_componentes": {
                "icsap": int(row["score_icsap"]),
                "life_stage": int(row["score_life_stage"]),
                "care_gap": int(row["score_care_gap"]),
                "social": int(row["score_social"]),
            },
            "linha_de_cuidado": row["linha_de_cuidado"],
            "ultima_visita": row["ultima_visita"].date().isoformat() if pd.notna(row["ultima_visita"]) else None,
            "ultimo_evento": last_event,
            "flags": {
                "hipertenso": bool(row["hipertenso"]),
                "diabetico": bool(row["diabetico"]),
                "gestacao": bool(row["gestacao"]),
                "vulnerabilidade": bool(row["situacao_vulnerabilidade"]),
            },
            "endereco_lat": float(row["endereco_latitude"]) if pd.notna(row["endereco_latitude"]) else None,
            "endereco_lon": float(row["endereco_longitude"]) if pd.notna(row["endereco_longitude"]) else None,
            "bundle_acao": _BUNDLES.get(row["linha_de_cuidado"], _BUNDLES["ficha_a_cadastro_familia"]),
            "script_abordagem": _build_script_abordagem(nome_display, row["linha_de_cuidado"], dias_evento),
        })

    return {
        "profissional_id": profissional_id,
        "equipe_id": equipe_id,
        "data": ref_date.isoformat(),
        "pacientes": out_patients,
    }


def gerar_dashboard_supervisor(
    equipe_id: str,
    ref_date: date,
    pacientes_scored: pd.DataFrame,
    all_equipes_scored: pd.DataFrame | None = None,
) -> dict:
    territory = pacientes_scored[pacientes_scored["equipe_id"] == equipe_id]
    if territory.empty:
        return {"equipe_id": equipe_id, "data": ref_date.isoformat(), "cobertura_por_linha": [], "alertas_criticos": []}

    def _coverage(mask: pd.Series, label: str) -> dict | None:
        subset = territory[mask]
        alvo = len(subset)
        if alvo == 0:
            return None
        em_dia = int((~subset["gap_vencido"]).sum())
        atrasados = int(subset["gap_vencido"].sum())
        return {
            "linha": label,
            "alvo": int(alvo),
            "em_dia": em_dia,
            "atrasados": atrasados,
            "pct": round(em_dia / alvo * 100, 1),
        }

    cobertura: list[dict] = []
    for mask, label in [
        (territory["gestacao"], "gestantes"),
        (territory["faixa_etaria"].apply(_is_age_0_6), "criancas_0_6"),
        (territory["hipertenso"], "hipertensos"),
        (territory["diabetico"], "diabeticos"),
    ]:
        cov = _coverage(mask, label)
        if cov is not None:
            cobertura.append(cov)

    nunca = int((territory["dias_gap"] >= 9999).sum())
    pct_nunca = round(nunca / len(territory) * 100, 1)

    # Ranking simples por % em dia em hipertensos (proxy para qualidade)
    ranking = None
    total_equipes = None
    if all_equipes_scored is not None:
        per_equipe = (
            all_equipes_scored[all_equipes_scored["hipertenso"]]
            .groupby("equipe_id")
            .agg(em_dia=("gap_vencido", lambda x: (~x).sum()), alvo=("gap_vencido", "count"))
            .reset_index()
        )
        per_equipe["pct"] = per_equipe["em_dia"] / per_equipe["alvo"]
        per_equipe = per_equipe.sort_values("pct", ascending=False).reset_index(drop=True)
        per_equipe["rank"] = per_equipe.index + 1
        total_equipes = len(per_equipe)
        match = per_equipe[per_equipe["equipe_id"] == equipe_id]
        if not match.empty:
            ranking = int(match["rank"].iloc[0])

    # Alertas: gestantes alto-risco com gap vencido ou evento recente
    gestantes_criticas = territory[
        (territory["gestacao"])
        & ((territory["gap_vencido"]) | (territory["evento_recente_60d"]))
    ].sort_values("score", ascending=False).head(5)
    alertas: list[dict] = []
    for _, r in gestantes_criticas.iterrows():
        alertas.append({
            "tipo": "gestante_alto_risco_alerta",
            "paciente_id": r["paciente_id"],
            "dias_sem_visita": int(r["dias_gap"]) if r["dias_gap"] < 9999 else None,
            "evento_recente_60d": bool(r["evento_recente_60d"]),
        })

    return {
        "equipe_id": equipe_id,
        "data": ref_date.isoformat(),
        "cobertura_por_linha": cobertura,
        "indicadores_previne": {
            "ranking_equipe_em_hipertensos": ranking,
            "total_equipes_amostra": total_equipes,
            "indicadores_total_2026": 15,
            "indicadores_batidos_demo": None,
        },
        "pacientes_nunca_visitados_pct": pct_nunca,
        "alertas_criticos": alertas,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Gera lista_do_dia.json e dashboard_supervisor.json a partir dos 4 Parquets reais.")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument("--data", type=str, default="2025-12-31", help="Data de referencia YYYY-MM-DD (fim da janela do dataset por padrao)")
    parser.add_argument("--profissional", type=str, default=None)
    parser.add_argument("--equipe", type=str, default=None)
    parser.add_argument("--top-n", type=int, default=TOP_N_DEFAULT)
    parser.add_argument("--demo", action="store_true", help="Escolhe automaticamente um profissional com variedade clinica")
    args = parser.parse_args()

    ref_date = datetime.strptime(args.data, "%Y-%m-%d").date()

    print(f"Carregando 4 Parquets de {args.data_dir}/ ...")
    pacientes, eventos, visitas, equipes = load_tables(args.data_dir)
    print(f"  pacientes: {len(pacientes):>7,}")
    print(f"  eventos:   {len(eventos):>7,}")
    print(f"  visitas:   {len(visitas):>7,}")
    print(f"  equipes:   {len(equipes):>7,}")

    print(f"\nComputando PRIO-ACS para ref_date={ref_date} ...")
    scored = compute_score(pacientes, eventos, visitas, ref_date)
    dist = scored["tier"].value_counts().reindex(["alto", "medio", "habitual"]).fillna(0).astype(int)
    print("  Distribuicao de tier:")
    for tier_name in ["alto", "medio", "habitual"]:
        print(f"    {tier_name:>9}: {dist[tier_name]:>6,} ({dist[tier_name]/len(scored)*100:5.1f}%)")

    if args.demo or not args.profissional:
        print("\nSelecionando profissional automatico (variedade clinica) ...")
        prof_id, equipe_id = find_profissional_default(visitas, scored)
    else:
        prof_id = args.profissional
        if args.equipe:
            equipe_id = args.equipe
        else:
            their_patient_ids = visitas.loc[visitas["profissional_id"] == prof_id, "paciente_id"].unique()
            equipe_id = scored.loc[scored["paciente_id"].isin(their_patient_ids), "equipe_id"].mode().iloc[0]
    print(f"  profissional: {prof_id}")
    print(f"  equipe:       {equipe_id}")
    territory_size = (scored["equipe_id"] == equipe_id).sum()
    print(f"  pacientes na microarea: {territory_size}")

    args.out_dir.mkdir(parents=True, exist_ok=True)

    print(f"\nGerando lista_do_dia.json (top {args.top_n}) ...")
    lista = gerar_lista_do_dia(prof_id, equipe_id, ref_date, scored, eventos, args.top_n)
    out_lista = args.out_dir / "lista_do_dia.json"
    out_lista.write_text(json.dumps(lista, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  -> {out_lista}  ({len(lista['pacientes'])} pacientes)")

    print(f"\nGerando dashboard_supervisor.json ...")
    dash = gerar_dashboard_supervisor(equipe_id, ref_date, scored, all_equipes_scored=scored)
    out_dash = args.out_dir / "dashboard_supervisor.json"
    out_dash.write_text(json.dumps(dash, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  -> {out_dash}")

    print("\nPronto.")


if __name__ == "__main__":
    main()
