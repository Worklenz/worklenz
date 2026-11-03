import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileSettings from './ProfileSettings';

const mocks = vi.hoisted(() => ({
  unwrap: vi.fn(),
  updateMe: vi.fn(),
  message: { success: vi.fn(), error: vi.fn() },
  me: { name: 'Alice', jobTitle: 'Designer', email: 'alice@example.com' },
}));
vi.mock('@/hooks/useClientAccess', () => ({
  useClientAccess: () => ({ me: mocks.me, isLoading: false, role: null, can: {} }),
}));
vi.mock('@/store/api-v2', () => ({
  useUpdateMeMutation: () => [mocks.updateMe, { isLoading: false }],
}));
vi.mock('@/hooks/useMessage', () => ({ useMessage: () => mocks.message }));
vi.mock('@/components/v2', () => ({
  useRoleLabel: () => (role: string) => role,
  errorMessage: () => undefined,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, options: { defaultValue: string }) => options.defaultValue }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateMe.mockReturnValue({ unwrap: mocks.unwrap });
  mocks.unwrap.mockResolvedValue({ ...mocks.me, name: 'Alice Updated' });
});

describe('profile save baseline', () => {
  it('ignores whitespace and disables Save again when edits are reverted', async () => {
    render(<ProfileSettings />);
    const save = screen.getByRole('button', { name: 'Save changes' });
    const name = screen.getByLabelText('Full name');
    await waitFor(() => expect(save).toBeDisabled());
    fireEvent.change(name, { target: { value: ' Alice ' } });
    expect(save).toBeDisabled();
    fireEvent.change(name, { target: { value: 'Alice Updated' } });
    expect(save).toBeEnabled();
    fireEvent.change(name, { target: { value: 'Alice' } });
    expect(save).toBeDisabled();
    expect(mocks.updateMe).not.toHaveBeenCalled();
  });

  it('disables Save after success even when the profile query has not refreshed', async () => {
    render(<ProfileSettings />);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Alice Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(mocks.message.success).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(mocks.updateMe).toHaveBeenCalledWith({ name: 'Alice Updated', job_title: 'Designer' });
  });

  it('keeps changes available for retry when saving fails', async () => {
    mocks.unwrap.mockRejectedValueOnce(new Error('Network error'));
    render(<ProfileSettings />);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Alice Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(mocks.message.error).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
});
