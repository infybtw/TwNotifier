/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** REST API prefix; relative by default so the Mini App and API share an origin. */
  readonly PUBLIC_API_BASE?: string;
  /** Bot username used for "open the bot chat" links. */
  readonly PUBLIC_BOT_USERNAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
