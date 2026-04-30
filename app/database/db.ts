import { SQL } from "bun";
import logger from "../logger";

const log = logger.getSubLogger({ name: "database" });

const db: SQL = new SQL(
  "postgres://infydev:infy.dev@localhost:5432/twnotifier",
);

export async function checkDBConnection() {
  try {
    await db`SELECT 1`;
    log.info("✅ Succesfully connected to PostgreSQL");
  } catch (err) {
    log.error("❌ Failed to connect PostgreSQL:", { err });
    process.exit(1);
  }
}

export async function prepareDB() {
  await db`CREATE TABLE IF NOT EXISTS channels(
    id BIGSERIAL PRIMARY KEY,
    channel_id INTEGER UNIQUE,
    channel_name VARCHAR(64)
  )`;

  await db`CREATE TABLE IF NOT EXISTS users(
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE,
    created TEXT
  )`;

  await db`CREATE TABLE IF NOT EXISTS users_follows(
    user_id INTEGER PRIMARY KEY REFERENCES users(user_id),
    channel_id INTEGER REFERENCES channels(channel_id),
    created TEXT
  )`;

  await db`CREATE TABLE IF NOT EXISTS users_settings(
      user_id INTEGER PRIMARY KEY REFERENCES users(user_id),
      online_notification INTEGER DEFAULT(1),
      offline_notification INTEGER DEFAULT(1)
  )`;
}

export async function addUser(user_id: number, date: string) {
  try {
    await db`INSERT INTO users(user_id,created) VALUES(${user_id},${date})`;
  } catch (err: any) {
    log.error("add user failed", {
      user_id: user_id,
      date: date,
      err,
      pg_code: err.code,
    });
  }
}

export async function getUser(user_id: number): Promise<User> {
  const users =
    (await db`SELECT user_id FROM users WHERE user_id = ${user_id}`) as User[];
  return users[0];
}

export async function addUserSettings(user_id: number) {
  try {
    await db`INSERT INTO users_settings(user_id) VALUES(${user_id})`;
  } catch (err: any) {
    log.error("add user settings failed", {
      user_id: user_id,
      err,
      pg_code: err.code,
    });
  }
}

export async function getSettingsState(
  user_id: number,
): Promise<Settings | undefined> {
  const settings =
    (await db`SELECT * FROM users_settings WHERE user_id = ${user_id}`) as Settings[];
  return settings[0];
}

export async function setOnlineNotificationState(
  user_id: number,
  state: number,
) {
  try {
    await db`UPDATE users_settings SET online_notification = ${state} WHERE user_id = ${user_id}`;
  } catch (err: any) {
    log.error("set online notification state failed", {
      user_id: user_id,
      err,
      pg_code: err.code,
    });
  }
}

export async function setOfflineNotificationState(
  user_id: number,
  state: number,
) {
  try {
    await db`UPDATE users_settings SET offline_notification = ${state} WHERE user_id = ${user_id}`;
  } catch (err: any) {
    log.error("set offline notification state failed", {
      user_id: user_id,
      err,
      pg_code: err.code,
    });
  }
}

export async function toggleOnlineNotificationState(
  user_id: number,
): Promise<number> {
  const settingsState = await getSettingsState(user_id);
  if (settingsState?.online_notification === 1) {
    await setOnlineNotificationState(user_id, 0);
    return 0;
  } else {
    await setOnlineNotificationState(user_id, 1);
    return 1;
  }
}

export async function toggleOfflineNotificationState(
  user_id: number,
): Promise<number> {
  const settingsState = await getSettingsState(user_id);
  if (settingsState?.offline_notification === 1) {
    await setOfflineNotificationState(user_id, 0);
    return 0;
  } else {
    await setOfflineNotificationState(user_id, 1);
    return 1;
  }
}

export async function getChannel(channel_id: number): Promise<Channel> {
  const channel =
    (await db`SELECT * FROM channels WHERE channel_id = ${channel_id}`) as Channel[];
  return channel[0];
}

export async function addChannel(channel_id: number, channel_name: string) {
  try {
    await db`INSERT INTO channels(channel_id,channel_name) VALUES(${channel_id},${channel_name})`;
  } catch (err: any) {
    log.error("add channel failed", {
      channel_id: channel_id,
      channel_name: channel_name,
      err,
      pg_code: err.code,
    });
  }
}

export async function addFollow(
  user_id: number,
  channel_id: number,
  created: string,
) {
  try {
    await db`INSERT INTO users_follows(user_id,channel_id,created) VALUES (${user_id},${channel_id},${created})`;
  } catch (err: any) {
    log.error("add follow failed", {
      user_id: user_id,
      channel_id: channel_id,
      err,
      pg_code: err.code,
    });
  }
}

export async function getFollow(
  user_id: number,
  channel_id: number,
): Promise<Follow> {
  const follow =
    (await db`SELECT * FROM users_follows WHERE user_id = ${user_id} AND channel_id = ${channel_id}`) as Follow[];
  return follow[0];
}

export async function removeFollow(user_id: number, channel_id: number) {
  try {
    await db`DELETE FROM users_follows WHERE user_id = ${user_id} AND channel_id = ${channel_id}`;
  } catch (err: any) {
    log.error("remove follow failed", {
      user_id: user_id,
      channel_id: channel_id,
      err,
      pg_code: err.code,
    });
  }
}

export async function getFollowList(user_id: number): Promise<Follow[]> {
  const follows =
    (await db`SELECT * FROM users_follows WHERE user_id = ${user_id}`) as Follow[];
  return follows;
}

export async function getChannelFollowers(
  channel_id: number,
): Promise<Follow[]> {
  const follows =
    (await db`SELECT * FROM users_follows WHERE channel_id = ${channel_id}`) as Follow[];
  return follows;
}

export async function updateChannelName(
  channel_id: number,
  new_channel_name: string,
) {
  try {
    await db`UPDATE channels SET channel_name = ${new_channel_name} WHERE channel_id = ${channel_id}`;
  } catch (err: any) {
    log.error("update channel name failed", {
      channel_id: channel_id,
      new_channel_name: new_channel_name,
      err,
      pg_code: err.code,
    });
  }
}

export async function getAllChannels(): Promise<Channel[]> {
  const channels = (await db`SELECT * FROM channels`) as Channel[];
  return channels;
}
