import AuthLayout from '@/layouts/AuthLayout';
import LoginPage from '@/pages/auth/login-page';
import SignupPage from '@/pages/auth/signup-page';
import ForgotPasswordPage from '@/pages/auth/forgot-password-page';
import LoggingOutPage from '@/pages/auth/logging-out';
import AuthenticatingPage from '@/pages/auth/authenticating';
import { Navigate } from 'react-router-dom';
import VerifyResetEmailPage from '@/pages/auth/verify-reset-email';
import { Suspense } from 'react';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';

const authRoutes = [
  {
    path: '/auth',
    element: (
      <AuthLayout />
    ),
    children: [
      {
        path: '',
        element: <Navigate to="login" replace />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'signup',
        element: <SignupPage />,
      },
      {
        path: 'forgot-password',
        element: <ForgotPasswordPage />,
      },
      {
        path: 'logging-out',
        element: <LoggingOutPage />,
      },
      {
        path: 'authenticating',
        element: <AuthenticatingPage />,
      },
      {
        path: 'verify-reset-email/:user/:hash',
        element: <VerifyResetEmailPage />,
      },
    ],
  },
];

export default authRoutes;
