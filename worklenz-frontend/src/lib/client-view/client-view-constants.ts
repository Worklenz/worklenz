import {
  AppstoreOutlined,
  CommentOutlined,
  DashboardOutlined,
  FileOutlined,
  GroupOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import React, { ReactNode } from 'react';
import ClientViewServices from '../../pages/client-view/services/client-view-service';
import ClientViewRequests from '../../pages/client-view/requests/client-view-requests';
import ClientViewChats from '../../pages/client-view/chat/client-view-chats';
import ClientViewProjects from '../../pages/client-view/projects/client-view-projects';
import ClientViewInvoices from '../../pages/client-view/invoices/client-view-invoices';
import ClientViewSettings from '../../pages/client-view/settings/client-view-settings';

// type of a menu item in client view sidebar
type clientViewMenuItems = {
  key: string;
  name: string;
  endpoint: string;
  icon: ReactNode;
  element: ReactNode;
  disabled?: boolean;
};
// clientView all element items use for sidebar and routes
export const clientViewItems: clientViewMenuItems[] = [
  {
    key: 'dashboard',
    name: 'Dashboard',
    endpoint: 'dashboard',
    icon: React.createElement(DashboardOutlined),
    element: false,
    disabled: false,
  },
  {
    key: 'services',
    name: 'services',
    endpoint: 'services',
    icon: React.createElement(GroupOutlined),
    element: React.createElement(ClientViewServices),
  },
  {
    key: 'projects',
    name: 'projects',
    endpoint: 'projects',
    icon: React.createElement(AppstoreOutlined),
    element: React.createElement(ClientViewProjects),
  },
  {
    key: 'chats',
    name: 'chats',
    endpoint: 'chats',
    icon: React.createElement(CommentOutlined),
    element: React.createElement(ClientViewChats),
  },
  {
    key: 'invoices',
    name: 'invoices',
    endpoint: 'invoices',
    icon: React.createElement(FileOutlined),
    element: React.createElement(ClientViewInvoices),
  },
  {
    key: 'requests',
    name: 'requests',
    endpoint: 'requests',
    icon: React.createElement(UnorderedListOutlined),
    element: React.createElement(ClientViewRequests),
  },
  {
    key: 'settings',
    name: 'settings',
    endpoint: 'settings',
    icon: React.createElement(SettingOutlined),
    element: React.createElement(ClientViewSettings),
  },
];
