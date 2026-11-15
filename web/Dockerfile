# Telegram Mini App built with Astro and served by its Node adapter.

# Astro's standalone server externalizes runtime dependencies, so the runtime
# image needs production node_modules in addition to dist/.
FROM oven/bun:1 AS deps
WORKDIR /web
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1 AS build
WORKDIR /web
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile

ARG PUBLIC_API_BASE=
ARG PUBLIC_BOT_USERNAME=

COPY web/ ./
# Reference the build args in the RUN command so Docker's layer cache is keyed
# by their values; otherwise a cached build can bake stale PUBLIC_* settings.
RUN PUBLIC_API_BASE="$PUBLIC_API_BASE" PUBLIC_BOT_USERNAME="$PUBLIC_BOT_USERNAME" bun run build

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

COPY --from=deps /web/node_modules ./node_modules
COPY --from=build /web/dist ./dist

EXPOSE 3001
CMD ["node", "./dist/server/entry.mjs"]
