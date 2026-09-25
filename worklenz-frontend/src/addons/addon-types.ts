import { ComponentType, ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';
import type { Middleware, Reducer } from '@reduxjs/toolkit';

export interface AddonManifest {
  id: string;
  name: string;
  version: string;
  requiresCore?: string;
  license?: string;
  migrationsTable?: string;
  apiPrefix?: string;
  dbPrefix?: string;
}

export interface AddonSlotItem {
  key: string;
  labelKey?: string;
  defaultLabel?: string;
  icon?: ReactNode;
  order?: number;
  dataIndex?: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  sorter?: boolean;
  component?: ComponentType<any>;
  path?: string;
  adminOnly?: boolean;
  freePlanFeature?: boolean;
  guestExcluded?: boolean;
}

export interface AddonSlots {
  projectSettingsTabs?: AddonSlotItem[];
  projectListColumns?: AddonSlotItem[];
  navigationItems?: AddonSlotItem[];
  [customSlotName: string]: AddonSlotItem[] | undefined;
}

export interface AddonStoreConfig {
  reducers?: Record<string, Reducer<any, any>>;
  middlewares?: Middleware[];
}

export interface AddonRegistry {
  addonRoutes: RouteObject[];
  addonSlots: AddonSlots;
  addonReducers: Record<string, Reducer<any, any>>;
  addonMiddlewares: Middleware[];
}
