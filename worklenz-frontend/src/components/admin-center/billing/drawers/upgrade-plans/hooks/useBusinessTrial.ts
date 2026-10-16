import { useState, useEffect } from 'react';
import { message } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { PlanTrialApiService } from '@/api/admin-center/plan-trial.api.service';
import { isOnBusinessTrial } from '@/utils/subscription-utils';

export function useBusinessTrial(currentSession: any) {
  const { t } = useTranslation(['admin-center/current-bill']);

  const [canStartBusinessTrial, setCanStartBusinessTrial] = useState(false);
  const [businessTrialLoading, setBusinessTrialLoading] = useState(false);
  const [trialEligibilityChecked, setTrialEligibilityChecked] = useState(false);

  useEffect(() => {
    const checkTrialEligibility = async () => {
      if (!currentSession || isOnBusinessTrial(currentSession)) {
        setTrialEligibilityChecked(true);
        return;
      }
      try {
        const response = await PlanTrialApiService.checkBusinessTrialEligibility();
        if (response.done && response.body) {
          setCanStartBusinessTrial(response.body.can_start_trial || false);
        }
      } catch (error) {
        console.error('Failed to check Business trial eligibility:', error);
        setCanStartBusinessTrial(false);
      } finally {
        setTrialEligibilityChecked(true);
      }
    };
    checkTrialEligibility();
  }, [currentSession]);

  const startBusinessTrial = async () => {
    setBusinessTrialLoading(true);
    try {
      const response = await PlanTrialApiService.startBusinessTrial();
      if (response.done) {
        message.success(
          t('business-trial-started', {
            defaultValue: 'Business trial started successfully! Refreshing...',
          })
        );
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        message.error(
          response.message ||
            t('business-trial-start-failed', { defaultValue: 'Failed to start trial' })
        );
      }
    } catch (error: any) {
      message.error(
        error.response?.data?.message ||
          t('business-trial-start-failed', { defaultValue: 'Failed to start trial' })
      );
    } finally {
      setBusinessTrialLoading(false);
    }
  };

  return {
    canStartBusinessTrial,
    businessTrialLoading,
    trialEligibilityChecked,
    startBusinessTrial,
  };
}
