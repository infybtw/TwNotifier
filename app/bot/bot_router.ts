import { Composer } from "grammy";
import logger from "../logger";
import {
  addChannel,
  addFollow,
  addUser,
  addUserSettings,
  channelExists,
  followExists,
  getFollowList,
  removeFollow,
  userExists,
  updateChannelName,
} from "../database/db";
import { getUserByLogin } from "../twitchAPI/users";
import {
  subscribeToChannelOffline,
  subscribeToChannelOnline,
} from "../twitchAPI/subscriptions";
import { homePageKeyboard } from "./keyboards";

const log = logger.getSubLogger({ name: "bot:router" });

export const router = new Composer();

router.command("start", async (ctx) => {
  ctx.reply(
    "Добро пожаловать в TwNotifier\n\nИспользование:\n/add <канал> - Добавить канал\n/remove <канал> - Удалить канал из отслеживаемых\n/list - Список моих каналов",
    { reply_markup: homePageKeyboard },
  );
  //@ts-ignore
  if (!userExists.get(ctx.message?.from.id)) {
    const now = new Date().toISOString();
    //@ts-ignore
    addUser.get(ctx.message?.from.id, now);
    //@ts-ignore
    addUserSettings.get(ctx.message?.from.id);
    log.info("user registered", { userId: ctx.message?.from.id });
  } else {
    log.info("used /start", { userId: ctx.message?.from.id });
  }
});

router.command("add", async (ctx) => {
  const channel_name = ctx.match.trim();

  if (!channel_name) {
    return ctx.reply("Неверный формат, Пример использования: /add xqc");
  }

  const channel_name_lower = channel_name.toLowerCase();
  const user = await getUserByLogin(channel_name_lower);
  if (!user) {
    return ctx.reply("Канал с таким именем не най��ен");
  }
  const channel_id = Number(user.id);
  const display_name = user.display_name;
  if (!channelExists.get(channel_id)) {
    addChannel.get(channel_id, display_name);
    log.info("new channel added", {
      channel_id: channel_id,
      channel_name: display_name,
    });
  } else {
    const current_name = channelExists.get(channel_id)?.channel_name;
    if (current_name !== display_name) {
      updateChannelName.run(display_name, channel_id);
    }
  }
  if (followExists.get(ctx.from.id, channel_id)) {
    return ctx.reply(`Вы уже отслеживаете ${display_name}`);
  }
  const now = new Date().toISOString();
  addFollow.get(ctx.from.id, channel_id, now);
  const subOnlineResCode = await subscribeToChannelOnline(
    channel_id,
    display_name || channel_name_lower,
  );
  if (subOnlineResCode < 0) {
    log.error("subscribe error", { subResponseCode: subOnlineResCode });
    ctx.reply(
      "Ошибка подписки, попробуйте позже или обратитесь в тех.поддержку.",
    );
    return;
  }
  const subOfflineResCode = await subscribeToChannelOffline(
    channel_id,
    display_name || channel_name_lower,
  );
  if (subOfflineResCode < 0) {
    log.error("subscribe error", { subResponseCode: subOfflineResCode });
    ctx.reply(
      "Ошибка подписки, попробуйте позже или обратитесь в тех.поддержку.",
    );
    return;
  }
  ctx.reply(`Готово! Теперь вы отслеживаете ${display_name}`);
  log.info("new follow", {
    userId: ctx.from.id,
    channel: display_name,
  });
});

router.command("remove", async (ctx) => {
  const channel_name = ctx.match.trim();

  if (!channel_name) {
    return ctx.reply("Неверный формат, Пример использования: /remove xqc");
  }
  const user = await getUserByLogin(channel_name.toLowerCase());
  if (!user) {
    return ctx.reply("Канал с таким именем не найден");
  }
  const channel_id = Number(user.id);
  //@ts-ignore
  if (!followExists.get(ctx.from.id, channel_id)) {
    ctx.reply(`Вы не подписаны на ${channel_name}`);
  } else {
    //@ts-ignore
    removeFollow.get(ctx.from.id, channel_id);
    ctx.reply(`Вы больше не отслеживаете ${channel_name}`);
  }
});

router.command("list", async (ctx) => {
  //@ts-ignore
  const follows = getFollowList.all(ctx.message?.from.id);
  if (follows.length < 1) {
    return ctx.reply("У вас пока нет подписок");
  }
  let reply_text = "Ваши подписки:\n";
  for (const sub of follows) {
    const channel = channelExists.get(sub.channel_id);
    reply_text += `${channel?.channel_name || `ID:${sub.channel_id}`} - c ${sub.created.slice(0, 10)}\n`;
  }
  ctx.reply(reply_text);
});
