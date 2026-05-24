"""
Carrega os parquets anonimizados (data/raw/) no Supabase Postgres e cria a
tabela `visitas_capturadas` para receber os forms preenchidos pelo ACS em
campo.

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


SCHEMA = """
DROP TABLE IF EXISTS visitas_capturadas CASCADE;
DROP TABLE IF EXISTS visitas CASCADE;
DROP TABLE IF EXISTS eventos CASCADE;
DROP TABLE IF EXISTS pacientes CASCADE;
DROP TABLE IF EXISTS equipes CASCADE;

CREATE TABLE equipes (
    equipe_id          TEXT PRIMARY KEY,
    endereco_latitude  DOUBLE PRECISION NOT NULL,
    endereco_longitude DOUBLE PRECISION NOT NULL
);

CREATE TABLE pacientes (
    paciente_id              TEXT PRIMARY KEY,
    equipe_id                TEXT NOT NULL REFERENCES equipes(equipe_id),
    unidade_id               TEXT NOT NULL,
    faixa_etaria             TEXT NOT NULL,
    sexo                     TEXT NOT NULL,
    raca_cor                 TEXT,
    situacao_vulnerabilidade BOOLEAN NOT NULL,
    endereco_longitude       DOUBLE PRECISION NOT NULL,
    endereco_latitude        DOUBLE PRECISION NOT NULL,
    hipertenso               BOOLEAN NOT NULL,
    diabetico                BOOLEAN NOT NULL,
    gestacao                 BOOLEAN NOT NULL
);
CREATE INDEX pacientes_equipe_idx   ON pacientes (equipe_id);
CREATE INDEX pacientes_unidade_idx  ON pacientes (unidade_id);

CREATE TABLE eventos (
    id              BIGSERIAL PRIMARY KEY,
    paciente_id     TEXT NOT NULL REFERENCES pacientes(paciente_id),
    tipo            TEXT NOT NULL,
    data_referencia DATE NOT NULL
);
CREATE INDEX eventos_paciente_data_idx ON eventos (paciente_id, data_referencia DESC);
CREATE INDEX eventos_tipo_idx          ON eventos (tipo);

CREATE TABLE visitas (
    id               BIGSERIAL PRIMARY KEY,
    profissional_id  TEXT NOT NULL,
    registrados_em   DATE NOT NULL,
    ordem_visita_dia INTEGER,
    paciente_id      TEXT NOT NULL REFERENCES pacientes(paciente_id)
);
CREATE INDEX visitas_paciente_data_idx   ON visitas (paciente_id, registrados_em DESC);
CREATE INDEX visitas_profissional_idx    ON visitas (profissional_id, registrados_em DESC);

-- Forms preenchidos em campo pelo ACS. payload é JSONB porque varia por perfil.
CREATE TABLE visitas_capturadas (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id            TEXT NOT NULL REFERENCES pacientes(paciente_id),
    profissional_id        TEXT NOT NULL,
    capturado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
    perfil_blocos          TEXT[] NOT NULL,
    payload                JSONB NOT NULL,
    sincronizado_vitacare  BOOLEAN NOT NULL DEFAULT FALSE,
    sincronizado_em        TIMESTAMPTZ
);
CREATE INDEX visitas_capturadas_paciente_idx     ON visitas_capturadas (paciente_id, capturado_em DESC);
CREATE INDEX visitas_capturadas_profissional_idx ON visitas_capturadas (profissional_id, capturado_em DESC);
"""


COPY_PLAN = [
    ("equipes", "equipes_anonimizadas.parquet",
     "SELECT equipe_id, endereco_latitude, endereco_longitude FROM read_parquet('{p}')"),
    ("pacientes", "pacientes_anonimizados.parquet",
     """SELECT paciente_id, equipe_id, unidade_id, faixa_etaria, sexo, raca_cor,
               situacao_vulnerabilidade, endereco_longitude, endereco_latitude,
               hipertenso, diabetico, gestacao
        FROM read_parquet('{p}')"""),
    ("eventos(paciente_id, tipo, data_referencia)", "eventos_clinicos_anonimizados.parquet",
     """SELECT paciente_id, tipo, CAST(data_referencia AS DATE) AS data_referencia
        FROM read_parquet('{p}')"""),
    ("visitas(profissional_id, registrados_em, ordem_visita_dia, paciente_id)",
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
        with conn.cursor() as cur:
            # pooler default statement_timeout pode matar COPYs grandes
            cur.execute("SET statement_timeout = 0")
            print("→ aplicando schema")
            cur.execute(SCHEMA)
        conn.commit()

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
            for table in ["equipes", "pacientes", "eventos", "visitas", "visitas_capturadas"]:
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                n = cur.fetchone()[0]
                print(f"  {table:<22} {n:>10,}")

    print("\nOK. Schema pronto e dados carregados.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
