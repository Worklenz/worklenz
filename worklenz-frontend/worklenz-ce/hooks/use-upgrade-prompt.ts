import { useCallback } from 'react';
import { IUpgradePrompt } from '../types/business-features.types';

const PRICING_URL = 'https://worklenz.com/pricing';

/**
 * CE stub — there is no in-app checkout, so an upgrade prompt just sends the user to the public
 * pricing page. The optional variant is ignored.
 */
export function useUpgradePrompt(): IUpgradePrompt {
  const promptUpgrade = useCallback(() => {
    window.open(PRICING_URL, '_blank', 'noopener');
  }, []);

  return { promptUpgrade, isUpgradeOpen: false };
}
