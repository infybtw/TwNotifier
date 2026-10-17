#!/bin/sh
# Backend container entrypoint: inject secrets from Doppler when a service
# token is provided, otherwise run the app with plain container environment
# (env_file / .env fallback).
#
# Variables (provided via env_file / .env, see .env.example):
#   DOPPLER_TOKEN   Doppler service token; project and config are bound to it.
#
# The Doppler CLI reads DOPPLER_TOKEN from the environment directly, so no
# login or project/config flags are needed.
set -eu

if [ -z "${DOPPLER_TOKEN:-}" ]; then
  echo "[entrypoint] DOPPLER_TOKEN not set, starting with container environment" >&2
  exec "$@"
fi

echo "[entrypoint] starting via Doppler" >&2
exec doppler run --no-liveness-ping -- "$@"
