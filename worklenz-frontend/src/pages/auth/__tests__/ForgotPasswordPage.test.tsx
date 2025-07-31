import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';

import ForgotPasswordPage from '../ForgotPasswordPage';
import { resetPassword, verifyAuthentication } from '@/features/auth/authSlice';

// Mock dependencies
vi.mock('@/features/auth/authSlice', () => ({
  resetPassword: vi.fn(),
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

vi.mock('@/hooks/useMixpanelTracking', () => ({
  useMixpanelTracking: () => ({
    trackMixpanelEvent: vi.fn(),
  }),
}));

vi.mock('@/hooks/useDoumentTItle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('react-responsive', () => ({
  useMediaQuery: () => false,
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
      'auth/forgot-password': {
        headerDescription: 'Enter your email to reset your password',
        emailRequired: 'Please input your email!',
        emailPlaceholder: 'Enter your email',
        resetPasswordButton: 'Reset Password',
        returnToLoginButton: 'Return to Login',
        orText: 'or',
        successTitle: 'Password Reset Email Sent',
        successMessage: 'Please check your email for instructions to reset your password.',
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
        <I18nextProvider i18n={i18n}>
          {component}
        </I18nextProvider>
      </BrowserRouter>
    </Provider>
  );
};

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL search params
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    });
  });

  it('renders forgot password form correctly', () => {
    renderWithProviders(<ForgotPasswordPage />);
    
    expect(screen.getByText('Enter your email to reset your password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset Password' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return to Login' })).toBeInTheDocument();
    expect(screen.getByText('or')).toBeInTheDocument();
  });

  it('validates required email field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);
    
    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Please input your email!')).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);
    
    const emailInput = screen.getByPlaceholderText('Enter your email');
    await user.type(emailInput, 'invalid-email');
    
    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Please input your email!')).toBeInTheDocument();
    });
  });

  it('submits form with valid email', async () => {
    const user = userEvent.setup();
    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ done: true }),
    });

    renderWithProviders(<ForgotPasswordPage />);
    
    const emailInput = screen.getByPlaceholderText('Enter your email');
    await user.type(emailInput, 'test@example.com');
    
    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith('test@example.com');
    });
  });

  it('shows success message after successful submission', async () => {
    const user = userEvent.setup();
    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ done: true }),
    });

    renderWithProviders(<ForgotPasswordPage />);
    
    const emailInput = screen.getByPlaceholderText('Enter your email');
    await user.type(emailInput, 'test@example.com');
    
    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Password Reset Email Sent')).toBeInTheDocument();
      expect(screen.getByText('Please check your email for instructions to reset your password.')).toBeInTheDocument();
    });
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
    });

    renderWithProviders(<ForgotPasswordPage />);
    
    const emailInput = screen.getByPlaceholderText('Enter your email');
    await user.type(emailInput, 'test@example.com');
    
    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByRole('img', { name: /loading/i })).toBeInTheDocument();
    });
  });

  it('handles submission errors gracefully', async () => {
    const user = userEvent.setup();
    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockRejectedValue(new Error('Reset failed')),
    });

    renderWithProviders(<ForgotPasswordPage />);
    
    const emailInput = screen.getByPlaceholderText('Enter your email');
    await user.type(emailInput, 'test@example.com');
    
    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    await user.click(submitButton);
    
    await waitFor(() => {
      // Should not show success message
      expect(screen.queryByText('Password Reset Email Sent')).not.toBeInTheDocument();
      // Should still show the form
      expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
    });
  });

  it('navigates to login page when return button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);
    
    const returnButton = screen.getByRole('button', { name: 'Return to Login' });
    await user.click(returnButton);
    
    expect(returnButton.closest('a')).toHaveAttribute('href', '/auth/login');
  });

  it('handles team parameter from URL', () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?team=test-team-id' },
      writable: true,
    });

    renderWithProviders(<ForgotPasswordPage />);
    
    // Component should render normally even with team parameter
    expect(screen.getByText('Enter your email to reset your password')).toBeInTheDocument();
  });

  it('redirects authenticated users to home', async () => {
    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({
        authenticated: true,
        user: { id: '1', email: 'test@example.com' },
      }),
    });

    renderWithProviders(<ForgotPasswordPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/worklenz/home');
    });
  });

  it('does not submit with empty email after trimming', async () => {
    const user = userEvent.setup();
    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ done: true }),
    });

    renderWithProviders(<ForgotPasswordPage />);
    
    const emailInput = screen.getByPlaceholderText('Enter your email');
    await user.type(emailInput, '   '); // Only whitespace
    
    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    await user.click(submitButton);
    
    // Should not call resetPassword with empty string
    expect(resetPassword).not.toHaveBeenCalled();
  });
});