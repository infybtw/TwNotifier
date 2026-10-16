import { APP_TOKEN, CLIENT_ID, CONDUIT_ID, setConduitId, TWITCH_HELIX } from "../config";
import logger from "../logger";
import { getAppToken } from "./auth";

const log = logger.getSubLogger({ name: "twitchAPI:conduits" });

const CONDUIT_URL: string = TWITCH_HELIX + "/helix/eventsub/conduits";
const SHARD_URL: string = TWITCH_HELIX + "/helix/eventsub/conduits/shards";

export interface ConduitShard {
  id: string;
  status: string;
  transport: {
    method: string;
    session_id?: string;
    connected_at?: string;
    disconnected_at?: string;
  };
}

/**
 * Lists the shards of a conduit together with their status and the transport
 * they are currently bound to. Used to detect shards Twitch disabled after a
 * dropped WebSocket session.
 */
export async function getConduitShards(conduitId: string = CONDUIT_ID, retry = true): Promise<ConduitShard[]> {
  const url = new URL(SHARD_URL);
  url.searchParams.set("conduit_id", conduitId);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Client-ID": CLIENT_ID,
      Authorization: `Bearer ${APP_TOKEN}`,
    },
  });

  if (res.status === 401 && retry) {
    // The cached app token no longer works — refresh it and try once more.
    log.warn("conduit shards request unauthorized, refreshing app token", { conduit_id: conduitId });
    await getAppToken();
    return getConduitShards(conduitId, false);
  }

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    log.error("failed to get conduit shards", {
      conduit_id: conduitId,
      status: res.status,
      error_message: data?.message,
    });
    throw new Error(`Failed to get conduit shards: ${data?.message ?? res.status}`);
  }

  return data.data ?? [];
}

export async function getConduits() {
  const res = await fetch(CONDUIT_URL, {
    method: "GET",
    headers: {
      "Client-ID": CLIENT_ID,
      Authorization: `Bearer ${APP_TOKEN}`,
    },
  });

  if (!res.ok) {
    log.error("failed to get conduits", { status: res.status, body: await res.text() });
    return;
  }

  const json = await res.json();
  const conduits = json.data || [];

  if (conduits.length === 0) {
    log.info("no conduits found");
    return;
  }

  log.info("conduits found", { count: conduits.length, conduit_ids: conduits.map((c: any) => c.id) });

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
        log.info("conduit deleted", { conduit_id: id });
      } else {
        log.error("failed to delete conduit", { conduit_id: id, status: res.status });
      }
    }

    await new Promise((r) => setTimeout(r, 1000));

    log.info("duplicate conduits deleted", { count: conduits.length });
  } catch (err) {
    log.error("failed to delete conduits", { error_message: err instanceof Error ? err.message : String(err) });
  }
}

export async function createConduit(shardCount: any) {
  const conduitList = await getConduits();
  if (!conduitList) {
    log.info("no existing conduit, creating a new one", { shard_count: shardCount });
  } else if (conduitList.length > 1) {
    log.warn("multiple conduits found, deleting them before creating a new one", { count: conduitList.length });
    await deleteAllConduits(conduitList);
  } else if (conduitList.length === 1) {
    const conduit_id = conduitList[0].id
    await setConduitId(conduit_id)
    log.info("reusing existing conduit", { conduit_id });
    return
  }
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
  log.info("conduit created", { conduit_id: data.data[0].id, shard_count: shardCount });
}
