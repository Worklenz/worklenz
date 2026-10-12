import React from 'react';
import {
  DashboardOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  ProjectOutlined,
  FileDoneOutlined,
  MessageOutlined,
  SettingOutlined,
} from '@/shared/antd-imports';
import { ClientSettings } from '@/types';

export interface ClientPortalMenuItems {
  key: string;
  name: string;
  icon: React.ReactNode;
  endpoint: string;
}

/** Of the 8 "Client Visible Selection" toggles (Portal Settings, admin side), only these 3 map
 * to a real nav item/route in this app today (Gantt/Files-as-a-section/Feedback Forms/a
 * client-facing Team page/Project Updates don't exist yet) — so only these gate anything.
 * Shared by ClientPortalSidebar (hides the menu entry) and ClientLayout (redirects a direct
 * URL visit) so both stay in sync off one map. */
export const VISIBILITY_GATED_KEYS: Record<string, keyof ClientSettings> = {
  projects: 'visible_project_plan',
  invoices: 'visible_invoices',
  chats: 'visible_chat',
};

export const clientPortalItems: ClientPortalMenuItems[] = [
  {
    key: 'dashboard',
    name: 'navigation.dashboard',
    icon: React.createElement(DashboardOutlined),
    endpoint: 'dashboard',
  },
  {
    key: 'services',
    name: 'navigation.services',
    icon: React.createElement(AppstoreOutlined),
    endpoint: 'services',
  },
  {
    key: 'requests',
    name: 'navigation.requests',
    icon: React.createElement(FileTextOutlined),
    endpoint: 'requests',
  },
  {
    key: 'projects',
    name: 'navigation.projects',
    icon: React.createElement(ProjectOutlined),
    endpoint: 'projects',
  },
  {
    key: 'invoices',
    name: 'navigation.invoices',
    icon: React.createElement(FileDoneOutlined),
    endpoint: 'invoices',
  },
  {
    key: 'chats',
    name: 'navigation.chats',
    icon: React.createElement(MessageOutlined),
    endpoint: 'chats',
  },
  {
    key: 'settings',
    name: 'navigation.settings',
    icon: React.createElement(SettingOutlined),
    endpoint: 'settings',
  },
];