#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

failure=0

while IFS= read -r tracked_file; do
  case "$tracked_file" in
    */.env.example|*/.env.*.example) ;;
    */.env|*/.env.*|.env|.env.*)
      printf 'ERROR: archivo de entorno rastreado: %s\n' "$tracked_file" >&2
      failure=1
      ;;
  esac
done < <(git ls-files)

while IFS= read -r tracked_file; do
  [[ -z "$tracked_file" ]] && continue
  printf 'ERROR: artefacto local rastreado: %s\n' "$tracked_file" >&2
  failure=1
done < <(git ls-files | grep -E '(^|/)(node_modules|\.next|dist|coverage|\.local)(/|$)|\.(sqlite|sqlite-shm|sqlite-wal|db)$' || true)

secret_pattern='AIza[0-9A-Za-z_-]{30,}|github_pat_[0-9A-Za-z_]{20,}|gh[pousr]_[0-9A-Za-z]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}'
while IFS= read -r tracked_file; do
  [[ -z "$tracked_file" ]] && continue
  printf 'ERROR: posible secreto en archivo rastreado: %s\n' "$tracked_file" >&2
  failure=1
done < <(git grep -I -l -E "$secret_pattern" -- . || true)

if [[ "$failure" -ne 0 ]]; then
  exit 1
fi

printf 'Seguridad del repositorio: OK\n'
