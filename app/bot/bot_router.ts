import { Composer } from "grammy";
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
  buildHomeKeyboard,
  addConfirmationKeyboard,
  removeConfirmationKeyboard,
  buildAdminKeyboard,
  platformSelectKeyboard,
  removePlatformSelecteKeyboard,
  adminBackKeyboard,
  broadcastConfirmKeyboard,
  backHomeKeyboard,
  mySubscriptionsAddBackKeyboard,
} from "./keyboards";
import { extractUsernameFromTwitchUrl } from "../utils/urlParser";
import { MyContext } from "./bot";
import { getKickChannelByUsername } from "../kickAPI/users";
import { Channel, UserFollow } from "../database/schema";

const log = logger.getSubLogger({ name: "bot:router" });

export const router = new Composer<MyContext>();

router.command("start", async (ctx) => {
  let message = `🏠 <b>TwNotifier</b>\n`
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`
  message += `Бот для отслеживания стримов\n\n`
  message += `📌 <b>Команды:</b>\n`
  message += `• /add канал — добавить канал\n`
  message += `• /remove канал — удалить канал\n`
  message += `• /list — мои подписки`
  ctx.reply(message, { reply_markup: await buildHomeKeyboard(ctx.from?.id!), parse_mode: "HTML" });
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
    return ctx.reply("📭 <b>Нет подписок</b>\n\nВы пока не отслеживаете ни одного канала.", { parse_mode: "HTML" });
  }
  const total = kickFollows.length + twitchFollows.length
  let reply_text = `📊 <b>Мои подписки</b>\n`
  reply_text += `━━━━━━━━━━━━━━━━━━━━\n`
  reply_text += `Всего: <b>${total}</b>\n`
  if (twitchFollows.length >= 1) {
    reply_text += `\n🟣 <b>Twitch</b>\n`
    for (const sub of twitchFollows) {
        const channel = await getChannelByChannelId(sub.channel_id!);
        reply_text += `   📺 ${channel?.channel_name || `ID:${sub.channel_id}`}\n`
        reply_text += `      📅 ${sub.created.slice(0, 10)}\n`;
    }
  }
  if (kickFollows.length >= 1) {
    reply_text += `\n🟢 <b>Kick</b>\n`
    for (const sub of kickFollows) {
        const channel = await getChannelByChannelId(sub.channel_id!);
        reply_text += `   📺 ${channel?.channel_name || `ID:${sub.channel_id}`}\n`
        reply_text += `      📅 ${sub.created.slice(0, 10)}\n`;
    }
  }

  ctx.reply(reply_text.trimEnd(), {parse_mode: "HTML", reply_markup: backHomeKeyboard});
});

router.command("admin", async (ctx) => {
  const user = await getUserByUserId(ctx.from?.id!)
  if (!user?.is_admin) {
    ctx.reply("🚫 <b>Доступ запрещён</b>\n\nДанная команда доступна только администраторам.", {parse_mode: "HTML"})
    return
  }
  ctx.session.adminLogin = {
    signed_in: true
  }
  log.warn(`${ctx.from?.id!} enter admin system`)
  const firstName = ctx.from?.first_name || "Admin"
  let message = `🛡️ <b>Панель управления</b>\n`
  message += `━━━━━━━━━━━━━━━━━━━━\n`
  message += `Добро пожаловать, ${firstName}!\n\n`
  message += `Выберите раздел для управления:`
  ctx.reply(message, {reply_markup: buildAdminKeyboard(), parse_mode: "HTML"})
})

router.command("becomeAdmin", async (ctx) => {
  const user = await getUserByUserId(ctx.from?.id!)
  if (user?.is_admin) {
    return ctx.reply("ℹ️ <b>Вы уже администратор</b>\n\nИспользуйте /admin для входа в панель.", {parse_mode: "HTML"})
  }
  const key = ctx.match.trim();
  if (!key) {
    return
  }
  const user_id = ctx.from?.id!
  const updatedUser = await makeUserAdmin(user_id, key)
  if (updatedUser) {
    log.warn(`User ${user_id} become admin with ${key}`)
    let message = `✅ <b>Админ-ключ активирован</b>\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`
    message += `Вы успешно получили права администратора.\n\n`
    message += `📌 Используйте /admin для входа в панель управления.`
    return ctx.reply(message, {parse_mode: "HTML"})
  }
})

router.command("weblogin", async (ctx) => {
  const user = await getUserByUserId(ctx.from?.id!)
  if (!user?.is_admin) {
    return ctx.reply("🚫 <b>Доступ запрещён</b>\n\nДанная команда доступна только администраторам.", {parse_mode: "HTML"})
  }
  const { generateLoginCode } = await import("../handlers/auth_api")
  const code = await generateLoginCode(ctx.from?.id!)
  log.warn(`${ctx.from?.id} requested web login code`)
  let message = `🔐 <b>Код для входа</b>\n`
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`
  message += `<code>${code}</code>\n\n`
  message += `⏳ Код действителен 5 минут\n`
  message += `📌 Введите его в панели администратора`
  ctx.reply(message, {parse_mode: "HTML"})
})

router.on("message", async (ctx, next) => {
  if (ctx.session.awaitingAddInput && ctx.message.text) {
    ctx.session.awaitingAddInput = undefined;
    const input = ctx.message.text.trim();

    const extractedUsername = extractUsernameFromTwitchUrl(input);
    if (!extractedUsername) {
      return ctx.reply(
        "Не удалось извлечь имя пользователя из URL. Убедитесь, что это корректная ссылка Twitch или имя пользователя.",
        { reply_markup: mySubscriptionsAddBackKeyboard },
      );
    }

    const channel_name_lower = extractedUsername.toLowerCase();
    const twitchChannel = await getUserByLogin(channel_name_lower);
    const kickChannel = await getKickChannelByUsername(channel_name_lower);
    if (!(twitchChannel || kickChannel)) {
      return ctx.reply("Канал с таким именем не найден", { reply_markup: mySubscriptionsAddBackKeyboard });
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

      return ctx.reply(message, { reply_markup: platformSelectKeyboard })
    }

    if (kickChannel.data[0]) {
      const channel_id = Number(kickChannel.data[0].broadcaster_user_id);
      const display_name = kickChannel.data[0].slug;

      if (!ctx.from) {
        return ctx.reply("Ошибка: не удалось определить пользователя");
      }

      if (await getFollowByUserIdAndChannelId(ctx.from.id, channel_id)) {
        return ctx.reply(`Вы уже отслеживаете ${display_name}`, { reply_markup: mySubscriptionsAddBackKeyboard });
      }

      ctx.session.pendingAdd = {
        channelId: channel_id,
        channelName: channel_name_lower,
        displayName: display_name,
        platform: "kick"
      };

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
        return ctx.reply(`Вы уже отслеживаете ${display_name}`, { reply_markup: mySubscriptionsAddBackKeyboard });
      }

      ctx.session.pendingAdd = {
        channelId: channel_id,
        channelName: channel_name_lower,
        displayName: display_name,
        platform: "twitch"
      };

      const previewMessage =
        `Вы хотите добавить канал:\n\n` +
        `📺 Имя: ${display_name}\n` +
        `🔗 Ссылка: https://twitch.tv/${display_name}\n\n` +
        `Продолжить добавление?`;

      log.info("showing channel preview", {
        userId: ctx.from.id,
        channel: display_name,
        channelId: channel_id,
        platform: "twitch",
      });

      return await ctx.reply(previewMessage, {
        reply_markup: addConfirmationKeyboard,
      });
    } else {
      return ctx.reply("Канал с таким именем не найден", { reply_markup: mySubscriptionsAddBackKeyboard });
    }
  }

  if (ctx.session.awaitingRemoveInput && ctx.message.text) {
    ctx.session.awaitingRemoveInput = undefined;
    const input = ctx.message.text.trim();

    const extractedUsername = extractUsernameFromTwitchUrl(input);
    if (!extractedUsername) {
      return ctx.reply(
        "Не удалось извлечь имя пользователя из URL. Убедитесь, что это корректная ссылка Twitch или имя пользователя.",
        { reply_markup: mySubscriptionsAddBackKeyboard },
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
      return ctx.reply("Канал с таким именем не найден", { reply_markup: mySubscriptionsAddBackKeyboard });
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
      return ctx.reply("Вы не подписанны на этот канал", { reply_markup: mySubscriptionsAddBackKeyboard });
    }

    if (usernameChannels.length < 1) {
      return ctx.reply("Канал с таким именем не найден", { reply_markup: mySubscriptionsAddBackKeyboard });
    }

    if (usernameChannels.length > 1 && bothFollow) {
      if (!kickChannel || !twitchChannel) {
        return ctx.reply("Канал с таким именем не найден", { reply_markup: mySubscriptionsAddBackKeyboard });
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
      return ctx.reply(`Вы не подписаны на ${display_name}`, { reply_markup: mySubscriptionsAddBackKeyboard });
    }

    ctx.session.pendingRemove = {
      channelId: channel_id,
      channelName: channel_name_lower,
      displayName: display_name,
      platform: channelPlatform,
    };

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
    return;
  }

  return next();
});

router.on("message", async (ctx) => {
  if (!ctx.session.adminLogin || !ctx.session.broadcastPending) {
    return;
  }

  ctx.session.broadcastPending = undefined;

  const text = ctx.message?.text;
  const photo = ctx.message?.photo;
  const caption = ctx.message?.caption;

  if (!text && (!photo || photo.length === 0)) {
    let errorMessage = `⚠️ *Ошибка формата*\n`
    errorMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
    errorMessage += `Не удалось распознать сообщение.\n\n`
    errorMessage += `📝 Отправьте текст или фото.`
    return ctx.reply(errorMessage, { reply_markup: adminBackKeyboard, parse_mode: "Markdown" });
  }

  const photoFileId = photo && photo.length > 0 ? photo[photo.length - 1].file_id : undefined;
  const messageText = text || caption;

  ctx.session.broadcastMessage = { text: messageText, photoFileId };

  let preview = `📨 *Предпросмотр рассылки*\n`
  preview += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  if (messageText) {
    preview += messageText.length > 500 ? messageText.slice(0, 500) + "..." : messageText;
  }
  if (photoFileId) {
    preview += messageText ? "\n\n📷 Фото" : "📷 Фото";
  }
  preview += `\n\n━━━━━━━━━━━━━━━━━━━━\n`;
  preview += `Подтвердите отправку или отмените.`

  await ctx.reply(preview, { reply_markup: broadcastConfirmKeyboard, parse_mode: "Markdown" });
});
