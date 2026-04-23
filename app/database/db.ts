import { Database } from "bun:sqlite";

const db = new Database("main.db");

db.run(`CREATE TABLE IF NOT EXISTS channels(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER UNIQUE,
  channel_name VARCHAR(64)
)`);

db.run(`CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  created TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS users_follows(
  user_id INTEGER REFERENCES users(id),
  channel_id INTEGER REFERENCES channels(id),
  created TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS users_settings(
    user_id INTEGER PRIMARY KEY REFERENCES users(user_id),
    online_notification INTEGER DEFAULT(1),
    offline_notification INTEGER DEFAULT(1)
)`);

export const addUser = db.query<User, [number, string]>(
  "INSERT INTO users(user_id,created) VALUES(?,?)",
);

export const userExists = db.query<User, [number]>(
  "SELECT user_id FROM users WHERE user_id = ?",
);

export const addUserSettings = db.query<Settings, [number]>(
  "INSERT INTO users_settings(user_id) VALUES(?)",
);

export const getSettingsState = db.query<Settings, [number]>(
  "SELECT * FROM users_settings WHERE user_id = ?",
);

const setOnlineNotificationState = db.query<
  Settings,
  [state: number, user_id: number]
>("UPDATE users_settings SET online_notification = ? WHERE user_id = ? ");

const setOfflineNotificationState = db.query<
  Settings,
  [state: number, user_id: number]
>("UPDATE users_settings SET offline_notification = ? WHERE user_id = ? ");

export async function toggleOnlineNotificationState(
  user_id: number,
): Promise<number> {
  const settingsState = getSettingsState.get(user_id);
  if (settingsState?.online_notification === 1) {
    setOnlineNotificationState.get(0, user_id);
    return 0;
  } else {
    setOnlineNotificationState.get(1, user_id);
    return 1;
  }
}

export async function toggleOfflineNotificationState(
  user_id: number,
): Promise<number> {
  const settingsState = getSettingsState.get(user_id);
  if (settingsState?.offline_notification === 1) {
    setOfflineNotificationState.get(0, user_id);
    return 0;
  } else {
    setOfflineNotificationState.get(1, user_id);
    return 1;
  }
}

export const channelExists = db.query<Channel, [number]>(
  "SELECT * FROM channels WHERE channel_id = ?",
);

export const addChannel = db.query<Channel, [number, string]>(
  "INSERT INTO channels(channel_id,channel_name) VALUES(?,?)",
);
export const addFollow = db.query<Follow, [number, number, string]>(
  "INSERT INTO users_follows(user_id, channel_id,created) VALUES (?,?,?)",
);

export const followExists = db.query<Follow, [number, number]>(
  "SELECT * FROM users_follows WHERE user_id = ? AND channel_id = ?",
);

export const removeFollow = db.query<Follow, [number, number]>(
  "DELETE FROM users_follows WHERE user_id = ? AND channel_id = ?",
);

export const getFollowList = db.query<Follow, [number]>(
  "SELECT * FROM users_follows WHERE user_id = ?",
);

export const getChannelFollowers = db.query<Follow, [number]>(
  "SELECT * FROM users_follows WHERE channel_id = ?",
);

export const getAllChannels = db.query<Channel, []>("SELECT * FROM channels");
