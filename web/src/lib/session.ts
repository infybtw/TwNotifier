import type { Profile, Settings } from "./types";

export interface SessionState {
  token: string | null;
  profile: Profile | null;
  settings: Settings | null;
  authError: string | null;
  signingIn: boolean;
  initialized: boolean;
}

/**
 * Session state lives in memory for the lifetime of the Mini App page. The
 * token is never written to storage; a fresh Telegram initData exchange is
 * used after a reload.
 */
export const session: SessionState = {
  token: null,
  profile: null,
  settings: null,
  authError: null,
  signingIn: false,
  initialized: false,
};

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifySession(): void {
  listeners.forEach((listener) => listener());
}

export function clearSession(authError: string | null = null): void {
  session.token = null;
  session.profile = null;
  session.settings = null;
  session.authError = authError;
  notifySession();
}
