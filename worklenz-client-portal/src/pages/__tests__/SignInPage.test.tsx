import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: Record<string, unknown>) =>
      String(options?.defaultValue ?? '').replace(/{{(\w+)}}/g, (_match, name: string) => String(options?.[name] ?? '')),
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/components/AuthPageHeader', () => ({
  default: ({ description }: { description: string }) => <div data-testid="header">{description}</div>,
}));

const api = vi.hoisted(() => ({
  requestSignInCode: vi.fn(),
  verifySignInCode: vi.fn(),
  setToken: vi.fn(),
}));

vi.mock('@/services/api', () => ({ default: api, clientPortalAPI: api }));

import { saveReturnTo } from '@/utils/returnTo';
import authReducer from '@/store/slices/authSlice';
import uiReducer from '@/store/slices/uiSlice';
import SignInPage from '../SignInPage';

const requested = (overrides: Record<string, unknown> = {}) => ({
  done: true,
  body: {
    email: 'alex@brandbase.com',
    maskedEmail: 'a***@brandbase.com',
    expiresInSeconds: 600,
    resendAfterSeconds: 60,
    organizationName: null,
    ...overrides,
  },
});

const session = {
  done: true,
  body: {
    token: 'signed.jwt.token',
    expiresAt: '2030-01-01T00:00:00.000Z',
    user: { id: 'login-1', email: 'alex@brandbase.com', name: 'Alex', role: 'member', organizations: [], organizationId: 'team-1' },
  },
};

const apiError = (status: number, code: string, message: string) => ({
  response: { status, data: { message, body: { code } } },
});

const renderPage = (path: string) => {
  const store = configureStore({ reducer: { auth: authReducer, ui: uiReducer } });
  const view = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/auth/login" element={<SignInPage />} />
          <Route path="/invite" element={<SignInPage />} />
          <Route path="/dashboard" element={<div>dashboard</div>} />
          <Route path="/approvals/:id" element={<div>approval page</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
  return { store, ...view };
};

const typeCode = async (code: string) => {
  const boxes = screen.getAllByRole('textbox');
  await userEvent.click(boxes[0]);
  await userEvent.keyboard(code);
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  api.requestSignInCode.mockResolvedValue(requested());
  api.verifySignInCode.mockResolvedValue(session);
});

describe('SignInPage: typed address', () => {
  it('asks for an email, sends a code, then signs in with it', async () => {
    const { store } = renderPage('/auth/login');

    await userEvent.type(screen.getByLabelText('Email address'), 'alex@brandbase.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }));

    await waitFor(() => expect(api.requestSignInCode).toHaveBeenCalledWith({ email: 'alex@brandbase.com' }));
    expect(await screen.findByText(/We sent a 6-digit code to a\*\*\*@brandbase\.com/)).toBeInTheDocument();

    await typeCode('482913');

    await waitFor(() => expect(api.verifySignInCode).toHaveBeenCalledWith({ email: 'alex@brandbase.com', code: '482913' }));
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
    expect(store.getState().auth.isAuthenticated).toBe(true);
    expect(api.setToken).toHaveBeenCalledWith('signed.jwt.token');
  });

  it('checks the address before asking the server', async () => {
    renderPage('/auth/login');
    await userEvent.type(screen.getByLabelText('Email address'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }));

    expect(await screen.findByText('Please enter a valid email address')).toBeInTheDocument();
    expect(api.requestSignInCode).not.toHaveBeenCalled();
  });

  it('shows the server message when the code is wrong and stays on the code screen', async () => {
    api.verifySignInCode.mockRejectedValue(apiError(400, 'INVALID_CODE', 'That code is incorrect or has expired.'));
    const { store } = renderPage('/auth/login');

    await userEvent.type(screen.getByLabelText('Email address'), 'alex@brandbase.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }));
    await screen.findByText(/We sent a 6-digit code/);
    await typeCode('000000');

    expect(await screen.findByText('That code is incorrect or has expired.')).toBeInTheDocument();
    expect(store.getState().auth.isAuthenticated).toBe(false);
    expect(screen.getByRole('button', { name: /Send a new code/ })).toBeInTheDocument();
  });

  it('keeps Send a new code disabled during the cooldown and offers another address', async () => {
    renderPage('/auth/login');
    await userEvent.type(screen.getByLabelText('Email address'), 'alex@brandbase.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }));

    const resend = await screen.findByRole('button', { name: /Send a new code in \d+s/ });
    expect(resend).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Use a different email address' }));
    expect(await screen.findByLabelText('Email address')).toBeInTheDocument();
  });

  it('says so when too many codes were requested', async () => {
    api.requestSignInCode.mockRejectedValue(apiError(429, 'TOO_MANY_CODES', 'Too many codes were requested.'));
    renderPage('/auth/login');

    await userEvent.type(screen.getByLabelText('Email address'), 'alex@brandbase.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }));

    expect(await screen.findByText(/Too many attempts/)).toBeInTheDocument();
  });
});

describe('SignInPage: emailed link', () => {
  it('sends the code as soon as the link opens, without asking for the address', async () => {
    api.requestSignInCode.mockResolvedValue(requested({ organizationName: 'Brandbase' }));
    renderPage('/invite?token=wli_abc');

    await waitFor(() => expect(api.requestSignInCode).toHaveBeenCalledWith({ inviteToken: 'wli_abc' }));
    expect(api.requestSignInCode).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/to open your Brandbase portal/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use a different email address' })).not.toBeInTheDocument();
  });

  it('falls back to typing the address when the link has expired', async () => {
    api.requestSignInCode.mockRejectedValue(apiError(404, 'LINK_INVALID', 'This link is no longer valid.'));
    renderPage('/invite?token=wli_old');

    expect(await screen.findByText('This link is no longer valid')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
  });

  it('tells the person when their access is not available', async () => {
    api.requestSignInCode.mockRejectedValue(apiError(403, 'ACCESS_UNAVAILABLE', 'Your access is not available right now.'));
    renderPage('/invite?token=wli_abc');

    expect(
      await screen.findByText('Your access is not available right now. Please contact your project team.')
    ).toBeInTheDocument();
  });
});

describe('SignInPage: deep link from an email', () => {
  it('says why sign-in is needed without naming the item, and lands on the item afterwards', async () => {
    saveReturnTo('/approvals/ap123');
    renderPage('/auth/login');

    expect(screen.getByText('Sign in to open the item from your email.')).toBeInTheDocument();
    expect(screen.queryByText(/ap123/)).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Email address'), 'alex@brandbase.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }));
    await screen.findByText(/We sent a 6-digit code/);
    await typeCode('482913');

    expect(await screen.findByText('approval page')).toBeInTheDocument();
    expect(sessionStorage.getItem('clientPortalReturnTo')).toBeNull();
  });

  it('keeps the destination through the emailed-link step', async () => {
    saveReturnTo('/approvals/ap123');
    renderPage('/invite?token=wli_abc');
    await screen.findByText(/We sent a 6-digit code/);
    await typeCode('482913');
    expect(await screen.findByText('approval page')).toBeInTheDocument();
  });

  it('shows no banner and opens the dashboard when there is no destination', async () => {
    renderPage('/auth/login');
    expect(screen.queryByText('Sign in to open the item from your email.')).not.toBeInTheDocument();
  });
});
