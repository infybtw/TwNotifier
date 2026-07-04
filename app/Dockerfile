FROM oven/bun:1

WORKDIR /app
COPY app/package.json app/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY app  .
COPY app/drizzle.config.ts .
COPY drizzle ./drizzle

CMD ["bun", "run", "index.ts"]
