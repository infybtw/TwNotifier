const seenMessages = new Map<string, number>();
const MESSAGE_TTL_MS = 10 * 60 * 1000;
const MAX_TRACKED_MESSAGES = 10_000;

function cleanup(now: number): void {
  for (const [id, timestamp] of seenMessages) {
    if (now - timestamp > MESSAGE_TTL_MS) {
      seenMessages.delete(id);
    }
  }
}

/**
 * Reserve a message id for processing. Returns false when the message is a
 * duplicate: its id was already processed, or processing is in flight.
 */
export function beginEventMessage(messageId: string): boolean {
  const now = Date.now();

  if (seenMessages.has(messageId)) {
    return false;
  }

  seenMessages.set(messageId, now);

  if (seenMessages.size >= MAX_TRACKED_MESSAGES) {
    cleanup(now);
  }

  return true;
}

/**
 * Mark a message as processed after its handling succeeded.
 */
export function completeEventMessage(messageId: string): void {
  seenMessages.set(messageId, Date.now());
}

/**
 * Release a message reservation after handling failed, so the provider's
 * redelivery of the same message id gets processed instead of being
 * swallowed as a duplicate.
 */
export function releaseEventMessage(messageId: string): void {
  seenMessages.delete(messageId);
}
