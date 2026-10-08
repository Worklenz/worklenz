import { useState, useEffect } from 'react';
import { billingApiService } from '@/api/admin-center/billing.api.service';
import logger from '@/utils/errorLogger';

const CACHE_KEY = 'worklenz_user_region_check';
const CACHE_DURATION = 24 * 60 * 60 * 1000;

function getTimezoneBasedLkr(): boolean {
  return Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Colombo';
}

function cacheRegionResult(isLkrUser: boolean): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ isLkrUser, timestamp: Date.now() }));
  } catch {
    logger.error('Failed to cache region data');
  }
}

export function useRegionCheck() {
  const [isLkrUser, setIsLkrUser] = useState(false);
  const [regionCheckComplete, setRegionCheckComplete] = useState(false);

  useEffect(() => {
    async function checkRegion() {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { isLkrUser: cachedValue, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setIsLkrUser(cachedValue);
            setRegionCheckComplete(true);
            return;
          }
        }
      } catch {
        logger.error('Failed to parse cached region data');
      }

      try {
        const response = await billingApiService.checkRegion();
        if (response.done && response.body) {
          const { isLkrEligible } = response.body;
          const result = isLkrEligible !== null ? isLkrEligible : getTimezoneBasedLkr();
          setIsLkrUser(result);
          cacheRegionResult(result);
        } else {
          const result = getTimezoneBasedLkr();
          setIsLkrUser(result);
          cacheRegionResult(result);
        }
      } catch {
        const result = getTimezoneBasedLkr();
        setIsLkrUser(result);
        cacheRegionResult(result);
      } finally {
        setRegionCheckComplete(true);
      }
    }

    checkRegion();
  }, []);

  return { isLkrUser, regionCheckComplete };
}
