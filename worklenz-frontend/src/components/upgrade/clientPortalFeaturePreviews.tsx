import React from 'react';
import { useTranslation } from 'react-i18next';
import ClientsPreviewMockup from './mockups/ClientsPreviewMockup';
import ClientPortalWorkspacePreviewMockup from './mockups/ClientPortalWorkspacePreviewMockup';
import ClientPortalInvoicesPreviewMockup from './mockups/ClientPortalInvoicesPreviewMockup';
import ClientPortalSettingsPreviewMockup from './mockups/ClientPortalSettingsPreviewMockup';

export interface ClientPortalFeaturePreview {
  title: string;
  description: string;
  features: string[];
  mockup: React.ReactNode;
}

const NAMESPACES = [
  'upgrade-preview',
  'client-portal-v2-overview',
  'client-portal-clients',
  'client-portal-invoices',
  'client-portal-settings',
  'client-portal-v2-projects',
  'client-portal-v2-approvals',
  'client-portal-v2-change-requests',
  'client-portal-v2-discussions',
  'client-portal-v2-audit',
  'client-portal-v2-preview',
];

// Per-tab locked-state previews for Client Portal, shown with the "Upgrade Now" CTA to workspaces
// without the Business plan. Titles reuse each page's own namespace (kept in sync with the unlocked
// page); descriptions and feature bullets are paywall copy that lives in upgrade-preview.json.
//
// The keys are the first path segment of each Client Portal route. Services, Requests, Chats and
// Ticketing are retired in v2, so they have no preview.
export const useClientPortalFeaturePreviews = (): Record<string, ClientPortalFeaturePreview> => {
  const { t } = useTranslation(NAMESPACES);

  const copy = (key: string, defaultDescription: string) => ({
    description: t(`cards.clientPortal.${key}.description`, {
      ns: 'upgrade-preview',
      defaultValue: defaultDescription,
    }),
    features: t(`cards.clientPortal.${key}.features`, {
      ns: 'upgrade-preview',
      returnObjects: true,
      defaultValue: [],
    }) as string[],
  });

  const projectsTitle = t('list.title', { ns: 'client-portal-v2-projects', defaultValue: 'Portal Projects' });
  const projectsDescription = t('list.description', {
    ns: 'client-portal-v2-projects',
    defaultValue: 'Choose which projects are visible in the Client Portal and what is shared inside each one.',
  });
  const approvalsTitle = t('list.title', { ns: 'client-portal-v2-approvals', defaultValue: 'Approvals' });
  const approvalsDescription = t('list.description', {
    ns: 'client-portal-v2-approvals',
    defaultValue: 'Ask a client to approve a file, milestone, task or free-form item.',
  });
  const changeRequestsTitle = t('list.title', {
    ns: 'client-portal-v2-change-requests',
    defaultValue: 'Change Requests',
  });
  const changeRequestsDescription = t('list.description', {
    ns: 'client-portal-v2-change-requests',
    defaultValue: 'Scope and feature changes your clients ask for.',
  });
  const discussionsTitle = t('page.title', { ns: 'client-portal-v2-discussions', defaultValue: 'Discussions' });
  const discussionsDescription = t('page.description', {
    ns: 'client-portal-v2-discussions',
    defaultValue: 'Client conversations attached to the project, task, file or approval they are about.',
  });
  const auditTitle = t('title', { ns: 'client-portal-v2-audit', defaultValue: 'Audit Log' });
  const auditDescription = t('description', {
    ns: 'client-portal-v2-audit',
    defaultValue: 'Every important client and internal action, timestamped and attributed to a user.',
  });
  const previewTitle = t('title', { ns: 'client-portal-v2-preview', defaultValue: 'Client Portal' });
  const previewDescription = t('description', {
    ns: 'client-portal-v2-preview',
    defaultValue: 'A read-only preview of what one client user sees.',
  });

  const overviewTitle = t('page.title', { ns: 'client-portal-v2-overview', defaultValue: 'Overview' });
  const overviewDescription = t('page.description', {
    ns: 'client-portal-v2-overview',
    defaultValue: 'What needs your attention across clients, projects and discussions.',
  });

  return {
    overview: {
      title: overviewTitle,
      ...copy('overview', 'See pending approvals, change requests, milestones and mentions in one customizable dashboard.'),
      mockup: (
        <ClientPortalWorkspacePreviewMockup
          title={overviewTitle}
          description={overviewDescription}
          columns={[
            t('widgets.kpi_awaiting_approvals.title', {
              ns: 'client-portal-v2-overview',
              defaultValue: 'Pending approvals',
            }),
            t('widgets.upcoming_milestones.title', {
              ns: 'client-portal-v2-overview',
              defaultValue: 'Upcoming milestones',
            }),
            t('widgets.mentions_me.title', { ns: 'client-portal-v2-overview', defaultValue: 'Mentions of me' }),
          ]}
        />
      ),
    },
    clients: {
      title: t('pageTitle', { ns: 'client-portal-clients', defaultValue: 'Clients' }),
      ...copy('clients', 'Give clients a branded portal to track project progress, share files, and stay in the loop.'),
      mockup: <ClientsPreviewMockup />,
    },
    projects: {
      title: projectsTitle,
      ...copy('projects', 'Choose which projects clients can see and what is shared inside each one.'),
      mockup: (
        <ClientPortalWorkspacePreviewMockup
          title={projectsTitle}
          description={projectsDescription}
          columns={[
            t('list.columns.project', { ns: 'client-portal-v2-projects', defaultValue: 'Project' }),
            t('list.columns.status', { ns: 'client-portal-v2-projects', defaultValue: 'Client-facing status' }),
            t('list.columns.progress', { ns: 'client-portal-v2-projects', defaultValue: 'Progress' }),
            t('list.columns.portal', { ns: 'client-portal-v2-projects', defaultValue: 'Portal' }),
          ]}
        />
      ),
    },
    approvals: {
      title: approvalsTitle,
      ...copy('approvals', 'Get formal, recorded sign-off from clients on exact file versions.'),
      mockup: (
        <ClientPortalWorkspacePreviewMockup
          title={approvalsTitle}
          description={approvalsDescription}
          columns={[
            t('list.columns.id', { ns: 'client-portal-v2-approvals', defaultValue: 'ID' }),
            t('list.columns.approval', { ns: 'client-portal-v2-approvals', defaultValue: 'Approval' }),
            t('list.columns.due', { ns: 'client-portal-v2-approvals', defaultValue: 'Due' }),
            t('list.columns.status', { ns: 'client-portal-v2-approvals', defaultValue: 'Status' }),
          ]}
        />
      ),
    },
    'change-requests': {
      title: changeRequestsTitle,
      ...copy('changeRequests', 'Review, estimate and decide on scope changes, then turn approved ones into work.'),
      mockup: (
        <ClientPortalWorkspacePreviewMockup
          title={changeRequestsTitle}
          description={changeRequestsDescription}
          columns={[
            t('list.columns.id', { ns: 'client-portal-v2-change-requests', defaultValue: 'ID' }),
            t('list.columns.request', { ns: 'client-portal-v2-change-requests', defaultValue: 'Request' }),
            t('list.columns.status', { ns: 'client-portal-v2-change-requests', defaultValue: 'Status' }),
            t('list.columns.estimate', { ns: 'client-portal-v2-change-requests', defaultValue: 'Estimate' }),
          ]}
        />
      ),
    },
    discussions: {
      title: discussionsTitle,
      ...copy('discussions', 'Talk to clients about the exact task, file or approval, with internal comments kept private.'),
      mockup: (
        <ClientPortalWorkspacePreviewMockup
          title={discussionsTitle}
          description={discussionsDescription}
          columns={[
            t('list.search', { ns: 'client-portal-v2-discussions', defaultValue: 'Search discussions' }),
            t('list.all', { ns: 'client-portal-v2-discussions', defaultValue: 'All' }),
          ]}
        />
      ),
    },
    invoices: {
      title: t('title', { ns: 'client-portal-invoices', defaultValue: 'Invoices' }),
      ...copy('invoices', 'Create, send, and track client invoices without leaving Worklenz.'),
      mockup: <ClientPortalInvoicesPreviewMockup />,
    },
    'audit-log': {
      title: auditTitle,
      ...copy('auditLog', 'A tamper-proof record of client and team activity.'),
      mockup: (
        <ClientPortalWorkspacePreviewMockup
          title={auditTitle}
          description={auditDescription}
          columns={[
            t('columns.when', { ns: 'client-portal-v2-audit', defaultValue: 'When' }),
            t('columns.actor', { ns: 'client-portal-v2-audit', defaultValue: 'Actor' }),
            t('columns.event', { ns: 'client-portal-v2-audit', defaultValue: 'Event' }),
            t('columns.target', { ns: 'client-portal-v2-audit', defaultValue: 'Target' }),
          ]}
        />
      ),
    },
    settings: {
      title: t('title', { ns: 'client-portal-settings', defaultValue: 'Portal Settings' }),
      ...copy('settings', 'Customize your client portal with your own branding.'),
      mockup: <ClientPortalSettingsPreviewMockup />,
    },
    preview: {
      title: previewTitle,
      ...copy('preview', 'See exactly what a client sees before you share anything.'),
      mockup: (
        <ClientPortalWorkspacePreviewMockup
          title={previewTitle}
          description={previewDescription}
          columns={[
            t('tabs.dashboard', { ns: 'client-portal-v2-preview', defaultValue: 'Dashboard' }),
            t('tabs.projects', { ns: 'client-portal-v2-preview', defaultValue: 'Projects' }),
            t('tabs.approvals', { ns: 'client-portal-v2-preview', defaultValue: 'Approvals' }),
          ]}
        />
      ),
    },
  };
};
