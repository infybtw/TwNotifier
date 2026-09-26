import { ServiceError } from "../services/errors";
import { InitDataError } from "./auth/initData";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export type ApiErrorCode =
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "SESSION_EXPIRED"
  | "CHANNEL_NOT_FOUND"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "INTERNAL";

export function apiErrorBody(code: ApiErrorCode, message: string, requestId: string): ApiErrorBody {
  return { error: { code, message, requestId } };
}

export interface MappedError {
  status: number;
  code: ApiErrorCode;
  message: string;
}

export function mapServiceError(error: unknown): MappedError | null {
  if (!(error instanceof ServiceError)) return null;
  switch (error.code) {
    case "INVALID_INPUT":
      return { status: 400, code: "INVALID_INPUT", message: error.message };
    case "FORBIDDEN":
      return { status: 403, code: "FORBIDDEN", message: error.message };
    case "CHANNEL_NOT_FOUND":
      return { status: 404, code: "CHANNEL_NOT_FOUND", message: error.message };
    case "NOT_FOUND":
      return { status: 404, code: "NOT_FOUND", message: error.message };
    case "PROVIDER_UNAVAILABLE":
      return { status: 503, code: "PROVIDER_UNAVAILABLE", message: error.message };
    case "RATE_LIMITED":
      return { status: 429, code: "RATE_LIMITED", message: error.message };
    default:
      return { status: 500, code: "INTERNAL", message: "Internal error" };
  }
}

export function mapInitDataError(error: unknown): MappedError | null {
  if (!(error instanceof InitDataError)) return null;
  const code: ApiErrorCode = error.reason === "expired" ? "SESSION_EXPIRED" : "UNAUTHORIZED";
  return { status: 401, code, message: "Telegram authentication failed" };
}
