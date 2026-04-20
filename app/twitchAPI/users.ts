import { APP_TOKEN, CLIENT_ID } from "../config";
import logger from "../logger";

const log = logger.getSubLogger({ name: "twitchAPI:users" });

async function getUserId(login: string): Promise<number> {
  const url = new URL("https://api.twitch.tv/helix/users");
  url.searchParams.set("login", login);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${APP_TOKEN}`,
      "Client-Id": CLIENT_ID,
    },
  });

  const data = await res.json();
  if (res.status === 200) {
    try {
      const broadcaster_id = data.data[0].id;
      return data.data[0].id;
    } catch (err) {
      return -1;
    }
  } else {
    console.log("Broadcaster not found!");
    return -1;
  }
}

export { getUserId };
