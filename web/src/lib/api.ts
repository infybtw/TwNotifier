import { t } from "./i18n";
import { notifySession, session } from "./session";

const rawApiBase = (import.meta.env.PUBLIC_API_BASE ?? "").trim().replace(/\/+$/, "");

/** Relative by default so the Mini App and API share one HTTPS origin. */
export const apiBase = rawApiBase || "/api/v1";

export const botUsername = (import.meta.env.PUBLIC_BOT_USERNAME ?? "").trim();
export const botUrl = botUsername ? `https://t.me/${botUsername}` : "";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
}

/**
 * Fetch wrapper for the user API. A 401 clears the in-memory session and lets
 * the onboarding screen show a recovery message instead of retrying.
 */
async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  let url = `${apiBase}${path}`;
  if (options.query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {};
  const isForm = options.body instanceof FormData;
  if (options.body !== undefined && !isForm) headers["content-type"] = "application/json";
  if (session.token) headers.authorization = `Bearer ${session.token}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined
        ? (isForm ? options.body as FormData : JSON.stringify(options.body))
        : undefined,
    });
  } catch {
    throw new ApiError("NETWORK", "Network error", 0);
  }

  const data = await response.json().catch(() => null);

  if (response.status === 401) {
    session.token = null;
    session.profile = null;
    session.settings = null;
    session.authError = "expired";
    notifySession();
  }

  if (!response.ok) {
    throw new ApiError(
      data?.error?.code ?? "INTERNAL",
      data?.error?.message ?? "Request failed",
      response.status,
      data?.error?.requestId,
    );
  }

  return data as T;
}

export const api = {
  request,
  get: <T>(path: string, query?: ApiRequestOptions["query"]) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  postForm: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", body: form }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Localizes an ApiError by its stable code. */
export function localizeApiError(error: unknown): string {
  if (error instanceof ApiError) return t(`error.${error.code}`);
  return t("common.error");
}
