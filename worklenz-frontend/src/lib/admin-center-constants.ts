import {
  AppstoreOutlined,
  CreditCardOutlined,
  ProfileOutlined,
  TeamOutlined,
  UserOutlined,
  SettingOutlined,
} from '@/shared/antd-imports';
import React, { ReactNode, lazy } from 'react';
const Overview = lazy(() => import('../pages/admin-center/overview/overview'));
const Users = lazy(() => import('../pages/admin-center/users/users'));
const Teams = lazy(() => import('../pages/admin-center/teams/teams'));
const Billing = lazy(() => import('../pages/admin-center/billing/billing'));
const Projects = lazy(() => import('../pages/admin-center/projects/projects'));
const Settings = lazy(() => import('../pages/admin-center/settings/Settings'));

// type of a menu item in admin center sidebar
type AdminCenterMenuItems = {
  key: string;
  name: string;
  endpoint: string;
  icon: ReactNode;
  element: ReactNode;
};
// settings all element items use for sidebar and routes
export const adminCenterItems: AdminCenterMenuItems[] = [
  {
    key: 'overview',
    name: 'overview',
    endpoint: 'overview',
    icon: React.createElement(AppstoreOutlined),
    element: React.createElement(Overview),
  },
  {
    key: 'users',
    name: 'users',
    endpoint: 'users',
    icon: React.createElement(UserOutlined),
    element: React.createElement(Users),
  },
  {
    key: 'teams',
    name: 'teams',
    endpoint: 'teams',
    icon: React.createElement(TeamOutlined),
    element: React.createElement(Teams),
  },
  {
    key: 'projects',
    name: 'projects',
    endpoint: 'projects',
    icon: React.createElement(ProfileOutlined),
    element: React.createElement(Projects),
  },
  {
    key: 'billing',
    name: 'billing',
    endpoint: 'billing',
    icon: React.createElement(CreditCardOutlined),
    element: React.createElement(Billing),
  },
  {
    key: 'settings',
    name: 'settings',
    endpoint: 'settings',
    icon: React.createElement(SettingOutlined),
    element: React.createElement(Settings),
  },
];
