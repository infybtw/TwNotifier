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
#   INFISICAL_TOKEN                       Optional pre-issued token (skips login)
#
# NOTE: `infisical run` alone does NOT authenticate with client-id/secret —
# it needs a token. Capture the plain login output and export it for `run`,
# without relying on a persisted CLI session inside the container.
# Project/env/path are passed as explicit flags so no `.infisical.json`
# is needed inside the image.
set -eu

if [ -z "${INFISICAL_PROJECT_ID:-}" ] \
  || { [ -z "${INFISICAL_TOKEN:-}" ] && { \
    [ -z "${INFISICAL_UNIVERSAL_AUTH_CLIENT_ID:-}" ] \
    || [ -z "${INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET:-}" ]; }; }; then
  echo "[entrypoint] INFISICAL_* not fully configured, starting with container environment" >&2
  exec "$@"
fi

# INFISICAL_DOMAIN is inherited by both CLI commands from the container env.
if [ -z "${INFISICAL_TOKEN:-}" ]; then
  echo "[entrypoint] logging into Infisical as machine identity" >&2
  # Keep assignment separate from export so a failed login aborts via set -e.
  INFISICAL_TOKEN=$(infisical login \
    --method=universal-auth \
    --client-id="${INFISICAL_UNIVERSAL_AUTH_CLIENT_ID}" \
    --client-secret="${INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET}" \
    --plain \
    --silent)
  if [ -z "$INFISICAL_TOKEN" ]; then
    echo "[entrypoint] Infisical login returned an empty token" >&2
    exit 1
  fi
fi
export INFISICAL_TOKEN

RECURSIVE_ARG=""
if [ "${INFISICAL_RECURSIVE:-false}" = "true" ]; then
  RECURSIVE_ARG="--recursive"
fi

echo "[entrypoint] starting via Infisical (env=${INFISICAL_ENVIRONMENT:-prod}, path=${INFISICAL_SECRET_PATH:-/})" >&2
# shellcheck disable=SC2086
exec infisical run \
  --projectId="${INFISICAL_PROJECT_ID}" \
  --env="${INFISICAL_ENVIRONMENT:-prod}" \
  --path="${INFISICAL_SECRET_PATH:-/}" \
  ${RECURSIVE_ARG} \
  -- "$@"
