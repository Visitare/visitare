#!/usr/bin/env bash
# ============================================================================
# Sincroniza artefatos do workspace impact-lab → repo final acs-digital.
# ----------------------------------------------------------------------------
# Estratégia: rsync limpo dos diretórios que compõem a aplicação completa.
# NUNCA toca em arquivos que só existem no acs-digital (README, PRD,
# ARCHITECTURE, .git, .gitignore — esses são editados manualmente).
#
# Uso:
#   bash scripts/sync_to_acs_digital.sh [--commit]
#
# --commit cria um commit "chore: sync from impact-lab" no acs-digital
#          (e push, se houver remote). Sem a flag, só sincroniza e mostra
#          o git status.
# ============================================================================

set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DST="$(cd "$SRC/../acs-digital" && pwd)"

if [[ ! -d "$DST/.git" ]]; then
    echo "ERRO: $DST não é um repo git." >&2
    exit 1
fi

echo "→ source:  $SRC"
echo "→ target:  $DST"
echo

# Diretórios sincronizados completamente (com --delete para refletir remoções)
SYNC_DIRS=(
    "frontend"
    "scripts"
    "db"
    "FICHAS"
    "manuais"
    "data"
)

# Arquivos individuais (sem --delete, idempotente)
SYNC_FILES=(
    "docs/SUPABASE.md"
    "MASTER_CONTEXT.md"
    "BUILD_THIS.md"
    "requirements.txt"
)

# Excluir do rsync (cache, deps, lixo)
EXCLUDE=(
    "--exclude=node_modules"
    "--exclude=__pycache__"
    "--exclude=__marimo__"
    "--exclude=.venv"
    "--exclude=.next"
    "--exclude=.vercel"
    "--exclude=.DS_Store"
    "--exclude=*.pyc"
    "--exclude=.pytest_cache"
    "--exclude=dist"
    "--exclude=coverage"
)

for d in "${SYNC_DIRS[@]}"; do
    if [[ -d "$SRC/$d" ]]; then
        echo "→ sync dir:  $d/"
        mkdir -p "$DST/$d"
        rsync -a --delete "${EXCLUDE[@]}" "$SRC/$d/" "$DST/$d/"
    fi
done

for f in "${SYNC_FILES[@]}"; do
    if [[ -f "$SRC/$f" ]]; then
        echo "→ sync file: $f"
        mkdir -p "$DST/$(dirname "$f")"
        rsync -a "$SRC/$f" "$DST/$f"
    fi
done

echo
echo "→ git status em $DST:"
echo
( cd "$DST" && git status --short )

if [[ "${1:-}" == "--commit" ]]; then
    echo
    echo "→ commitando e empurrando..."
    cd "$DST"
    git add frontend scripts db FICHAS manuais data docs MASTER_CONTEXT.md BUILD_THIS.md requirements.txt 2>/dev/null || true
    if git diff --cached --quiet; then
        echo "  nada a commitar."
    else
        STAMP=$(date "+%Y-%m-%d %H:%M")
        git commit -m "chore: sync from impact-lab — $STAMP"
        git push
        echo "  ✓ pushed"
    fi
fi

echo
echo "Pronto."
