import React, { ReactNode, lazy } from 'react';

const ClientPortalClients = lazy(
  () => import('../../pages/client-portal/clients/ClientPortalClients')
);
const ClientPortalRequests = lazy(
  () => import('../../pages/client-portal/requests/client-portal-requests')
);
const ClientPortalServices = lazy(
  () => import('../../pages/client-portal/services/client-portal-services')
);
const ClientPortalChats = lazy(() => import('../../pages/client-portal/chats/client-portal-chats'));
const ClientPortalInvoices = lazy(
  () => import('../../pages/client-portal/invoices/client-portal-invoices')
);
const ClientPortalSettings = lazy(
  () => import('../../pages/client-portal/settings/client-portal-settings')
);

import {
  AppstoreOutlined,
  CommentOutlined,
  FileDoneOutlined,
  GroupOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';

export type ClientPortalMenuItems = {
  key: string;
  name: string;
  endpoint: string;
  icon?: ReactNode;
  element: ReactNode;
  children?: ClientPortalMenuItems[];
};

export const clientPortalItems: ClientPortalMenuItems[] = [
  {
    key: 'clients',
    name: 'clients',
    endpoint: 'clients',
    icon: React.createElement(GroupOutlined),
    element: React.createElement(ClientPortalClients),
  },
  {
    key: 'requests',
    name: 'requests',
    endpoint: 'requests',
    icon: React.createElement(UnorderedListOutlined),
    element: React.createElement(ClientPortalRequests),
  },
  {
    key: 'services',
    name: 'services',
    endpoint: 'services',
    icon: React.createElement(AppstoreOutlined),
    element: React.createElement(ClientPortalServices),
  },
  {
    key: 'chats',
    name: 'chats',
    endpoint: 'chats',
    icon: React.createElement(CommentOutlined),
    element: React.createElement(ClientPortalChats),
  },
  {
    key: 'invoices',
    name: 'invoices',
    endpoint: 'invoices',
    icon: React.createElement(FileDoneOutlined),
    element: React.createElement(ClientPortalInvoices),
  },
  {
    key: 'settings',
    name: 'settings',
    endpoint: 'settings',
    icon: React.createElement(SettingOutlined),
    element: React.createElement(ClientPortalSettings),
  },
];
