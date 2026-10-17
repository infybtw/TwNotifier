# TwitchNotifierBot - Agent Guidance

## Development Commands
- `bun run dev` - Run the bot with `.env` file (no file watching)
- There is no `start` script; production runs via Docker (`Dockerfile-app`)

## Environment Setup
- Environment file: `.env` (loaded via `--env-file` flag in package.json script)
- `.env.example` documents all required variables including Kick integration vars
- `.env.example.raw` lists the app values to store in Doppler (`KEY=VALUE`, no DB or compose-only keys)
- Development and production use real Twitch endpoints (`wss://eventsub.wss.twitch.tv/ws`, `https://api.twitch.tv`)
- `DATABASE_URL` is built in `app/config.ts` from `POSTGRES_USER/PASSWORD/DB` and `POSTGRES_HOST/PORT`; do not set it

## Architecture Notes
- Entry point: `app/index.ts` - runs migrations, starts Telegram bot, authenticates Twitch/Kick, connects WebSocket, starts HTTP server
- Uses Bun runtime with TypeScript (ES modules, `"type": "module"` in package.json)
- Telegram bot built with grammy.js framework (`app/bot/`)
- Twitch EventSub WebSocket integration for real-time stream notifications (`app/twitchAPI/`)
- Kick integration via webhooks handled by Elysia HTTP server (`app/kickAPI/`, `app/handlers/http_handler.ts`)
- PostgreSQL database via Drizzle ORM (`app/database/`)
- Schema: `app/database/schema.ts`, migrations: `drizzle/` directory
- Drizzle config: `drizzle.config.ts` (uses `DATABASE_URL` env var)
- Startup order matters: migrate → bot → auth → conduits → websocket → http server

## Database
- PostgreSQL 16 (not SQLite)
- Drizzle ORM with `drizzle-orm/bun-sql` driver
- Run migrations: `bun run app/migrate.ts` (also runs automatically on startup)
- Generate migrations: `npx drizzle-kit generate`
- Schema tables: `users`, `channels`, `users_follows`, `users_settings`, `admin_keys`

## Docker Compose Files
- `docker-compose.dev.yml` - PostgreSQL + app + Mini App + Caddy (local development)
- `compose.yaml` - PostgreSQL + app + Mini App + adminer + postgres-backup (production, images pulled from GHCR, config from `.env`)

## Build & Type Checking
- TypeScript config: `tsconfig.json` with `rootDir: "./app"`, `outDir: "./dist"`
- No linting, formatting, or typecheck scripts defined in package.json
- Build artifacts go to `dist/` directory (git-ignored)

## Git Commit Convention
- All commits MUST follow the [Conventional Commits](https://www.conventionalcommits.org/) specification
- Format: `<type>(<optional scope>): <description>`
- Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- Examples:
  - `feat(bot): add Kick stream notification handler`
  - `fix(twitch): reconnect websocket on token expiry`
  - `docs: update .env.example with Kick variables`
  - `chore(deps): bump drizzle-orm to latest`

## Important Constraints
- Database file (`*.db`) and session files (`/sessions`) are git-ignored
- Logs directory (`logs/`) is git-ignored
- No tests in the repo; static checks are `typecheck` scripts (`tsc --noEmit`)
- `APP_TOKEN`, `KICK_APP_TOKEN`, `CONDUIT_ID` are mutable globals set at runtime in `app/config.ts`
