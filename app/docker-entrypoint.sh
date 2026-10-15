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
# `infisical run` picks up Universal Auth credentials, project ID and domain
# from the environment automatically; project/env/path are also passed as
# explicit flags so no `.infisical.json` is needed inside the image.
set -eu

if [ -z "${INFISICAL_UNIVERSAL_AUTH_CLIENT_ID:-}" ] \
  || [ -z "${INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET:-}" ] \
  || [ -z "${INFISICAL_PROJECT_ID:-}" ]; then
  echo "[entrypoint] INFISICAL_* not fully configured, starting with container environment" >&2
  exec "$@"
fi

DOMAIN_ARG=""
if [ -n "${INFISICAL_DOMAIN:-}" ]; then
  DOMAIN_ARG="--domain=${INFISICAL_DOMAIN}"
fi

RECURSIVE_ARG=""
if [ "${INFISICAL_RECURSIVE:-false}" = "true" ]; then
  RECURSIVE_ARG="--recursive"
fi

echo "[entrypoint] starting via Infisical (env=${INFISICAL_ENVIRONMENT:-prod}, path=${INFISICAL_SECRET_PATH:-/})" >&2
# shellcheck disable=SC2086
exec infisical run \
  ${DOMAIN_ARG} \
  --projectId="${INFISICAL_PROJECT_ID}" \
  --env="${INFISICAL_ENVIRONMENT:-prod}" \
  --path="${INFISICAL_SECRET_PATH:-/}" \
  ${RECURSIVE_ARG} \
  -- "$@"
