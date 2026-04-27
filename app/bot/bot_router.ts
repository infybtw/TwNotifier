import { Composer } from "grammy";
import { InlineKeyboard } from "grammy";
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
import { homePageKeyboard, addConfirmationKeyboard, removeConfirmationKeyboard } from "./keyboards";
import { extractUsernameFromTwitchUrl } from "../utils/urlParser";
import { MyContext } from "./bot";

const log = logger.getSubLogger({ name: "bot:router" });

export const router = new Composer<MyContext>();

router.command("start", async (ctx) => {
  ctx.reply(
    "Добро пожаловать в TwNotifier\n\nИспользование:\n/add <канал> - Добавить канал (можно использовать имя или URL Twitch)\n/remove <канал> - Удалить канал из отслеживаемых\n/list - Список моих каналов",
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
  const input = ctx.match.trim();

  if (!input) {
    return ctx.reply("Неверный формат, Пример использования: /add xqc или /add https://twitch.tv/xqc");
  }

  const extractedUsername = extractUsernameFromTwitchUrl(input);
  if (!extractedUsername) {
    return ctx.reply("Не удалось извлечь имя пользователя из URL. Убедитесь, что это корректная ссылка Twitch или имя пользователя.");
  }

  const channel_name_lower = extractedUsername.toLowerCase();
  const user = await getUserByLogin(channel_name_lower);
  if (!user) {
    return ctx.reply("Канал с таким именем не найден");
  }
  
  const channel_id = Number(user.id);
  const display_name = user.display_name;
  
  if (!ctx.from) {
    return ctx.reply("Ошибка: не удалось определить пользователя");
  }
  
  // Check if already following
  if (followExists.get(ctx.from.id, channel_id)) {
    return ctx.reply(`Вы уже отслеживаете ${display_name}`);
  }
  
  // Store pending channel in session
  ctx.session.pendingAdd = {
    channelId: channel_id,
    channelName: channel_name_lower,
    displayName: display_name
  };
  
  // Show preview with confirmation buttons
  const previewMessage = `Вы хотите добавить канал:\n\n` +
    `📺 Имя: ${display_name}\n` +
    `🔗 Ссылка: https://twitch.tv/${channel_name_lower}\n\n` +
    `Продолжить добавление?`;
    
  await ctx.reply(previewMessage, {
    reply_markup: addConfirmationKeyboard,
  });
  
  log.info("showing channel preview", {
    userId: ctx.from.id,
    channel: display_name,
    channelId: channel_id
  });
});

router.command("remove", async (ctx) => {
  const input = ctx.match.trim();

  if (!input) {
    return ctx.reply("Неверный формат, Пример использования: /remove xqc или /remove https://twitch.tv/xqc");
  }

  const extractedUsername = extractUsernameFromTwitchUrl(input);
  if (!extractedUsername) {
    return ctx.reply("Не удалось извлечь имя пользователя из URL. Убедитесь, что это корректная ссылка Twitch или имя пользователя.");
  }

  const channel_name_lower = extractedUsername.toLowerCase();
  const user = await getUserByLogin(channel_name_lower);
  if (!user) {
    return ctx.reply("Канал с таким именем не найден");
  }
  
  const channel_id = Number(user.id);
  const display_name = user.display_name || extractedUsername;
  
  if (!ctx.from) {
    return ctx.reply("Ошибка: не удалось определить пользователя");
  }
  
  // Check if user is following this channel
  //@ts-ignore
  if (!followExists.get(ctx.from.id, channel_id)) {
    return ctx.reply(`Вы не подписаны на ${display_name}`);
  }
  
  // Store pending removal in session
  ctx.session.pendingRemove = {
    channelId: channel_id,
    channelName: channel_name_lower,
    displayName: display_name
  };
  
  // Show preview with confirmation buttons
  const previewMessage = `Вы хотите удалить канал из отслеживаемых:\n\n` +
    `📺 Имя: ${display_name}\n` +
    `🔗 Ссылка: https://twitch.tv/${channel_name_lower}\n\n` +
    `Подтвердите удаление?`;
    
  await ctx.reply(previewMessage, {
    reply_markup: removeConfirmationKeyboard,
  });
  
  log.info("showing remove preview", {
    userId: ctx.from.id,
    channel: display_name,
    channelId: channel_id
  });
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


