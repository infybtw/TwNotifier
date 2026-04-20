import { Bot, Context, session, SessionFlavor } from "grammy";
import { BOT_TOKEN } from "../config";
import { router } from "./bot_router";
import logger from "../logger";

const log = logger.getSubLogger({ name: "bot" });

export const botInstance = new Bot(BOT_TOKEN);
botInstance.use(router);

export async function botStart() {
  botInstance.start();
  log.info("---Bot started---");
}
