#!/usr/bin/env bash
# Wrapper de compatibilidad. Preferir: ./deploy.sh o deploy.ps1
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DEPLOY_TARGET="${DEPLOY_TARGET:-preprod}"
exec "${ROOT_DIR}/deploy.sh" "$@"
