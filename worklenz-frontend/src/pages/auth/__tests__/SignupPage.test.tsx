import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';

import SignupPage from '../SignupPage';
import { signUp } from '@/features/auth/authSlice';
import { authApiService } from '@/api/auth/auth.api.service';

// Mock dependencies
vi.mock('@/features/auth/authSlice', () => ({
  signUp: vi.fn(),
}));

vi.mock('@/api/auth/auth.api.service', () => ({
  authApiService: {
    signUpCheck: vi.fn(),
    verifyRecaptchaToken: vi.fn(),
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

vi.mock('@/utils/errorLogger', () => ({
  default: {
    error: vi.fn(),
  },
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
      'auth/signup': {
        headline: 'Create your account',
        headerDescription: 'Sign up to get started',
        signUpWithLabel: 'Sign up with',
        orText: 'or',
        nameLabel: 'Full name',
        namePlaceholder: 'Jordan Lee',
        nameRequired: 'Please input your name!',
        nameMinCharacterRequired: 'Name must be at least 4 characters!',
        emailLabel: 'Email',
        emailPlaceholder: 'jordan@acme.com',
        emailRequired: 'Please input your email!',
        passwordLabel: 'Password',
        passwordPlaceholder: 'At least 8 characters',
        passwordRequired: 'Please input your password!',
        passwordMinCharacterRequired: 'Password must be at least 8 characters!',
        passwordMaxCharacterRequired: 'Password must be no more than 32 characters!',
        passwordPatternRequired:
          'Password must contain uppercase, lowercase, number and special character!',
        signupButton: 'Create account',
        signInWithGoogleButton: 'Google',
        signUpWithAppleButton: 'Apple',
        alreadyHaveAccountText: 'Already have an account?',
        loginButton: 'Log in',
        bySigningUpText: 'By creating an account, you agree to our',
        privacyPolicyLink: 'Privacy Policy',
        andText: 'and',
        termsOfUseLink: 'Terms of Service',
        reCAPTCHAVerificationError: 'reCAPTCHA Verification Failed',
        reCAPTCHAVerificationErrorMessage: 'Please try again',
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
      auth: (state = {}) => state,
      themeReducer: (state = { mode: 'light' }) => state,
    },
  });
};

import { MemoryRouter } from 'react-router-dom';

const renderWithProviders = (component: React.ReactElement) => {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>{component}</I18nextProvider>
      </MemoryRouter>
    </Provider>
  );
};

describe('SignupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Mock environment variables
    vi.stubEnv('VITE_ENABLE_GOOGLE_LOGIN', 'true');
    vi.stubEnv('VITE_ENABLE_RECAPTCHA', 'false');
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000');

    // Mock URL search params with a valid URL object
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost:5173/auth/signup'),
      writable: true,
    });
  });

  it('renders signup form correctly', () => {
    renderWithProviders(<SignupPage />);

    expect(screen.getByText('Create your account')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Jordan Lee')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('jordan@acme.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('At least 8 characters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
  });

  it('shows Google signup button when enabled', () => {
    renderWithProviders(<SignupPage />);

    expect(screen.getByText('Google')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<SignupPage />);

    const submitButton = screen.getByRole('button', { name: 'Create account' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please input your name!')).toBeInTheDocument();
      expect(screen.getByText('Please input your email!')).toBeInTheDocument();
      expect(screen.getByText('Please input your password!')).toBeInTheDocument();
    });
  });

  it('validates name minimum length', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<SignupPage />);

    const nameInput = screen.getByPlaceholderText('Jordan Lee');
    await user.type(nameInput, 'Jo');

    const submitButton = screen.getByRole('button', { name: 'Create account' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Name must be at least 4 characters!')).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<SignupPage />);

    const emailInput = screen.getByPlaceholderText('jordan@acme.com');
    await user.type(emailInput, 'invalid-email');

    const submitButton = screen.getByRole('button', { name: 'Create account' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please input your email!')).toBeInTheDocument();
    });
  });

  it('validates password requirements', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<SignupPage />);

    const passwordInput = screen.getByPlaceholderText('At least 8 characters');
    await user.type(passwordInput, 'weak');

    const submitButton = screen.getByRole('button', { name: 'Create account' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters!')).toBeInTheDocument();
    });
  });

  it('shows password checklist when password field is focused', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<SignupPage />);

    const passwordInput = screen.getByPlaceholderText('At least 8 characters');
    await user.click(passwordInput);

    await waitFor(() => {
      expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
      expect(screen.getByText('One uppercase letter')).toBeInTheDocument();
      expect(screen.getByText('One lowercase letter')).toBeInTheDocument();
      expect(screen.getByText('One number')).toBeInTheDocument();
      expect(screen.getByText('One special character')).toBeInTheDocument();
    });
  });

  it('updates password checklist based on input', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<SignupPage />);

    const passwordInput = screen.getByPlaceholderText('At least 8 characters');
    await user.click(passwordInput);
    await user.type(passwordInput, 'Password123!');

    await waitFor(() => {
      // All checklist items should be visible and satisfied for a strong password
      expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
      expect(screen.getByText('One uppercase letter')).toBeInTheDocument();
      expect(screen.getByText('One lowercase letter')).toBeInTheDocument();
      expect(screen.getByText('One number')).toBeInTheDocument();
      expect(screen.getByText('One special character')).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup({ delay: null });
    (authApiService.signUpCheck as any).mockResolvedValue({ done: true });

    renderWithProviders(<SignupPage />);

    const nameInput = screen.getByPlaceholderText('Jordan Lee');
    const emailInput = screen.getByPlaceholderText('jordan@acme.com');
    const passwordInput = screen.getByPlaceholderText('At least 8 characters');

    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');
    await user.type(passwordInput, 'Password123!');

    const submitButton = screen.getByRole('button', { name: 'Create account' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(authApiService.signUpCheck).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
      });
    });
  });

  it('handles Google signup click', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<SignupPage />);

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });

    const googleButton = screen.getByText('Google');
    await user.click(googleButton);

    expect(window.location.href).toBe('http://localhost:3000/secure/google?');
  });

  it('pre-fills form from URL parameters', () => {
    // Mock URLSearchParams
    Object.defineProperty(window, 'location', {
      value: { search: '?email=test@example.com&name=Test User' },
      writable: true,
    });

    renderWithProviders(<SignupPage />);

    const nameInput = screen.getByPlaceholderText('Jordan Lee') as HTMLInputElement;
    const emailInput = screen.getByPlaceholderText('jordan@acme.com') as HTMLInputElement;

    expect(nameInput.value).toBe('Test User');
    expect(emailInput.value).toBe('test@example.com');
  });

  it('shows terms of use and privacy policy links', () => {
    renderWithProviders(<SignupPage />);

    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();

    const privacyLink = screen.getByText('Privacy Policy').closest('a');
    const termsLink = screen.getByText('Terms of Service').closest('a');

    expect(privacyLink).toHaveAttribute('href', 'https://worklenz.com/privacy/');
    expect(termsLink).toHaveAttribute('href', 'https://worklenz.com/terms/');
  });

  it('navigates to login page', () => {
    renderWithProviders(<SignupPage />);

    const loginLink = screen.getByText('Log in');
    expect(loginLink.closest('a')).toHaveAttribute('href', '/auth/login');
  });

  it('shows loading state during signup', async () => {
    const user = userEvent.setup({ delay: null });
    (authApiService.signUpCheck as any).mockResolvedValue({ done: true });

    renderWithProviders(<SignupPage />);

    const nameInput = screen.getByPlaceholderText('Jordan Lee');
    const emailInput = screen.getByPlaceholderText('jordan@acme.com');
    const passwordInput = screen.getByPlaceholderText('At least 8 characters');

    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');
    await user.type(passwordInput, 'Password123!');

    const submitButton = screen.getByRole('button', { name: 'Create account' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: /loading/i })).toBeInTheDocument();
    });
  });
});
