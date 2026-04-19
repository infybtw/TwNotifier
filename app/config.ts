import "dotenv/config";

import tokens from "../tokens.json";

export const CLIENT_ID: string = String(process.env.CLIENT_ID);
export const CLIENT_SECRET: string = String(process.env.CLIENT_SECRET);
export const BOT_USER_ID: string = String(process.env.BOT_USER_ID);
export const SHARD_COUNT: number = Number(process.env.SHARD_COUNT);
export const BOT_TOKEN: string = String(process.env.BOT_TOKEN);

export let APP_TOKEN: string;
export let CONDUIT_ID: string;

export async function setAppToken(appToken: string): Promise<void> {
  APP_TOKEN = appToken;
}

export async function setConduitId(conduitId: string): Promise<void> {
  CONDUIT_ID = conduitId;
}
