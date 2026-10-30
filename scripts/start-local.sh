#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backend_pid=""
frontend_pid=""

cleanup() {
  trap - EXIT INT TERM HUP
  for process_id in "$frontend_pid" "$backend_pid"; do
    if [[ -n "$process_id" ]] && kill -0 "$process_id" 2>/dev/null; then
      kill "$process_id" 2>/dev/null || true
    fi
  done
  for process_id in "$frontend_pid" "$backend_pid"; do
    if [[ -n "$process_id" ]]; then
      wait "$process_id" 2>/dev/null || true
    fi
  done
}

trap cleanup EXIT INT TERM HUP

for required_path in \
  "$repository_root/back-end/.env" \
  "$repository_root/front-end/.env.local" \
  "$repository_root/back-end/node_modules" \
  "$repository_root/front-end/node_modules" \
  "$repository_root/data-release/Ine-hacktoon-DATA-06"; do
  if [[ ! -e "$required_path" ]]; then
    printf 'ERROR: la instalación local está incompleta. Ejecuta primero:\n' >&2
    printf '  ./scripts/setup-local.sh\n' >&2
    exit 1
  fi
done

node "$repository_root/scripts/check-local-config.mjs"

printf 'Iniciando backend...\n'
(cd "$repository_root/back-end" && exec corepack pnpm api) &
backend_pid=$!

printf 'Iniciando frontend...\n'
(cd "$repository_root/front-end" && exec corepack pnpm dev) &
frontend_pid=$!

if ! node "$repository_root/scripts/wait-for-local-services.mjs"; then
  exit 1
fi

cat <<'MESSAGE'

INE Explora con Paper está listo:
  http://127.0.0.1:3000

Presiona Ctrl+C para cerrar frontend y backend.
MESSAGE

while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$frontend_pid" 2>/dev/null; do
  sleep 1
done

set +e
if ! kill -0 "$backend_pid" 2>/dev/null; then
  wait "$backend_pid"
  exit_code=$?
else
  wait "$frontend_pid"
  exit_code=$?
fi
set -e
exit "$exit_code"
