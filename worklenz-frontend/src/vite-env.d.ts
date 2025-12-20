/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_TITLE: string;
  readonly VITE_APP_ENV: string;
  readonly VITE_APP_BRAND_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
