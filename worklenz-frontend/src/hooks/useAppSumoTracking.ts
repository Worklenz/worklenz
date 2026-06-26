import { useCallback } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';

export const useAppSumoTracking = () => {
  const { trackMixpanelEvent } = useMixpanelTracking();
  const billingInfo = useAppSelector(s => s.adminCenterReducer.billingInfo);
  const session = useAuthService().getCurrentSession();

  const trackAppSumoEvent = useCallback(
    (event: string, extra?: Record<string, unknown>) => {
      trackMixpanelEvent(event, {
        user_id: session?.id,
        workspace_id: session?.team_id,
        current_plan: billingInfo?.subscription_type ?? 'appsumo',
        appsumo_codes_redeemed: billingInfo?.redeemed_codes_count,
        appsumo_seat_limit: billingInfo?.total_seats,
        ...extra,
      });
    },
    [trackMixpanelEvent, billingInfo, session]
  );

  return { trackAppSumoEvent };
};
