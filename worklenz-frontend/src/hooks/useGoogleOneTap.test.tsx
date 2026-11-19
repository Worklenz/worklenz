import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useGoogleOneTap } from './useGoogleOneTap';

const mocks = vi.hoisted(() => ({
  config: vi.fn(), verify: vi.fn(), challenge: vi.fn(), login: vi.fn(),
  navigate: vi.fn(), error: vi.fn(),
}));
vi.mock('@/api/auth/auth.api.service', () => ({ authApiService: {
  googleOneTapConfig: mocks.config, verify: mocks.verify, googleOneTapChallenge: mocks.challenge,
  googleOneTapLogin: mocks.login,
} }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, options: { defaultValue: string }) => options.defaultValue }) }));
vi.mock('@/shared/antd-imports', () => ({ message: { error: mocks.error } }));

const initialize = vi.fn();
const prompt = vi.fn();
const cancel = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  window.google = { accounts: { id: { initialize, prompt, cancel } } };
  mocks.config.mockResolvedValue({ enabled: true, clientId: 'client-id' });
  mocks.verify.mockResolvedValue({ authenticated: false });
  mocks.challenge.mockResolvedValue('nonce');
  mocks.login.mockResolvedValue(undefined);
});
afterEach(() => { delete window.google; });

describe('Google One Tap', () => {
  it('does not prompt when disabled or an existing session is authenticated', async () => {
    mocks.config.mockResolvedValueOnce({ enabled: false });
    const first = renderHook(() => useGoogleOneTap(true));
    await waitFor(() => expect(mocks.config).toHaveBeenCalled());
    expect(mocks.verify).not.toHaveBeenCalled();
    first.unmount();
    mocks.verify.mockResolvedValueOnce({ authenticated: true });
    renderHook(() => useGoogleOneTap(true));
    await waitFor(() => expect(mocks.verify).toHaveBeenCalled());
    expect(prompt).not.toHaveBeenCalled();
    expect(mocks.challenge).not.toHaveBeenCalled();
  });

  it('submits a credential once and completes the existing authentication flow', async () => {
    const { unmount } = renderHook(() => useGoogleOneTap(true));
    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    const options = initialize.mock.calls[0][0];
    expect(options).toMatchObject({ client_id: 'client-id', nonce: 'nonce', auto_select: false });
    act(() => { options.callback({ credential: 'credential' }); options.callback({ credential: 'credential' }); });
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/auth/authenticating', { replace: true }));
    expect(mocks.login).toHaveBeenCalledOnce();
    expect(mocks.login).toHaveBeenCalledWith('credential');
    unmount();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('shows a localized fallback error when login fails', async () => {
    mocks.login.mockRejectedValueOnce(new Error('rejected'));
    renderHook(() => useGoogleOneTap(true));
    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    act(() => initialize.mock.calls[0][0].callback({ credential: 'credential' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('another sign-in method')));
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
