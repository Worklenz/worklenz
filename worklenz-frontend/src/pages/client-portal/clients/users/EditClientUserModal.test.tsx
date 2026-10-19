import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: Record<string, unknown>) =>
      String(options?.defaultValue ?? '').replace(/{{(\w+)}}/g, (_match, name: string) =>
        String(options?.[name] ?? '')
      ),
    i18n: { language: 'en' },
  }),
}));

const state = vi.hoisted(() => ({ update: vi.fn() }));

vi.mock('@/api/client-portal/portal-access-api', () => ({
  useUpdatePortalClientUserMutation: () => [
    (...args: unknown[]) => {
      const promise = Promise.resolve().then(() => state.update(...args));
      return Object.assign(promise, { unwrap: () => promise });
    },
    { isLoading: false },
  ],
}));

vi.mock('@/api/client-portal/portal-api-utils', () => ({
  getPortalErrorCode: (error: { code?: string }) => error.code,
  getPortalErrorMessage: (error: { message?: string }, fallback: string) => error.message ?? fallback,
}));

import { EditClientUserModal } from './EditClientUserModal';
import type { ClientUser } from '@/types/client-portal/v2';

const USER = {
  id: 'user-1',
  name: 'Ada Admin',
  email: 'ada@example.com',
  phone: null,
  job_title: null,
  role: 'admin',
  organization_name: 'Brandbase',
} as unknown as ClientUser;

const lastBody = () => (state.update.mock.calls.at(-1)![0] as { body: Record<string, unknown> }).body;

describe('EditClientUserModal warnings', () => {
  beforeEach(() => {
    state.update.mockReset();
  });

  it('confirms the last-admin and the only-approver warnings one after the other', async () => {
    const user = userEvent.setup();
    state.update
      .mockRejectedValueOnce({ code: 'LAST_CLIENT_ADMIN', message: 'Ada is the last active Client Admin.' })
      .mockRejectedValueOnce({ code: 'PENDING_APPROVALS', message: 'Ada is the only approver.' })
      .mockResolvedValueOnce({});
    const onClose = vi.fn();
    render(<EditClientUserModal user={USER} onClose={onClose} />);

    // The backend only raises these warnings when an admin is demoted.
    await user.click(screen.getByRole('radio', { name: /Client Member/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('This is the last Client Admin')).toBeTruthy();
    expect(lastBody().role).toBe('member');
    expect(lastBody().confirm_last_admin).toBeUndefined();
    expect(lastBody().confirm_pending_approvals).toBeUndefined();

    await user.click(screen.getByRole('button', { name: 'Continue anyway' }));
    expect(await screen.findByText('This leaves an approval without an approver')).toBeTruthy();
    // Confirming the first warning must not pre-confirm the second one.
    expect(state.update.mock.calls[1][0].body.confirm_last_admin).toBe(true);
    expect(state.update.mock.calls[1][0].body.confirm_pending_approvals).toBeUndefined();
    expect(state.update.mock.calls[1][0].body.role).toBe('member');

    await user.click(screen.getByRole('button', { name: 'Continue anyway' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(lastBody().confirm_last_admin).toBe(true);
    expect(lastBody().confirm_pending_approvals).toBe(true);
    expect(lastBody().role).toBe('member');
  });
});
