export type UrlPlatform = "twitch" | "kick";

/**
 * Only these registrable domains (and their subdomains) are treated as
 * provider URLs. A substring check such as `includes("twitch.tv")` would also
 * accept `twitch.tv.evil.com` and is intentionally avoided.
 */
const PROVIDER_DOMAINS: Record<UrlPlatform, string> = {
  twitch: "twitch.tv",
  kick: "kick.com",
};

const USERNAME_PATTERNS: Record<UrlPlatform, RegExp> = {
  // Twitch logins: letters, digits and underscores.
  twitch: /^[a-zA-Z0-9_]{1,25}$/,
  // Kick slugs: letters, digits, underscores and hyphens.
  kick: /^[a-zA-Z0-9_-]{1,25}$/,
};

export interface ParsedChannelInput {
  /** null when the input was a bare username without platform information. */
  platform: UrlPlatform | null;
  /** Canonical, lower-cased login/slug. */
  username: string;
}

function isProviderHostname(hostname: string, platform: UrlPlatform): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const domain = PROVIDER_DOMAINS[platform];
  return host === domain || host.endsWith(`.${domain}`);
}

function platformFromHostname(hostname: string): UrlPlatform | null {
  if (isProviderHostname(hostname, "twitch")) return "twitch";
  if (isProviderHostname(hostname, "kick")) return "kick";
  return null;
}

export function isValidUsername(username: string, platform: UrlPlatform): boolean {
  return USERNAME_PATTERNS[platform].test(username);
}

/**
 * Detects which platform a URL belongs to.
 * Returns null when the input is a bare username or an unsupported URL.
 */
export function extractPlatformFromUrl(urlOrUsername: string): UrlPlatform | null {
  const trimmed = urlOrUsername.trim();
  if (trimmed.length === 0 || (!trimmed.includes("/") && !trimmed.includes("."))) {
    return null;
  }
  if (/\s/.test(trimmed)) {
    return null;
  }

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return platformFromHostname(url.hostname);
  } catch {
    return null;
  }
}

/**
 * Extracts the channel login from a Twitch or Kick URL, or validates a bare
 * username. Returns null for unsupported hosts and malformed names.
 */
export function extractUsernameFromTwitchUrl(urlOrUsername: string): string | null {
  const parsed = parseChannelInput(urlOrUsername);
  return parsed ? parsed.username : null;
}

/**
 * Parses user input into a platform hint (when a provider URL was given) and a
 * canonical username. Returns null when the input is not a valid username or
 * provider URL.
 */
export function parseChannelInput(urlOrUsername: string): ParsedChannelInput | null {
  const trimmed = urlOrUsername.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const looksLikeUrl = trimmed.includes("/") || trimmed.includes(".");
  if (!looksLikeUrl) {
    const username = trimmed.toLowerCase();
    if (isValidUsername(username, "twitch") || isValidUsername(username, "kick")) {
      return { platform: null, username };
    }
    return null;
  }

  if (/\s/.test(trimmed)) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const platform = platformFromHostname(url.hostname);
  if (!platform) {
    return null;
  }

  const pathParts = url.pathname.split("/").filter((part) => part.length > 0);
  if (pathParts.length < 1) {
    return null;
  }

  const username = decodeURIComponent(pathParts[0]).toLowerCase();
  if (!isValidUsername(username, platform)) {
    return null;
  }

  return { platform, username };
}
