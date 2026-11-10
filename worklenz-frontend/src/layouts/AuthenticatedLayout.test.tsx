import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthenticatedLayout } from './AuthenticatedLayout';

const { verify, hasSession, setSession, deleteSession } = vi.hoisted(() => ({
  verify: vi.fn(),
  hasSession: vi.fn(),
  setSession: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock('@/api/auth/auth.api.service', () => ({
  authApiService: { verify },
}));

vi.mock('@/utils/session-helper', () => ({
  hasSession,
  setSession,
  deleteSession,
}));

vi.mock('@/socket/socketContext', () => ({
  SocketProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const renderProtectedRoute = () =>
  render(
    <MemoryRouter initialEntries={['/worklenz']}>
      <Routes>
        <Route path="/worklenz" element={<AuthenticatedLayout />}>
          <Route index element={<div>Protected content</div>} />
        </Route>
        <Route path="/auth/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('AuthenticatedLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears stale local authentication and redirects when the server session is invalid', async () => {
    hasSession.mockReturnValue(true);
    verify.mockResolvedValue({ authenticated: false, user: null });

    renderProtectedRoute();

    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(deleteSession).toHaveBeenCalledOnce();
    expect(setSession).not.toHaveBeenCalled();
  });

  it('refreshes the local session before showing protected content', async () => {
    const user = { id: 'user-1' };
    hasSession.mockReturnValue(true);
    verify.mockResolvedValue({ authenticated: true, user });

    renderProtectedRoute();

    expect(await screen.findByText('Protected content')).toBeInTheDocument();
    expect(setSession).toHaveBeenCalledWith(user);
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it('does not verify a session when no local session exists', async () => {
    hasSession.mockReturnValue(false);

    renderProtectedRoute();

    await waitFor(() => expect(screen.getByText('Protected content')).toBeInTheDocument());
    expect(verify).not.toHaveBeenCalled();
  });
});
