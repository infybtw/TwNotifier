import { createHmac, timingSafeEqual } from "node:crypto";
import {
  BOT_TOKEN,
  INIT_DATA_FUTURE_SKEW_SECONDS,
  INIT_DATA_MAX_AGE_SECONDS,
} from "../../config";

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
  photo_url?: string;
}

export interface VerifiedInitData {
  user: TelegramWebAppUser;
  /** Unix timestamp in seconds, as issued by Telegram. */
  authDate: number;
  queryId?: string;
  startParam?: string;
  allowsWriteToPm: boolean;
}

export type InitDataErrorReason =
  | "malformed"
  | "duplicate_keys"
  | "missing_hash"
  | "bad_hash_format"
  | "missing_bot_token"
  | "bad_signature"
  | "missing_auth_date"
  | "expired"
  | "future"
  | "missing_user"
  | "bad_user";

export class InitDataError extends Error {
  constructor(public readonly reason: InitDataErrorReason, message: string) {
    super(message);
    this.name = "InitDataError";
  }
}

export interface VerifyInitDataOptions {
  botToken?: string;
  nowMs?: number;
  maxAgeSeconds?: number;
  futureSkewSeconds?: number;
}

const HASH_PATTERN = /^[0-9a-f]{64}$/i;

/**
 * Verifies Telegram Mini App initData using the official HMAC-SHA-256 scheme:
 *
 *   secret_key   = HMAC_SHA256(key="WebAppData", message=bot_token)
 *   expected     = HMAC_SHA256(key=secret_key, message=data_check_string)
 *
 * `data_check_string` is built from every received field except `hash`,
 * sorted by key. A `signature` field (used by the separate Ed25519 scheme for
 * third parties) is *not* excluded here, because it is part of the signed data
 * for the HMAC scheme.
 */
export function verifyInitData(initData: string, options: VerifyInitDataOptions = {}): VerifiedInitData {
  const botToken = options.botToken ?? BOT_TOKEN;
  const maxAgeSeconds = options.maxAgeSeconds ?? INIT_DATA_MAX_AGE_SECONDS;
  const futureSkewSeconds = options.futureSkewSeconds ?? INIT_DATA_FUTURE_SKEW_SECONDS;
  const nowMs = options.nowMs ?? Date.now();

  if (!botToken) {
    throw new InitDataError("missing_bot_token", "Bot token is not configured");
  }

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    throw new InitDataError("malformed", "initData is not a valid query string");
  }

  const seen = new Set<string>();
  const entries: [string, string][] = [];
  for (const [key, value] of params) {
    if (seen.has(key)) {
      throw new InitDataError("duplicate_keys", `Duplicate field: ${key}`);
    }
    seen.add(key);
    entries.push([key, value]);
  }

  const receivedHash = params.get("hash");
  if (!receivedHash) {
    throw new InitDataError("missing_hash", "initData hash is missing");
  }
  if (!HASH_PATTERN.test(receivedHash)) {
    throw new InitDataError("bad_hash_format", "initData hash has an invalid format");
  }

  const dataCheckString = entries
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest();
  const receivedHashBytes = Buffer.from(receivedHash, "hex");

  if (
    receivedHashBytes.length !== expectedHash.length ||
    !timingSafeEqual(receivedHashBytes, expectedHash)
  ) {
    throw new InitDataError("bad_signature", "initData signature is invalid");
  }

  const authDateRaw = params.get("auth_date");
  if (!authDateRaw || !/^-?\d+$/.test(authDateRaw)) {
    throw new InitDataError("missing_auth_date", "initData auth_date is missing or invalid");
  }
  const authDate = Number(authDateRaw);
  const nowSeconds = Math.floor(nowMs / 1000);

  if (nowSeconds - authDate > maxAgeSeconds) {
    throw new InitDataError("expired", "initData has expired");
  }
  if (authDate - nowSeconds > futureSkewSeconds) {
    throw new InitDataError("future", "initData auth_date is in the future");
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    throw new InitDataError("missing_user", "initData user is missing");
  }

  let user: TelegramWebAppUser;
  try {
    user = JSON.parse(userRaw) as TelegramWebAppUser;
  } catch {
    throw new InitDataError("bad_user", "initData user is not valid JSON");
  }

  if (!user || typeof user !== "object" || !Number.isSafeInteger(user.id) || user.id <= 0) {
    throw new InitDataError("bad_user", "initData user id is invalid");
  }

  return {
    user,
    authDate,
    queryId: params.get("query_id") ?? undefined,
    startParam: params.get("start_param") ?? undefined,
    allowsWriteToPm: user.allows_write_to_pm === true,
  };
}
