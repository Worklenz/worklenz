import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { SocketProvider } from '@/socket/socketContext';
import { authApiService } from '@/api/auth/auth.api.service';
import { deleteSession, hasSession, setSession } from '@/utils/session-helper';
import logger from '@/utils/errorLogger';
import { SuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';

export const AuthenticatedLayout = () => {
  const navigate = useNavigate();
  const [isVerifyingSession, setIsVerifyingSession] = useState(() => hasSession());

  useEffect(() => {
    if (!hasSession()) return;

    let isMounted = true;
    const verifySession = async () => {
      try {
        const response = await authApiService.verify(true);
        if (!isMounted) return;

        if (response.authenticated && response.user) {
          setSession(response.user);
        } else {
          deleteSession();
          navigate('/auth/login', { replace: true });
        }
      } catch (error) {
        if (isMounted) {
          logger.error('Failed to verify the current session', error);
        }
      } finally {
        if (isMounted) setIsVerifyingSession(false);
      }
    };

    void verifySession();
    return () => {
      isMounted = false;
    };
  }, [navigate]);

  if (isVerifyingSession) return <SuspenseFallback />;

  return (
    <SocketProvider>
      <Outlet />
    </SocketProvider>
  );
};
