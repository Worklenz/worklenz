import React, { lazy } from 'react';
import { BankOutlined, DeleteOutlined, BellOutlined, BgColorsOutlined, GlobalOutlined, QuestionCircleOutlined, TeamOutlined, UserOutlined } from '@/shared/antd-imports';

export interface SettingsNavItem {
  key: string;
  /** Route segment: `/settings/<endpoint>`. */
  endpoint: string;
  /** i18n key and English label. */
  name: string;
  defaultLabel: string;
  icon: React.ReactNode;
  groupKey: string;
  groupDefaultLabel: string;
  /** Extra words the sidebar search matches besides the label. */
  keywords?: string;
  /** Styles the group heading as destructive. */
  isDanger?: boolean;
  component: React.LazyExoticComponent<React.ComponentType>;
}

/**
 * Settings sections. Config-driven like the main app's `settingsItems`: add an entry here and the
 * sidebar, search and route pick it up without touching the page layout.
 */
export const settingsItems: SettingsNavItem[] = [
  {
    key: 'profile',
    endpoint: 'profile',
    name: 'settings.nav.profile',
    defaultLabel: 'Profile',
    icon: React.createElement(UserOutlined),
    groupKey: 'settings.groups.account',
    groupDefaultLabel: 'Account & Personal',
    keywords: 'name job title email',
    component: lazy(() => import('@/pages/v2/settings/ProfileSettings')),
  },
  {
    key: 'appearance',
    endpoint: 'appearance',
    name: 'settings.nav.appearance',
    defaultLabel: 'Appearance',
    icon: React.createElement(BgColorsOutlined),
    groupKey: 'settings.groups.account',
    groupDefaultLabel: 'Account & Personal',
    keywords: 'theme dark light mode',
    component: lazy(() => import('@/pages/v2/settings/AppearanceSettings')),
  },
  {
    key: 'language-and-region',
    endpoint: 'language-and-region',
    name: 'settings.nav.languageAndRegion',
    defaultLabel: 'Language and Region',
    icon: React.createElement(GlobalOutlined),
    groupKey: 'settings.groups.account',
    groupDefaultLabel: 'Account & Personal',
    keywords: 'language time zone timezone locale',
    component: lazy(() => import('@/pages/v2/settings/LanguageAndRegionSettings')),
  },
  {
    key: 'notifications',
    endpoint: 'notifications',
    name: 'settings.nav.notifications',
    defaultLabel: 'Notifications',
    icon: React.createElement(BellOutlined),
    groupKey: 'settings.groups.account',
    groupDefaultLabel: 'Account & Personal',
    keywords: 'email in-app alerts events notified',
    component: lazy(() => import('@/pages/v2/settings/NotificationSettings')),
  },
  {
    key: 'organization',
    endpoint: 'organization',
    name: 'settings.nav.organization',
    defaultLabel: 'Organization',
    icon: React.createElement(BankOutlined),
    groupKey: 'settings.groups.organization',
    groupDefaultLabel: 'Organization',
    keywords: 'company managed by',
    component: lazy(() => import('@/pages/v2/settings/OrganizationSettings')),
  },
  {
    key: 'members',
    endpoint: 'members',
    name: 'settings.nav.members',
    defaultLabel: 'Members',
    icon: React.createElement(TeamOutlined),
    groupKey: 'settings.groups.organization',
    groupDefaultLabel: 'Organization',
    keywords: 'people users invite colleagues remove access',
    component: lazy(() => import('@/pages/v2/settings/MembersSettings')),
  },
  {
    key: 'help',
    endpoint: 'help',
    name: 'settings.nav.help',
    defaultLabel: 'Help',
    icon: React.createElement(QuestionCircleOutlined),
    groupKey: 'settings.groups.helpSupport',
    groupDefaultLabel: 'Help & Support',
    keywords: 'documentation changelog support email community version about privacy',
    component: lazy(() => import('@/pages/v2/settings/HelpSettings')),
  },
  {
    key: 'delete-account',
    endpoint: 'delete-account',
    name: 'settings.nav.deleteAccount',
    defaultLabel: 'Delete Account',
    icon: React.createElement(DeleteOutlined),
    groupKey: 'settings.groups.dangerZone',
    groupDefaultLabel: 'Danger Zone',
    keywords: 'remove close account permanently',
    isDanger: true,
    component: lazy(() => import('@/pages/v2/settings/DeleteAccountSettings')),
  },
];

export const DEFAULT_SETTINGS_SECTION = settingsItems[0].endpoint;

/** The locales the portal ships (folders under `src/locales`). Codes match them. */
export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'pt', label: 'Português' },
  { value: 'al', label: 'Shqip' },
  { value: 'de', label: 'Deutsch' },
  { value: 'zh', label: '简体中文' },
  { value: 'pl', label: 'Polski' },
  { value: 'fr', label: 'Français' },
] as const;
