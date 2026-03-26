import { lazy, Suspense } from 'react';
import AuthLayout from '@/layouts/AuthLayout';
import { Navigate } from 'react-router-dom';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';

// PPM-OVERRIDE: Auto-reload on stale chunk errors after deploys
const lazyWithReload = (importFn: () => Promise<any>) =>
  lazy(() =>
    importFn().catch(() => {
      window.location.reload();
      return new Promise(() => {}); // never resolves — reload handles it
    })
  );

// Lazy load auth page components for better code splitting
const LoginPage = lazyWithReload(() => import('@/pages/auth/LoginPage'));
const SignupPage = lazyWithReload(() => import('@/pages/auth/SignupPage'));
const ForgotPasswordPage = lazyWithReload(() => import('@/pages/auth/ForgotPasswordPage'));
const LoggingOutPage = lazyWithReload(() => import('@/pages/auth/LoggingOutPage'));
const AuthenticatingPage = lazyWithReload(() => import('@/pages/auth/AuthenticatingPage'));
const VerifyResetEmailPage = lazyWithReload(() => import('@/pages/auth/VerifyResetEmailPage'));

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
