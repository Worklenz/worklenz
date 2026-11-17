import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card, ConfigProvider, theme } from '@/shared/antd-imports';
import taskManagementStyles from '@/styles/task-management.css?raw';
import { openAddClientWizard } from '@/features/clients-portal/clients/clients-slice';
import type { PreviewUser } from '@/types/client-portal/v2';

const activeUser: PreviewUser = {
  id: 'user-1',
  name: 'Client Person',
  email: 'client@example.com',
  role: 'admin',
  organization_id: 'client-1',
  organization_name: 'Client organization',
  status: 'active',
};

const state = vi.hoisted(() => ({
  getBranding: vi.fn(),
  dispatch: vi.fn(),
  usersBody: {
    users: [] as PreviewUser[],
    has_client_users: true,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? ''),
  }),
}));

vi.mock('react-router-dom', () => ({ useSearchParams: () => [new URLSearchParams()] }));

vi.mock('@/api/settings/profile/profile-settings.api.service', () => ({
  profileSettingsApiService: { getClientPortalSettings: () => state.getBranding() },
}));

vi.mock('@/api/client-portal/portal-projects-api', () => ({
  useGetProjectAccessQuery: () => ({ isLoading: false }),
}));

vi.mock('@/hooks/useAppDispatch', () => ({
  useAppDispatch: () => state.dispatch,
}));

vi.mock('@/api/client-portal/portal-workflow-api', () => ({
  useGetPreviewUsersQuery: () => ({
    data: { body: state.usersBody },
    isLoading: false,
    isError: false,
  }),
  useGetPreviewQuery: () => ({
    data: {
      body: {
        user: { name: 'Client Person', role: 'admin' },
        role: { can: {} },
        hidden: { milestones: 0, tasks: 0, files: 0, draft_approvals: 0 },
      },
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/components/client-portal/v2', () => ({
  RoleTag: () => null,
  StatusTag: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  PortalLoader: () => null,
  ROLE_LABEL_COPY: { admin: { key: 'role.admin', defaultValue: 'Client Admin' } },
}));

// Keep the preview data small while exercising real Ant Design styles and theme context.
vi.mock('./PreviewViews', async () => {
  const { Button, Card, Tag, theme } = await import('@/shared/antd-imports');
  return {
    PreviewDashboard: () => {
      const { token } = theme.useToken();
      return (
        <Card data-testid="portal-card" title="Preview content">
          <Button>Preview action</Button>
          <Tag>Preview status</Tag>
          <span data-testid="portal-text" style={{ color: token.colorText }}>Portal text</span>
        </Card>
      );
    },
    PreviewProjects: () => null,
    PreviewDiscussions: () => null,
    PreviewApprovals: () => null,
    PreviewChangeRequests: () => null,
    PreviewError: () => null,
  };
});

import ClientPortalPreviewPage from './ClientPortalPreviewPage';

let globalStyles: HTMLStyleElement;

beforeEach(() => {
  vi.clearAllMocks();
  state.usersBody = { users: [{ ...activeUser }], has_client_users: true };
  globalStyles = document.createElement('style');
  globalStyles.textContent = taskManagementStyles;
  document.head.append(globalStyles);
});

afterEach(() => {
  cleanup();
  globalStyles.remove();
  document.documentElement.classList.remove('dark', 'light');
});

const renderPreview = (adminTheme: 'light' | 'dark') => {
  document.documentElement.classList.add(adminTheme);
  return render(
    <ConfigProvider
      theme={{
        algorithm: adminTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: { colorBgContainer: adminTheme === 'dark' ? '#1f1f1f' : '#ffffff' },
      }}
    >
      <Card data-testid="admin-card">Admin content</Card>
      <ClientPortalPreviewPage />
    </ConfigProvider>
  );
};

const expectPortalTheme = (portalTheme: 'light' | 'dark') => {
  const card = screen.getByTestId('portal-card');
  expect(card).toHaveClass('portal-preview-card');
  expect(card).not.toHaveClass('ant-card');
  expect(screen.getByRole('button', { name: 'Preview action' })).toHaveClass('portal-preview-btn');
  expect(screen.getByText('Preview status')).toHaveClass('portal-preview-tag');
  expect(getComputedStyle(card).backgroundColor).toBe(portalTheme === 'dark' ? 'rgb(31, 31, 31)' : 'rgb(255, 255, 255)');
  expect(getComputedStyle(screen.getByTestId('portal-text')).color).toBe(
    portalTheme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.88)'
  );
};

describe('ClientPortalPreviewPage users', () => {
  it('labels a client user who has not accepted the invite', () => {
    state.usersBody = {
      users: [{ ...activeUser, status: 'invited', name: 'Pending Person' }],
      has_client_users: true,
    };
    state.getBranding.mockResolvedValue({ done: true, body: { portal_theme: 'light' } });
    renderPreview('light');

    expect(screen.getByText('Pending invite')).toBeInTheDocument();
    expect(screen.getByText('{{name}} · {{role}} · Pending invite')).toBeInTheDocument();
  });

  it('offers add client and add client user when nobody has been added', async () => {
    const user = userEvent.setup();
    state.usersBody = { users: [], has_client_users: false };
    state.getBranding.mockResolvedValue({ done: true, body: { portal_theme: 'light' } });
    renderPreview('light');

    expect(
      screen.getByText('No client users yet. Add a client and a client user, then assign a project to preview the portal.')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add client' }));
    await user.click(screen.getByRole('button', { name: 'Add client user' }));

    expect(state.dispatch).toHaveBeenNthCalledWith(1, openAddClientWizard('new_organization'));
    expect(state.dispatch).toHaveBeenNthCalledWith(2, openAddClientWizard('existing_organization'));
  });

  it('asks for a project when client users exist but none can be previewed', () => {
    state.usersBody = { users: [], has_client_users: true };
    state.getBranding.mockResolvedValue({ done: true, body: { portal_theme: 'light' } });
    renderPreview('light');

    expect(
      screen.getByText('No client users with a project yet. Invite a user and assign a project to preview the portal.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add client' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add client user' })).not.toBeInTheDocument();
  });
});

describe('ClientPortalPreviewPage theme isolation', () => {
  it.each([
    { adminTheme: 'dark', portalTheme: 'light' },
    { adminTheme: 'light', portalTheme: 'dark' },
    { adminTheme: 'dark', portalTheme: 'dark' },
    { adminTheme: 'light', portalTheme: 'light' },
  ] as const)('uses a $portalTheme portal inside the $adminTheme admin app', async ({ adminTheme, portalTheme }) => {
    state.getBranding.mockResolvedValue({ done: true, body: { portal_theme: portalTheme, portal_title: 'Configured portal' } });
    renderPreview(adminTheme);

    await screen.findByText('Configured portal');
    await waitFor(() => expectPortalTheme(portalTheme));
    expect(screen.getByTestId('admin-card')).toHaveClass('ant-card');
    expect(getComputedStyle(screen.getByTestId('admin-card')).backgroundColor).toBe(
      adminTheme === 'dark' ? 'rgb(31, 31, 31)' : 'rgb(255, 255, 255)'
    );
  });

  it('uses the light portal default while branding loads in the dark admin app', async () => {
    state.getBranding.mockReturnValue(new Promise<never>(() => {}));
    renderPreview('dark');

    await waitFor(() => expectPortalTheme('light'));
    expect(getComputedStyle(screen.getByTestId('admin-card')).backgroundColor).toBe('rgb(31, 31, 31)');
  });
});
