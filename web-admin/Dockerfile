FROM oven/bun:1 AS build

WORKDIR /app
COPY web-admin/package.json web-admin/bun.lock ./
RUN bun install --frozen-lockfile
COPY web-admin/ .
RUN bun run build

FROM oven/bun:1

WORKDIR /app
COPY --from=build /app/.output ./.output

ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

CMD ["bun", "run", ".output/server/index.mjs"]
