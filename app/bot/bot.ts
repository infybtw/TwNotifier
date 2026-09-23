import { Bot, Context, GrammyError, session, SessionFlavor } from "grammy";
import { BOT_TOKEN } from "../config";
import { router as mRouter } from "./bot_router";
import { router as cRouter } from "./bot_callback_handler";
import { buildAdminBackKeyboard, buildBackHomeKeyboard } from "./keyboards";
import { t } from "../i18n";
import { getUserLocale } from "../utils/locale";
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
  broadcastMessage?: {
    text?: string;
    photoFileId?: string;
  };
  awaitingAddInput?: boolean;
  awaitingRemoveInput?: boolean;
}

export type MyContext = Context & SessionFlavor<SessionData>;

export const botInstance = new Bot<MyContext>(BOT_TOKEN);

// Link cards are never used by the bot. Twitch's live notification uses an
// explicit stream screenshot instead; all other URLs remain plain links.
botInstance.api.config.use((prev, method, payload, signal) => {
  if (method === "sendMessage" || method === "editMessageText") {
    return prev(method, {
      ...payload,
      link_preview_options: { is_disabled: true },
    } as typeof payload, signal);
  }
  return prev(method, payload, signal);
});

botInstance.use(session({
  initial: (): SessionData => ({}),
}));

botInstance.use(mRouter);
botInstance.use(cRouter);

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

botInstance.catch(async (err) => {
  const ctx = err.ctx;
  const e = err.error;
  log.error(`Error while handling update ${ctx.update.update_id}`, {
    error: e instanceof Error ? e.message : String(e),
  });

  let errorText: string;
  if (e instanceof GrammyError) {
    errorText = e.description;
  } else if (e instanceof Error) {
    errorText = e.message;
  } else {
    errorText = String(e);
  }
  if (errorText.length > 500) errorText = errorText.slice(0, 500) + "...";

  try {
    const userId = ctx.from?.id;
    const locale = userId ? await getUserLocale(userId) : undefined;
    const keyboard = ctx.session?.adminLogin
      ? buildAdminBackKeyboard(locale)
      : buildBackHomeKeyboard(locale);
    await ctx.reply(t("error.details", locale).replace("{error}", escapeHtml(errorText)), {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  } catch {}
});

export async function botStart() {
  botInstance.start();
  log.info("---Bot started---");
}
