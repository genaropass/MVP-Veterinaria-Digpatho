#!/usr/bin/env bash
set -euo pipefail

# Deploy local del frontend a una VM en GCP (SSH directo o IAP).
# Uso:
#   ./deploy.sh                  # usa deploy.local.env
#   DEPLOY_TARGET=prod ./deploy.sh
#   SSH_MODE=iap ./deploy.sh
#
# En Windows: ejecutar deploy.ps1 o Git Bash desde la raiz del repo.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV_FILE="${ROOT_DIR}/deploy.local.env"

if [[ -f "${LOCAL_ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${LOCAL_ENV_FILE}"
fi

# Git for Windows: asegurar ssh/scp en PATH
for git_bin in \
  "/c/Program Files/Git/usr/bin" \
  "/c/Program Files/Git/bin" \
  "/usr/bin"
do
  if [[ -d "${git_bin}" ]]; then
    export PATH="${git_bin}:${PATH}"
  fi
done

DEPLOY_TARGET="${DEPLOY_TARGET:-preprod}"
SSH_MODE="${SSH_MODE:-direct}"

case "${DEPLOY_TARGET}" in
  prod)
    SSH_USER="${SSH_USER:-ubuntu}"
    REMOTE_NEW_DIR="${REMOTE_NEW_DIR:-/opt/digpatho/DigpathoWeb_new}"
    REMOTE_APP_DIR="${REMOTE_APP_DIR:-/opt/digpatho/DigpathoWeb}"
    REMOTE_STAGING_DIR="${REMOTE_STAGING_DIR:-/tmp/digpatho_web_new}"
    APP_NAME="${APP_NAME:-digpatho-web}"
    APP_PORT="${APP_PORT:-3000}"
  ;;
  preprod)
    SSH_USER="${SSH_USER:-agustind}"
    REMOTE_NEW_DIR="${REMOTE_NEW_DIR:-/home/${SSH_USER}/DigpathoWeb_prepro_new}"
    REMOTE_APP_DIR="${REMOTE_APP_DIR:-/home/${SSH_USER}/DigpathoWeb_prepro}"
    REMOTE_STAGING_DIR="${REMOTE_STAGING_DIR:-/tmp/digpatho_front_prepro_new_${SSH_USER}}"
    APP_NAME="${APP_NAME:-digpatho-frontend-prepro}"
    APP_PORT="${APP_PORT:-3100}"
  ;;
  *)
    echo "Error: DEPLOY_TARGET invalido (${DEPLOY_TARGET}). Usar prod o preprod."
    exit 1
  ;;
esac

HOST_FRONTEND="${HOST_FRONTEND:-}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/google_compute_engine}"
GCP_PROJECT="${GCP_PROJECT:-}"
GCP_INSTANCE="${GCP_INSTANCE:-}"
GCP_ZONE="${GCP_ZONE:-}"

HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://localhost:${APP_PORT}}"
HEALTHCHECK_ATTEMPTS="${HEALTHCHECK_ATTEMPTS:-12}"
HEALTHCHECK_SLEEP_SECONDS="${HEALTHCHECK_SLEEP_SECONDS:-5}"
USE_SUDO="${USE_SUDO:-auto}"
APP_OWNER="${APP_OWNER:-}"
DEFAULT_API_URL="${DEFAULT_API_URL:-https://api.digpatho.com/}"
USE_ECOSYSTEM="${USE_ECOSYSTEM:-$([[ "${DEPLOY_TARGET}" == "prod" ]] && echo true || echo false)}"

die() {
  echo "Error: $*" >&2
  exit 1
}

require_file() {
  [[ -f "$1" ]] || die "no existe el archivo $1"
}

preflight() {
  command -v npm >/dev/null 2>&1 || die "npm no esta disponible localmente (solo se usa para validar el repo)."

  if [[ "${SSH_MODE}" == "iap" ]]; then
    command -v gcloud >/dev/null 2>&1 || die "gcloud no esta instalado. Necesario para SSH_MODE=iap."
    [[ -n "${GCP_PROJECT}" ]] || die "falta GCP_PROJECT en deploy.local.env"
    [[ -n "${GCP_INSTANCE}" ]] || die "falta GCP_INSTANCE en deploy.local.env"
    [[ -n "${GCP_ZONE}" ]] || die "falta GCP_ZONE en deploy.local.env"
    gcloud auth print-access-token >/dev/null 2>&1 || die "gcloud no autenticado. Ejecuta: gcloud auth login"
  else
    [[ -n "${HOST_FRONTEND}" ]] || die "falta HOST_FRONTEND en deploy.local.env"
    require_file "${SSH_KEY}"
  fi
}

ssh_cmd() {
  local remote_cmd="$1"
  if [[ "${SSH_MODE}" == "iap" ]]; then
    gcloud compute ssh "${GCP_INSTANCE}" \
      --project="${GCP_PROJECT}" \
      --zone="${GCP_ZONE}" \
      --tunnel-through-iap \
      --strict-host-key-checking=no \
      --ssh-key-file="${SSH_KEY}" \
      --command="${remote_cmd}"
  else
    ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no -o ConnectTimeout=20 "${SSH_USER}@${HOST_FRONTEND}" "${remote_cmd}"
  fi
}

scp_to_remote() {
  local local_path="$1"
  local remote_path="$2"
  if [[ "${SSH_MODE}" == "iap" ]]; then
    gcloud compute scp \
      --project="${GCP_PROJECT}" \
      --zone="${GCP_ZONE}" \
      --tunnel-through-iap \
      --strict-host-key-checking=no \
      --ssh-key-file="${SSH_KEY}" \
      "${local_path}" "${GCP_INSTANCE}:${remote_path}"
  else
    scp -i "${SSH_KEY}" -o StrictHostKeyChecking=no -o ConnectTimeout=20 "${local_path}" "${SSH_USER}@${HOST_FRONTEND}:${remote_path}"
  fi
}

upload_sources() {
  echo "==> Subiendo codigo (${DEPLOY_TARGET}, SSH_MODE=${SSH_MODE})"
  local tmp_tar
  tmp_tar="$(mktemp /tmp/digpatho_deploy_XXXXXX.tar.gz 2>/dev/null || mktemp "${TMP:-/tmp}/digpatho_deploy_XXXXXX.tar.gz")"

  tar --exclude=".git" \
    --exclude=".next" \
    --exclude="node_modules" \
    --exclude=".env" \
    --exclude=".env.local" \
    --exclude=".env.production" \
    --exclude="deploy.local.env" \
    --exclude="*.log" \
    -czf "${tmp_tar}" -C "${ROOT_DIR}" .

  ssh_cmd "rm -rf '${REMOTE_STAGING_DIR}' && mkdir -p '${REMOTE_STAGING_DIR}'"
  scp_to_remote "${tmp_tar}" "/tmp/digpatho_deploy.tar.gz"
  ssh_cmd "tar -xzf /tmp/digpatho_deploy.tar.gz -C '${REMOTE_STAGING_DIR}' && rm -f /tmp/digpatho_deploy.tar.gz"
  rm -f "${tmp_tar}"
}

run_remote_deploy() {
  local remote_script
  remote_script="$(cat <<'REMOTE_EOF'
set -e
REMOTE_NEW_DIR="__REMOTE_NEW_DIR__"
REMOTE_APP_DIR="__REMOTE_APP_DIR__"
REMOTE_STAGING_DIR="__REMOTE_STAGING_DIR__"
APP_NAME="__APP_NAME__"
APP_PORT="__APP_PORT__"
HEALTHCHECK_URL="__HEALTHCHECK_URL__"
HEALTHCHECK_ATTEMPTS="__HEALTHCHECK_ATTEMPTS__"
HEALTHCHECK_SLEEP_SECONDS="__HEALTHCHECK_SLEEP_SECONDS__"
APP_OWNER="__APP_OWNER__"
DEFAULT_API_URL="__DEFAULT_API_URL__"
USE_ECOSYSTEM="__USE_ECOSYSTEM__"
DEPLOY_TARGET="__DEPLOY_TARGET__"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm no esta instalado en la VM."
  exit 1
fi

if [ -z "${APP_OWNER}" ] && [ -d "${REMOTE_APP_DIR}" ]; then
  APP_OWNER="$(stat -c '%U' "${REMOTE_APP_DIR}")"
fi
if [ -z "${APP_OWNER}" ]; then
  APP_OWNER="$(whoami)"
fi

SUDO="sudo"
if [ "${DEPLOY_TARGET}" = "prod" ] && [ "$(id -u)" -eq 0 ]; then
  SUDO=""
fi
if [ "${DEPLOY_TARGET}" = "prod" ] && [ "$(whoami)" = "ubuntu" ] && ! sudo -n true 2>/dev/null; then
  SUDO=""
fi

if ! ${SUDO} -u "${APP_OWNER}" -H bash -lc "command -v pm2 >/dev/null 2>&1"; then
  echo "Error: pm2 no esta instalado para APP_OWNER=${APP_OWNER}."
  exit 1
fi

echo "Preparando backup de variables de entorno..."
for env_name in production local dot; do
  src=""
  case "${env_name}" in
    production) src="${REMOTE_APP_DIR}/.env.production" ;;
    local) src="${REMOTE_APP_DIR}/.env.local" ;;
    dot) src="${REMOTE_APP_DIR}/.env" ;;
  esac
  if [ -d "${REMOTE_APP_DIR}" ] && [ -f "${src}" ]; then
    ${SUDO} cp "${src}" "/tmp/digpatho_front_env_${env_name}.bak"
  fi
done

echo "Moviendo codigo nuevo a carpeta temporal..."
${SUDO} rm -rf "${REMOTE_NEW_DIR}"
${SUDO} mkdir -p "$(dirname "${REMOTE_NEW_DIR}")"
${SUDO} mv "${REMOTE_STAGING_DIR}" "${REMOTE_NEW_DIR}"
${SUDO} chown -R "${APP_OWNER}:${APP_OWNER}" "${REMOTE_NEW_DIR}"

for env_name in production local dot; do
  if [ -f "/tmp/digpatho_front_env_${env_name}.bak" ]; then
    case "${env_name}" in
      production) ${SUDO} cp "/tmp/digpatho_front_env_${env_name}.bak" "${REMOTE_NEW_DIR}/.env.production" ;;
      local) ${SUDO} cp "/tmp/digpatho_front_env_${env_name}.bak" "${REMOTE_NEW_DIR}/.env.local" ;;
      dot) ${SUDO} cp "/tmp/digpatho_front_env_${env_name}.bak" "${REMOTE_NEW_DIR}/.env" ;;
    esac
  fi
done

${SUDO} -u "${APP_OWNER}" -H bash -lc "if [ -f '${REMOTE_NEW_DIR}/.env.local' ]; then sed -i 's#^NEXT_PUBLIC_API_URL=http://api\\.digpatho\\.com/#NEXT_PUBLIC_API_URL=https://api.digpatho.com/#' '${REMOTE_NEW_DIR}/.env.local'; fi"
${SUDO} bash -lc "if [ -f '${REMOTE_NEW_DIR}/.env.production' ] && ! grep -q '^API_URL=' '${REMOTE_NEW_DIR}/.env.production'; then printf '\nAPI_URL=${DEFAULT_API_URL}\n' | tee -a '${REMOTE_NEW_DIR}/.env.production' >/dev/null; chown '${APP_OWNER}:${APP_OWNER}' '${REMOTE_NEW_DIR}/.env.production'; fi"

for env_name in production local dot; do
  ${SUDO} rm -f "/tmp/digpatho_front_env_${env_name}.bak" || true
done

echo "Instalando dependencias..."
if [ -f "${REMOTE_NEW_DIR}/package-lock.json" ]; then
  ${SUDO} -u "${APP_OWNER}" -H bash -lc "cd '${REMOTE_NEW_DIR}' && npm ci"
else
  ${SUDO} -u "${APP_OWNER}" -H bash -lc "cd '${REMOTE_NEW_DIR}' && npm install"
fi

echo "Compilando frontend..."
${SUDO} -u "${APP_OWNER}" -H bash -lc "cd '${REMOTE_NEW_DIR}' && rm -rf .next && npm run build && test -f .next/BUILD_ID"

echo "Parando PM2 (${APP_NAME})..."
${SUDO} -u "${APP_OWNER}" -H bash -lc "pm2 stop '${APP_NAME}' >/dev/null 2>&1 || true"

if [ -d "${REMOTE_APP_DIR}" ]; then
  echo "Generando backup de app actual..."
  ${SUDO} rm -rf "${REMOTE_APP_DIR}_backup"
  ${SUDO} mv "${REMOTE_APP_DIR}" "${REMOTE_APP_DIR}_backup"
fi

echo "Activando nueva version..."
${SUDO} mv "${REMOTE_NEW_DIR}" "${REMOTE_APP_DIR}"
${SUDO} chown -R "${APP_OWNER}:${APP_OWNER}" "${REMOTE_APP_DIR}"

echo "Iniciando/reiniciando PM2..."
if [ "${USE_ECOSYSTEM}" = "true" ] && [ -f "${REMOTE_APP_DIR}/ecosystem.config.cjs" ]; then
  ${SUDO} -u "${APP_OWNER}" -H bash -lc "cd '${REMOTE_APP_DIR}' && if pm2 describe '${APP_NAME}' >/dev/null 2>&1; then pm2 restart '${APP_NAME}' --update-env; else pm2 start ecosystem.config.cjs --update-env; fi"
else
  ${SUDO} -u "${APP_OWNER}" -H bash -lc "if pm2 describe '${APP_NAME}' >/dev/null 2>&1; then pm2 restart '${APP_NAME}' --update-env; else PORT='${APP_PORT}' pm2 start npm --name '${APP_NAME}' -- start -- -p '${APP_PORT}' --update-env; fi"
fi

if ! ${SUDO} -u "${APP_OWNER}" -H bash -lc "pm2 describe '${APP_NAME}' >/dev/null 2>&1"; then
  echo "Error: no se pudo iniciar PM2 para ${APP_NAME}."
  exit 1
fi

echo "Verificando healthcheck en ${HEALTHCHECK_URL}..."
attempt_num=1
until curl -fsS "${HEALTHCHECK_URL}" >/dev/null; do
  if [ "${attempt_num}" -ge "${HEALTHCHECK_ATTEMPTS}" ]; then
    echo "Deploy fallo, restaurando backup..."
    ${SUDO} -u "${APP_OWNER}" -H bash -lc "pm2 delete '${APP_NAME}' || true"
    ${SUDO} rm -rf "${REMOTE_APP_DIR}"
    if [ -d "${REMOTE_APP_DIR}_backup" ]; then
      ${SUDO} mv "${REMOTE_APP_DIR}_backup" "${REMOTE_APP_DIR}"
      ${SUDO} chown -R "${APP_OWNER}:${APP_OWNER}" "${REMOTE_APP_DIR}"
      if [ "${USE_ECOSYSTEM}" = "true" ] && [ -f "${REMOTE_APP_DIR}/ecosystem.config.cjs" ]; then
        ${SUDO} -u "${APP_OWNER}" -H bash -lc "cd '${REMOTE_APP_DIR}' && pm2 start ecosystem.config.cjs --update-env || true"
      else
        ${SUDO} -u "${APP_OWNER}" -H bash -lc "cd '${REMOTE_APP_DIR}' && PORT='${APP_PORT}' pm2 start npm --name '${APP_NAME}' -- start -- -p '${APP_PORT}' --update-env || true"
      fi
    fi
    exit 1
  fi
  echo "Intento ${attempt_num}: app no responde aun, esperando ${HEALTHCHECK_SLEEP_SECONDS}s..."
  attempt_num=$((attempt_num + 1))
  sleep "${HEALTHCHECK_SLEEP_SECONDS}"
done

echo "Deploy OK. Limpiando backup..."
${SUDO} rm -rf "${REMOTE_APP_DIR}_backup" || true
${SUDO} -u "${APP_OWNER}" -H bash -lc "pm2 status '${APP_NAME}' || true"
REMOTE_EOF
)"

  remote_script="${remote_script//__REMOTE_NEW_DIR__/${REMOTE_NEW_DIR}}"
  remote_script="${remote_script//__REMOTE_APP_DIR__/${REMOTE_APP_DIR}}"
  remote_script="${remote_script//__REMOTE_STAGING_DIR__/${REMOTE_STAGING_DIR}}"
  remote_script="${remote_script//__APP_NAME__/${APP_NAME}}"
  remote_script="${remote_script//__APP_PORT__/${APP_PORT}}"
  remote_script="${remote_script//__HEALTHCHECK_URL__/${HEALTHCHECK_URL}}"
  remote_script="${remote_script//__HEALTHCHECK_ATTEMPTS__/${HEALTHCHECK_ATTEMPTS}}"
  remote_script="${remote_script//__HEALTHCHECK_SLEEP_SECONDS__/${HEALTHCHECK_SLEEP_SECONDS}}"
  remote_script="${remote_script//__APP_OWNER__/${APP_OWNER}}"
  remote_script="${remote_script//__DEFAULT_API_URL__/${DEFAULT_API_URL}}"
  remote_script="${remote_script//__USE_ECOSYSTEM__/${USE_ECOSYSTEM}}"
  remote_script="${remote_script//__DEPLOY_TARGET__/${DEPLOY_TARGET}}"

  local remote_script_file
  remote_script_file="$(mktemp /tmp/digpatho_remote_XXXXXX.sh 2>/dev/null || mktemp "${TMP:-/tmp}/digpatho_remote_XXXXXX.sh")"
  printf '%s\n' "${remote_script}" > "${remote_script_file}"

  echo "==> Ejecutando deploy remoto (${APP_NAME})"
  scp_to_remote "${remote_script_file}" "/tmp/digpatho_deploy_remote.sh"
  ssh_cmd "chmod +x /tmp/digpatho_deploy_remote.sh && bash /tmp/digpatho_deploy_remote.sh; rc=\$?; rm -f /tmp/digpatho_deploy_remote.sh; exit \$rc"
  rm -f "${remote_script_file}"
}

main() {
  echo "==> Digpatho frontend deploy (${DEPLOY_TARGET})"
  preflight
  upload_sources
  run_remote_deploy
  echo "==> Deploy finalizado"
}

main "$@"
