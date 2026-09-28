import logger from "../logger";

const log = logger.getSubLogger({ name: "http" });

/** Requests at or above this duration are logged as warnings with `slow: true`. */
const SLOW_REQUEST_MS = 500;

/** Start timestamps per in-flight request; a WeakMap avoids retaining requests. */
const startedAt = new WeakMap<Request, number>();

/**
 * Records when a request entered the server. Register this hook before the
 * routes it should observe so the full request lifetime is measured.
 */
export function logRequestStart({ request }: { request: Request }): void {
  startedAt.set(request, performance.now());
}

/**
 * Logs every HTTP request once its response is produced: method, path, status
 * and wall-clock duration. The body is never logged, so initData and other
 * credentials stay out of the logs.
 */
export function logRequestEnd({ request, set }: { request: Request; set: { status?: number | string } }): void {
  const started = startedAt.get(request);
  startedAt.delete(request);

  const durationMs = started === undefined ? null : Math.round(performance.now() - started);
  const status = Number(set.status) || 200;
  const slow = durationMs !== null && durationMs >= SLOW_REQUEST_MS;

  const payload = {
    method: request.method,
    path: new URL(request.url).pathname,
    status,
    durationMs,
    slow,
  };

  if (status >= 500) {
    log.error("request", payload);
  } else if (status >= 400 || slow) {
    log.warn("request", payload);
  } else {
    log.info("request", payload);
  }
}
