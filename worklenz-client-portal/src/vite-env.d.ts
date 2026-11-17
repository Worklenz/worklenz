/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Socket.IO server URL. Defaults to the host of VITE_API_BASE_URL (ws/wss). */
  readonly VITE_SOCKET_URL?: string;
  /** Shown in Settings > Help > About. */
  readonly VITE_APP_VERSION?: string;
  /** ISO date (YYYY-MM-DD) shown in Settings > Help > About as "Last updated". */
  readonly VITE_APP_LAST_UPDATED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
