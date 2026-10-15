import React from 'react';
import {
  AuditOutlined,
  BarChartOutlined,
  FileDoneOutlined,
  MessageOutlined,
  ProjectOutlined,
  SwapOutlined,
} from '@/shared/antd-imports';

export type NavBadgeKey = 'discussions' | 'approvals' | 'changeRequests';

export interface ClientPortalMenuItems {
  key: string;
  /** i18n key; the English label is the default value. */
  name: string;
  defaultLabel: string;
  icon: React.ReactNode;
  /** Route segment under `/`. */
  endpoint: string;
  badge?: NavBadgeKey;
  /** Shown only when the operator turned Invoices on (GET /v2/me). */
  requiresInvoices?: boolean;
}

/** The icon-rail sidebar (umbrella #2520, "Navigation"). Order is the display order. */
export const clientPortalItems: ClientPortalMenuItems[] = [
  { key: 'dashboard', name: 'navigation.dashboard', defaultLabel: 'Overview', icon: React.createElement(BarChartOutlined), endpoint: 'dashboard' },
  { key: 'projects', name: 'navigation.projects', defaultLabel: 'Projects', icon: React.createElement(ProjectOutlined), endpoint: 'projects' },
  { key: 'discussions', name: 'navigation.discussions', defaultLabel: 'Discussions', icon: React.createElement(MessageOutlined), endpoint: 'discussions', badge: 'discussions' },
  { key: 'approvals', name: 'navigation.approvals', defaultLabel: 'Approvals', icon: React.createElement(AuditOutlined), endpoint: 'approvals', badge: 'approvals' },
  { key: 'change-requests', name: 'navigation.changeRequests', defaultLabel: 'Change Req.', icon: React.createElement(SwapOutlined), endpoint: 'change-requests', badge: 'changeRequests' },
  { key: 'invoices', name: 'navigation.invoices', defaultLabel: 'Invoices', icon: React.createElement(FileDoneOutlined), endpoint: 'invoices', requiresInvoices: true },
];
