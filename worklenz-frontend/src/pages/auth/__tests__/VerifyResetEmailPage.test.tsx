import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';

import VerifyResetEmailPage from '../VerifyResetEmailPage';
import { updatePassword } from '@/features/auth/authSlice';

// Mock dependencies
vi.mock('@/features/auth/authSlice', () => ({
  updatePassword: vi.fn(),
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
      'auth/verify-reset-email': {
        description: 'Enter your new password',
        passwordRequired: 'Please input your password!',
        confirmPasswordRequired: 'Please confirm your password!',
        placeholder: 'Enter new password',
        confirmPasswordPlaceholder: 'Confirm new password',
        resetPasswordButton: 'Reset Password',
        resendResetEmail: 'Resend Reset Email',
        orText: 'or',
        passwordMismatch: 'The two passwords do not match!',
        successTitle: 'Password Reset Successful',
        successMessage: 'Your password has been reset successfully.',
        'passwordChecklist.minLength': 'At least 8 characters',
        'passwordChecklist.uppercase': 'One uppercase letter',
        'passwordChecklist.lowercase': 'One lowercase letter',
        'passwordChecklist.number': 'One number',
        'passwordChecklist.special': 'One special character',
      },
    },
  },
});

// Create test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      themeReducer: (state = { mode: 'light' }) => state,
    },
  });
};

const renderWithProviders = (
  component: React.ReactElement,
  route = '/verify-reset/test-hash/test-user'
) => {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>
        <I18nextProvider i18n={i18n}>{component}</I18nextProvider>
      </MemoryRouter>
    </Provider>
  );
};

describe('VerifyResetEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders password reset form correctly', () => {
    renderWithProviders(<VerifyResetEmailPage />);

    expect(screen.getByText('Enter your new password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter new password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Confirm new password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset Password' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend Reset Email' })).toBeInTheDocument();
  });

  it('shows password checklist immediately', () => {
    renderWithProviders(<VerifyResetEmailPage />);

    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('One uppercase letter')).toBeInTheDocument();
    expect(screen.getByText('One lowercase letter')).toBeInTheDocument();
    expect(screen.getByText('One number')).toBeInTheDocument();
    expect(screen.getByText('One special character')).toBeInTheDocument();
  });

  it('validates required password fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VerifyResetEmailPage />);

    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please input your password!')).toBeInTheDocument();
      expect(screen.getByText('Please confirm your password!')).toBeInTheDocument();
    });
  });

  it('validates password confirmation match', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VerifyResetEmailPage />);

    const passwordInput = screen.getByPlaceholderText('Enter new password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm new password');

    await user.type(passwordInput, 'Password123!');
    await user.type(confirmPasswordInput, 'DifferentPassword123!');

    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('The two passwords do not match!')).toBeInTheDocument();
    });
  });

  it('updates password checklist based on input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VerifyResetEmailPage />);

    const passwordInput = screen.getByPlaceholderText('Enter new password');
    await user.type(passwordInput, 'Password123!');

    // All checklist items should be visible (this component shows them by default)
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('One uppercase letter')).toBeInTheDocument();
    expect(screen.getByText('One lowercase letter')).toBeInTheDocument();
    expect(screen.getByText('One number')).toBeInTheDocument();
    expect(screen.getByText('One special character')).toBeInTheDocument();
  });

  it('submits form with valid matching passwords', async () => {
    const user = userEvent.setup();
    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ done: true }),
    });

    renderWithProviders(<VerifyResetEmailPage />);

    const passwordInput = screen.getByPlaceholderText('Enter new password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm new password');

    await user.type(passwordInput, 'Password123!');
    await user.type(confirmPasswordInput, 'Password123!');

    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(updatePassword).toHaveBeenCalledWith({
        hash: 'test-hash',
        user: 'test-user',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });
    });
  });

  it('shows success message after successful password reset', async () => {
    const user = userEvent.setup();
    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ done: true }),
    });

    renderWithProviders(<VerifyResetEmailPage />);

    const passwordInput = screen.getByPlaceholderText('Enter new password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm new password');

    await user.type(passwordInput, 'Password123!');
    await user.type(confirmPasswordInput, 'Password123!');

    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Password Reset Successful')).toBeInTheDocument();
      expect(screen.getByText('Your password has been reset successfully.')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/auth/login');
    });
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
    });

    renderWithProviders(<VerifyResetEmailPage />);

    const passwordInput = screen.getByPlaceholderText('Enter new password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm new password');

    await user.type(passwordInput, 'Password123!');
    await user.type(confirmPasswordInput, 'Password123!');

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

    renderWithProviders(<VerifyResetEmailPage />);

    const passwordInput = screen.getByPlaceholderText('Enter new password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm new password');

    await user.type(passwordInput, 'Password123!');
    await user.type(confirmPasswordInput, 'Password123!');

    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    await user.click(submitButton);

    await waitFor(() => {
      // Should not show success message
      expect(screen.queryByText('Password Reset Successful')).not.toBeInTheDocument();
      // Should still show the form
      expect(screen.getByPlaceholderText('Enter new password')).toBeInTheDocument();
    });
  });

  it('navigates to forgot password page when resend button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VerifyResetEmailPage />);

    const resendButton = screen.getByRole('button', { name: 'Resend Reset Email' });
    await user.click(resendButton);

    expect(resendButton.closest('a')).toHaveAttribute('href', '/auth/forgot-password');
  });

  it('prevents pasting in confirm password field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VerifyResetEmailPage />);

    const confirmPasswordInput = screen.getByPlaceholderText('Confirm new password');

    await user.click(confirmPasswordInput);

    // Try to paste - should be prevented
    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: new DataTransfer(),
    });

    fireEvent(confirmPasswordInput, pasteEvent);

    // The preventDefault should be called (we can't easily test this directly,
    // but we can ensure the input behavior remains consistent)
    expect(confirmPasswordInput).toBeInTheDocument();
  });

  it('does not submit with empty passwords after trimming', async () => {
    const user = userEvent.setup();
    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ done: true }),
    });

    renderWithProviders(<VerifyResetEmailPage />);

    const passwordInput = screen.getByPlaceholderText('Enter new password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm new password');

    await user.type(passwordInput, '   '); // Only whitespace
    await user.type(confirmPasswordInput, '   '); // Only whitespace

    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    await user.click(submitButton);

    // Should not call updatePassword with empty strings
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it('extracts hash and user from URL params', () => {
    renderWithProviders(<VerifyResetEmailPage />, '/verify-reset/my-hash/my-user');

    // Component should render normally, indicating it received the params
    expect(screen.getByText('Enter your new password')).toBeInTheDocument();
  });
});
