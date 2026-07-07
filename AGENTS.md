# TwitchNotifierBot - Agent Guidance

## Development Commands
- `bun run dev` - Run the bot (root package.json, loads `.env` via `--env-file`)
- `bun test` - Run tests (no test files exist yet)
- No lint, format, typecheck, or build scripts defined
- No CI/CD workflows in this repo

## Project Structure - Two package.json Files
- **Root `package.json`** - wrapper with `dev` and `migrate` scripts that `cd app && ...`
- **`app/package.json`** - the real Bun project with dependencies, `bun.lock`, `bunfig.toml`, `node_modules/`
- The `app/` directory is self-contained; `bun install` should be run there
- Root `.env` is loaded by the root `dev` script via `--env-file ../.env`

## Environment Setup
- `.env` at repo root (git-ignored); copy from `.env.example`
- `.env.example` documents all required variables including Kick integration vars
- Development uses localhost endpoints for Twitch API mocking (twitch-mock service)
- Production uses real Twitch endpoints (`wss://eventsub.wss.twitch.tv/ws`, `https://api.twitch.tv`)
- `DATABASE_URL` is required - PostgreSQL connection string
- `ALLOW_KICK_INSECURE=true` skips Kick webhook signature verification (dev only, NEVER in production)

## Architecture
- Entry point: `app/index.ts` - startup order: migrate → bot → auth → conduits → websocket → http server
- Runtime: Bun with TypeScript (ES modules, `"type": "module"`)
- Telegram bot: grammy.js framework (`app/bot/`), UI language is Russian
- Twitch EventSub WebSocket: real-time stream notifications (`app/twitchAPI/`)
- Kick webhooks: handled by Elysia HTTP server (`app/kickAPI/`, `app/handlers/http_handler.ts`)
- PostgreSQL via Drizzle ORM (`app/database/`)
- Logger: tslog (`app/logger.ts`) - writes to stdout + `logs/app.log`

## Database
- PostgreSQL 16 via Drizzle ORM with `drizzle-orm/bun-sql` driver
- Schema: `app/database/schema.ts`
- Migrations: `app/drizzle/` directory
- Drizzle config: `app/drizzle.config.ts` (uses `DATABASE_URL` env var)
- Generate migrations: `bunx drizzle-kit generate` (run from `app/` directory)
- Migrations run automatically on startup via `app/migrate.ts`
- Schema tables: `users`, `channels`, `users_follows`, `users_settings`, `admin_keys`, `stream_logs`

## Docker Compose Files
- `docker-compose.dev.yml` - PostgreSQL + twitch-mock (local development)
- `docker-compose.local.yml` - PostgreSQL + app + web-admin + adminer (local prod-like testing, git-ignored)
- `docker-compose.prod.yml` - PostgreSQL + app + adminer + pgbackweb (production)
- App Dockerfile: `app/Dockerfile` (build context is repo root)

## Important Constraints
- `APP_TOKEN`, `KICK_APP_TOKEN`, `CONDUIT_ID` are mutable globals set at runtime in `app/config.ts`
- Platform types are strict `"kick" | "twitch"` union types throughout the codebase
- `app/tsconfig.json` exists but the app runs directly via Bun, not compiled to `dist/`
- `web-admin/` is a separate Nuxt.js admin panel project with its own dependencies
- Logs directory (`logs/`) and `.env` files are git-ignored
