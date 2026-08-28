import React, { useMemo } from 'react';
import { Modal } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAuthService } from '@/hooks/useAuth';
import { useRegionCheck } from '@/hooks/useRegionCheck';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { isAppSumoUser as checkIsAppSumoUser } from '@/ee/utils/subscription-utils';
import UpgradePlans from '@/ee/components/admin-center/billing/drawers/upgrade-plans/UpgradePlans';
import UpgradePlansLKR from '@/ee/components/admin-center/billing/drawers/upgrade-plans-lkr/upgrade-plans-lkr';

// The single "Upgrade Now" pricing modal, driven by isUpgradeModalOpen and
// mounted once per top-level layout (MainLayout, ReportingLayout,
// ClientPortalLayout — see each for why every one of them needs its own
// copy rather than sharing a single mount point). Kept as one component so
// the three copies can't drift apart the way MainLayout's and
// ReportingLayout's previously did (LKR region check + zIndex 1050 vs. a
// plain UpgradePlans + zIndex 1000).
const GlobalUpgradeModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isUpgradeModalOpen, billingInfo } = useAppSelector(state => state.adminCenterReducer);
  const currentSession = useAuthService().getCurrentSession();
  const { isLkrUser, regionCheckComplete } = useRegionCheck();

  const isAppSumoUser = useMemo(
    () => checkIsAppSumoUser(currentSession, billingInfo),
    [billingInfo, currentSession]
  );

  const modalWidth = isLkrUser ? 'fit-content' : isAppSumoUser ? 700 : 1400;

  return (
    <Modal
      open={isUpgradeModalOpen}
      onCancel={() => dispatch(toggleUpgradeModal())}
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
          isLkrUser ? <UpgradePlansLKR /> : <UpgradePlans />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
        )}
      </div>
    </Modal>
  );
};

export default GlobalUpgradeModal;
