import { updateShard } from "../twitchAPI/shards";
import { sendChatMessage } from "../twitchAPI/sendMessage";
import { BOT_USER_ID } from "../config";
import { handleCommand } from "./commands";

export async function onSessionWelcome(sessionId: any) {
  console.log("Session ID: ", sessionId);
  await updateShard(sessionId, "0");
}

export async function onNotification(payload: any) {
  const type: string = payload.subscription.type;
  const event = payload.event;
  switch (type) {
    case "channel.chat.message":
      const chatterId: string = event.chatter_user_id;
      const chatterUsername: string = event.chatter_user_name;
      const message_text: string = event.message.text;
      const broadcasterId: string = event.broadcaster_user_id;
      const broadcasterUsername: string = event.broadcaster_user_name;
      if (chatterId == BOT_USER_ID) {
        break;
      }
      console.log(
        `[${broadcasterUsername}]${chatterUsername}: ${message_text}`,
      );
      if (message_text.startsWith("!")) {
        await handleCommand(message_text, event);
        return;
      }
      await sendChatMessage(
        "Hello World!",
        broadcasterId,
        broadcasterUsername,
        null,
      );
  }
}
