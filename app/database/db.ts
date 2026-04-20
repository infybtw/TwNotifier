import { Database } from "bun:sqlite";

const db = new Database("main.db");

db.run(`CREATE TABLE IF NOT EXISTS channels(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_name varchar(64)
  )`);

db.run(`CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE
  )`);

db.run(`CREATE TABLE IF NOT EXISTS users_follows(
    user_id INTEGER REFERENCES users(id),
    channel_id INTEGER REFERENCES channels(id)
)`);

export const addUser = db.query<User, [number, string]>(
  "INSERT INTO users(user_id,created) VALUES(?,?)",
);

export const userExists = db.query<User, [number]>(
  "SELECT user_id FROM users WHERE user_id = ?",
);

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
