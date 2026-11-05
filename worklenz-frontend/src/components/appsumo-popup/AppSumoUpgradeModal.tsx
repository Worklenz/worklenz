import { useEffect, useState } from 'react';
import { Modal } from '@/shared/antd-imports';
import { APPSUMO_PROMO_DEFAULT_BILLING } from '@/config/appsumo-promo.config';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { MixpanelBillingEvents } from '@/types/mixpanel-events.types';
import { AppSumoUpgradeBanner } from './AppSumoUpgradeBanner';

interface AppSumoUpgradeModalProps {
  open: boolean;
  onClose: () => void;
  sourceComponent: string;
  trackViewOnOpen?: boolean;
}

export const AppSumoUpgradeModal = ({
  open,
  onClose,
  sourceComponent,
  trackViewOnOpen = true,
}: AppSumoUpgradeModalProps) => {
  const { trackMixpanelEvent } = useMixpanelTracking();
  const [bannerKey, setBannerKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setBannerKey(key => key + 1);
    if (!trackViewOnOpen) return;
    trackMixpanelEvent(MixpanelBillingEvents.APPSUMO_PROMO_POPUP_VIEWED, {
      source_component: sourceComponent,
      billing: APPSUMO_PROMO_DEFAULT_BILLING,
    });
  }, [open, trackViewOnOpen, sourceComponent, trackMixpanelEvent]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnHidden
      closable={false}
      maskClosable={false}
      width={1040}
      zIndex={1100}
      className="appsumo-upgrade-modal"
      styles={{ content: { padding: 0, overflow: 'hidden' }, body: { padding: 0 } }}
    >
      {open && (
        <AppSumoUpgradeBanner
          key={bannerKey}
          sourceComponent={sourceComponent}
          showClose
          onClose={onClose}
        />
      )}
    </Modal>
  );
};

export default AppSumoUpgradeModal;
