import { APP_TOKEN, CLIENT_ID } from "../config";

async function getUserId(login: string) {
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
    console.log("Broadcaster found!");
    console.log("Broadcaster ID: " + data.data[0].id);
    return data.data[0].id;
  } else {
    console.log("Broadcaster not found!");
    return -1;
  }
}

export { getUserId };
