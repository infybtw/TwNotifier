let cachedPublicKey: string | null = null;

export async function getKickPublicKey(): Promise<string> {
  if (cachedPublicKey) return cachedPublicKey;

  const res = await fetch("https://api.kick.com/public/v1/public-key");
  if (!res.ok) {
    throw new Error(`Failed to fetch Kick public key: ${res.status}`);
  }

  const data = await res.json();
  cachedPublicKey = data.data.public_key;

  return cachedPublicKey!;
}
