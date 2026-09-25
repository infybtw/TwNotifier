export const CLIENT_ID: string = String(process.env.CLIENT_ID);
export const CLIENT_SECRET: string = String(process.env.CLIENT_SECRET);
export const BOT_USER_ID: string = String(process.env.BOT_USER_ID);

export const KICK_CLIENT_ID: string = String(process.env.KICK_CLIENT_ID)
export const KICK_CLIENT_SECRET: string = String(process.env.KICK_CLIENT_SECRET)
export const KICK_WEBHOOK_PATH: string = String(process.env.KICK_WEBHOOK_PATH)

export const HTTP_SERVER_PORT: number = Number(process.env.HTTP_SERVER_PORT)

export const SHARD_COUNT: number = Number(process.env.SHARD_COUNT);
export const BOT_TOKEN: string = String(process.env.BOT_TOKEN);
export const DATABASE_URL: string = String(process.env.DATABASE_URL);

export let APP_TOKEN: string;
export let KICK_APP_TOKEN: string;
export let CONDUIT_ID: string;

export const TWITCH_WS: string = String(process.env.TWITCH_WS);
export const TWITCH_HELIX: string = String(process.env.TWITCH_HELIX);
export const TWITCH_OAUTH: string = String(process.env.TWITCH_OAUTH);

export const TWITCH_EVENT_TRANSPORT: string = process.env.TWITCH_EVENT_TRANSPORT || "";
export const TWITCH_WEBHOOK_PATH: string = process.env.TWITCH_WEBHOOK_PATH || "";
export const TWITCH_WEBHOOK_SECRET: string = process.env.TWITCH_WEBHOOK_SECRET || "";
export const BOT_URL: string = process.env.BOT_URL || "";

export const KICK_API: string = String(process.env.KICK_API)
export const KICK_OAUTH: string = String(process.env.KICK_OAUTH)

export const ADMINER_URL: string = String(process.env.ADMINER_URL)
export const PGBACKWEB_URL: string = String(process.env.PGBACKWEB_URL)

export const DEFAULT_LANGUAGE: string = process.env.DEFAULT_LANGUAGE || "ru"

// --- Telegram Mini App / REST API ---
/** Public HTTPS URL of the Mini App (used for launch links). */
export const WEB_APP_URL: string = process.env.WEB_APP_URL || ""
/** Bot username without the leading @, used to build share/deep links. */
export const BOT_USERNAME: string = (process.env.BOT_USERNAME || "").replace(/^@/, "")
/** Server-side session lifetime in seconds. */
export const SESSION_TTL_SECONDS: number = Number(process.env.SESSION_TTL_SECONDS || 3600)
/** Maximum age of a verified initData payload in seconds. */
export const INIT_DATA_MAX_AGE_SECONDS: number = Number(process.env.INIT_DATA_MAX_AGE_SECONDS || 300)
/** Allowed clock skew into the future for initData auth_date, in seconds. */
export const INIT_DATA_FUTURE_SKEW_SECONDS: number = Number(process.env.INIT_DATA_FUTURE_SKEW_SECONDS || 30)
/** Requests per minute per client for authentication and mutations. */
export const API_RATE_LIMIT_PER_MINUTE: number = Number(process.env.API_RATE_LIMIT_PER_MINUTE || 60)
/** Maximum accepted initData body size in bytes. */
export const INIT_DATA_MAX_BYTES: number = Number(process.env.INIT_DATA_MAX_BYTES || 8192)

export const STARTUP_TIME = Date.now();

export async function setAppToken(appToken: string): Promise<void> {
  APP_TOKEN = appToken;
}

export async function setKickAppToken(appToken: string): Promise<void>{
  KICK_APP_TOKEN = appToken;
}

export async function setConduitId(conduitId: string): Promise<void> {
  CONDUIT_ID = conduitId;
}
