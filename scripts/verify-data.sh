#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
data_release="$repository_root/data-release/Ine-hacktoon-DATA-06"
pnpm_command=(corepack pnpm@10.34.5)

"$repository_root/scripts/prepare-data-release.sh"

run_data_script() {
  (cd "$data_release" && "${pnpm_command[@]}" run "$@")
}

run_data_script ccpc:verify-delivery
run_data_script typecheck
(cd "$data_release" && "${pnpm_command[@]}" test)
run_data_script ccpc:validate --input data/ccpc/sample/data02/participation.json
run_data_script ccpc:full:verify
run_data_script ccpc:full:audit
run_data_script ccpc:catalog:verify
run_data_script ccpc:catalog:audit
run_data_script ccpc:release:verify
run_data_script ccpc:release:audit
run_data_script ccpc:privacy:audit

printf 'Verificación del release de datos: OK\n'
