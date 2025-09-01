import { useCallback } from 'react';
import { PlanType } from '../types';
import { MAX_REGULAR_USERS, MAX_APPSUMO_USERS, APPSUMO_BUSINESS_LIMIT } from '../constants';

export const useTeamSizeOptions = (isAppSumoUser: boolean, selectedPlanType: PlanType) => {
  const generateTeamSizeOptions = useCallback(() => {
    const options: { value: number; label: string }[] = [];

    // Always show 1-5 for small teams
    for (let i = 1; i <= 5; i++) {
      options.push({ value: i, label: `${i} user${i > 1 ? 's' : ''}` });
    }

    // For AppSumo users, show up to 50 users with special highlighting
    const maxUsers = isAppSumoUser ? MAX_APPSUMO_USERS : MAX_REGULAR_USERS;
    const showAppSumoLabel = isAppSumoUser && selectedPlanType === 'business';

    // Show multiples of 5 up to the maximum
    for (let i = 10; i <= maxUsers; i += 5) {
      const label =
        showAppSumoLabel && i > APPSUMO_BUSINESS_LIMIT && i <= MAX_APPSUMO_USERS 
          ? `${i} users (AppSumo Special)` 
          : `${i} users`;
      options.push({ value: i, label });
    }

    // For non-AppSumo users, continue to 95
    if (!isAppSumoUser) {
      for (let i = 55; i <= MAX_REGULAR_USERS; i += 5) {
        options.push({ value: i, label: `${i} users` });
      }
    }

    return options;
  }, [isAppSumoUser, selectedPlanType]);

  return { generateTeamSizeOptions };
};