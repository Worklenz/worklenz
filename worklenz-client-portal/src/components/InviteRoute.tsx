import React, { Suspense, lazy, useRef } from 'react';
import { Spin } from '@/shared/antd-imports';
import { useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import PublicRoute from '@/components/PublicRoute';

const SignInPage = lazy(() => import('@/pages/SignInPage'));
const AcceptInvitePage = lazy(() => import('@/pages/AcceptInvitePage'));

type InviteMode = 'accept' | 'sign-in';

/**
 * The emailed invitation link (`/invite?token=`).
 * - Already signed in: the invitation is accepted straight away, with no code.
 * - Not signed in: the usual one-time-code sign-in, which links every portal for the address.
 * The mode is decided once, when the session check finishes, so signing in through this very link does
 * not then try to accept the invitation a second time.
 */
export const InviteRoute: React.FC = () => {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token');
  const { isAuthenticated, isLoading } = useAppSelector(state => state.auth);
  const mode = useRef<InviteMode | null>(null);

  if (mode.current === null && !isLoading) {
    mode.current = isAuthenticated && inviteToken ? 'accept' : 'sign-in';
  }

  // Wait for the stored session to be checked, otherwise a signed-in person would be sent a code first.
  if (mode.current === null) return <Spin fullscreen />;

  return (
    <Suspense fallback={<Spin fullscreen />}>
      {mode.current === 'accept' && inviteToken ? (
        <AcceptInvitePage inviteToken={inviteToken} />
      ) : (
        <PublicRoute restricted>
          <SignInPage />
        </PublicRoute>
      )}
    </Suspense>
  );
};

export default InviteRoute;
