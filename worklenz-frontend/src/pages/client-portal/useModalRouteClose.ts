import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Closing a route-driven modal returns to wherever it was opened from (a list, a workspace tab,
 * a notification), or to `fallback` when it was opened directly (a shared link, a fresh tab).
 */
export const useModalRouteClose = (fallback: string) => {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    if (location.key !== 'default') navigate(-1);
    else navigate(fallback);
  }, [location.key, navigate, fallback]);
};
