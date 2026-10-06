import { useEffect, useRef, useState } from 'react';
import { Modal, Spin } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { openUpgradeModal } from '@/features/admin-center/admin-center.slice';
import {
  APPSUMO_POPUP_IMAGE_URL,
  hasAppSumoPopupBeenShownRecently,
  markAppSumoPopupShown,
} from '@/config/appsumo-promo.config';
import { profileSettingsApiService } from '@/api/settings/profile/profile-settings.api.service';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { MixpanelBillingEvents } from '@/types/mixpanel-events.types';

interface AppSumoPopupProps {
  isAppSumoUser: boolean;
  /** Backend-configurable reappearance interval in days (`user.appsumo_popup_frequency_days`). */
  frequencyDays?: number;
}

export const AppSumoPopup = ({ isAppSumoUser, frequencyDays }: AppSumoPopupProps) => {
  const { t } = useTranslation('appsumo');
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const [open, setOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Claiming consumes the server-side "shown" slot, so it is issued at most once per mount and its
  // continuation must survive effect cleanup (React 18 StrictMode double-invokes effects in dev).
  const hasStartedClaimRef = useRef(false);
  // Billing info loads after the first render, so eligibility can flip while a claim is in flight.
  const isEligibleRef = useRef(isAppSumoUser);
  // True component unmount only (e.g. logout) — deliberately separate from the claim effect's own
  // cleanup below, which also runs on an in-place frequencyDays/isAppSumoUser change while the
  // component is still alive and an in-flight claim should still be allowed to complete.
  const isMountedRef = useRef(true);

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
    if (
      !isAppSumoUser ||
      !APPSUMO_POPUP_IMAGE_URL ||
      hasStartedClaimRef.current ||
      hasAppSumoPopupBeenShownRecently(frequencyDays)
    ) {
      return;
    }

    let cancelled = false;
    const preloadImage = new Image();

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
      setImageLoaded(true);
      setOpen(true);
      trackMixpanelEvent(MixpanelBillingEvents.APPSUMO_PROMO_POPUP_VIEWED, {
        source_component: 'AppSumoPopup',
      });
    };

    const startClaim = () => {
      if (cancelled) return;
      void claimAndShow();
    };

    preloadImage.onload = startClaim;
    preloadImage.onerror = startClaim;
    preloadImage.src = APPSUMO_POPUP_IMAGE_URL;

    return () => {
      cancelled = true;
      preloadImage.onload = null;
      preloadImage.onerror = null;
    };
  }, [isAppSumoUser, frequencyDays]);

  if (!APPSUMO_POPUP_IMAGE_URL) return null;

  const handleClose = () => {
    setOpen(false);
    trackMixpanelEvent(MixpanelBillingEvents.APPSUMO_PROMO_POPUP_CLOSED, {
      source_component: 'AppSumoPopup',
    });
  };

  const handleUpgradeClick = () => {
    setOpen(false);
    trackMixpanelEvent(MixpanelBillingEvents.APPSUMO_PROMO_POPUP_CLICKED, {
      source_component: 'AppSumoPopup',
    });
    dispatch(openUpgradeModal());
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      centered
      destroyOnHidden
      width={720}
      styles={{ content: { padding: 8 }, body: { padding: 0 } }}
    >
      {!imageLoaded && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 280,
          }}
        >
          <Spin size="large" />
        </div>
      )}
      <img
        src={APPSUMO_POPUP_IMAGE_URL}
        alt={t('popup.imageAlt')}
        style={{
          width: '100%',
          display: imageLoaded ? 'block' : 'none',
          borderRadius: 8,
          cursor: 'pointer',
        }}
        onLoad={() => setImageLoaded(true)}
        onClick={handleUpgradeClick}
      />
    </Modal>
  );
};

export default AppSumoPopup;
