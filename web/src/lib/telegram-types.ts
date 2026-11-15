export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  section_bg_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
  [key: string]: string | undefined;
}

export interface TelegramInset {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface TelegramBackButton {
  isVisible: boolean;
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
  photo_url?: string;
}

export interface TelegramWebAppInitDataUnsafe {
  user?: TelegramWebAppUser;
  start_param?: string;
  auth_date?: number;
  hash?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: TelegramWebAppInitDataUnsafe;
  themeParams: TelegramThemeParams;
  colorScheme: "light" | "dark";
  platform: string;
  version: string;
  viewportHeight: number;
  viewportStableHeight: number;
  isExpanded: boolean;
  safeAreaInset?: TelegramInset;
  contentSafeAreaInset?: TelegramInset;
  BackButton: TelegramBackButton;
  ready(): void;
  expand(): void;
  close(): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  requestWriteAccess?(callback?: (granted: boolean) => void): void;
  showAlert?(message: string, callback?: () => void): void;
  showConfirm?(message: string, callback?: (confirmed: boolean) => void): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  onEvent(event: string, callback: () => void): void;
  offEvent(event: string, callback: () => void): void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}
