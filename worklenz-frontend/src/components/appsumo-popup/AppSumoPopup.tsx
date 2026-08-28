import { useEffect, useState } from 'react';
import { Modal, Spin } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { openUpgradeModal } from '@/features/admin-center/admin-center.slice';
import {
  APPSUMO_POPUP_IMAGE_URL,
  hasAppSumoPopupBeenShownRecently,
  markAppSumoPopupShown,
} from '@/config/appsumo-promo.config';
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

  useEffect(() => {
    if (!isAppSumoUser || !APPSUMO_POPUP_IMAGE_URL || hasAppSumoPopupBeenShownRecently(frequencyDays)) return;

    let cancelled = false;
    const preloadImage = new Image();

    const showPopup = () => {
      if (cancelled) return;
      setImageLoaded(true);
      setOpen(true);
      trackMixpanelEvent(MixpanelBillingEvents.APPSUMO_PROMO_POPUP_VIEWED, {
        source_component: 'AppSumoPopup',
      });
    };

    preloadImage.onload = showPopup;
    preloadImage.onerror = showPopup;
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
    markAppSumoPopupShown();
    trackMixpanelEvent(MixpanelBillingEvents.APPSUMO_PROMO_POPUP_CLOSED, {
      source_component: 'AppSumoPopup',
    });
  };

  const handleUpgradeClick = () => {
    setOpen(false);
    markAppSumoPopupShown();
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
