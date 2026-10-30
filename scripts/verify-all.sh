#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
data_release="$repository_root/data-release/Ine-hacktoon-DATA-06"
install_dependencies=false

case "${1:-}" in
  "") ;;
  --install) install_dependencies=true ;;
  *)
    printf 'Uso: %s [--install]\n' "$0" >&2
    exit 2
    ;;
esac

for command_name in node npm corepack; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'ERROR: falta el comando requerido: %s\n' "$command_name" >&2
    exit 1
  fi
done

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (!((major === 22 && minor >= 18) || (major === 23 && minor >= 6) || major >= 24)) { console.error("ERROR: se requiere Node.js 22.18+, 23.6+ o 24+."); process.exit(1); }'

"$repository_root/scripts/check-repository-safety.sh"
"$repository_root/scripts/prepare-data-release.sh"

if [[ "$install_dependencies" == true ]]; then
  (cd "$data_release" && npm ci --ignore-scripts)
  (cd "$repository_root/back-end" && corepack pnpm install --frozen-lockfile)
  (cd "$repository_root/front-end" && corepack pnpm install --frozen-lockfile)
fi

(cd "$data_release" && npm run ccpc:verify-delivery && npm run ccpc:check)
(cd "$repository_root/back-end" && corepack pnpm int-08:verify)
(cd "$repository_root/front-end" && corepack pnpm int-08:verify)

printf 'Verificación integral: OK\n'
