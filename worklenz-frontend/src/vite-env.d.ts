/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_TITLE: string;
  readonly VITE_APP_ENV: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'virtual:addons-registry' {
  import type { RouteObject } from 'react-router-dom';
  import type { Middleware, Reducer } from '@reduxjs/toolkit';
  import type { AddonSlots } from '@/addons/addon-types';

  export const addonRoutes: RouteObject[];
  export const addonSlots: AddonSlots;
  export const addonReducers: Record<string, Reducer<any, any>>;
  export const addonMiddlewares: Middleware[];
}

