import { KICK_CLIENT_ID, KICK_CLIENT_SECRET, KICK_OAUTH, setKickAppToken} from "../config";

export async function getKickAppToken() {
  const res = await fetch(KICK_OAUTH + "/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: KICK_CLIENT_ID,
      client_secret: KICK_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error("Failed to get App Access Token: " + data.message);
  }

  await setKickAppToken(data.access_token);
  console.log("Kick App Access Token received successfully");
}
