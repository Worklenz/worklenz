import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';

import LoginPage from '../LoginPage';
import { login } from '@/features/auth/authSlice';

// Mock dependencies
vi.mock('@/features/auth/authSlice', () => ({
  login: vi.fn(),
  verifyAuthentication: vi.fn(),
}));

vi.mock('@/features/user/userSlice', () => ({
  setUser: vi.fn(),
}));

vi.mock('@/utils/session-helper', () => ({
  setSession: vi.fn(),
  getUserSession: vi.fn().mockReturnValue(null),
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

vi.mock('@/services/alerts/alertService', () => ({
  default: {
    error: vi.fn(),
  },
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
      'auth/login': {
        headline: 'Welcome back',
        headerDescription: 'Log in to your Worklenz workspace.',
        signInWithLabel: 'Sign in with',
        orText: 'or',
        emailLabel: 'Email',
        emailPlaceholder: 'you@company.com',
        emailRequired: 'Please enter your email!',
        nextButton: 'Next',
        changeEmailLink: 'Change',
        passwordLabel: 'Password',
        passwordPlaceholder: 'Enter your password',
        passwordRequired: 'Please enter your password!',
        loginButton: 'Log in',
        signupButton: 'Sign up',
        forgotPasswordButton: 'Forgot password?',
        signInWithGoogleButton: 'Google',
        signInWithAppleButton: 'Apple',
        dontHaveAccountText: "Don't have an account?",
        bySigningInText: 'By signing in, you understand and agree to our',
        andText: 'and',
        termsOfServiceLink: 'Terms of Service',
        privacyPolicyLink: 'Privacy Policy',
        successMessage: 'Login successful!',
        'validationMessages.email': 'Please enter a valid email!',
        'validationMessages.password': 'Password must be at least 8 characters!',
        'errorMessages.loginErrorTitle': 'Login Failed',
        'errorMessages.loginErrorMessage': 'Invalid email or password',
      },
    },
  },
});

// Create test store
const createTestStore = (initialState: any = {}) => {
  return configureStore({
    reducer: {
      auth: (state = { isLoading: false, ...initialState.auth }) => state,
      user: (state = {}) => state,
      themeReducer: (state = { mode: 'light' }) => state,
    },
  });
};

const renderWithProviders = (component: React.ReactElement, initialState: any = {}) => {
  const store = createTestStore(initialState);
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <I18nextProvider i18n={i18n}>{component}</I18nextProvider>
      </BrowserRouter>
    </Provider>
  );
};

// Advances the form from the email step to the password step
const goToPasswordStep = async (
  user: ReturnType<typeof userEvent.setup>,
  email = 'test@example.com'
) => {
  const emailInput = screen.getByPlaceholderText('you@company.com');
  await user.type(emailInput, email);

  const nextButton = screen.getByRole('button', { name: 'Next' });
  await waitFor(() => expect(nextButton).toBeEnabled());
  await user.click(nextButton);

  await waitFor(() => {
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
  });
};

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_ENABLE_GOOGLE_LOGIN', 'true');
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000');

    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ authenticated: false }),
    });
  });

  it('renders the email step by default', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.queryByPlaceholderText('Enter your password')).not.toBeInTheDocument();
  });

  it('shows Google login button when enabled', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByText('Google')).toBeInTheDocument();
  });

  it('keeps Next disabled for an invalid email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByPlaceholderText('you@company.com'), 'invalid-email');

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('advances to the password step with a valid email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await goToPasswordStep(user);

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('Change')).toBeInTheDocument();
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();
  });

  it('returns to the email step via Change', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await goToPasswordStep(user);
    await user.click(screen.getByText('Change'));

    expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Enter your password')).not.toBeInTheDocument();
  });

  it('validates password minimum length', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await goToPasswordStep(user);

    await user.type(screen.getByPlaceholderText('Enter your password'), '123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters!')).toBeInTheDocument();
    });
  });

  it('submits with valid credentials', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await goToPasswordStep(user);

    // Only start returning an authenticated session once the credentials are
    // actually submitted — the mount-time auth check reuses the same mocked
    // dispatch, so setting this up front would redirect before the test gets
    // a chance to interact with the password step.
    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({
        authenticated: true,
        user: { id: '1', email: 'test@example.com' },
      }),
    });

    await user.type(screen.getByPlaceholderText('Enter your password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        team_id: undefined,
        team_member_id: undefined,
        project_id: undefined,
      });
    });
  });

  it('handles Google login click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });

    await user.click(screen.getByText('Google'));

    expect(window.location.href).toBe('http://localhost:3000/secure/google');
  });

  it('navigates to signup page', () => {
    renderWithProviders(<LoginPage />);

    const signupLink = screen.getByText('Sign up');
    expect(signupLink.closest('a')).toHaveAttribute('href', '/auth/signup');
  });

  it('navigates to forgot password page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await goToPasswordStep(user);

    const forgotPasswordLink = screen.getByText('Forgot password?');
    expect(forgotPasswordLink.closest('a')).toHaveAttribute('href', '/auth/forgot-password');
  });

  it('redirects already authenticated users to home', async () => {
    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({
        authenticated: true,
        user: { id: '1', email: 'test@example.com', setup_completed: true },
      }),
    });

    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });

    renderWithProviders(<LoginPage />);

    await waitFor(() => {
      expect(window.location.href).toBe('/worklenz/home');
    });
  });
});
