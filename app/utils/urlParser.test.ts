import { describe, expect, test } from "bun:test";
import { extractPlatformFromUrl, extractUsernameFromTwitchUrl, isValidUsername, parseChannelInput } from "./urlParser";

describe("parseChannelInput", () => {
  test("accepts bare usernames without a platform", () => {
    expect(parseChannelInput("XQC")).toEqual({ platform: null, username: "xqc" });
    expect(parseChannelInput("good-girl21")).toEqual({ platform: null, username: "good-girl21" });
  });

  test("detects the platform from a provider URL", () => {
    expect(parseChannelInput("https://twitch.tv/xqc")).toEqual({ platform: "twitch", username: "xqc" });
    expect(parseChannelInput("twitch.tv/xqc")).toEqual({ platform: "twitch", username: "xqc" });
    expect(parseChannelInput("https://www.twitch.tv/xqc/videos")).toEqual({ platform: "twitch", username: "xqc" });
    expect(parseChannelInput("https://kick.com/xqc")).toEqual({ platform: "kick", username: "xqc" });
  });

  test("allows provider subdomains only", () => {
    expect(parseChannelInput("https://m.twitch.tv/xqc")?.platform).toBe("twitch");
    expect(parseChannelInput("https://player.twitch.tv/xqc")?.platform).toBe("twitch");
  });

  test("rejects lookalike and unrelated hosts", () => {
    expect(parseChannelInput("https://twitch.tv.evil.com/xqc")).toBeNull();
    expect(parseChannelInput("https://eviltwitch.tv/xqc")).toBeNull();
    expect(parseChannelInput("https://youtube.com/xqc")).toBeNull();
    expect(parseChannelInput("https://notkick.com/xqc")).toBeNull();
  });

  test("rejects malformed usernames and empty input", () => {
    expect(parseChannelInput("")).toBeNull();
    expect(parseChannelInput("   ")).toBeNull();
    expect(parseChannelInput("bad name")).toBeNull();
    expect(parseChannelInput("https://twitch.tv/")).toBeNull();
    expect(parseChannelInput("https://twitch.tv/" + "a".repeat(26))).toBeNull();
    expect(parseChannelInput("https://kick.com/has space")).toBeNull();
  });
});

describe("username validation", () => {
  test("twitch allows underscores but not hyphens", () => {
    expect(isValidUsername("a_b_1", "twitch")).toBe(true);
    expect(isValidUsername("a-b", "twitch")).toBe(false);
  });

  test("kick allows underscores and hyphens", () => {
    expect(isValidUsername("a-b_1", "kick")).toBe(true);
  });
});

describe("legacy helpers", () => {
  test("extractPlatformFromUrl stays consistent with parseChannelInput", () => {
    expect(extractPlatformFromUrl("https://kick.com/xqc")).toBe("kick");
    expect(extractPlatformFromUrl("xqc")).toBeNull();
    expect(extractPlatformFromUrl("https://twitch.tv.evil.com/xqc")).toBeNull();
  });

  test("extractUsernameFromTwitchUrl returns canonical usernames", () => {
    expect(extractUsernameFromTwitchUrl("https://twitch.tv/XQC")).toBe("xqc");
    expect(extractUsernameFromTwitchUrl("XQC")).toBe("xqc");
    expect(extractUsernameFromTwitchUrl("https://youtube.com/xqc")).toBeNull();
  });
});
