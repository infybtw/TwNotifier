/**
 * Stable, transport-agnostic service error. The HTTP layer maps `code` to a
 * response, the bot maps it to a localized message. Services never import
 * grammY or Elysia.
 */
export type ServiceErrorCode =
  | "INVALID_INPUT"
  | "FORBIDDEN"
  | "CHANNEL_NOT_FOUND"
  | "NOT_FOUND"
  | "PROVIDER_UNAVAILABLE"
  | "RATE_LIMITED"
  | "INTERNAL";

export class ServiceError extends Error {
  constructor(
    public readonly code: ServiceErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}
