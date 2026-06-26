import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';

import AuthenticatingPage from '../AuthenticatingPage';
import { verifyAuthentication } from '@/features/auth/authSlice';
import { setUser } from '@/features/user/userSlice';
import { setSession } from '@/utils/session-helper';

// Mock dependencies
vi.mock('@/features/auth/authSlice', () => ({
  verifyAuthentication: vi.fn(),
}));

vi.mock('@/features/user/userSlice', () => ({
  setUser: vi.fn(),
}));

vi.mock('@/utils/session-helper', () => ({
  setSession: vi.fn(),
}));

vi.mock('@/utils/errorLogger', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('@/shared/constants', () => ({
  WORKLENZ_REDIRECT_PROJ_KEY: 'worklenz_redirect_proj',
}));

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock dispatch
const mockDispatch = vi.fn();
vi.mock('@/hooks/useAppDispatch', () => ({
  useAppDispatch: () => mockDispatch,
}));

// Setup i18n for testing
i18n.init({
  lng: 'en',
  resources: {
    en: {
      'auth/auth-common': {
        authenticating: 'Authenticating...',
        gettingThingsReady: 'Getting things ready for you...',
      },
    },
  },
});

// Create test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      auth: (state = {}) => state,
      user: (state = {}) => state,
    },
  });
};

const renderWithProviders = (component: React.ReactElement) => {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <I18nextProvider i18n={i18n}>{component}</I18nextProvider>
      </BrowserRouter>
    </Provider>
  );
};

describe('AuthenticatingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders loading state correctly', () => {
    renderWithProviders(<AuthenticatingPage />);

    expect(screen.getByText('Authenticating...')).toBeInTheDocument();
    expect(screen.getByText('Getting things ready for you...')).toBeInTheDocument();
    expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument();
  });

  it('redirects to login when authentication fails', async () => {
    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ authenticated: false }),
    });

    renderWithProviders(<AuthenticatingPage />);

    // Run all pending timers
    await vi.runAllTimersAsync();

    expect(mockNavigate).toHaveBeenCalledWith('/auth/login');
  });

  it('redirects to setup when user setup is not completed', async () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      setup_completed: false,
    };

    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({
        authenticated: true,
        user: mockUser,
      }),
    });

    renderWithProviders(<AuthenticatingPage />);

    // Run all pending timers
    await vi.runAllTimersAsync();

    expect(setSession).toHaveBeenCalledWith(mockUser);
    expect(setUser).toHaveBeenCalledWith(mockUser);
    expect(mockNavigate).toHaveBeenCalledWith('/worklenz/setup');
  });

  it('redirects to home after successful authentication', async () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      setup_completed: true,
    };

    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({
        authenticated: true,
        user: mockUser,
      }),
    });

    renderWithProviders(<AuthenticatingPage />);

    // Run all pending timers
    await vi.runAllTimersAsync();

    expect(setSession).toHaveBeenCalledWith(mockUser);
    expect(setUser).toHaveBeenCalledWith(mockUser);
    expect(mockNavigate).toHaveBeenCalledWith('/worklenz/home');
  });

  it('redirects to project when redirect key is present in localStorage', async () => {
    const projectId = 'test-project-123';
    localStorage.setItem('worklenz_redirect_proj', projectId);

    const mockUser = {
      id: '1',
      email: 'test@example.com',
      setup_completed: true,
    };

    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({
        authenticated: true,
        user: mockUser,
      }),
    });

    // Mock window.location with a proper setter
    let hrefValue = '';
    Object.defineProperty(window, 'location', {
      value: {
        get href() {
          return hrefValue;
        },
        set href(value) {
          hrefValue = value;
        },
      },
      writable: true,
    });

    renderWithProviders(<AuthenticatingPage />);

    // Run all pending timers
    await vi.runAllTimersAsync();

    expect(setSession).toHaveBeenCalledWith(mockUser);
    expect(setUser).toHaveBeenCalledWith(mockUser);
    expect(hrefValue).toBe(`/worklenz/projects/${projectId}?tab=tasks-list`);
    expect(localStorage.getItem('worklenz_redirect_proj')).toBeNull();
  });

  it('handles authentication errors and redirects to login', async () => {
    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockRejectedValue(new Error('Authentication failed')),
    });

    renderWithProviders(<AuthenticatingPage />);

    // Run all pending timers
    await vi.runAllTimersAsync();

    expect(mockNavigate).toHaveBeenCalledWith('/auth/login');
  });
});
