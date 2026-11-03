# TwitchNotifierBot

A Telegram bot that sends real-time notifications when Twitch/Kick streamers go live. Built with TypeScript, Bun runtime, and integrates with Twitch EventSub (WebSocket conduit or webhook) and Kick webhooks.

## Project Description

TwitchNotifierBot is a notification system that monitors Twitch and Kick streamers and sends Telegram notifications when they start or stop streaming. For Twitch, it supports two EventSub transport modes: **conduit** (persistent WebSocket connection) or **webhook** (HTTP callback). Kick uses webhook integration. The bot handles authentication, manages user subscriptions, and provides an admin panel via Telegram.

### Key Features
- Real-time Twitch and Kick stream notifications via Telegram
- Twitch EventSub with configurable transport: conduit (WebSocket) or webhook
- Kick webhook integration for stream notifications
- PostgreSQL database for persistent user preferences
- Grammy.js framework for Telegram bot interactions
- Development mode with Twitch API mocking support

## Quickstart

### Prerequisites
- [Bun](https://bun.sh/) runtime (v1.0+)
- PostgreSQL database
- Telegram Bot Token from [@BotFather](https://t.me/botfather)
- Twitch API credentials (Client ID and Client Secret)
- Kick API credentials (optional, for Kick stream notifications)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/infybtw/TwNotifier
   cd TwNotifier
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` — fill in the values documented in `.env.example` (Telegram,
   Twitch/Kick credentials, Mini App settings). It is git-ignored, so secrets
   stay local. In production this file is rendered by Ansible (see below).

### Running the Bot

**Development mode** (with `.env` file):
```bash
bun run dev
```

**Development stack** (PostgreSQL, backend, Mini App and Caddy; Twitch uses the
real API configured in `.env`):
```bash
docker compose -f docker-compose.dev.yml up --build
```

The stack is available on `http://localhost:3000`; Caddy forwards Mini App,
`API_PATH`, and provider webhooks to the internal containers. Only PostgreSQL
(`localhost:54322`) and Caddy (`localhost:3000`) are published to the host.
No `TUNNEL_TOKEN` is required for development.

**Production mode** (via Docker):
```bash
docker compose pull

docker compose up -d --remove-orphans
```

### Type checking
Backend type checking (from `app/`):
```bash
cd app && bun run typecheck
```

Frontend commands (from `web/`):
```bash
bun install
bun run dev        # Nuxt dev server on :3001
bun run typecheck
bun run generate   # static SPA into web/.output/public
```

### Deep Links

To open the bot and automatically follow a Twitch or Kick channel, use its platform and channel name in the `start` payload:

```
https://t.me/<bot_username>?start=prefollow_<platform>_<channel_name>
```

For example:

```
https://t.me/<bot_username>?start=prefollow_twitch_justovich221337
https://t.me/<bot_username>?start=prefollow_kick_justovich221337
```

Telegram deep links use the `start` parameter, so `?prefollow=twitch/justovich221337` is not delivered to the bot.

## Telegram Mini App

The bot ships with a Telegram Mini App (a static Nuxt SPA in `web/`) that covers
every user-facing feature: follows, adding and removing channels, live status,
all notification settings, language and help. Chat commands and buttons keep
working in parallel; notifications are always delivered in the private chat,
whether or not the Mini App is open.

```
web/ (Nuxt 4 SPA, static build)
      │ HTTPS /api/v1 + bearer token
      ▼
Bun / Elysia: auth → validation → services ─── PostgreSQL
      ▲                                      └── Twitch / Kick API
Telegram commands / callbacks ─ services ────┘
```

### Backend API

All routes except the `initData` exchange require an
`Authorization: Bearer <token>` header. The token is opaque, stored hashed in
`web_sessions`, and short-lived (default 1 hour).

| Method and path | Purpose |
| --- | --- |
| `POST /api/v1/auth/telegram` | Verify `initData`, register the user, issue a session |
| `DELETE /api/v1/auth/session` | Revoke the current session |
| `GET /api/v1/me` | Profile, language, chat-delivery state |
| `GET /api/v1/settings` | All user settings (booleans) |
| `PATCH /api/v1/settings` | Set explicitly supplied values |
| `POST /api/v1/channels/resolve` | Resolve a username/URL to platform matches |
| `GET /api/v1/follows` | Paginated follows with `platform`/`search` filters |
| `POST /api/v1/follows` | Add `{ platform, channelId }` after server-side verification |
| `GET /api/v1/follows/:platform/:channelId` | Follow details and share links |
| `DELETE /api/v1/follows/:platform/:channelId` | Remove a follow (idempotent) |
| `GET /api/v1/follows/:platform/:channelId/live` | Live status and stream details |
| `GET /api/v1/online` | Live channels from the user's follows |

Errors use `{ "error": { "code", "message", "requestId" } }`; the frontend
localizes by `code`. A provider outage yields `unknown`, never `offline`.

Authentication follows Telegram's HMAC-SHA-256 scheme: `secret = HMAC("WebAppData", bot_token)`,
`hash = HMAC(secret, data_check_string)`. `initData` is accepted only from the
JSON body (size limited), `auth_date` must be fresh (5 minutes by default), and
the bot token never reaches the frontend.

### Frontend

The Mini App is a static Nuxt SPA under `web/`; frontend commands are listed
above. Public configuration is limited to `NUXT_PUBLIC_API_BASE` and
`NUXT_PUBLIC_BOT_USERNAME`; no backend secret is exposed.

### Launching the Mini App

1. Create the Mini App in [@BotFather](https://t.me/botfather) and set its
   production HTTPS URL (`WEB_APP_URL`).
2. Set the menu button to that URL (BotFather or `setChatMenuButton`).
3. The private chat main menu already contains an "Open app" inline button when
   `WEB_APP_URL` is set; commands remain available below it.
4. Share links use the Main Mini App form:
   `https://t.me/<bot_username>?startapp=prefollow_<platform>_<login>`.
   Existing `?start=prefollow_...` links keep working through the bot.

### Docker deployment

`compose.yaml` uses **Cloudflare Tunnel as the only public entry point**:

```text
Internet → Cloudflare (HTTPS) → cloudflared → twn / web / dbx
```

The connector makes outbound connections; no inbound HTTP/HTTPS ports are
published on the server. Allow outbound tunnel traffic on port `7844` (UDP for
QUIC or TCP for HTTP/2). The API and static Mini App run independently:

- API: `HTTP_SERVER_PORT` (default `3000`) with routes under `API_PATH`
  (default `/api/v1`).
- Mini App: `WEB_SERVER_PORT` (default `3001`); the Caddy **inside the web image**
  only serves static files and SPA fallbacks, not public ingress.

#### Cloudflare Tunnel setup

1. Add your domain to Cloudflare and create a remotely-managed Cloudflare
   Tunnel in the dashboard (Networking → Tunnels).
2. Copy the connector token from the Docker installation command into
   `TUNNEL_TOKEN` in `.env`, or into the encrypted Ansible vault for production.
   The connector receives only this token, not the other application secrets.
3. Add published application routes in this order (path values are regular
   expressions). Protect `/dbx` and `/dbx/*` with Cloudflare Access and an
   explicit allow policy **before publishing the DBX route**:

   | Hostname | Path | HTTP service |
   | --- | --- | --- |
   | `twn.infybtw.dev` | `^/api/v1(/.*)?$` | `http://twn:3000` |
   | `twn.infybtw.dev` | `^/webhook/(kick\|twitch)$` | `http://twn:3000` |
   | `twn.infybtw.dev` | `^/dbx(/.*)?$` | `http://dbx:4224` |
   | `twn.infybtw.dev` | empty (all remaining paths) | `http://web:3001` |

   Specific paths must precede the Mini App catch-all. Paths are forwarded
   unchanged. Match the API expression to `API_PATH` if you change it, and use
   the configured internal ports if they differ from `3000`/`3001`.
   The origin hostnames are Docker service names, **not `localhost`**.
4. Set `WEB_APP_URL=https://twn.infybtw.dev`, `BOT_URL=https://twn.infybtw.dev`
   (webhook callback base), and `CORS_ORIGINS=https://twn.infybtw.dev`.
   Keep the frontend API base at `/api/v1` for this same-origin setup. A custom
   API prefix also requires rebuilding the web image with matching
   `NUXT_PUBLIC_API_BASE`.
5. DBX is available at `https://twn.infybtw.dev/dbx`. Its native
   `DBX_PUBLIC_BASE_PATH=/dbx` handles the prefix, including assets and API;
   do not strip it or add a separate proxy. `DBX_URL` sets the admin bot button
   and defaults to this URL even with an older vault. Replace the old
   `ADMINER_URL` vault key with `DBX_URL` when next editing the vault. Remove
   any old Adminer tunnel route; `--remove-orphans` removes its container.
   Connect to PostgreSQL at `postgres:5432` using the configured `POSTGRES_*`
   credentials. The `dbx-data` volume persists DBX settings and saved
   connections; back it up in full, including `.dbx/secret.key`, which encrypts
   stored credentials. The existing PostgreSQL backup service does not back up
   this volume. The dev stack is unchanged and does not include DBX.

Do not put Access login or interactive challenges in front of the public Mini
App/API or provider webhook routes: Telegram and webhook providers must reach
them without a browser login. Keep normal API authentication and webhook
signature verification enabled. Disable Cloudflare caching for API, webhook
and DBX paths; never add a cache-everything rule covering authenticated API
responses.

For migration, remove `EDGE_HTTP_PORT` from your vault/local `.env`, add
`TUNNEL_TOKEN`, configure the routes, then deploy with `--remove-orphans` as
above. Ansible also removes orphaned containers so the old `edge_proxy` cannot
keep port 80 exposed. Stop using any external reverse proxy for this app and
remove obsolete public origin DNS/port-forwarding rules. Existing Caddy volumes
are left untouched. The development stack continues to use local Caddy and
does not run a Cloudflare Tunnel connector.

If the Mini App fails to load, users can keep managing everything through chat
commands; reopening the Mini App from the bot button is the recovery path for
expired sessions.

## Server Provisioning (Ansible)

The `deploy/ansible/` directory contains playbooks that prepare a fresh Ubuntu or Debian
server to run TWN: they install Docker, clone the repository, render the
`.env` file from an Ansible Vault, and start the Compose stack.

`playbooks/docker-setup.yaml` automatically detects the distribution and release
codename using Ansible facts, then installs Docker using the matching official
Docker APT repository and GPG key. All Docker setup tasks are in this single
playbook.
Other distributions are rejected before installation. If Docker is already
installed, package installation is skipped; the service is enabled and started,
and the deploy user is added to the `docker` group.

### Prerequisites

- Ansible with `ansible-core` 2.15 or newer installed on your control machine (the machine you run the playbook
  from).
- SSH access to the target server with a user that can escalate via `sudo`.
- The `community.docker` collection:

  ```bash
  ansible-galaxy collection install community.docker
  ```

### Configure the inventory

Copy the example inventory and point it at your server:

```bash
cp deploy/ansible/inventory.ini.example deploy/ansible/inventory.ini
```

```ini
[servers]
server1 ansible_host=your_host_ip ansible_user=your_user
```

`inventory.ini` is git-ignored, so your host details stay local.

### Configure the vault

Copy the example vault, fill in real values, and encrypt it:

```bash
cp deploy/ansible/vault.example.yaml deploy/ansible/vault.yaml
$EDITOR deploy/ansible/vault.yaml
ansible-vault encrypt deploy/ansible/vault.yaml
```

The vault holds every secret and deployment value: Telegram, Twitch and Kick
credentials, the Cloudflare Tunnel token, PostgreSQL, Mini App/API settings,
internal ports, the backup schedule and S3 credentials. The full key list is in
`vault.example.yaml`.
The deploy play renders the server's `.env` from `templates/.env.j2` with
these values, so nothing is pulled from an external secret manager at runtime.

If you are migrating a vault created before the secrets moved into it, add the
new keys from `vault.example.yaml` and remove `DOPPLER_TOKEN`.

`vault.yaml` can be committed only after encryption with Ansible Vault.
Keep the vault password outside the repository and never commit decrypted secrets.
The `.env` file on the server is rendered from `templates/.env.j2` with these
variables — never edited by hand.

### Run the playbook

```bash
cd deploy/ansible
ansible-playbook twn-deploy.yaml -K --ask-vault-pass
```

(`-K` asks for the sudo password, `--ask-vault-pass` for the vault password.
Omit `--ask-vault-pass` if you kept `vault.yaml` unencrypted.)

The entrypoint `twn-deploy.yaml` imports two playbooks and then deploys:

| Playbook | What it does |
| --- | --- |
| `playbooks/docker-setup.yaml` | Detects Ubuntu or Debian, installs Docker Engine and the Compose and Buildx plugins, enables the Docker service, and adds the deploy user to the `docker` group |
| `playbooks/twn-setup.yaml` | Clones `TwNotifier` into `~/twn` and pulls the Compose images |
| `twn-deploy.yaml` (deploy play) | Resolves the latest git tag, renders `~/twn/.env` from `templates/.env.j2` + `vault.yaml` (mode `0600`) and starts the stack with `docker compose up` |

The deploy does not follow the moving `latest` image tag: the play runs
`git fetch --tags` in the deployed clone, picks the newest tag by creation date
(`3.1.1`, `3.0.8-beta11`, …) and writes it as `TWN_VERSION` into the rendered
`.env`, which `compose.yaml` interpolates into both image names
(`ghcr.io/infybtw/twnotifier:<tag>`, `ghcr.io/infybtw/twnotifier-web:<tag>`).
So each deploy runs the images built by the `docker-build.yml` run for that
tag. Leave `TWN_VERSION` unset in `vault.yaml` to always track the newest tag;
set it (e.g. `TWN_VERSION: "3.1.1"`) to pin a release, including rolling back.
Bare `docker compose up` without that variable still uses `latest`.

When it finishes, the stack is already running — no manual `.env` editing on
the server needed. To change backend config (bot tokens, provider credentials,
webhook secrets, API settings), edit `vault.yaml` and re-run the playbook;
`.env` is only re-rendered during deploy, so restarting the container alone
does not pick up vault changes. To change DB credentials, ports, the backup
schedule or the pinned version, edit `vault.yaml` and re-run the playbook as
well.

Backups run in the `backup` service (`ghcr.io/infybtw/postgres-backup`), which
dumps PostgreSQL to S3-compatible storage on `BACKUP_SCHEDULE`. Its `S3_*`
credentials are stored in `vault.yaml` and land in the same rendered `.env`.

## Architecture

```
app/
├── index.ts              # Main entry point
├── config.ts             # Environment configuration
├── logger.ts             # Custom logger (json/pretty/plain, Alloy/Loki compatible)
├── migrate.ts            # Database migration runner
├── bot/                  # Telegram bot handlers
│   ├── bot.ts            # Bot initialization
│   ├── bot_router.ts     # Message routing
│   ├── bot_callback_handler.ts # Callback handlers
│   ├── bot_sender.ts     # Notification sending
│   └── keyboards.ts      # Keyboard layouts
├── twitchAPI/            # Twitch API integration
│   ├── auth.ts           # Authentication
│   ├── shards.ts         # WebSocket connection management
│   ├── conduits.ts       # Conduit management
│   ├── subscriptions.ts  # Event subscriptions
│   ├── users.ts          # User lookups
│   ├── verifyWebhook.ts  # Webhook signature verification (HMAC-SHA256)
│   └── webhook_handler.ts # Twitch webhook processing
├── kickAPI/              # Kick API integration
│   ├── auth.ts           # Kick authentication
│   ├── subscription.ts   # Kick subscription management
│   ├── users.ts          # Kick user lookups
│   ├── publicKey.ts      # Webhook signature verification
│   └── verifyWebhook.ts  # Webhook verification
├── handlers/             # Event handlers
│   ├── ws_handler.ts     # Twitch WebSocket message processing
│   ├── http_handler.ts   # Elysia HTTP server (API + Kick/Twitch webhooks)
│   └── webhook_handler.ts # Kick webhook processing
├── services/             # Shared business logic (bot + API)
│   ├── users.ts          # Registration, profile, chat delivery
│   ├── follows.ts        # Add/remove follows, provider subscriptions
│   ├── channels.ts       # Username/URL resolution and verification
│   ├── settings.ts       # Notification settings validation
│   ├── online.ts         # Batched live status with caching
│   └── errors.ts         # Transport-agnostic service errors
├── http/                 # User-facing REST API (v1)
│   ├── api.ts            # Route mounting and error mapping
│   ├── auth/             # initData verification, sessions, guard
│   ├── routes/           # auth, me, settings, channels, follows
│   └── dto.ts            # Public data structures
├── database/             # Database layer
│   ├── db.ts             # Database queries
│   └── schema.ts         # Drizzle ORM schema
├── models/               # Type definitions
│   ├── twitch_user.ts
│   ├── twitch_subscription.ts
│   └── kick_user.ts
└── utils/                # Utilities
    ├── settings.ts       # User settings helpers
    └── urlParser.ts      # URL parsing
web/                      # Telegram Mini App (Nuxt 4 + Tailwind 4 SPA)
```

## Libraries Used

### Core Dependencies
- **[grammy](https://grammy.dev/)** (^1.42.0) - Telegram Bot Framework
- **[@grammyjs/conversations](https://grammy.dev/plugins/conversations)** (^2.1.1) - Conversation management for Telegram bots
- **[@grammyjs/storage-file](https://grammy.dev/plugins/storage-file)** (^2.5.1) - File-based session storage
- **[drizzle-orm](https://orm.drizzle.team/)** (^0.45.2) - TypeScript ORM for PostgreSQL
- **[elysia](https://elysiajs.com/)** (^1.4.29) - HTTP server framework (Kick + Twitch webhooks)
- **[pg](https://node-postgres.com/)** (^8.22.0) - PostgreSQL client
- Custom logger (`app/logger.ts`) - Zero-dependency logger with json/pretty/plain formats, compatible with Grafana Alloy/Loki

### Development Dependencies
- **[@types/bun](https://bun.sh/docs/typescript)** - TypeScript definitions for Bun
- **[typescript](https://www.typescriptlang.org/)** (^5) - TypeScript compiler
- **[drizzle-kit](https://orm.drizzle.team/kit-docs/overview)** (^0.31.10) - Database migration tooling

### Runtime
- **[Bun](https://bun.sh/)** - JavaScript runtime and package manager
- **[PostgreSQL](https://www.postgresql.org/)** - Database for persistence

## Development

### TypeScript Configuration
- Target: ES2020
- Module: ES modules (`"type": "module"` in package.json)
- Source directory: `app/`
- Output directory: `dist/`
