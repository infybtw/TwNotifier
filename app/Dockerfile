FROM oven/bun:1

# Infisical CLI for pulling secrets at container start (see docker-entrypoint.sh).
COPY --from=infisical/cli:latest /bin/infisical /usr/local/bin/infisical

WORKDIR /app
COPY app/package.json app/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY app/  .
COPY app/drizzle.config.ts .
COPY app/drizzle ./drizzle
RUN chmod +x /app/docker-entrypoint.sh /usr/local/bin/infisical

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["bun", "run", "index.ts"]
