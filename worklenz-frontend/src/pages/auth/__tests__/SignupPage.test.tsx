import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
      'auth/signup': {
        headerDescription: 'Sign up to get started',
        nameLabel: 'Full Name',
        emailLabel: 'Email',
        passwordLabel: 'Password',
        nameRequired: 'Please input your name!',
        emailRequired: 'Please input your email!',
        passwordRequired: 'Please input your password!',
        nameMinCharacterRequired: 'Name must be at least 4 characters!',
        passwordMinCharacterRequired: 'Password must be at least 8 characters!',
        passwordMaxCharacterRequired: 'Password must be no more than 32 characters!',
        passwordPatternRequired: 'Password must contain uppercase, lowercase, number and special character!',
        namePlaceholder: 'Enter your full name',
        emailPlaceholder: 'Enter your email',
        strongPasswordPlaceholder: 'Enter a strong password',
        passwordGuideline: 'Password must be at least 8 characters, include uppercase and lowercase letters, a number, and a special character.',
        signupButton: 'Sign Up',
        signInWithGoogleButton: 'Sign up with Google',
        orText: 'or',
        alreadyHaveAccountText: 'Already have an account?',
        loginButton: 'Log in',
        bySigningUpText: 'By signing up, you agree to our',
        privacyPolicyLink: 'Privacy Policy',
        andText: 'and',
        termsOfUseLink: 'Terms of Use',
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
      themeReducer: (state = { mode: 'light' }) => state,
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

describe('SignupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Mock environment variables
    vi.stubEnv('VITE_ENABLE_GOOGLE_LOGIN', 'true');
    vi.stubEnv('VITE_ENABLE_RECAPTCHA', 'false');
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000');
    
    // Mock URL search params
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    });
  });

  it('renders signup form correctly', () => {
    renderWithProviders(<SignupPage />);
    
    expect(screen.getByText('Sign up to get started')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your full name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter a strong password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument();
  });

  it('shows Google signup button when enabled', () => {
    renderWithProviders(<SignupPage />);
    
    expect(screen.getByText('Sign up with Google')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);
    
    const submitButton = screen.getByRole('button', { name: 'Sign Up' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Please input your name!')).toBeInTheDocument();
      expect(screen.getByText('Please input your email!')).toBeInTheDocument();
      expect(screen.getByText('Please input your password!')).toBeInTheDocument();
    });
  });

  it('validates name minimum length', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);
    
    const nameInput = screen.getByPlaceholderText('Enter your full name');
    await user.type(nameInput, 'Jo');
    
    const submitButton = screen.getByRole('button', { name: 'Sign Up' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Name must be at least 4 characters!')).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);
    
    const emailInput = screen.getByPlaceholderText('Enter your email');
    await user.type(emailInput, 'invalid-email');
    
    const submitButton = screen.getByRole('button', { name: 'Sign Up' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Please input your email!')).toBeInTheDocument();
    });
  });

  it('validates password requirements', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);
    
    const passwordInput = screen.getByPlaceholderText('Enter a strong password');
    await user.type(passwordInput, 'weak');
    
    const submitButton = screen.getByRole('button', { name: 'Sign Up' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters!')).toBeInTheDocument();
    });
  });

  it('shows password checklist when password field is focused', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);
    
    const passwordInput = screen.getByPlaceholderText('Enter a strong password');
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
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);
    
    const passwordInput = screen.getByPlaceholderText('Enter a strong password');
    await user.click(passwordInput);
    await user.type(passwordInput, 'Password123!');
    
    await waitFor(() => {
      // All checklist items should be visible and some should be checked
      expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
      expect(screen.getByText('One uppercase letter')).toBeInTheDocument();
      expect(screen.getByText('One lowercase letter')).toBeInTheDocument();
      expect(screen.getByText('One number')).toBeInTheDocument();
      expect(screen.getByText('One special character')).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    (authApiService.signUpCheck as any).mockResolvedValue({ done: true });

    renderWithProviders(<SignupPage />);
    
    const nameInput = screen.getByPlaceholderText('Enter your full name');
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Enter a strong password');
    
    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');
    await user.type(passwordInput, 'Password123!');
    
    const submitButton = screen.getByRole('button', { name: 'Sign Up' });
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
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);
    
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
    
    const googleButton = screen.getByText('Sign up with Google');
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
    
    const nameInput = screen.getByPlaceholderText('Enter your full name') as HTMLInputElement;
    const emailInput = screen.getByPlaceholderText('Enter your email') as HTMLInputElement;
    
    expect(nameInput.value).toBe('Test User');
    expect(emailInput.value).toBe('test@example.com');
  });

  it('shows terms of use and privacy policy links', () => {
    renderWithProviders(<SignupPage />);
    
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Terms of Use')).toBeInTheDocument();
    
    const privacyLink = screen.getByText('Privacy Policy').closest('a');
    const termsLink = screen.getByText('Terms of Use').closest('a');
    
    expect(privacyLink).toHaveAttribute('href', 'https://worklenz.com/privacy/');
    expect(termsLink).toHaveAttribute('href', 'https://worklenz.com/terms/');
  });

  it('navigates to login page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);
    
    const loginLink = screen.getByText('Log in');
    await user.click(loginLink);
    
    expect(loginLink.closest('a')).toHaveAttribute('href', '/auth/login');
  });

  it('shows loading state during signup', async () => {
    const user = userEvent.setup();
    (authApiService.signUpCheck as any).mockResolvedValue({ done: true });

    renderWithProviders(<SignupPage />);
    
    const nameInput = screen.getByPlaceholderText('Enter your full name');
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Enter a strong password');
    
    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');
    await user.type(passwordInput, 'Password123!');
    
    const submitButton = screen.getByRole('button', { name: 'Sign Up' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByRole('img', { name: /loading/i })).toBeInTheDocument();
    });
  });
});