import { sleep } from "bun"
import { KICK_APP_TOKEN, KICK_API } from "../config"
import logger from "../logger"
import { getKickAppToken } from "./auth"

const log = logger.getSubLogger({ name: "kickAPI:users"})


export async function getKickChannelByUsername(username: string): Promise<KickChannelResponse> {
  const url = new URL(`${KICK_API}/public/v1/channels`)
  url.searchParams.set("slug", username)

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${KICK_APP_TOKEN}`
    }
  })

  const data: KickChannelResponse = await res.json()

  if (res.status === 200) {
    return data;
  } else if (res.status === 401) {
    log.warn("request failed: unauthorized", {
      status: res.status,
      username: username,
    })
    await getKickAppToken()
    await sleep(10000)
    return getKickChannelByUsername(username)
  } else {
    log.warn("request failed: forbidden" ,{
      status: res.status,
      username: username,
    })
    await sleep(10000)
    return getKickChannelByUsername(username)
  }
}
