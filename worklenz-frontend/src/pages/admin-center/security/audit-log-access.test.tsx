import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom';
import type { ILocalSession } from '@/types/auth/local-session.types';
import { createAuthService } from '@/services/auth/auth.service';
import AdminCenterSidebar from '@/pages/admin-center/sidebar/sidebar';
import adminCenterRoutes from '@/app/routes/admin-center-routes';

const mockSession: { current: ILocalSession | null } = { current: null };

vi.mock('@/utils/session-helper', () => ({
  getUserSession: () => mockSession.current,
  hasSession: () => mockSession.current !== null,
  setSession: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => createAuthService(vi.fn()),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@/layouts/AdminCenterLayout', async () => {
  const { Outlet } = await import('react-router-dom');
  return { default: () => <Outlet /> };
});

vi.mock('@/pages/admin-center/security/audit-log-page', () => ({
  default: () => <div>audit-log-page</div>,
}));

const SESSIONS: Record<string, Partial<ILocalSession>> = {
  owner: { owner: true, role_name: 'Owner', is_admin: true },
  admin: { owner: false, role_name: 'Admin', is_admin: true },
  member: { owner: false, role_name: 'Member', is_admin: false },
  teamLead: { owner: false, role_name: 'Team Lead', is_admin: false },
  teamLeadWithAdminRoleFlag: { owner: false, role_name: 'Team Lead', is_admin: true },
};

const signInAs = (role: keyof typeof SESSIONS) => {
  mockSession.current = { id: 'u1', name: 'QA', email: 'qa@example.test', ...SESSIONS[role] } as ILocalSession;
};

const renderSidebar = () =>
  render(
    <MemoryRouter initialEntries={['/worklenz/admin-center/overview']}>
      <AdminCenterSidebar />
    </MemoryRouter>
  );

const renderSecurityRoute = () => {
  const router = createMemoryRouter(
    [
      { path: '/worklenz', children: adminCenterRoutes },
      { path: '/worklenz/unauthorized', element: <div>unauthorized-page</div> },
    ],
    { initialEntries: ['/worklenz/admin-center/security'] }
  );
  render(<RouterProvider router={router} />);
};

describe('Security > Audit Log access (task 8.2)', () => {
  beforeEach(() => {
    mockSession.current = null;
  });

  it.each(['owner', 'admin'] as const)('shows the Security nav item and page to %s', async role => {
    signInAs(role);
    renderSidebar();
    expect(screen.getByRole('link', { name: 'Security' })).toBeInTheDocument();

    renderSecurityRoute();
    expect(await screen.findByText('audit-log-page')).toBeInTheDocument();
  });

  it.each(['member', 'teamLead', 'teamLeadWithAdminRoleFlag'] as const)(
    'hides the Security nav item from %s and redirects the URL to unauthorized',
    async role => {
      signInAs(role);
      renderSidebar();
      expect(screen.queryByRole('link', { name: 'Security' })).not.toBeInTheDocument();

      renderSecurityRoute();
      expect(await screen.findByText('unauthorized-page')).toBeInTheDocument();
      expect(screen.queryByText('audit-log-page')).not.toBeInTheDocument();
    }
  );
});
