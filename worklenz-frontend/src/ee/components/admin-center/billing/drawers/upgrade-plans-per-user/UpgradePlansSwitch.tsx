import React, { useEffect, useState } from 'react';
import { Spin } from '@/shared/antd-imports';
import { billingApiService, type IPerUserPlansResponse } from '@/ee/api/admin-center/billing.api.service';
import UpgradePlans from '@/ee/components/admin-center/billing/drawers/upgrade-plans/UpgradePlans';
import PerUserUpgradePlans from './PerUserUpgradePlans';
import logger from '@/utils/errorLogger';

/**
 * Chooses the upgrade modal content. Per-user plans on Paddle Billing replace the legacy plan cards
 * as soon as any of them is active; until then (or if they cannot be loaded) the legacy modal is
 * shown unchanged, so turning the new pricing on is a data change, not a deployment.
 */
const UpgradePlansSwitch: React.FC = () => {
  const [perUser, setPerUser] = useState<IPerUserPlansResponse | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    billingApiService
      .getPerUserPlans()
      .then(response => {
        if (!cancelled) setPerUser(response.done && response.body?.plans?.length ? response.body : null);
      })
      .catch(error => {
        logger.error('Failed to load per-user plans', error);
        if (!cancelled) setPerUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (perUser === undefined) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Spin />
      </div>
    );
  }

  return perUser ? <PerUserUpgradePlans data={perUser} /> : <UpgradePlans />;
};

export default UpgradePlansSwitch;
