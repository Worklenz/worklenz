import {
  AppstoreOutlined,
  CreditCardOutlined,
  ProfileOutlined,
  TeamOutlined,
  UserOutlined,
  SettingOutlined,
  SafetyCertificateOutlined,
} from '@/shared/antd-imports';
import React, { ReactNode, lazy } from 'react';
import {
  ORGANIZATION_PERMISSIONS,
  OrganizationPermission,
} from '@/types/admin-center/permission-schemes.types';

const Overview = lazy(() => import('../pages/admin-center/overview/overview'));
const Users = lazy(() => import('../pages/admin-center/users/users'));
const Teams = lazy(() => import('../pages/admin-center/teams/teams'));
const Billing = lazy(() => import('../pages/admin-center/billing/BillingSection'));
const Projects = lazy(() => import('../pages/admin-center/projects/projects'));
const Settings = lazy(() => import('../pages/admin-center/settings/settings'));
const AuditLog = lazy(() => import('../pages/admin-center/security/audit-log-page'));

/** Permissions that unlock any Admin Center page (besides Owner/Admin). */
export const ADMIN_CENTER_ENTRY_PERMISSIONS: OrganizationPermission[] = [
  ORGANIZATION_PERMISSIONS.MANAGE_USERS,
  ORGANIZATION_PERMISSIONS.MANAGE_TEAMS,
  ORGANIZATION_PERMISSIONS.MANAGE_BILLING,
  ORGANIZATION_PERMISSIONS.MANAGE_ORGANIZATION_SETTINGS,
];

export const canAccessAdminCenter = (
  isOwnerOrAdmin: boolean,
  permissions: OrganizationPermission[] = []
): boolean =>
  isOwnerOrAdmin ||
  ADMIN_CENTER_ENTRY_PERMISSIONS.some(permission => permissions.includes(permission));

// type of a menu item in admin center sidebar
export type AdminCenterMenuItems = {
  key: string;
  name: string;
  defaultValue: string;
  endpoint: string;
  icon: ReactNode;
  element: ReactNode;
  selfHostedExcluded?: boolean;
  /** Hidden from the sidebar and route-guarded unless the user is an Owner or Admin. */
  ownerOrAdminOnly?: boolean;
  /** Granted via the default permission scheme; Owners/Admins always see the item. */
  requiredPermission?: OrganizationPermission;
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
    requiredPermission: ORGANIZATION_PERMISSIONS.MANAGE_USERS,
  },
  {
    key: 'teams',
    name: 'teams',
    defaultValue: 'Teams',
    endpoint: 'teams',
    icon: React.createElement(TeamOutlined),
    element: React.createElement(Teams),
    requiredPermission: ORGANIZATION_PERMISSIONS.MANAGE_TEAMS,
  },
  {
    key: 'projects',
    name: 'projects',
    defaultValue: 'Projects',
    endpoint: 'projects',
    icon: React.createElement(ProfileOutlined),
    element: React.createElement(Projects),
    ownerOrAdminOnly: true,
  },
  {
    key: 'billing',
    name: 'billing',
    defaultValue: 'Billing',
    endpoint: 'billing',
    icon: React.createElement(CreditCardOutlined),
    element: React.createElement(Billing),
    selfHostedExcluded: true,
    requiredPermission: ORGANIZATION_PERMISSIONS.MANAGE_BILLING,
  },
  {
    key: 'settings',
    name: 'settings',
    defaultValue: 'Settings',
    endpoint: 'settings',
    icon: React.createElement(SettingOutlined),
    element: React.createElement(Settings),
    requiredPermission: ORGANIZATION_PERMISSIONS.MANAGE_ORGANIZATION_SETTINGS,
  },
  {
    key: 'security',
    name: 'security',
    defaultValue: 'Security',
    endpoint: 'security',
    icon: React.createElement(SafetyCertificateOutlined),
    element: React.createElement(AuditLog),
    ownerOrAdminOnly: true,
  },
];

export const canAccessAdminCenterItem = (
  item: AdminCenterMenuItems,
  isOwnerOrAdmin: boolean,
  permissions: OrganizationPermission[] = []
): boolean => {
  if (item.ownerOrAdminOnly && !isOwnerOrAdmin) {
    return false;
  }

  if (
    item.requiredPermission &&
    !isOwnerOrAdmin &&
    !permissions.includes(item.requiredPermission)
  ) {
    return false;
  }

  return true;
};
