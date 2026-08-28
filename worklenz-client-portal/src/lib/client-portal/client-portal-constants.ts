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

export interface ClientPortalMenuItems {
  key: string;
  name: string;
  icon: React.ReactNode;
  endpoint: string;
}

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