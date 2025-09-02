import { useCallback } from 'react';
import { PlanType } from '../types';
import { MAX_REGULAR_USERS, MAX_APPSUMO_USERS, APPSUMO_BUSINESS_LIMIT } from '../constants';

export const useTeamSizeOptions = (isAppSumoUser: boolean, selectedPlanType: PlanType, currentTeamSize?: number) => {
  const generateTeamSizeOptions = useCallback(() => {
    const options: { value: number; label: string }[] = [];
    
    // If there's a current team size, use it as the minimum
    const minTeamSize = currentTeamSize && currentTeamSize > 0 ? currentTeamSize : 1;

    // Always include the current team size if it's not in the standard options
    if (currentTeamSize && currentTeamSize > 0) {
      // Add current team size if it's not a standard option (1-5 or multiple of 5)
      const isStandardOption = currentTeamSize <= 5 || currentTeamSize % 5 === 0;
      if (!isStandardOption) {
        options.push({ 
          value: currentTeamSize, 
          label: `${currentTeamSize} user${currentTeamSize > 1 ? 's' : ''} (Current)` 
        });
      }
    }

    // Show 1-5 for small teams (but only if >= minTeamSize)
    for (let i = 1; i <= 5; i++) {
      if (i >= minTeamSize) {
        const label = i === currentTeamSize 
          ? `${i} user${i > 1 ? 's' : ''} (Current)`
          : `${i} user${i > 1 ? 's' : ''}`;
        options.push({ value: i, label });
      }
    }

    // For AppSumo users, show up to 50 users with special highlighting
    const maxUsers = isAppSumoUser ? MAX_APPSUMO_USERS : MAX_REGULAR_USERS;
    const showAppSumoLabel = isAppSumoUser && selectedPlanType === 'business';

    // Show multiples of 5 up to the maximum (but only if >= minTeamSize)
    for (let i = 10; i <= maxUsers; i += 5) {
      if (i >= minTeamSize) {
        let label = `${i} users`;
        if (i === currentTeamSize) {
          label += ' (Current)';
        } else if (showAppSumoLabel && i > APPSUMO_BUSINESS_LIMIT && i <= MAX_APPSUMO_USERS) {
          label += ' (AppSumo Special)';
        }
        options.push({ value: i, label });
      }
    }

    // For non-AppSumo users, continue to 95
    if (!isAppSumoUser) {
      for (let i = 55; i <= MAX_REGULAR_USERS; i += 5) {
        if (i >= minTeamSize) {
          const label = i === currentTeamSize 
            ? `${i} users (Current)`
            : `${i} users`;
          options.push({ value: i, label });
        }
      }
    }

    // Sort options by value to ensure proper order
    options.sort((a, b) => a.value - b.value);

    return options;
  }, [isAppSumoUser, selectedPlanType, currentTeamSize]);

  return { generateTeamSizeOptions };
};