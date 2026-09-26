import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';

import LoggingOutPage from '../LoggingOutPage';
import { authApiService } from '@/api/auth/auth.api.service';
import CacheCleanup from '@/utils/cache-cleanup';

// Mock dependencies
const mockAuthService = {
  signOut: vi.fn(),
};

vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => mockAuthService,
}));

vi.mock('@/api/auth/auth.api.service', () => ({
  authApiService: {
    logout: vi.fn(),
  },
}));

vi.mock('@/utils/cache-cleanup', () => ({
  default: {
    clearAllCaches: vi.fn(),
    forceReload: vi.fn(),
  },
}));

vi.mock('react-responsive', () => ({
  useMediaQuery: () => false,
}));

vi.mock('@/hooks/useMixpanelTracking', () => ({
  useMixpanelTracking: () => ({
    trackMixpanelEvent: vi.fn(),
    reset: vi.fn(),
  }),
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

// Setup i18n for testing
i18n.init({
  lng: 'en',
  resources: {
    en: {
      'auth/auth-common': {
        loggingOut: 'Logging Out...',
      },
    },
  },
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <I18nextProvider i18n={i18n}>{component}</I18nextProvider>
    </BrowserRouter>
  );
};

describe('LoggingOutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock console.error to avoid noise in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mock('@/hooks/useAuth', () => ({
      useAuthService: () => mockAuthService,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders loading state correctly', () => {
    renderWithProviders(<LoggingOutPage />);

    expect(screen.getByText('Logging Out...')).toBeInTheDocument();
    // WorklenzLogoLoader uses role="status" with a visually hidden "Loading..." span
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('performs complete logout sequence successfully', async () => {
    mockAuthService.signOut.mockResolvedValue(undefined);
    (authApiService.logout as any).mockResolvedValue(undefined);
    (CacheCleanup.clearAllCaches as any).mockResolvedValue(undefined);

    renderWithProviders(<LoggingOutPage />);

    // Allow microtasks (signOut, logout, clearAllCaches) to complete
    await vi.runAllTimersAsync();

    expect(mockAuthService.signOut).toHaveBeenCalled();
    expect(authApiService.logout).toHaveBeenCalled();
    expect(CacheCleanup.clearAllCaches).toHaveBeenCalled();
    expect(CacheCleanup.forceReload).toHaveBeenCalledWith('/auth/login');
  });

  it('handles auth service signOut failure', async () => {
    mockAuthService.signOut.mockRejectedValue(new Error('SignOut failed'));

    renderWithProviders(<LoggingOutPage />);

    await vi.runAllTimersAsync();

    expect(console.error).toHaveBeenCalledWith('Logout error:', expect.any(Error));
    expect(CacheCleanup.forceReload).toHaveBeenCalledWith('/auth/login');
  });

  it('handles backend logout failure', async () => {
    mockAuthService.signOut.mockResolvedValue(undefined);
    (authApiService.logout as any).mockRejectedValue(new Error('Backend logout failed'));

    renderWithProviders(<LoggingOutPage />);

    await vi.runAllTimersAsync();

    expect(mockAuthService.signOut).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('Logout error:', expect.any(Error));
    expect(CacheCleanup.forceReload).toHaveBeenCalledWith('/auth/login');
  });

  it('handles cache cleanup failure', async () => {
    mockAuthService.signOut.mockResolvedValue(undefined);
    (authApiService.logout as any).mockResolvedValue(undefined);
    (CacheCleanup.clearAllCaches as any).mockRejectedValue(new Error('Cache cleanup failed'));

    renderWithProviders(<LoggingOutPage />);

    await vi.runAllTimersAsync();

    expect(mockAuthService.signOut).toHaveBeenCalled();
    expect(authApiService.logout).toHaveBeenCalled();
    expect(CacheCleanup.clearAllCaches).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('Logout error:', expect.any(Error));
    expect(CacheCleanup.forceReload).toHaveBeenCalledWith('/auth/login');
  });

  it('triggers logout sequence immediately on mount', () => {
    renderWithProviders(<LoggingOutPage />);

    expect(mockAuthService.signOut).toHaveBeenCalled();
  });

  it('shows consistent loading UI throughout logout process', async () => {
    mockAuthService.signOut.mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );
    (authApiService.logout as any).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );
    (CacheCleanup.clearAllCaches as any).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    renderWithProviders(<LoggingOutPage />);

    // Should show loading state immediately
    expect(screen.getByText('Logging Out...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Should continue showing loading state during the process
    vi.advanceTimersByTime(50);

    expect(screen.getByText('Logging Out...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('calls forceReload with correct path after timeout', async () => {
    mockAuthService.signOut.mockResolvedValue(undefined);
    (authApiService.logout as any).mockResolvedValue(undefined);
    (CacheCleanup.clearAllCaches as any).mockResolvedValue(undefined);

    renderWithProviders(<LoggingOutPage />);

    await vi.runAllTimersAsync();

    expect(CacheCleanup.forceReload).toHaveBeenCalledWith('/auth/login');
    expect(CacheCleanup.forceReload).toHaveBeenCalledTimes(1);
  });

  it('handles complete failure of all logout steps', async () => {
    mockAuthService.signOut.mockRejectedValue(new Error('SignOut failed'));

    renderWithProviders(<LoggingOutPage />);

    await vi.runAllTimersAsync();

    expect(console.error).toHaveBeenCalledWith('Logout error:', expect.any(Error));
    expect(CacheCleanup.forceReload).toHaveBeenCalledWith('/auth/login');
  });
});
