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
  query?: Record<string, string | number | undefined>;
}

/**
 * Fetch wrapper for the user API. The bearer token lives in memory only (via
 * useState) and is never written to storage. A 401 clears the session and lets
 * the onboarding screen show a recovery message instead of retrying.
 */
export function useApi() {
  const config = useRuntimeConfig();
  const token = useState<string | null>("auth-token", () => null);
  const authError = useState<string | null>("auth-error", () => null);

  async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    let url = `${config.public.apiBase}${path}`;
    if (options.query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== "") params.set(key, String(value));
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers["content-type"] = "application/json";
    if (token.value) headers.authorization = `Bearer ${token.value}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method ?? "GET",
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch {
      throw new ApiError("NETWORK", "Network error", 0);
    }

    const data = await response.json().catch(() => null);

    if (response.status === 401) {
      token.value = null;
      authError.value = "expired";
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

  return {
    request,
    get: <T>(path: string, query?: ApiRequestOptions["query"]) => request<T>(path, { query }),
    post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
    patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
    del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  };
}

/** Localizes an ApiError by its stable code. */
export function useApiError() {
  const { t } = useLocale();
  return (error: unknown): string => {
    if (error instanceof ApiError) return t(`error.${error.code}`);
    return t("common.error");
  };
}
