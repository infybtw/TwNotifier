import { createVerify } from "crypto";

interface KickWebhookHeaders {
  messageId: string;
  timestamp: string;
  signature: string;
}

export function verifyKickWebhook(headers: KickWebhookHeaders,rawBody: string,publicKeyPem: string): boolean {
  const signedPayload = `${headers.messageId}.${headers.timestamp}.${rawBody}`;

  const verifier = createVerify("RSA-SHA256");
  verifier.update(signedPayload);
  verifier.end();

  try {
    return verifier.verify(publicKeyPem, headers.signature, "base64");
  } catch {
    return false;
  }
}
