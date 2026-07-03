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

export const KICK_API: string = String(process.env.KICK_API)
export const KICK_OAUTH: string = String(process.env.KICK_OAUTH)
export const ALLOW_KICK_INSECURE: boolean = Boolean(process.env.ALLOW_KICK_INSECURE)

export const ADMINER_URL: string = String(process.env.ADMINER_URL)
export const PGBACKWEB_URL: string = String(process.env.PGBACKWEB_URL)


export async function setAppToken(appToken: string): Promise<void> {
  APP_TOKEN = appToken;
}

export async function setKickAppToken(appToken: string): Promise<void>{
  KICK_APP_TOKEN = appToken;
}

export async function setConduitId(conduitId: string): Promise<void> {
  CONDUIT_ID = conduitId;
}
