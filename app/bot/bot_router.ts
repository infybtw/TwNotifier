import { Composer } from "grammy";
import logger from "../logger";
import {
  addChannel,
  addFollow,
  addUser,
  channelExists,
  followExists,
  getFollowList,
  removeFollow,
  userExists,
} from "../database/db";
import { getUserId } from "../twitchAPI/users";
import {
  subscribeToChannelOffline,
  subscribeToChannelOnline,
} from "../twitchAPI/subscriptions";

const log = logger.getSubLogger({ name: "bot:router" });

export const router = new Composer();

router.command("start", async (ctx) => {
  ctx.reply(
    "Добро пожаловать в TwNotifier\n\nИспользование:\n/add <канал> - Добавить канал\n/remove <канал> - Удалить канал из отслеживаемых\n/list - Список моих каналов",
  );
  //@ts-ignore
  if (!userExists.get(ctx.message?.from.id)) {
    const now = new Date().toISOString();
    //@ts-ignore
    addUser.get(ctx.message?.from.id, now);
    log.info("user registered", { userId: ctx.message?.from.id });
  } else {
    log.info("used /start", { userId: ctx.message?.from.id });
  }
});

router.command("add", async (ctx) => {
  const channel_name = ctx.match;

  if (!channel_name) {
    return ctx.reply("Неверный формат\nПример использования: /add xqc");
  }

  const channel_id = Number(await getUserId(channel_name));
  if (channel_id <= -1) {
    log.info("channel not found", {
      user_id: ctx.message?.from.id,
      broadcaster_login: channel_name,
    });
    return ctx.reply("Канал с таким именем не найден");
  }
  //@ts-ignore
  if (followExists.get(ctx.message?.from.id, channel_id)) {
    return ctx.reply(`Вы уже отслеживаете ${channel_name}`);
  }
  if (!channelExists.get(channel_id)) {
    addChannel.get(channel_id, channel_name);
    log.info("new channel", {
      channel_name: channel_name,
      channel_id: channel_id,
    });
  }
  const now = new Date().toISOString();
  //@ts-ignore
  addFollow.get(ctx.message?.from.id, channel_id, now);
  const subOnlineResCode = await subscribeToChannelOnline(
    channel_id,
    channel_name,
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
    channel_name,
  );
  if (subOfflineResCode < 0) {
    log.error("subscribe error", { subResponseCode: subOfflineResCode });
    ctx.reply(
      "Ошибка подписки, попробуйте позже или обратитесь в тех.поддержку.",
    );
    return;
  }
  ctx.reply(`Готово! Теперь вы отслеживаете ${channel_name}`);
  log.info("new follow", {
    userId: ctx.message?.from.id,
    channel: channel_name,
  });
});

router.command("remove", async (ctx) => {
  const channel_name = ctx.match;

  if (!channel_name) {
    return ctx.reply("Неверный формат\nПример использования: /remove xqc");
  }
  const channel_id = Number(await getUserId(channel_name));
  //@ts-ignore
  if (!followExists.get(ctx.message?.from.id, channel_id)) {
    ctx.reply(`Вы не подписаны на ${channel_name}`);
  } else {
    //@ts-ignore
    removeFollow.get(ctx.message?.from.id, channel_id);
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
    const channel_name = channelExists.get(sub.channel_id)?.channel_name;
    reply_text += `${channel_name} - c ${sub.created.slice(0, 10)}\n`;
  }
  ctx.reply(reply_text);
});
