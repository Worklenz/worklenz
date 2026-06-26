import RateCardSettings from '@/pages/settings/rate-card-settings/RateCardSettings';
import {
  BankOutlined,
  FileZipOutlined,
  GlobalOutlined,
  GroupOutlined,
  IdcardOutlined,
  LockOutlined,
  NotificationOutlined,
  ProfileOutlined,
  SettingOutlined,
  TagsOutlined,
  TeamOutlined,
  UserOutlined,
  UserSwitchOutlined,
  BulbOutlined,
  DeleteOutlined,
  DollarCircleOutlined,
  ApiOutlined,
} from '@/shared/antd-imports';
import { MobileOutlined } from '@ant-design/icons';
import React, { ReactNode, lazy } from 'react';
const ProfileSettings = lazy(() => import('../../pages/settings/profile/profile-settings'));
const NotificationsSettings = lazy(
  () => import('../../pages/settings/notifications/notifications-settings')
);
const ClientsSettings = lazy(() => import('../../pages/settings/clients/clients-settings'));
const JobTitlesSettings = lazy(() => import('@/pages/settings/job-titles/job-titles-settings'));
const LabelsSettings = lazy(() => import('../../pages/settings/labels/LabelsSettings'));
const CategoriesSettings = lazy(
  () => import('../../pages/settings/categories/categories-settings')
);
const ProjectTemplatesSettings = lazy(
  () => import('@/pages/settings/project-templates/project-templates-settings')
);
const TaskTemplatesSettings = lazy(
  () => import('@/pages/settings/task-templates/task-templates-settings')
);
const TeamMembersSettings = lazy(
  () => import('@/pages/settings/team-members/team-members-settings')
);
const TeamHierarchy = lazy(() => import('@/components/settings/team-hierarchy/team-hierarchy'));
const TeamsSettings = lazy(() => import('../../pages/settings/teams/teams-settings'));
const ChangePassword = lazy(() => import('@/pages/settings/change-password/change-password'));
const LanguageAndRegionSettings = lazy(
  () => import('@/pages/settings/language-and-region/language-and-region-settings')
);
const AppearanceSettings = lazy(() => import('@/pages/settings/appearance/appearance-settings'));
const AccountDeletion = lazy(() => import('@/pages/settings/account-deletion/AccountDeletion'));
const IntegrationsSettings = lazy(
  () => import('@/pages/settings/integrations/IntegrationsSettings')
);
const MobileAppSettings = lazy(
  () => import('@/pages/settings/mobile-app/mobile-app-settings')
);
const ConfigurationSettings = lazy(
  () => import('@/pages/settings/configuration/configuration-settings')
);

// type of menu item in settings sidebar
type SettingMenuItem = {
  key: string;
  name: string;
  defaultValue: string;
  endpoint: string;
  groupKey?: string;
  groupDefaultValue?: string;
  icon: ReactNode;
  element: ReactNode;
  adminOnly?: boolean;
  isDangerous?: boolean;
  businessPlanRequired?: boolean;
  showInSidebar?: boolean;
};
// settings all element items use for sidebar and routes
export const settingsItems: SettingMenuItem[] = [
  // Available for everyone
  {
    key: 'profile',
    name: 'profile',
    defaultValue: 'Profile',
    endpoint: 'profile',
    groupKey: 'account-personal',
    groupDefaultValue: 'Account & Personal',
    icon: React.createElement(UserOutlined),
    element: React.createElement(ProfileSettings),
  },
  {
    key: 'notifications',
    name: 'notifications',
    defaultValue: 'Notifications',
    endpoint: 'notifications',
    groupKey: 'account-personal',
    groupDefaultValue: 'Account & Personal',
    icon: React.createElement(NotificationOutlined),
    element: React.createElement(NotificationsSettings),
  },
  {
    key: 'appearance',
    name: 'appearance',
    defaultValue: 'Appearance',
    endpoint: 'appearance',
    groupKey: 'account-personal',
    groupDefaultValue: 'Account & Personal',
    icon: React.createElement(BulbOutlined),
    element: React.createElement(AppearanceSettings),
  },
  {
    key: 'change-password',
    name: 'change-password',
    defaultValue: 'Change Password',
    endpoint: 'password',
    groupKey: 'account-personal',
    groupDefaultValue: 'Account & Personal',
    icon: React.createElement(LockOutlined),
    element: React.createElement(ChangePassword),
  },
  {
    key: 'language-and-region',
    name: 'language-and-region',
    defaultValue: 'Language and Region',
    endpoint: 'language-and-region',
    groupKey: 'account-personal',
    groupDefaultValue: 'Account & Personal',
    icon: React.createElement(GlobalOutlined),
    element: React.createElement(LanguageAndRegionSettings),
  },
  {
    key: 'mobile-app',
    name: 'mobile-app',
    defaultValue: 'Mobile App',
    endpoint: 'mobile-app',
    groupKey: 'account-personal',
    groupDefaultValue: 'Account & Personal',
    icon: React.createElement(MobileOutlined),
    element: React.createElement(MobileAppSettings),
  },
  // Admin only items
  {
    key: 'clients',
    name: 'clients',
    defaultValue: 'Clients',
    endpoint: 'clients',
    groupKey: 'workspace-setup',
    groupDefaultValue: 'Workspace Setup',
    icon: React.createElement(UserSwitchOutlined),
    element: React.createElement(ClientsSettings),
    adminOnly: true,
  },
  {
    key: 'job-titles',
    name: 'job-titles',
    defaultValue: 'Job Titles',
    endpoint: 'job-titles',
    groupKey: 'workspace-setup',
    groupDefaultValue: 'Workspace Setup',
    icon: React.createElement(IdcardOutlined),
    element: React.createElement(JobTitlesSettings),
    adminOnly: true,
  },
  {
    key: 'labels',
    name: 'labels',
    defaultValue: 'Labels',
    endpoint: 'labels',
    groupKey: 'project-workflow',
    groupDefaultValue: 'Project & Workflow',
    icon: React.createElement(TagsOutlined),
    element: React.createElement(LabelsSettings),
    adminOnly: true,
  },
  {
    key: 'categories',
    name: 'categories',
    defaultValue: 'Categories',
    endpoint: 'categories',
    groupKey: 'project-workflow',
    groupDefaultValue: 'Project & Workflow',
    icon: React.createElement(GroupOutlined),
    element: React.createElement(CategoriesSettings),
    adminOnly: true,
  },
  {
    key: 'project-templates',
    name: 'project-templates',
    defaultValue: 'Project Templates',
    endpoint: 'project-templates',
    groupKey: 'project-workflow',
    groupDefaultValue: 'Project & Workflow',
    icon: React.createElement(FileZipOutlined),
    element: React.createElement(ProjectTemplatesSettings),
    adminOnly: true,
  },
  {
    key: 'task-templates',
    name: 'task-templates',
    defaultValue: 'Task Templates',
    endpoint: 'task-templates',
    groupKey: 'project-workflow',
    groupDefaultValue: 'Project & Workflow',
    icon: React.createElement(ProfileOutlined),
    element: React.createElement(TaskTemplatesSettings),
    adminOnly: true,
  },
  {
    key: 'team-members',
    name: 'team-members',
    defaultValue: 'Team Members',
    endpoint: 'team-members',
    groupKey: 'workspace-setup',
    groupDefaultValue: 'Workspace Setup',
    icon: React.createElement(TeamOutlined),
    element: React.createElement(TeamMembersSettings),
    adminOnly: true,
  },
  {
    key: 'team-hierarchy',
    name: 'team-hierarchy',
    defaultValue: 'Team Hierarchy',
    endpoint: 'team-hierarchy',
    groupKey: 'workspace-setup',
    groupDefaultValue: 'Workspace Setup',
    icon: React.createElement(TeamOutlined),
    element: React.createElement(TeamHierarchy),
    adminOnly: true,
  },
  {
    key: 'ratecard',
    name: 'ratecard',
    defaultValue: 'Rate Card',
    endpoint: 'ratecard',
    groupKey: 'financial-billing',
    groupDefaultValue: 'Financial & Billing',
    icon: React.createElement(DollarCircleOutlined),
    element: React.createElement(RateCardSettings),
    businessPlanRequired: true,
  },
  {
    key: 'teams',
    name: 'teams',
    defaultValue: 'Teams',
    endpoint: 'teams',
    groupKey: 'workspace-setup',
    groupDefaultValue: 'Workspace Setup',
    icon: React.createElement(BankOutlined),
    element: React.createElement(TeamsSettings),
    adminOnly: true,
  },
  {
    key: 'integrations',
    name: 'integrations',
    defaultValue: 'Integrations',
    endpoint: 'integrations',
    groupKey: 'system-integrations',
    groupDefaultValue: 'System & Integrations',
    icon: React.createElement(ApiOutlined),
    element: React.createElement(IntegrationsSettings),
    adminOnly: true,
  },
  {
    key: 'configuration',
    name: 'configuration',
    defaultValue: 'Configuration',
    endpoint: 'configuration',
    groupKey: 'system-integrations',
    groupDefaultValue: 'System & Integrations',
    icon: React.createElement(SettingOutlined),
    element: React.createElement(ConfigurationSettings),
    adminOnly: true,
    businessPlanRequired: false, // Visible to all admins; upgrade prompt shown inside
  },
  // Danger zone - always at the bottom
  {
    key: 'account-deletion',
    name: 'account-deletion',
    defaultValue: 'Account Deletion',
    endpoint: 'account-deletion',
    groupKey: 'danger-zone',
    groupDefaultValue: 'Danger Zone',
    icon: React.createElement(DeleteOutlined),
    element: React.createElement(AccountDeletion),
    isDangerous: true,
  },
];

export const getAccessibleSettings = (isAdmin: boolean, hasBusinessAccess: boolean) => {
  return settingsItems.filter(item => {
    // Check admin requirement
    if (item.adminOnly && !isAdmin) {
      return false;
    }

    // Check business plan requirement
    if (item.businessPlanRequired && !hasBusinessAccess) return false;

    return true;
  });
};
