"""
Carrega os parquets anonimizados (data/raw/) no Supabase Postgres.

Pressupõe que o schema já existe — aplicado via Supabase CLI
(`supabase db push` / `supabase db reset`, ver supabase/migrations/ e
VISI-11). Este script SÓ carrega dados; não cria nem derruba tabela nenhuma.

Uso:
    pip install 'psycopg[binary]' duckdb pandas
    export SUPABASE_DB_URL='postgresql://postgres.<ref>:<senha>@aws-...pooler.supabase.com:5432/postgres'
    python scripts/setup_supabase.py
"""
from __future__ import annotations

import io
import os
import sys
from pathlib import Path

import duckdb
import psycopg


COPY_PLAN = [
    ("teams", "equipes_anonimizadas.parquet",
     "SELECT equipe_id, endereco_latitude, endereco_longitude FROM read_parquet('{p}')"),
    ("patients", "pacientes_anonimizados.parquet",
     """SELECT paciente_id, equipe_id, unidade_id, faixa_etaria, sexo, raca_cor,
               situacao_vulnerabilidade, endereco_longitude, endereco_latitude,
               hipertenso, diabetico, gestacao
        FROM read_parquet('{p}')"""),
    ("events(patient_id, type, reference_date)", "eventos_clinicos_anonimizados.parquet",
     """SELECT paciente_id, tipo, CAST(data_referencia AS DATE) AS data_referencia
        FROM read_parquet('{p}')"""),
    ("visits(professional_id, recorded_at, daily_visit_order, patient_id)",
     "visitas_anonimizadas.parquet",
     """SELECT profissional_id, CAST(registrados_em AS DATE) AS registrados_em,
               ordem_visita_dia, paciente_id
        FROM read_parquet('{p}')"""),
]


def main() -> int:
    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        print("ERRO: defina SUPABASE_DB_URL no ambiente.", file=sys.stderr)
        return 1

    dados_dir = Path(__file__).resolve().parent.parent / "data" / "raw"
    if not dados_dir.is_dir():
        print(f"ERRO: pasta data/raw/ não encontrada em {dados_dir}", file=sys.stderr)
        return 1

    duck = duckdb.connect()

    CHUNK = 5_000

    with psycopg.connect(db_url, autocommit=False) as conn:
        for target, parquet_name, query in COPY_PLAN:
            table_only = target.split("(")[0].strip()
            parquet_path = dados_dir / parquet_name

            df = duck.execute(query.format(p=parquet_path)).fetchdf()
            total = len(df)
            print(f"→ {table_only:<10} ← {parquet_name} ({total:,} linhas)")

            for start in range(0, total, CHUNK):
                end = min(start + CHUNK, total)
                buf = io.StringIO()
                df.iloc[start:end].to_csv(buf, index=False, header=False, na_rep="")
                buf.seek(0)
                with conn.cursor() as cur:
                    cur.execute("SET statement_timeout = 0")
                    copy_sql = f"COPY {target} FROM STDIN WITH (FORMAT CSV, NULL '')"
                    with cur.copy(copy_sql) as copy:
                        copy.write(buf.read())
                conn.commit()
                print(f"    {end:>7,} / {total:,}")

        print("\n→ contagens finais")
        with conn.cursor() as cur:
            for table in ["teams", "patients", "events", "visits", "captured_visits"]:
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                n = cur.fetchone()[0]
                print(f"  {table:<22} {n:>10,}")

    print("\nOK. Dados carregados.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
