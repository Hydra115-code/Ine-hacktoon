#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
run_full_verification=false

case "${1:-}" in
  "") ;;
  --verify) run_full_verification=true ;;
  *)
    printf 'Uso: %s [--verify]\n' "$0" >&2
    exit 2
    ;;
esac

for command_name in node corepack git unzip; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'ERROR: falta el comando requerido: %s\n' "$command_name" >&2
    exit 1
  fi
done

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (!((major === 22 && minor >= 18) || (major === 23 && minor >= 6) || major >= 24)) { console.error("ERROR: se requiere Node.js 22.18+, 23.6+ o 24+."); process.exit(1); }'

printf '\n[1/4] Preparando los datos oficiales...\n'
"$repository_root/scripts/install-data-dependencies.sh"

printf '\n[2/4] Instalando el backend con pnpm...\n'
(cd "$repository_root/back-end" && corepack pnpm install --frozen-lockfile)

printf '\n[3/4] Instalando el frontend con pnpm...\n'
(cd "$repository_root/front-end" && corepack pnpm install --frozen-lockfile)

printf '\n[4/4] Creando y validando la configuración privada...\n'
"$repository_root/scripts/init-local-env.sh"
node "$repository_root/scripts/check-local-config.mjs"
"$repository_root/scripts/check-repository-safety.sh"

if [[ "$run_full_verification" == true ]]; then
  printf '\nEjecutando la verificación integral...\n'
  "$repository_root/scripts/verify-all.sh"
fi

cat <<'MESSAGE'

Instalación local terminada.

Para iniciar el producto completo:
  ./scripts/start-local.sh

Después abre:
  http://127.0.0.1:3000
MESSAGE
