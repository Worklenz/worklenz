import { IBusinessFeatures } from '../types/business-features.types';

/**
 * CE stub — the open-source build has no business plan, so every business feature is off and
 * billable is restricted. No session/Redux access (CE must not import from `src/`).
 */
export function useBusinessFeatures(): IBusinessFeatures {
  return {
    hasBusinessAccess: false,
    isBusinessPlan: false,
    isEnterprisePlan: false,
    isFreeUser: true,
    isOnBusinessTrial: false,
    planTrialDaysRemaining: 0,
    shouldRestrictBillable: true,
  };
}
