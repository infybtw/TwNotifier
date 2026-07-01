import { Bot, Context, session, SessionFlavor } from "grammy";
import { BOT_TOKEN } from "../config";
import { router as mRouter } from "./bot_router";
import { router as cRouter } from "./bot_callback_handler";
import logger from "../logger";
import { TwitchUser } from "../models/twitch_user";
import { Channel } from "../database/schema";

const log = logger.getSubLogger({ name: "bot" });

interface SessionData {
  pendingAdd?: {
    channelId: number;
    channelName: string;
    displayName: string;
    platform: "kick" | "twitch";
  };
  pendingRemove?: {
    channelId: number;
    channelName: string;
    displayName: string;
    platform: "kick" | "twitch";
  };
  pendingPlatformSelect?: {
    kickData: KickChannelResponse;
    twitchData: TwitchUser;
  };
  removePendingPlatformSelect?: {
    kickChannel: Channel,
    twitchChannel: Channel,
  };
  adminLogin?: {
    signed_in: boolean;
  }
  broadcastPending?: boolean;
}

export type MyContext = Context & SessionFlavor<SessionData>;

export const botInstance = new Bot<MyContext>(BOT_TOKEN);

botInstance.use(session({
  initial: (): SessionData => ({}),
}));

botInstance.use(mRouter);
botInstance.use(cRouter);

export async function botStart() {
  botInstance.start();
  log.info("---Bot started---");
}
