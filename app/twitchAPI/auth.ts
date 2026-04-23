import { CLIENT_ID, CLIENT_SECRET, setAppToken, TWITCH_OAUTH } from "../config";

async function getAppToken() {
  const res = await fetch(TWITCH_OAUTH + "/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error("Failed to get App Access Token: " + data.message);
  }

  await setAppToken(data.access_token);
  console.log("App Access Token received successfully");
}

export { getAppToken };
