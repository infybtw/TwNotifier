import { APP_TOKEN, CLIENT_ID, setConduitId, TWITCH_HELIX } from "../config";

const CONDUIT_URL: string = TWITCH_HELIX + "/helix/eventsub/conduits";

export async function getConduits() {
  const res = await fetch(CONDUIT_URL, {
    method: "GET",
    headers: {
      "Client-ID": CLIENT_ID,
      Authorization: `Bearer ${APP_TOKEN}`,
    },
  });

  if (!res.ok) {
    console.error("Failed to get conduits: ", await res.text());
    return;
  }

  const json = await res.json();
  const conduits = json.data || [];

  if (conduits.length === 0) {
    console.log("Conduits not found");
    return;
  }

  console.log(`${conduits.length} conduits found`);

  return conduits;
}

export async function deleteAllConduits(conduits: any) {
  try {
    for (const conduit of conduits) {
      const id = conduit.id;
      const res = await fetch(`${CONDUIT_URL}?id=${id}`, {
        method: "DELETE",
        headers: {
          "Client-ID": CLIENT_ID,
          Authorization: `Bearer ${APP_TOKEN}`,
        },
      });

      if (res.status === 204) {
        console.log(`Conduits ${id} deleted`);
      } else {
        console.log(`Failed to delete conduit: ${id}. Status: ${res.status}`);
      }
    }

    await new Promise((r) => setTimeout(r, 1000));

    console.log(`${conduits.length} conduits deleted`);
  } catch (err) {
    console.error("Failed to delete conduits:", err);
  }
}

export async function createConduit(shardCount: any) {
  const res = await fetch(CONDUIT_URL, {
    method: "POST",
    headers: {
      "Client-ID": CLIENT_ID,
      Authorization: `Bearer ${APP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ shard_count: shardCount }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Failed to create conduit: ${data.message}`);

  await setConduitId(data.data[0].id);
  console.log("Conduit created successfully");
}
