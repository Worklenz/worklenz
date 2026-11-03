import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import InviteTeamMembers from './InviteTeamMembers';

const createTeamMember = vi.hoisted(() => vi.fn());
vi.mock('@/shared/antd-imports', async () => ({
  ...(await import('antd')),
  ...(await import('@ant-design/icons')),
}));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector({
    memberReducer: { isInviteMemberDrawerOpen: true, inviteMemberPrefillEmail: '' },
  }),
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuthService: () => ({ getCurrentSession: () => ({}) }) }));
vi.mock('@/hooks/useMixpanelTracking', () => ({ useMixpanelTracking: () => ({ trackMixpanelEvent: vi.fn() }) }));
vi.mock('@/api/team-members/teamMembers.api.service', () => ({ teamMembersApiService: { createTeamMember } }));
vi.mock('@/components/settings/role-permissions-popover', () => ({ RolePermissionsPopover: () => null }));
vi.mock('@/components/common/seat-limit-modal', () => ({ SeatLimitModal: () => null }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({
  t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
}) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('submits a typed email as an array of addresses', async () => {
  createTeamMember.mockResolvedValue({ done: true });
  render(<InviteTeamMembers />);
  const input = screen.getByLabelText('Email Address');
  fireEvent.change(input, { target: { value: 'member@example.com' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
  fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }));
  await waitFor(() => expect(createTeamMember).toHaveBeenCalledWith(expect.objectContaining({
    emails: ['member@example.com'],
  })));
});
