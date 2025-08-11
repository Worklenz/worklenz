import {
  BankOutlined,
  FileZipOutlined,
  GlobalOutlined,
  GroupOutlined,
  IdcardOutlined,
  LockOutlined,
  NotificationOutlined,
  ProfileOutlined,
  TagsOutlined,
  TeamOutlined,
  UserOutlined,
  UserSwitchOutlined,
  BulbOutlined,
  DeleteOutlined,
} from '@/shared/antd-imports';
import React, { ReactNode, lazy } from 'react';
const ProfileSettings = lazy(() => import('../../pages/settings/profile/profile-settings'));
const NotificationsSettings = lazy(() => import('../../pages/settings/notifications/notifications-settings'));
const ClientsSettings = lazy(() => import('../../pages/settings/clients/clients-settings'));
const JobTitlesSettings = lazy(() => import('@/pages/settings/job-titles/job-titles-settings'));
const LabelsSettings = lazy(() => import('../../pages/settings/labels/LabelsSettings'));
const CategoriesSettings = lazy(() => import('../../pages/settings/categories/categories-settings'));
const ProjectTemplatesSettings = lazy(() => import('@/pages/settings/project-templates/project-templates-settings'));
const TaskTemplatesSettings = lazy(() => import('@/pages/settings/task-templates/task-templates-settings'));
const TeamMembersSettings = lazy(() => import('@/pages/settings/team-members/team-members-settings'));
const TeamsSettings = lazy(() => import('../../pages/settings/teams/teams-settings'));
const ChangePassword = lazy(() => import('@/pages/settings/change-password/change-password'));
const LanguageAndRegionSettings = lazy(() => import('@/pages/settings/language-and-region/language-and-region-settings'));
const AppearanceSettings = lazy(() => import('@/pages/settings/appearance/appearance-settings'));
const AccountDeletion = lazy(() => import('@/pages/settings/account-deletion/AccountDeletion'));

// type of menu item in settings sidebar
type SettingMenuItems = {
  key: string;
  name: string;
  endpoint: string;
  icon: ReactNode;
  element: ReactNode;
  adminOnly?: boolean;
  isDangerous?: boolean;
};
// settings all element items use for sidebar and routes
export const settingsItems: SettingMenuItems[] = [
  // Available for everyone
  {
    key: 'profile',
    name: 'profile',
    endpoint: 'profile',
    icon: React.createElement(UserOutlined),
    element: React.createElement(ProfileSettings),
  },
  {
    key: 'notifications',
    name: 'notifications',
    endpoint: 'notifications',
    icon: React.createElement(NotificationOutlined),
    element: React.createElement(NotificationsSettings),
  },
  {
    key: 'appearance',
    name: 'appearance',
    endpoint: 'appearance',
    icon: React.createElement(BulbOutlined),
    element: React.createElement(AppearanceSettings),
  },
  {
    key: 'change-password',
    name: 'change-password',
    endpoint: 'password',
    icon: React.createElement(LockOutlined),
    element: React.createElement(ChangePassword),
  },
  {
    key: 'language-and-region',
    name: 'language-and-region',
    endpoint: 'language-and-region',
    icon: React.createElement(GlobalOutlined),
    element: React.createElement(LanguageAndRegionSettings),
  },
  // Admin only items
  {
    key: 'clients',
    name: 'clients',
    endpoint: 'clients',
    icon: React.createElement(UserSwitchOutlined),
    element: React.createElement(ClientsSettings),
    adminOnly: true,
  },
  {
    key: 'job-titles',
    name: 'job-titles',
    endpoint: 'job-titles',
    icon: React.createElement(IdcardOutlined),
    element: React.createElement(JobTitlesSettings),
    adminOnly: true,
  },
  {
    key: 'labels',
    name: 'labels',
    endpoint: 'labels',
    icon: React.createElement(TagsOutlined),
    element: React.createElement(LabelsSettings),
    adminOnly: true,
  },
  {
    key: 'categories',
    name: 'categories',
    endpoint: 'categories',
    icon: React.createElement(GroupOutlined),
    element: React.createElement(CategoriesSettings),
    adminOnly: true,
  },
  {
    key: 'project-templates',
    name: 'project-templates',
    endpoint: 'project-templates',
    icon: React.createElement(FileZipOutlined),
    element: React.createElement(ProjectTemplatesSettings),
    adminOnly: true,
  },
  {
    key: 'task-templates',
    name: 'task-templates',
    endpoint: 'task-templates',
    icon: React.createElement(ProfileOutlined),
    element: React.createElement(TaskTemplatesSettings),
    adminOnly: true,
  },
  {
    key: 'team-members',
    name: 'team-members',
    endpoint: 'team-members',
    icon: React.createElement(TeamOutlined),
    element: React.createElement(TeamMembersSettings),
    adminOnly: true,
  },
  {
    key: 'teams',
    name: 'teams',
    endpoint: 'teams',
    icon: React.createElement(BankOutlined),
    element: React.createElement(TeamsSettings),
    adminOnly: true,
  },
  // Danger zone - always at the bottom
  {
    key: 'account-deletion',
    name: 'account-deletion',
    endpoint: 'account-deletion',
    icon: React.createElement(DeleteOutlined),
    element: React.createElement(AccountDeletion),
    isDangerous: true,
  },
];

export const getAccessibleSettings = (isAdmin: boolean) => {
  return settingsItems.filter(item => !item.adminOnly || isAdmin);
};
