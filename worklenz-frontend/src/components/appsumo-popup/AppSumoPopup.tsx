import { useEffect, useRef, useState } from 'react';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { MixpanelBillingEvents } from '@/types/mixpanel-events.types';
import {
  APPSUMO_PROMO_DEFAULT_BILLING,
  hasAppSumoPopupBeenShownRecently,
  markAppSumoPopupShown,
} from '@/config/appsumo-promo.config';
import { profileSettingsApiService } from '@/api/settings/profile/profile-settings.api.service';
import { AppSumoUpgradeModal } from './AppSumoUpgradeModal';

interface AppSumoPopupProps {
  isAppSumoUser: boolean;
  /** Backend-configurable reappearance interval in days (`user.appsumo_popup_frequency_days`). */
  frequencyDays?: number;
}

export const AppSumoPopup = ({ isAppSumoUser, frequencyDays }: AppSumoPopupProps) => {
  const { trackMixpanelEvent } = useMixpanelTracking();
  const [open, setOpen] = useState(false);

  // Claiming consumes the server-side "shown" slot, so it is issued at most once per mount and its
  // continuation must survive effect cleanup (React 18 StrictMode double-invokes effects in dev).
  const hasStartedClaimRef = useRef(false);
  // Billing info loads after the first render, so eligibility can flip while a claim is in flight.
  const isEligibleRef = useRef(isAppSumoUser);
  // True component unmount only (e.g. logout) — deliberately separate from the claim effect's own
  // cleanup below, which also runs on an in-place frequencyDays/isAppSumoUser change while the
  // component is still alive and an in-flight claim should still be allowed to complete.
  const isMountedRef = useRef(true);
  // View is tracked once here so AppSumoUpgradeModal does not double-fire on auto-open.
  const hasTrackedViewRef = useRef(false);

  useEffect(() => {
    isEligibleRef.current = isAppSumoUser;
  }, [isAppSumoUser]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isAppSumoUser || hasStartedClaimRef.current || hasAppSumoPopupBeenShownRecently(frequencyDays)) {
      return;
    }

    let cancelled = false;

    // The server is the source of truth for cadence (APPSUMO_POPUP_FREQUENCY_DAYS) because
    // localStorage is wiped on logout. The local gate above only avoids a needless request.
    const claimAndShow = async () => {
      if (hasStartedClaimRef.current) return;
      hasStartedClaimRef.current = true;
      // Re-check eligibility right before consuming the server-side slot: it's a one-shot
      // resource, so we shouldn't spend it on a user billing info has since ruled out.
      if (!isEligibleRef.current) return;

      let serverAllowsPopup = true;
      try {
        const response = await profileSettingsApiService.claimAppSumoPopup();
        // A failed claim (done:false, e.g. backend not migrated yet) or a network error falls
        // back to the local gate, which has already passed.
        if (response.done && response.body) serverAllowsPopup = response.body.should_show;
      } catch {
        // Fall back to the local gate.
      }

      // The component may have actually unmounted (e.g. logout) while the request was in flight;
      // don't stamp localStorage or open the popup for a torn-down instance.
      if (!isMountedRef.current) return;
      if (!serverAllowsPopup || !isEligibleRef.current) return;

      markAppSumoPopupShown();
      setOpen(true);
      if (!hasTrackedViewRef.current) {
        hasTrackedViewRef.current = true;
        trackMixpanelEvent(MixpanelBillingEvents.APPSUMO_PROMO_POPUP_VIEWED, {
          source_component: 'AppSumoPopup',
          billing: APPSUMO_PROMO_DEFAULT_BILLING,
        });
      }
    };

    // Defer so React StrictMode's effect cleanup can cancel before we consume the server slot.
    const timer = window.setTimeout(() => {
      if (!cancelled) void claimAndShow();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isAppSumoUser, frequencyDays, trackMixpanelEvent]);

  return (
    <AppSumoUpgradeModal
      open={open}
      onClose={() => setOpen(false)}
      sourceComponent="AppSumoPopup"
      trackViewOnOpen={false}
    />
  );
};

export default AppSumoPopup;
