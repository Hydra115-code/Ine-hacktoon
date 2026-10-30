#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
umask 077

copy_template() {
  local template="$1"
  local destination="$2"

  if [[ -e "$destination" ]]; then
    printf 'Conservado: %s ya existe.\n' "${destination#"$repository_root"/}"
    return
  fi

  cp "$template" "$destination"
  chmod 600 "$destination"
  printf 'Creado: %s\n' "${destination#"$repository_root"/}"
}

copy_template "$repository_root/back-end/.env.example" "$repository_root/back-end/.env"
copy_template "$repository_root/front-end/.env.example" "$repository_root/front-end/.env.local"

for environment_file in back-end/.env front-end/.env.local; do
  if ! git -C "$repository_root" check-ignore --quiet "$environment_file"; then
    printf 'ERROR: Git no está ignorando %s.\n' "$environment_file" >&2
    exit 1
  fi
done

cat <<'MESSAGE'

Completa los valores locales antes de iniciar los servicios.
- AGENT_API_TOKEN debe ser el mismo en backend y frontend.
- GEMINI_API_KEY pertenece únicamente a back-end/.env.
- No modifiques las plantillas .env.example con valores reales.
MESSAGE
