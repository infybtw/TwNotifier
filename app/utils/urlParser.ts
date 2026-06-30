export function extractUsernameFromTwitchUrl(urlOrUsername: string): string | null {
  const trimmed = urlOrUsername.trim();

  // Handle empty strings
  if (trimmed.length === 0) {
    return null;
  }

  // If it's already a username (no URL), return as is
  if (!trimmed.includes('/') && !trimmed.includes('.')) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);

    // Check if it's a Twitch URL
    if (!url.hostname.includes('twitch.tv') && !url.hostname.includes("kick.com")) {
      return null;
    }

    // Extract the path and get the username
    const path = url.pathname;
    const pathParts = path.split('/').filter(part => part.length > 0);

    // Handle different Twitch URL formats:
    // - https://www.twitch.tv/username
    // - https://twitch.tv/username
    // - https://www.twitch.tv/username/clips?filter=clips&range=7d
    // - https://www.twitch.tv/username/videos?filter=archives
    if (pathParts.length >= 1) {
      const username = pathParts[0];
      // Remove any query parameters or fragments
      const cleanUsername = username.split('?')[0].split('#')[0];
      return cleanUsername;
    }

    return null;
  } catch {
    // If URL parsing fails, treat it as a username
    return trimmed;
  }
}
