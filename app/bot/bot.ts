import { Bot, Context, session, SessionFlavor } from "grammy";
import { BOT_TOKEN } from "../config";
import { router as mRouter } from "./bot_router";
import { router as cRouter } from "./bot_callback_handler";
import logger from "../logger";

const log = logger.getSubLogger({ name: "bot" });

export const botInstance = new Bot(BOT_TOKEN);
botInstance.use(mRouter);
botInstance.use(cRouter);

export async function botStart() {
  botInstance.start();
  log.info("---Bot started---");
}
