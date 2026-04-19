import { BOT_USER_ID, CLIENT_ID } from "../config";

export async function sendChatMessage(
  text: string,
  broadcasterId: string,
  broadcasterUsername: string,
  replyMessageId: string | null = null,
) {
  const body = {
    broadcaster_id: broadcasterId,
    sender_id: BOT_USER_ID,
    message: text,
    ...(replyMessageId ? { reply_parent_message_id: replyMessageId } : {}),
  };

  const res = await fetch("https://api.twitch.tv/helix/chat/messages", {
    method: "POST",
    headers: {
      "Client-ID": CLIENT_ID,
      Authorization: `Bearer -1`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`Failed to send chat message: ${await res.text()}`);
  } else {
    console.log(`[${broadcasterUsername}]BOT: ${text}`);
  }
}
