import { lazy, Suspense } from 'react';
import AuthLayout from '@/layouts/AuthLayout';
import { Navigate } from 'react-router-dom';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';
import ChunkErrorHandler from '@/utils/chunk-error-handler';

// Lazy load auth page components for better code splitting with chunk error handling
const LoginPage = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/auth/LoginPage'), 'LoginPage')
);
const SignupPage = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/auth/SignupPage'), 'SignupPage')
);
const ForgotPasswordPage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/auth/ForgotPasswordPage'),
    'ForgotPasswordPage'
  )
);
const LoggingOutPage = lazy(
  ChunkErrorHandler.wrapLazyImport(() => import('@/pages/auth/LoggingOutPage'), 'LoggingOutPage')
);
const AuthenticatingPage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/auth/AuthenticatingPage'),
    'AuthenticatingPage'
  )
);
const VerifyResetEmailPage = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/auth/VerifyResetEmailPage'),
    'VerifyResetEmailPage'
  )
);
const ResetPasswordRedirect = lazy(
  ChunkErrorHandler.wrapLazyImport(
    () => import('@/pages/auth/ResetPasswordRedirect'),
    'ResetPasswordRedirect'
  )
);

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
      {
        path: 'reset-password',
        element: (
          <Suspense fallback={<SuspenseFallback />}>
            <ResetPasswordRedirect />
          </Suspense>
        ),
      },
    ],
  },
];

export default authRoutes;
