import { sendChatMessage } from "../twitchAPI/sendMessage";

const CUSTOM_COMMANDS = {
  "!discord": "🎮 Наш Discord: discord.gg/example",
  "!donate": "💰 Поддержать стрим: donate.stream/example",
};
async function getCommand(command: string): Promise<string> {
  if (command in CUSTOM_COMMANDS) {
    return CUSTOM_COMMANDS[command as keyof typeof CUSTOM_COMMANDS];
  }
  return "Unknown";
}

export async function handleCommand(commandText: string, event: any) {
  if (!commandText.startsWith("!")) return;

  const parts = commandText.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  const broadcasterId: string = event.broadcaster_user_id;
  const broadcasterUsername: string = event.broadcaster_user_name;

  switch (cmd) {
    case "!ping":
      return sendChatMessage(
        `Pong @${event.chatter_user_name}`,
        broadcasterId,
        broadcasterUsername,
      );

    default:
      const commandReply: string = await getCommand(cmd);
      if (commandReply === "Unknown") {
        return;
      } else {
        return sendChatMessage(
          `@${event.chatter_user_name}, ${commandReply}`,
          broadcasterId,
          broadcasterUsername,
        );
      }
  }
}
