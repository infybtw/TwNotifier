import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { InitDataError, verifyInitData } from "./initData";

const BOT_TOKEN = "123456:TEST-BOT-TOKEN";
const OTHER_TOKEN = "654321:OTHER-BOT-TOKEN";
const NOW = 1_700_000_000_000;
const NOW_SECONDS = Math.floor(NOW / 1000);

function sign(fields: Record<string, string>, botToken = BOT_TOKEN): string {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  return createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
}

function makeInitData(fields: Record<string, string>, botToken = BOT_TOKEN): string {
  const withHash = { ...fields, hash: sign(fields, botToken) };
  return new URLSearchParams(withHash).toString();
}

function userFields(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: 42,
    first_name: "Test",
    username: "tester",
    language_code: "ru",
    ...overrides,
  });
}

const baseFields = (): Record<string, string> => ({
  auth_date: String(NOW_SECONDS),
  query_id: "AAExampleQueryId",
  user: userFields(),
});

const options = { botToken: BOT_TOKEN, nowMs: NOW };

describe("verifyInitData", () => {
  test("accepts a valid payload", () => {
    const result = verifyInitData(makeInitData(baseFields()), options);
    expect(result.user.id).toBe(42);
    expect(result.user.username).toBe("tester");
    expect(result.authDate).toBe(NOW_SECONDS);
    expect(result.queryId).toBe("AAExampleQueryId");
    expect(result.allowsWriteToPm).toBe(false);
  });

  test("includes the signature field in the signed data", () => {
    const fields = { ...baseFields(), signature: "some-ed25519-signature" };
    const result = verifyInitData(makeInitData(fields), options);
    expect(result.user.id).toBe(42);
  });

  test("rejects a tampered user while keeping the original hash", () => {
    const initData = makeInitData(baseFields());
    const params = new URLSearchParams(initData);
    params.set("user", userFields({ id: 99, username: "attacker" }));
    expect(() => verifyInitData(params.toString(), options)).toThrow(InitDataError);
  });

  test("rejects a tampered hash", () => {
    const initData = makeInitData(baseFields());
    const params = new URLSearchParams(initData);
    params.set("hash", "0".repeat(64));
    expect(() => verifyInitData(params.toString(), options)).toThrow(InitDataError);
  });

  test("rejects a malformed hash", () => {
    const params = new URLSearchParams(baseFields());
    params.set("hash", "not-hex");
    expect(() => verifyInitData(params.toString(), options)).toThrow(InitDataError);
  });

  test("rejects a payload signed with a different bot token", () => {
    expect(() => verifyInitData(makeInitData(baseFields(), OTHER_TOKEN), options)).toThrow(InitDataError);
  });

  test("rejects a missing user", () => {
    const fields = { auth_date: String(NOW_SECONDS) };
    expect(() => verifyInitData(makeInitData(fields), options)).toThrow(InitDataError);
  });

  test("rejects a missing auth_date", () => {
    const fields = { user: userFields() };
    expect(() => verifyInitData(makeInitData(fields), options)).toThrow(InitDataError);
  });

  test("rejects an expired payload", () => {
    const fields = { ...baseFields(), auth_date: String(NOW_SECONDS - 400) };
    expect(() => verifyInitData(makeInitData(fields), options)).toThrow(InitDataError);
  });

  test("rejects an auth_date too far in the future", () => {
    const fields = { ...baseFields(), auth_date: String(NOW_SECONDS + 120) };
    expect(() => verifyInitData(makeInitData(fields), options)).toThrow(InitDataError);
  });

  test("allows a small future clock skew", () => {
    const fields = { ...baseFields(), auth_date: String(NOW_SECONDS + 5) };
    expect(verifyInitData(makeInitData(fields), options).user.id).toBe(42);
  });

  test("handles Unicode and URL encoding", () => {
    const firstName = "Иван ❤️ & <b>100%</b>";
    const fields = { ...baseFields(), user: userFields({ first_name: firstName }) };
    const result = verifyInitData(makeInitData(fields), options);
    expect(result.user.first_name).toBe(firstName);
  });

  test("rejects duplicate keys", () => {
    const initData = makeInitData(baseFields());
    expect(() => verifyInitData(`${initData}&user=duplicate`, options)).toThrow(InitDataError);
  });

  test("rejects an invalid user id", () => {
    const fields = { ...baseFields(), user: JSON.stringify({ id: -1, first_name: "x" }) };
    expect(() => verifyInitData(makeInitData(fields), options)).toThrow(InitDataError);
  });

  test("requires a configured bot token", () => {
    expect(() => verifyInitData(makeInitData(baseFields()), { botToken: "" })).toThrow(InitDataError);
  });
});
