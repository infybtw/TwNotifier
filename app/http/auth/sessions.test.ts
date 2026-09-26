import { describe, expect, test } from "bun:test";
import { hashToken, parseBearerToken } from "./sessions";

describe("session token helpers", () => {
  test("hashing is deterministic and hex encoded", () => {
    const hash = hashToken("token-value");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("token-value")).toBe(hash);
    expect(hashToken("other")).not.toBe(hash);
  });

  test("parses bearer headers case-insensitively", () => {
    expect(parseBearerToken("Bearer abc.def")).toBe("abc.def");
    expect(parseBearerToken("bearer token")).toBe("token");
    expect(parseBearerToken("Token abc")).toBeNull();
    expect(parseBearerToken(null)).toBeNull();
    expect(parseBearerToken("")).toBeNull();
  });
});
