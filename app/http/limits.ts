import { API_RATE_LIMIT_PER_MINUTE } from "../config";
import { createRateLimiter } from "./rateLimit";
import { clientKey } from "./pagination";

export const apiRateLimiter = createRateLimiter(API_RATE_LIMIT_PER_MINUTE);

export function isRateLimited(request: Request): boolean {
  return !apiRateLimiter.take(clientKey(request));
}
