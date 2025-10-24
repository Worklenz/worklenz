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
const Billing = lazy(() => import('../pages/admin-center/billing/BillingSection'));
const Projects = lazy(() => import('../pages/admin-center/projects/projects'));
const Settings = lazy(() => import('../pages/admin-center/settings/settings'));

// type of a menu item in admin center sidebar
type AdminCenterMenuItems = {
  key: string;
  name: string;
  defaultValue: string;
  endpoint: string;
  icon: ReactNode;
  element: ReactNode;
  selfHostedExcluded?: boolean;
};
// settings all element items use for sidebar and routes
export const adminCenterItems: AdminCenterMenuItems[] = [
  {
    key: 'overview',
    name: 'overview',
    defaultValue: 'Overview',
    endpoint: 'overview',
    icon: React.createElement(AppstoreOutlined),
    element: React.createElement(Overview),
  },
  {
    key: 'users',
    name: 'users',
    defaultValue: 'Users',
    endpoint: 'users',
    icon: React.createElement(UserOutlined),
    element: React.createElement(Users),
  },
  {
    key: 'teams',
    name: 'teams',
    defaultValue: 'Teams',
    endpoint: 'teams',
    icon: React.createElement(TeamOutlined),
    element: React.createElement(Teams),
  },
  {
    key: 'projects',
    name: 'projects',
    defaultValue: 'Projects',
    endpoint: 'projects',
    icon: React.createElement(ProfileOutlined),
    element: React.createElement(Projects),
  },
  {
    key: 'billing',
    name: 'billing',
    defaultValue: 'Billing',
    endpoint: 'billing',
    icon: React.createElement(CreditCardOutlined),
    element: React.createElement(Billing),
    selfHostedExcluded: true,
  },
  {
    key: 'settings',
    name: 'settings',
    defaultValue: 'Settings',
    endpoint: 'settings',
    icon: React.createElement(SettingOutlined),
    element: React.createElement(Settings),
  },
];
