import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';

import LoginPage from '../LoginPage';
import { login, verifyAuthentication } from '@/features/auth/authSlice';

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

vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({
    getCurrentSession: () => null,
  }),
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
      'auth/login': {
        headerDescription: 'Sign in to your account',
        emailRequired: 'Please input your email!',
        passwordRequired: 'Please input your password!',
        emailPlaceholder: 'Email',
        passwordPlaceholder: 'Password',
        loginButton: 'Sign In',
        rememberMe: 'Remember me',
        forgotPasswordButton: 'Forgot password?',
        signInWithGoogleButton: 'Sign in with Google',
        orText: 'or',
        dontHaveAccountText: "Don't have an account?",
        signupButton: 'Sign up',
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
    },
  });
};

const renderWithProviders = (component: React.ReactElement, initialState: any = {}) => {
  const store = createTestStore(initialState);
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

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock environment variables
    vi.stubEnv('VITE_ENABLE_GOOGLE_LOGIN', 'true');
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000');
  });

  it('renders login form correctly', () => {
    renderWithProviders(<LoginPage />);
    
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByText('Remember me')).toBeInTheDocument();
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();
  });

  it('shows Google login button when enabled', () => {
    renderWithProviders(<LoginPage />);
    
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    
    const submitButton = screen.getByRole('button', { name: 'Sign In' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Please input your email!')).toBeInTheDocument();
      expect(screen.getByText('Please input your password!')).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    
    const emailInput = screen.getByPlaceholderText('Email');
    await user.type(emailInput, 'invalid-email');
    
    const submitButton = screen.getByRole('button', { name: 'Sign In' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email!')).toBeInTheDocument();
    });
  });

  it('validates password minimum length', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    
    const emailInput = screen.getByPlaceholderText('Email');
    const passwordInput = screen.getByPlaceholderText('Password');
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, '123');
    
    const submitButton = screen.getByRole('button', { name: 'Sign In' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters!')).toBeInTheDocument();
    });
  });

  it('submits form with valid credentials', async () => {
    const user = userEvent.setup();
    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({
        authenticated: true,
        user: { id: '1', email: 'test@example.com' },
      }),
    });

    renderWithProviders(<LoginPage />);
    
    const emailInput = screen.getByPlaceholderText('Email');
    const passwordInput = screen.getByPlaceholderText('Password');
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    
    const submitButton = screen.getByRole('button', { name: 'Sign In' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        remember: true,
      });
    });
  });

  it('shows loading state during login', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { auth: { isLoading: true } });
    
    const submitButton = screen.getByRole('button', { name: 'Sign In' });
    expect(submitButton).toBeDisabled();
    expect(screen.getByRole('img', { name: /loading/i })).toBeInTheDocument();
  });

  it('handles Google login click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
    
    const googleButton = screen.getByText('Sign in with Google');
    await user.click(googleButton);
    
    expect(window.location.href).toBe('http://localhost:3000/secure/google');
  });

  it('navigates to signup page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    
    const signupLink = screen.getByText('Sign up');
    await user.click(signupLink);
    
    // Link navigation is handled by React Router, so we just check the element exists
    expect(signupLink.closest('a')).toHaveAttribute('href', '/auth/signup');
  });

  it('navigates to forgot password page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    
    const forgotPasswordLink = screen.getByText('Forgot password?');
    await user.click(forgotPasswordLink);
    
    expect(forgotPasswordLink.closest('a')).toHaveAttribute('href', '/auth/forgot-password');
  });

  it('toggles remember me checkbox', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    
    const rememberMeCheckbox = screen.getByRole('checkbox', { name: 'Remember me' });
    expect(rememberMeCheckbox).toBeChecked(); // Default is true
    
    await user.click(rememberMeCheckbox);
    expect(rememberMeCheckbox).not.toBeChecked();
  });

  it('redirects already authenticated users', async () => {
    mockDispatch.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({
        authenticated: true,
        user: { id: '1', email: 'test@example.com', setup_completed: true },
      }),
    });

    renderWithProviders(<LoginPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/worklenz/home');
    });
  });

  it('redirects to setup for users with incomplete setup', async () => {
    const mockCurrentSession = {
      id: '1',
      email: 'test@example.com',
      setup_completed: false,
    };

    vi.mock('@/hooks/useAuth', () => ({
      useAuthService: () => ({
        getCurrentSession: () => mockCurrentSession,
      }),
    }));

    renderWithProviders(<LoginPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/worklenz/setup');
    });
  });
});