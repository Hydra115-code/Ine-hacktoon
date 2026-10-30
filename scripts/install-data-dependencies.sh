#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
data_release="$repository_root/data-release/Ine-hacktoon-DATA-06"

"$repository_root/scripts/prepare-data-release.sh"

if [[ ! -f "$data_release/pnpm-lock.yaml" ]]; then
  (cd "$data_release" && corepack pnpm@10.34.5 import)
fi

(cd "$data_release" && corepack pnpm@10.34.5 install --frozen-lockfile --ignore-scripts --node-linker=hoisted --force)

printf 'Dependencias del release de datos instaladas con pnpm.\n'
