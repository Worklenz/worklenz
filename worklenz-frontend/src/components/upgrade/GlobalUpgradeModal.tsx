import React, { useEffect, useMemo } from 'react';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import { MixpanelBillingEvents, PricingModalEventProps } from '@/types/mixpanel-events.types';
import { Modal } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAuthService } from '@/hooks/useAuth';
import { useRegionCheck } from '@/hooks/useRegionCheck';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { isAppSumoUser as checkIsAppSumoUser } from '@/utils/subscription-utils';
import UpgradePlansSwitch from '@/components/admin-center/billing/drawers/upgrade-plans-per-user/UpgradePlansSwitch';
import UpgradePlansLKR from '@/components/admin-center/billing/drawers/upgrade-plans-lkr/upgrade-plans-lkr';

// The single "Upgrade Now" pricing modal, driven by isUpgradeModalOpen and
// mounted once per top-level layout (MainLayout, ReportingLayout,
// ClientPortalLayout — see each for why every one of them needs its own
// copy rather than sharing a single mount point). Kept as one component so
// the three copies can't drift apart the way MainLayout's and
// ReportingLayout's previously did (LKR region check + zIndex 1050 vs. a
// plain UpgradePlans + zIndex 1000).
const GlobalUpgradeModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isUpgradeModalOpen, upgradeModalVariant, billingInfo } = useAppSelector(
    state => state.adminCenterReducer
  );
  const { trackMixpanelEvent } = useMixpanelTracking();
  const currentSession = useAuthService().getCurrentSession();
  const { isLkrUser, regionCheckComplete } = useRegionCheck();

  const isAppSumoUser = useMemo(
    () => checkIsAppSumoUser(currentSession, billingInfo),
    [billingInfo, currentSession]
  );

  const modalWidth = isLkrUser ? 'fit-content' : isAppSumoUser ? 700 : 1400;

  // Every entry point (navbar, billing page, invite dialogs, banners) opens this modal, so this is
  // the one place that sees them all.
  useEffect(() => {
    if (!isUpgradeModalOpen) return;
    const subscriptionType = currentSession?.subscription_type;
    const props: PricingModalEventProps = {
      user_type: isAppSumoUser
        ? 'appsumo'
        : subscriptionType === ISUBSCRIPTION_TYPE.TRIAL
          ? 'trial'
          : subscriptionType === ISUBSCRIPTION_TYPE.FREE
            ? 'free'
            : 'paid',
      trigger_source: upgradeModalVariant,
      current_plan: billingInfo?.plan_name,
      is_appsumo_user: isAppSumoUser,
      team_size: billingInfo?.total_used,
      subscription_status: billingInfo?.status,
      source_page: window.location.pathname,
    };
    trackMixpanelEvent(MixpanelBillingEvents.PRICING_MODAL_OPENED, props);
    // Only when the modal opens, not on every billingInfo refresh while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUpgradeModalOpen]);

  return (
    <Modal
      open={isUpgradeModalOpen}
      onCancel={() => {
        trackMixpanelEvent(MixpanelBillingEvents.PRICING_MODAL_CLOSED, {
          trigger_source: upgradeModalVariant,
          source_page: window.location.pathname,
        });
        dispatch(toggleUpgradeModal());
      }}
      width={modalWidth}
      centered
      okButtonProps={{ hidden: true }}
      cancelButtonProps={{ hidden: true }}
      // Must outrank whatever gated form/modal was open when the user hit
      // "Upgrade Now" (e.g. Add Expense) — antd Modals default to the same
      // z-index (1000), so without this the one mounted first would paint
      // underneath a modal that opened later, like the quick-action forms
      // it's meant to interrupt.
      zIndex={1050}
      destroyOnHidden
      maskClosable={false}
    >
      <div style={{ padding: '20px' }}>
        {regionCheckComplete ? (
          isLkrUser ? <UpgradePlansLKR /> : <UpgradePlansSwitch />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
        )}
      </div>
    </Modal>
  );
};

export default GlobalUpgradeModal;
