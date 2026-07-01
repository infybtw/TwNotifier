import { Composer } from "grammy";
import { InlineKeyboard } from "grammy";
import logger from "../logger";
import {
  checkOrCreateUser,
  getChannelByChannelId,
  getChannelsByUsername,
  getFollowByUserIdAndChannelId,
  getFollowByUserIdChannelIdAndPlatform,
  getFollowsByUserId,
  getFollowsByUserIdAndPlatform,
  getUserByUserId,
  makeUserAdmin
} from "../database/db";
import { getUserByLogin } from "../twitchAPI/users";
import {
  homePageKeyboard,
  addConfirmationKeyboard,
  removeConfirmationKeyboard,
  adminKeyboard,
  platformSelectKeyboard,
  removePlatformSelecteKeyboard,
} from "./keyboards";
import { extractUsernameFromTwitchUrl } from "../utils/urlParser";
import { MyContext } from "./bot";
import { getKickChannelByUsername } from "../kickAPI/users";
import { sleep } from "bun";
import { Channel, UserFollow } from "../database/schema";

const log = logger.getSubLogger({ name: "bot:router" });

export const router = new Composer<MyContext>();

router.command("start", async (ctx) => {
  ctx.reply(
    "Добро пожаловать в TwNotifier\n\nИспользование:\n/add <канал> - Добавить канал (можно использовать имя или URL Twitch)\n/remove <канал> - Удалить канал из отслеживаемых\n/list - Список моих каналов",
    { reply_markup: homePageKeyboard },
  );
  const newUser = await checkOrCreateUser(ctx.from?.id!, ctx.from?.username!, ctx.from?.first_name!)
  if (!newUser) {
    ctx.reply("Упс, произошла ошибка при регистрации, пожалуйста обратитесь в поддержку")
  } else if(!newUser.isNew) {
    log.info("used /start", { userId: ctx.message?.from.id, username: ctx.from?.username, first_name: ctx.from?.first_name});
  } else if (newUser.isNew) {
    log.info("user registered", { userId: ctx.message?.from.id, username: ctx.from?.username, first_name: ctx.from?.first_name });
  }
});

router.command("add", async (ctx) => {
  const input = ctx.match.trim();

  if (!input) {
    return ctx.reply(
      "Неверный формат, Пример использования: /add xqc или /add https://twitch.tv/xqc",
    );
  }

  const extractedUsername = extractUsernameFromTwitchUrl(input);
  if (!extractedUsername) {
    return ctx.reply(
      "Не удалось извлечь имя пользователя из URL. Убедитесь, что это корректная ссылка Twitch или имя пользователя.",
    );
  }

  const channel_name_lower = extractedUsername.toLowerCase();
  const twitchChannel = await getUserByLogin(channel_name_lower);
  const kickChannel = await getKickChannelByUsername(channel_name_lower);
  if (!(twitchChannel || kickChannel)) {
    return ctx.reply("Канал с таким именем не найден");
  }

  if (kickChannel.data[0] && twitchChannel) {
    ctx.session.pendingPlatformSelect = {
      kickData: kickChannel,
      twitchData: twitchChannel,
    }

    const message = `Канал с таким именем найден на 2 платформах.\n` +
      `https://kick.com/${channel_name_lower}\n` +
      `https://twitch.tv/${channel_name_lower}\n\n` +
      `Выберите платформу для подписки:`

    return ctx.reply(message ,{reply_markup: platformSelectKeyboard})
  }
  let platform = ""
  if (kickChannel.data[0]) {
    const channel_id = Number(kickChannel.data[0].broadcaster_user_id);
    const display_name = kickChannel.data[0].slug;

    if (!ctx.from) {
      return ctx.reply("Ошибка: не удалось определить пользователя");
    }

    if (await getFollowByUserIdAndChannelId(ctx.from.id, channel_id)) {
      return ctx.reply(`Вы уже отслеживаете ${display_name}`);
    }

    // Store pending channel in session
    ctx.session.pendingAdd = {
      channelId: channel_id,
      channelName: channel_name_lower,
      displayName: display_name,
      platform: "kick"
    };

    // Show preview with confirmation buttons
    const previewMessage =
      `Вы хотите добавить канал:\n\n` +
      `📺 Имя: ${display_name}\n` +
      `🔗 Ссылка: https://kick.com/${display_name}\n\n` +
      `Продолжить добавление?`;

    log.info("showing channel preview", {
      userId: ctx.from.id,
      channel: display_name,
      channelId: channel_id,
      platform: "kick"
    });

    return await ctx.reply(previewMessage, {
      reply_markup: addConfirmationKeyboard,
    });
  } else if (twitchChannel) {


      const channel_id = Number(twitchChannel!.id);
      const display_name = twitchChannel!.display_name;

      if (!ctx.from) {
        return ctx.reply("Ошибка: не удалось определить пользователя");
      }

      if (await getFollowByUserIdAndChannelId(ctx.from.id, channel_id)) {
        return ctx.reply(`Вы уже отслеживаете ${display_name}`);
      }

      // Store pending channel in session
      ctx.session.pendingAdd = {
        channelId: channel_id,
        channelName: channel_name_lower,
        displayName: display_name,
        platform: "twitch"
      };

      // Show preview with confirmation buttons
      const previewMessage =
        `Вы хотите добавить канал:\n\n` +
        `📺 Имя: ${display_name}\n` +
        `🔗 Ссылка: https://twitch.tv/${display_name}\n\n` +
        `Продолжить добавление?`;

      await ctx.reply(previewMessage, {
        reply_markup: addConfirmationKeyboard,
      });

      log.info("showing channel preview", {
        userId: ctx.from.id,
        channel: display_name,
        channelId: channel_id,
        platform: "twitch",
      });
  } else {
    return ctx.reply("Канал с таким именем не найден")
  }

});

router.command("remove", async (ctx) => {
  const input = ctx.match.trim();

  if (!input) {
    return ctx.reply(
      "Неверный формат, Пример использования: /remove xqc или /remove https://twitch.tv/xqc",
    );
  }

  const extractedUsername = extractUsernameFromTwitchUrl(input);
  if (!extractedUsername) {
    return ctx.reply(
      "Не удалось извлечь имя пользователя из URL. Убедитесь, что это корректная ссылка Twitch или имя пользователя.",
    );
  }

  if (!ctx.from) {
    return ctx.reply("Ошибка: не удалось определить пользователя");
  }

  const channel_name_lower = extractedUsername.toLowerCase();
  const usernameChannels = await getChannelsByUsername(channel_name_lower)

  const kickChannel = usernameChannels.find(ch => ch.platform === "kick")
  const twitchChannel = usernameChannels.find(ch => ch.platform === "twitch")

  if (!kickChannel && !twitchChannel) {
    return ctx.reply("Канал с таким именем не найден");
  }

  const kickFollow = kickChannel ? await getFollowByUserIdChannelIdAndPlatform(ctx.from?.id, kickChannel.channel_id!, "kick") : undefined
  const twitchFollow = twitchChannel ? await getFollowByUserIdChannelIdAndPlatform(ctx.from?.id, twitchChannel.channel_id!, "twitch") : undefined

  let bothFollow: boolean = false
  let follow: UserFollow
  let channel: Channel

  if (kickFollow && twitchFollow) {
    bothFollow = true
  } else if (kickFollow || twitchFollow){
    if (kickFollow) {
      follow = kickFollow
      channel = kickChannel!
    } else {
      follow = twitchFollow!
      channel = twitchChannel!
    }
  } else {
    return ctx.reply("Вы не подписанны на этот канал")
  }

  if (usernameChannels.length < 1) {
    return ctx.reply("Канал с таким именем не найден");
  }

  if (usernameChannels.length > 1 && bothFollow) {
    if (!kickChannel || !twitchChannel) {
      return ctx.reply("Канал с таким именем не найден")
    } else {
      const message = `Канал с таким именем найден на 2 платформах.\n` +
        `https://kick.com/${channel_name_lower}\n` +
        `https://twitch.tv/${channel_name_lower}\n\n` +
        `Выберите платформу для удаления:`

      ctx.session.removePendingPlatformSelect = {
        kickChannel,
        twitchChannel,
      }
      return ctx.reply(message, { reply_markup: removePlatformSelecteKeyboard })
    }
  }

  const channelPlatform = follow!.platform === "twitch" ? "twitch" : "kick";
  const channelPlatformUrl = follow!.platform === "twitch" ? "twitch.tv" : "kick.com";

  const channel_id = Number(channel!.channel_id);
  const display_name = channel!.channel_name || extractedUsername;



  if (!(await getFollowByUserIdChannelIdAndPlatform(ctx.from.id, channel_id, channelPlatform))) {
    return ctx.reply(`Вы не подписаны на ${display_name}`);
  }

  ctx.session.pendingRemove = {
    channelId: channel_id,
    channelName: channel_name_lower,
    displayName: display_name,
    platform: channelPlatform,
  };

  // Show preview with confirmation buttons
  const previewMessage =
    `Вы хотите удалить канал из отслеживаемых:\n\n` +
    `📺 Имя: ${display_name}\n` +
    `🔗 Ссылка: https://${channelPlatformUrl}/${channel_name_lower}\n\n` +
    `Подтвердите удаление?`;

  await ctx.reply(previewMessage, {
    reply_markup: removeConfirmationKeyboard,
  });

  log.info("showing remove preview", {
    userId: ctx.from.id,
    channel: display_name,
    channelId: channel_id,
  });
});

router.command("list", async (ctx) => {
  const user_id = ctx.from?.id
  const kickFollows = await getFollowsByUserIdAndPlatform(user_id!, "kick")
  const twitchFollows = await getFollowsByUserIdAndPlatform(user_id!, "twitch")
  if (kickFollows.length < 1 && twitchFollows.length < 1) {
    return ctx.reply("У вас пока нет подписок");
  }
  let reply_text = "Ваши подписки:\n";
  if (kickFollows.length >= 1) {
    reply_text += "\n<b>Kick:</b>\n"
    for (const sub of kickFollows) {
        const channel = await getChannelByChannelId(sub.channel_id!);
        reply_text += `${channel?.channel_name || `ID:${sub.channel_id}`} - c ${sub.created.slice(0, 10)}\n`;
    }
  }
  if (twitchFollows.length >= 1) {
    reply_text += "\nTwitch:\n"
    for (const sub of twitchFollows) {
        const channel = await getChannelByChannelId(sub.channel_id!);
        reply_text += `${channel?.channel_name || `ID:${sub.channel_id}`} - c ${sub.created.slice(0, 10)}\n`;
    }
  }

  ctx.reply(reply_text, {parse_mode: "HTML"});
});

router.command("admin", async (ctx) => {
  const user = await getUserByUserId(ctx.from?.id!)
  if (!user?.is_admin) {
    ctx.reply("Данная команда доступна только админам")
    return
  }
  ctx.session.adminLogin = {
    signed_in: true
  }
  log.warn(`${ctx.from?.id!} enter admin system`)
  ctx.reply("Вы вошли в систему администрирования", {reply_markup: adminKeyboard})
})

router.command("becomeAdmin", async (ctx) => {
  const user = await getUserByUserId(ctx.from?.id!)
  if (user?.is_admin) {
    return ctx.reply("Вы уже админ")
  }
  const key = ctx.match.trim();
  if (!key) {
    return
  }
  const user_id = ctx.from?.id!
  const updatedUser = await makeUserAdmin(user_id, key)
  if (updatedUser) {
    log.warn(`User ${user_id} become admin with ${key}`)
    return ctx.reply("Вы успешно использовали Админ-Ключ\nДля входа используйте /admin")
  }
})
