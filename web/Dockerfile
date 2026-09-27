# Static Mini App built with Nuxt and served by Caddy.
FROM oven/bun:1 AS build

WORKDIR /web
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile

ARG NUXT_PUBLIC_API_BASE=
ARG NUXT_PUBLIC_BOT_USERNAME=
ENV NUXT_PUBLIC_API_BASE=$NUXT_PUBLIC_API_BASE
ENV NUXT_PUBLIC_BOT_USERNAME=$NUXT_PUBLIC_BOT_USERNAME

COPY web/ ./
RUN bun run generate

FROM caddy:2-alpine

COPY --from=build /web/.output/public /web/public
COPY web/Caddyfile /etc/caddy/Caddyfile

ENV WEB_SERVER_PORT=3001
EXPOSE 3001
