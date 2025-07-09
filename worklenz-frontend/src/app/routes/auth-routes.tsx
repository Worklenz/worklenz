import { lazy, Suspense } from 'react';
import AuthLayout from '@/layouts/AuthLayout';
import { Navigate } from 'react-router-dom';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';

// Lazy load auth page components for better code splitting
const LoginPage = lazy(() => import('@/pages/auth/login-page'));
const SignupPage = lazy(() => import('@/pages/auth/signup-page'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/forgot-password-page'));
const LoggingOutPage = lazy(() => import('@/pages/auth/logging-out'));
const AuthenticatingPage = lazy(() => import('@/pages/auth/authenticating'));
const VerifyResetEmailPage = lazy(() => import('@/pages/auth/verify-reset-email'));

const authRoutes = [
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      {
        path: '',
        element: <Navigate to="login" replace />,
      },
      {
        path: 'login',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <LoginPage />
          </Suspense>
        ),
      },
      {
        path: 'signup',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <SignupPage />
          </Suspense>
        ),
      },
      {
        path: 'forgot-password',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <ForgotPasswordPage />
          </Suspense>
        ),
      },
      {
        path: 'logging-out',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <LoggingOutPage />
          </Suspense>
        ),
      },
      {
        path: 'authenticating',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <AuthenticatingPage />
          </Suspense>
        ),
      },
      {
        path: 'verify-reset-email/:user/:hash',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <VerifyResetEmailPage />
          </Suspense>
        ),
      },
    ],
  },
];

export default authRoutes;
