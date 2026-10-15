#!/bin/sh
# Backend container entrypoint: pull secrets from self-hosted Infisical
# via Universal Auth when bootstrap variables are present, otherwise run
# the app with plain container environment (env_file / .env fallback).
#
# Bootstrap variables (provided via env_file / .env, see .env.example):
#   INFISICAL_DOMAIN                      e.g. https://secrets.example.com
#   INFISICAL_PROJECT_ID                  Infisical project ID (required for this mode)
#   INFISICAL_ENVIRONMENT                 Infisical environment slug, e.g. prod (default: prod)
#   INFISICAL_SECRET_PATH                 Secrets folder path (default: /)
#   INFISICAL_RECURSIVE                   "true" to also fetch sub-folders (default: false)
#   INFISICAL_UNIVERSAL_AUTH_CLIENT_ID
#   INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET
#
# NOTE: `infisical run` alone does NOT authenticate with client-id/secret —
# it needs a stored session or token. So we log in non-interactively first
# (`login --method=universal-auth`), then `run` injects project secrets.
# Project/env/path are passed as explicit flags so no `.infisical.json`
# is needed inside the image.
set -eu

if [ -z "${INFISICAL_UNIVERSAL_AUTH_CLIENT_ID:-}" ] \
  || [ -z "${INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET:-}" ] \
  || [ -z "${INFISICAL_PROJECT_ID:-}" ]; then
  echo "[entrypoint] INFISICAL_* not fully configured, starting with container environment" >&2
  exec "$@"
fi

LOGIN_DOMAIN=""
if [ -n "${INFISICAL_DOMAIN:-}" ]; then
  LOGIN_DOMAIN="--domain=${INFISICAL_DOMAIN}"
fi

echo "[entrypoint] logging into Infisical as machine identity" >&2
# stdout is swallowed: login prints the access token there and it must
# never land in container logs. stderr stays for real error messages
# (non-zero exit still aborts the container thanks to `set -e`).
# shellcheck disable=SC2086
infisical login --silent ${LOGIN_DOMAIN} \
  --method=universal-auth \
  --client-id="${INFISICAL_UNIVERSAL_AUTH_CLIENT_ID}" \
  --client-secret="${INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET}" > /dev/null

RECURSIVE_ARG=""
if [ "${INFISICAL_RECURSIVE:-false}" = "true" ]; then
  RECURSIVE_ARG="--recursive"
fi

echo "[entrypoint] starting via Infisical (env=${INFISICAL_ENVIRONMENT:-prod}, path=${INFISICAL_SECRET_PATH:-/})" >&2
# shellcheck disable=SC2086
exec infisical run \
  ${LOGIN_DOMAIN} \
  --projectId="${INFISICAL_PROJECT_ID}" \
  --env="${INFISICAL_ENVIRONMENT:-prod}" \
  --path="${INFISICAL_SECRET_PATH:-/}" \
  ${RECURSIVE_ARG} \
  -- "$@"
