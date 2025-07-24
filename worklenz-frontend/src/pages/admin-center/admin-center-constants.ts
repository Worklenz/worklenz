import {
  AppstoreOutlined,
  CreditCardOutlined,
  ProfileOutlined,
  TeamOutlined,
  UserOutlined,
} from '@/shared/antd-imports';
import React, { ReactNode, lazy } from 'react';
const Overview = lazy(() => import('./overview/overview'));
const Users = lazy(() => import('./users/users'));
const Teams = lazy(() => import('./teams/teams'));
const Billing = lazy(() => import('./billing/billing'));
const Projects = lazy(() => import('./projects/projects'));

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
];
