import { InlineKeyboard } from "grammy";

export const homePageKeyboard = new InlineKeyboard()
  .text("Добавить канал", "addchannelCMD")
  .text("Мои каналы", "mychannelsCMD")
  .text("Инфо", "infoCMD");
