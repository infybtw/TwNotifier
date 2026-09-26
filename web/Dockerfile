# Static Mini App served directly by Bun; no reverse proxy is used.
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

FROM oven/bun:1

WORKDIR /web
COPY --from=build /web/.output/public ./public
COPY web/server.ts ./server.ts

ENV WEB_SERVER_PORT=3001
EXPOSE 3001

CMD ["bun", "run", "server.ts"]
