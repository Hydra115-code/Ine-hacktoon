#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
data_directory="$repository_root/data"
archive_name="Entrega-final-CCPC-1.0.0.zip"
archive_path="$data_directory/$archive_name"
checksum_path="$data_directory/$archive_name.sha256"
release_root="$repository_root/data-release"
release_module="$release_root/Ine-hacktoon-DATA-06"

if [[ -d "$release_module" ]]; then
  printf 'Release de datos disponible: %s\n' "${release_module#"$repository_root"/}"
  exit 0
fi

for required_file in "$archive_path" "$checksum_path"; do
  if [[ ! -f "$required_file" ]]; then
    printf 'ERROR: falta %s\n' "${required_file#"$repository_root"/}" >&2
    exit 1
  fi
done

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$data_directory" && sha256sum --check "$archive_name.sha256")
elif command -v shasum >/dev/null 2>&1; then
  (cd "$data_directory" && shasum -a 256 --check "$archive_name.sha256")
else
  printf 'ERROR: se requiere sha256sum o shasum para verificar el release.\n' >&2
  exit 1
fi

if ! command -v unzip >/dev/null 2>&1; then
  printf 'ERROR: se requiere unzip para preparar el release.\n' >&2
  exit 1
fi

if [[ -e "$release_root" ]]; then
  printf 'ERROR: %s existe pero no contiene el módulo esperado. Revísalo manualmente.\n' "$release_root" >&2
  exit 1
fi

temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/ine-data-release.XXXXXX")"
trap 'rm -rf "$temporary_directory"' EXIT
unzip -q "$archive_path" -d "$temporary_directory"

extracted_root="$temporary_directory/Entrega-final-CCPC-1.0.0"
if [[ ! -f "$extracted_root/Ine-hacktoon-DATA-06/src/data/dataset-v1.ts" \
   || ! -f "$extracted_root/Ine-hacktoon-DATA-06/data/ccpc/full/participation.compact.json" ]]; then
  printf 'ERROR: el ZIP verificado no contiene el módulo CCPC esperado.\n' >&2
  exit 1
fi

mv "$extracted_root" "$release_root"
printf 'Release de datos preparado: %s\n' "${release_module#"$repository_root"/}"
