import { createHmac } from "crypto";

interface TwitchWebhookHeaders {
  messageId: string;
  timestamp: string;
  signature: string;
}

export function verifyTwitchWebhook(
  headers: TwitchWebhookHeaders,
  rawBody: string,
  secret: string,
): boolean {
  const signedPayload = `${headers.messageId}${headers.timestamp}${rawBody}`;
  const expectedSignature =
    "sha256=" + createHmac("sha256", secret).update(signedPayload).digest("hex");

  return expectedSignature === headers.signature;
}
