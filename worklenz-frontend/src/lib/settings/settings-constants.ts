import {
  BankOutlined,
  DollarCircleOutlined,
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
} from '@ant-design/icons';
import React, { ReactNode } from 'react';
import ProfileSettings from '../../pages/settings/profile/profile-settings';
import NotificationsSettings from '../../pages/settings/notifications/notifications-settings';
import ClientsSettings from '../../pages/settings/clients/clients-settings';
import JobTitlesSettings from '@/pages/settings/job-titles/job-titles-settings';
import LabelsSettings from '../../pages/settings/labels/labels-settings';
import CategoriesSettings from '../../pages/settings/categories/categories-settings';
import ProjectTemplatesSettings from '@/pages/settings/project-templates/project-templates-settings';
import TaskTemplatesSettings from '@/pages/settings/task-templates/task-templates-settings';
import TeamMembersSettings from '@/pages/settings/team-members/team-members-settings';
import TeamsSettings from '../../pages/settings/teams/teams-settings';
import ChangePassword from '@/pages/settings/change-password/change-password';
import LanguageAndRegionSettings from '@/pages/settings/language-and-region/language-and-region-settings';
import RatecardSettings from '@/pages/settings/ratecard/ratecard-settings';
import AppearanceSettings from '@/pages/settings/appearance/appearance-settings';

// type of menu item in settings sidebar
type SettingMenuItems = {
  key: string;
  name: string;
  endpoint: string;
  icon: ReactNode;
  element: ReactNode;
  adminOnly?: boolean;
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
  // {
  //   key: 'project-templates',
  //   name: 'project-templates',
  //   endpoint: 'project-templates',
  //   icon: React.createElement(FileZipOutlined),
  //   element: React.createElement(ProjectTemplatesSettings),
  //   adminOnly: true,
  // },
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
    key: 'ratecard',
    name: 'Rate Card',
    endpoint: 'ratecard',
    icon: React.createElement(DollarCircleOutlined),
    element: React.createElement(RatecardSettings),
  },
  {
    key: 'teams',
    name: 'teams',
    endpoint: 'teams',
    icon: React.createElement(BankOutlined),
    element: React.createElement(TeamsSettings),
    adminOnly: true,
  },
];

export const getAccessibleSettings = (isAdmin: boolean) => {
  return settingsItems.filter(item => !item.adminOnly || isAdmin);
};
