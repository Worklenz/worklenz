import { createAuthService } from '@/services/auth/auth.service';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export const useAuthService = () => {
  const navigate = useNavigate();
  const authService = useMemo(() => createAuthService(navigate), [navigate]);
  return authService;
};
