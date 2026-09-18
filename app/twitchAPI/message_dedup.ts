const seenMessages = new Map<string, number>();
const MESSAGE_TTL_MS = 10 * 60 * 1000;
const MAX_TRACKED_MESSAGES = 10_000;

/**
 * Twitch EventSub delivers messages at-least-once: the same event
 * (same message id) can arrive multiple times. Returns true if this
 * message id was already processed recently.
 */
export function isDuplicateEventMessage(messageId: string): boolean {
  const now = Date.now();

  if (seenMessages.has(messageId)) {
    return true;
  }

  seenMessages.set(messageId, now);

  if (seenMessages.size >= MAX_TRACKED_MESSAGES) {
    for (const [id, timestamp] of seenMessages) {
      if (now - timestamp > MESSAGE_TTL_MS) {
        seenMessages.delete(id);
      }
    }
  }

  return false;
}
