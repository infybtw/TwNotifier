# Telegram Mini App Plan

## 1. Goal and Decisions

Add a Telegram Mini App built with **Nuxt 4 + Tailwind CSS 4, `ssr: false`**, covering all existing user-facing bot features. Chat commands and buttons remain a fully supported way to manage the bot. Both interfaces share the same follows, settings, and business logic. Stream notifications continue to arrive in the private chat with the bot, including when the Mini App is closed.

This task produces the plan; implementation will follow the stages below.

> Implementation status: all stages are implemented. Stage checklist items are
> ticked where the work is complete in code and covered by automated checks.
> Two items depend on external infrastructure and are marked inline: launching
> through a test bot and the production smoke test.

Baseline implementation decisions:

- Frontend: a separate `web/` directory containing a static Nuxt SPA build.
- Backend: a user-facing REST API within the existing Bun/Elysia application.
- A single HTTPS origin for the SPA and API; PostgreSQL remains shared with the bot.
- Authentication through Telegram Mini App, without a separate password or account-linking flow.
- UI: RU/EN, Telegram light/dark themes, mobile-first.
- Full feature parity with the bot comes first; administrative features, including the administrator timezone setting, are outside the Mini App scope.
- Outside Telegram, display an “Open in Telegram” page. Standalone browser authentication is not currently planned.

## 2. Existing Project Structure

This plan is based on the current code:

| Area | Files |
| --- | --- |
| Commands, registration, `prefollow` | `app/bot/bot_router.ts` |
| User buttons, online status, settings, language | `app/bot/bot_callback_handler.ts`, `app/bot/keyboards.ts` |
| Follow list with online status | `app/bot/my_subscriptions.ts` |
| Notification delivery and bot-blocking handling | `app/bot/bot_sender.ts` |
| Database and settings | `app/database/schema.ts`, `app/database/db.ts`, `app/utils/settings.ts` |
| Platform and channel name detection | `app/utils/urlParser.ts` |
| HTTP server with webhooks | `app/handlers/http_handler.ts` |
| Translations | `app/i18n/ru.json`, `app/i18n/en.json` |
| Startup, containers, proxy | `app/index.ts`, `app/Dockerfile`, `docker-compose.prod.yml`, `CaddyfileDev` |

There is currently no user-facing HTTP API. Much of the business logic lives directly in Telegram handlers and uses `ctx.session`. Extract it into a shared service layer rather than invoking bot commands from HTTP handlers.

In the current layout, migrations are in `app/drizzle/`, their configuration is in `app/drizzle.config.ts`, and the backend TypeScript configuration is in `app/tsconfig.json`. The repository root and `app/` have separate package and lock files. When adding the frontend, explicitly define installation and build commands for each package.

## 3. Full User Feature Coverage Matrix

| Bot workflow | Mini App implementation |
| --- | --- |
| `/start`, main menu | Authentication, user and settings creation on first sign-in, home screen |
| `/list`, “My follows”, pagination | Follow list, counts, platform, online status, pagination |
| `/add`, adding through buttons | Enter a username or URL, resolve the channel, preview, and confirm |
| Same username on Twitch and Kick | Show both results with explicit platform selection; a platform URL selects the platform directly |
| Confirm/cancel adding | Confirm the preview; cancel without changing the database |
| `/remove`, removal through buttons | Remove from the detail view or find an existing follow by username/URL, select the platform, and confirm |
| Confirm/cancel removal | Confirm removal; cancel without changing the database |
| Manage an individual follow | Name, platform, link, follow date, actions |
| Check a specific channel’s online status | Status, stream title, viewers, Twitch category, and available Kick details |
| “Who is online” | Dedicated screen listing live channels from the user’s follows, with refresh |
| Open Twitch/Kick | Open the link using Telegram’s APIs |
| Share a follow | Share a channel link through Telegram; support existing `?start=prefollow_...` links |
| Open a `prefollow` invitation | Equivalent Mini App link using `startapp`, channel preview, and follow after confirmation |
| Notification settings | All six toggles from the current database |
| Language selection | RU/EN with a shared saved language for the interface and notifications |
| Bot information | Features, supported platforms, help, GitHub link |

### Settings: Exact Semantics

The API returns booleans; the service maps them to the existing `0/1` values:

| Database field | UI label / meaning |
| --- | --- |
| `online_notification` | Stream start notifications |
| `offline_notification` | Stream end notifications |
| `title_change_notification` | Stream title change notifications, currently implemented for Twitch |
| `category_change_notification` | Category change notifications, currently implemented for Twitch |
| `stream_metadata` | Completed stream details: duration and category history where available |
| `link_preview` | Stream preview image in the start notification, rather than a standard URL preview card |
| `language` | `ru` or `en` |

`is_bot_blocked` is a diagnostic delivery state exposed as read-only through the user API. It is not a user-controlled toggle. The UI must reflect actual platform capabilities and must not imply that Kick supports the same title/category change notifications as Twitch.

## 4. Telegram Mini App Authentication

### 4.1. Telegram Requirements

The official JavaScript bridge provides `Telegram.WebApp.initData`: the original query string containing user fields, an issuance timestamp, and verification values. The frontend sends the **original string** to the backend over HTTPS.

`initDataUnsafe`, a standalone `user.id` supplied by the browser, and URL parameters are not proof of identity. Data becomes trusted only after server-side verification.

For our own backend, use **HMAC-SHA-256 with the bot token**. Telegram also documents Ed25519 verification of `signature` for third parties without access to the bot token; that mechanism is not required for this project.

### 4.2. Backend Verification Algorithm

1. Accept `initData` in the JSON body of `POST /api/v1/auth/telegram`; enforce a body size limit.
2. Parse the query string using a standard URL parser, decoding values once; reject duplicate keys and malformed input.
3. Extract `hash` and validate its SHA-256 hexadecimal format.
4. Build `data_check_string` from the remaining received fields: sort by key name, format each entry as `key=value`, and join with `\n`. Do not parse and reserialize JSON values when computing the signature.
5. Compute `secret_key = HMAC_SHA256(key="WebAppData", message=BOT_TOKEN)` as bytes.
6. Compute `expected_hash = HMAC_SHA256(key=secret_key, message=data_check_string)`.
7. Compare the hashes in constant time after checking their lengths.
8. Validate `auth_date`: a Unix timestamp in seconds, with a default exchange window of 5 minutes and up to 30 seconds of future clock skew. These limits are application policy, not Telegram-mandated expiration values.
9. After verification, parse `user`, require a valid positive safe-integer `user.id`, and validate the data structure. Reject authentication if the user is missing.
10. Create or retrieve the user and settings transactionally; update the name/username from verified data without overwriting saved user preferences.

Keep the algorithms distinct: the HMAC scheme excludes `hash`; a received `signature` field remains among the signed fields. Excluding both `hash` and `signature` and adding the `bot_id:WebAppData` prefix belong to the separate Ed25519 scheme. Add a test using a modern payload containing `signature`.

The bot token stays exclusively on the backend. Never include `initData`, session tokens, or authorization headers in logs or API query parameters.

### 4.3. Application Session

Exchange verified `initData` for a short-lived server-side session:

- An opaque, cryptographically random bearer token with a default TTL of 1 hour.
- Store the token hash, `user_id`, creation time, and expiration time in the database; add a lookup index and remove expired records. Do not store the raw token.
- The frontend keeps the token in memory only and sends `Authorization: Bearer ...`.
- After a page reload, repeat the exchange if `initData` is still fresh; otherwise ask the user to close and reopen the Mini App. Do not extend sessions indefinitely using old `initData`.
- On `401`, stop protected requests and display a clear sign-in recovery screen without retry loops.
- Rate-limit authentication requests and user operations. Re-exchanging fresh `initData` is allowed for network retries; the TTL limits the replay window but does not make the payload single-use.
- Derive the user for every API operation from the session; do not accept `user_id` from the request body or query.

An in-memory bearer token avoids reliance on third-party cookies in Telegram Web. Unlike cookies, these credentials are not automatically attached by the browser; mutation endpoints require the authorization header and valid JSON. CORS does not replace session validation.

### 4.4. Permission to Message the User

Authentication and permission to send messages are separate concerns. A user can open the Main Mini App or a direct link before sending `/start`.

- Offer new users “Enable chat notifications”: call `requestWriteAccess()` if supported by the client, or open the private bot chat and guide them to `/start`.
- Declining permission does not prevent follow management; the screen explains that chat delivery has not been enabled yet.
- Treat verified `user.allows_write_to_pm` as a signal at launch time, not a permanent delivery guarantee.
- Do not reset `is_bot_blocked` merely because the Mini App was opened or its client-side `requestWriteAccess` callback succeeded.
- Update state based on server-side Telegram updates (`write_access_allowed`, bot status changes in the private chat), `/start`, and actual delivery results. For new users, track unknown/confirmed delivery permission separately; an unset `is_bot_blocked` does not establish permission.
- Preserve handling of `403 bot was blocked by the user`; the UI should offer instructions to unblock the bot and return to the chat.
- Verify delivery to new users both through `/start` and through write access granted from the Mini App.

## 5. Architecture and Shared Service Layer

```text
Telegram Mini App (Nuxt SPA)
        │ HTTPS /api/v1 + bearer
        ▼
Bun / Elysia: auth → validation → user services
                                  ▲       │
Telegram commands / callbacks ────┘       ├── PostgreSQL
                                          └── Twitch / Kick API

Twitch / Kick events → existing handlers → bot_sender → private chat
```

Proposed structure:

```text
web/
  nuxt.config.ts
  app/pages/
  app/components/
  app/composables/          # Telegram bridge, auth, API, localization
  app/plugins/telegram.client.ts
  app/assets/css/main.css
app/
  services/users.ts
  services/follows.ts
  services/channels.ts
  services/settings.ts
  http/auth/               # initData, sessions, middleware
  http/routes/             # user-facing API
  http/dto/                # public data structures and errors
  handlers/http_handler.ts # mount API alongside webhooks
```

Services accept plain data and return typed results without depending on grammY Context, HTTP, or translations. The bot and API handle their own presentation of results. Existing Telegram session fields remain conversation state only, not Mini App operation state.

Shared operations include registration, channel resolution, retrieving follows, adding/removing follows, online status, and saving settings. Extract every user-facing follow creation path, including `/start prefollow`, to eliminate divergent implementations.

Also fix the discrepancy in Kick error handling: `confirm_add` currently ignores the subscription result, while `prefollow` checks it. The shared service must report provider errors instead of returning false success.

### Data Integrity Before Exposing the API

1. A channel is identified by `(platform, channel_id)`. Currently, `channels.channel_id` is globally unique, and some reads/joins ignore the platform.
2. Migrate to a composite key/unique constraint on `(platform, channel_id)` and corresponding composite foreign keys in `users_follows`, `stream_logs`, and `stream_sessions`. Update all affected reads/joins, including those used by the existing bot and event handlers.
3. Make platform and relationship key fields required, and restrict platforms to supported values.
4. Add uniqueness on `(user_id, platform, channel_id)` in `users_follows`. First inspect duplicates, nulls, and inconsistent relationships; define an explicit backfill and preserve the follow date during deduplication.
5. Implement concurrency-safe upserts for users, settings, channels, and follows. The bot and Mini App can perform operations simultaneously.
6. Separate the canonical login/slug from the display name: Twitch currently stores a display name in `channel_name`, which is then used for lookups and links. Plan a login backfill through the provider API.
7. The URL parser must check an exact hostname or an allowed subdomain rather than `includes('twitch.tv')`; validate usernames according to platform rules. Send requests only to configured provider APIs.

Creating external EventSub/webhook subscriptions is not atomic with a database transaction. Support repeatable creation, treat “already exists” as success, and allow safe retries after partial failures. Return success only after the required external subscriptions are ready and the follow is saved. Do not keep database transactions open during network calls. Removing a personal follow must not disable a shared external subscription used by other users.

## 6. REST API v1

All routes except the `initData` exchange require a server-side session.

| Method and path | Purpose |
| --- | --- |
| `POST /api/v1/auth/telegram` | Verify `initData`, register the user, issue a session and `expiresAt` |
| `DELETE /api/v1/auth/session` | Revoke the current session |
| `GET /api/v1/me` | Profile, language, diagnostic delivery state |
| `GET /api/v1/settings` | All user settings |
| `PATCH /api/v1/settings` | Set explicitly supplied values |
| `POST /api/v1/channels/resolve` | Resolve a username/URL, with an optional platform, and return preview results |
| `GET /api/v1/follows` | Current user’s follows with pagination, search, and platform filtering |
| `POST /api/v1/follows` | Add `{ platform, channelId }` with server-side channel verification |
| `GET /api/v1/follows/:platform/:channelId` | Details of an owned follow, its date, and share links |
| `DELETE /api/v1/follows/:platform/:channelId` | Remove an owned follow |
| `GET /api/v1/follows/:platform/:channelId/live` | Online status and available stream details |
| `GET /api/v1/online` | Live channels from the current user’s follows only |

Contracts and behavior:

- DTOs must not expose entire internal database records, administrative fields, or provider secrets.
- Public DTO IDs are strings; dates use ISO 8601, platforms use an enum, and settings use booleans.
- Verify that a follow belongs to the current user for both reads and mutations.
- Repeated additions return the existing follow without creating a duplicate; repeated deletions are safe. The client disables repeated clicks while a request is pending.
- `PATCH` sets a state rather than toggling it, so network retries do not invert settings. Only the seven user-facing fields listed above are allowed.
- Atomically update only supplied fields; concurrent changes to the same field use the last saved value. Return the resulting settings to the UI.
- Use stable ordering, a bounded `limit`, and cursor-based or explicitly defined pagination; do not merge identical names across platforms.
- Errors use `{ error: { code, message, requestId } }`, with codes for invalid input, expired sessions, missing channels, rate limits, and unavailable providers. The frontend localizes by `code`.
- An unavailable provider produces `unknown`, not `offline`. On partial failure, display available results and a platform-specific warning.
- Batch online-status requests according to provider limits, cache briefly (30 seconds proposed), and return `checkedAt`. Do not query the API on every card render.
- Refresh on opening/returning to the app and on manual request; background polling is not required for the first version.

## 7. Nuxt, Tailwind, and Telegram UX

### Application Setup

- Nuxt 4, TypeScript, and `ssr: false` in `web/nuxt.config.ts`.
- Tailwind 4 through `@tailwindcss/vite`; register the global `app/assets/css/main.css` containing `@import "tailwindcss"` in Nuxt’s `css` configuration.
- Pin versions through the lock file during implementation; use compatible Nuxt/Vue/Tailwind versions.
- Load the official Telegram Web App script before bridge initialization, then access it through a thin typed wrapper.
- Browser configuration contains public data only: the relative `/api/v1` path and bot username. Do not import backend secrets into the frontend.
- `nuxt generate` outputs the SPA to `web/.output/public`; Nuxt server routes are not used for authentication or database access.

### Screens

1. **Sign-in / onboarding**: Telegram validation, session loading, enabling chat delivery, sign-in errors.
2. **My follows**: list, counts, filters, online indicators, add action.
3. **Add channel**: username/URL → platform results → preview → confirmation.
4. **Follow details**: date, current status, stream details, open, share, remove.
5. **Online**: the user’s live channels, links to details/streams, refresh.
6. **Settings**: six toggles, RU/EN, chat delivery state.
7. **About**: help and GitHub.

### Telegram Client Integration

- Call `ready()` once the application shell is prepared, and `expand()` when appropriate.
- Account for `themeParams`, `themeChanged`, viewport, and safe area/content safe area; check client support for newer capabilities.
- Synchronize Telegram BackButton with routing; unsubscribe from events when handlers are disposed.
- Open external Twitch/Kick links with `openLink` and Telegram links with `openTelegramLink`.
- Support light/dark themes, accessible button sizes, toggle labels, focus states, and loading/empty/error/offline states.
- The saved database language takes precedence. For a new user, suggest Telegram’s language_code with RU fallback; the saved choice is then shared by the bot and Mini App.
- Keep UI translations separate from the bot’s HTML message templates; do not inject Telegram HTML into the page through `v-html`.
- After mutations, refresh data and display confirmation within the UI. When returning to the app, reload settings and follows that may have changed through chat.

## 8. Mini App Launch and Links

1. Configure a Main Mini App for the existing bot through BotFather and specify its production HTTPS URL.
2. Configure the menu button with that URL through BotFather or the Bot API’s `setChatMenuButton`.
3. Add an “Open app” inline `web_app` button to the private chat welcome message/main menu; commands remain available.
4. Do not use reply-keyboard launch as the primary authentication flow: the documentation notes that its initData differs and may be empty.
5. For the Main Mini App, use `https://t.me/<bot_username>?startapp=prefollow_<platform>_<login>`. Existing `?start=prefollow_...` links continue to work through the bot.
6. `tgWebAppStartParam` may preselect a screen; backend processing must use the verified `start_param`. No GET request or link navigation creates a Mini App follow without confirmation.
7. Support older clients with a clear fallback to chat when a required Telegram capability is unavailable.

## 9. Deployment and Local Development

Recommended deployment: an HTTPS reverse proxy serves the static SPA and forwards `/api/v1/*` to the existing Elysia application. Confirm the domain and proxy placement before deployment.

- Preserve routing for existing Kick/Twitch webhook paths. Mini App middleware applies only to `/api/v1`, not to provider webhooks.
- Configure an `index.html` fallback for direct navigation to nested SPA routes. API and webhook errors must not fall through to the SPA.
- Add the frontend build to Docker/CI and update `.github/workflows/docker-build.yml` and Compose for the selected publishing setup.
- Use long-lived caching for versioned assets, revalidation for `index.html`, and `Cache-Control: no-store` for authentication and personal-data responses.
- Verify rendering inside the Telegram Web iframe: avoid blocking `X-Frame-Options: DENY/SAMEORIGIN`; align CSP `frame-ancestors` with supported Telegram Web origins and allow the official bridge script.
- Add `WEB_APP_URL`, initData freshness limits, and session TTL configuration to `app/config.ts` and `.env.example`; reuse the existing bot token.
- Development: backend on port 3000 and the Mini App on 3001; use a public HTTPS tunnel and a separate test bot for running inside Telegram.
- Development uses the real provider APIs. Development authentication data is allowed only in an isolated test environment; production must not accept a substituted user ID.
- Add documented frontend dev/generate/typecheck commands and backend checks, accounting for the current two package.json files.
- Apply migrations before code that requires the new schema; coordinate the composite-key rollout with the backend and validate the migration on a database copy. Account for the current `app/index.ts` startup order: the API becomes available after integrations initialize.

## 10. Implementation Stages

### Stage 1. Shared Services and Data Preparation

- [x] Finalize DTOs and the workflow coverage matrix.
- [x] Audit/migrate platform keys, duplicate follows, and canonical logins.
- [x] Extract user, follow, channel, and settings services.
- [x] Switch user-facing commands and callback handlers to these services.
- [x] Resolve inconsistent Kick error handling and concurrent record creation.

**Deliverable:** the existing bot runs through a shared layer ready for the HTTP API.

### Stage 2. Authentication and API

- [x] Implement initData validation and expiration checks.
- [x] Add server-side sessions, authentication middleware, and expired-record cleanup.
- [x] Implement endpoints, validation, request limits, and error codes.
- [x] Track chat delivery activation and Telegram permission updates.
- [x] Verify user isolation and repeatable mutations.

**Deliverable:** a protected user-facing API covering all required features.

### Stage 3. Mini App Shell

- [x] Create the Nuxt SPA and integrate Tailwind and the bridge.
- [x] Implement authentication, navigation, themes, safe areas, and RU/EN.
- [x] Add onboarding and missing/expired Telegram authentication states.
- [ ] Enable launch through the test bot.
  Requires a test bot, a public HTTPS URL and BotFather configuration; see
  "Launching the Mini App" in the root README.

**Deliverable:** the Mini App opens in Telegram and displays the current user’s data.

### Stage 4. User Screens

- [x] Follow list and online list.
- [x] Search, platform selection, preview, and follow creation.
- [x] Follow details, live stream details, removal, external links, and sharing.
- [x] All settings, shared language, and help.
- [x] Handle `startapp`, platform errors, and synchronization after chat changes.

**Deliverable:** every item in the coverage matrix is available through the Mini App.

### Stage 5. Verification and Production

- [x] Run the checks in the next section.
- [x] Build the SPA and containers; configure HTTPS/proxy and production BotFather settings.
- [x] Update README and `.env.example`; document deployment and returning to chat if the UI fails.
- [ ] Run a production smoke test: sign in → follow → change a setting → provider event → chat notification → unfollow.
  Runs against the deployed app; the equivalent flow is covered by tests at the
  service and API level.

## 11. Verification and Acceptance Criteria

### Backend: Bun Tests and Integration Checks

- initData: valid HMAC, tampered user/hash, different bot token, missing user/auth_date, expiration and future timestamps, Unicode/URL encoding, duplicate keys, payload with `signature`.
- Sessions: expiration, revocation, missing token, and preventing user A from accessing user B’s follows.
- Settings: field allowlist, boolean/language validation, repeated PATCH preserving the requested value.
- Follows: identical Twitch/Kick IDs, identical usernames, platform-specific URLs, concurrent additions from the bot and API, repeated deletion.
- Provider errors: partial subscription creation failure, retries, rate limits, one platform being unavailable; `unknown` must not become `offline`.
- PostgreSQL migrations: preserve existing follows, settings, and stream history; verify composite foreign keys and uniqueness.
- Notifications: new and existing users, write access, blocking/unblocking, and applying all six settings and the language after UI changes.

### Frontend and Real Clients

- Nuxt and backend typechecks, production SPA build.
- Automated browser scenarios with a test bridge: sign-in, add/remove, settings, deep links, authentication errors.
- Manual checks in Telegram Android, iOS, Desktop, and Web: real initData, menu/profile/inline launch, BackButton, safe areas, keyboard, theme changes, and write access.
- Verify that opening the website normally does not authenticate the user; test reopening after session expiration and refreshing a nested route.
- Verify that follows created through the Mini App appear in `/list`, and settings changed through chat appear in the Mini App.
- Close the Mini App, generate Twitch/Kick events, and verify normal chat notifications arrive without duplicates.

**Definition of done:** every coverage-matrix row is implemented, server-side authentication isolates user data, existing chat workflows pass regression checks, and notifications work independently of whether the UI is open.

## 12. Details to Confirm Before Implementation/Deployment

There are no blocking questions for preparing this plan. Assumptions: both interfaces remain available in parallel, RU/EN are included in the first release, and there is no separate authentication outside Telegram.

Before deployment, confirm:

1. The production Mini App domain and where the external HTTPS proxy is managed. The repository contains a development Caddyfile but no production proxy configuration.
2. A separate test bot and HTTPS URL for Mini App testing.
3. Visual style preferences; the default is a compact interface using Telegram theme colors and platform indicators.

## 13. Documentation

The following documentation was reviewed through Context7 when preparing this plan:

- [Telegram Mini Apps: capabilities and launch methods](https://core.telegram.org/bots/webapps)
- [Backend initData validation](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
- [Ed25519 for third parties: a separate verification scheme](https://core.telegram.org/bots/webapps#validating-data-for-third-party-use)
- [Telegram WebApp API: requestWriteAccess, themes, navigation](https://core.telegram.org/bots/webapps#initializing-mini-apps)
- [Nuxt 4: deployment and client-side only rendering](https://nuxt.com/docs/4.x/getting-started/deployment)
- [Nuxt: the ssr option](https://nuxt.com/docs/4.x/api/configuration/nuxt-config#ssr)
- [Tailwind CSS: installation with Nuxt](https://tailwindcss.com/docs/installation/framework-guides/nuxt)
