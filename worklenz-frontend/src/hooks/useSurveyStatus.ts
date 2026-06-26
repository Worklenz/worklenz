import { useState, useEffect } from 'react';
import { surveyApiService } from '@/api/survey/survey.api.service';
import logger from '@/utils/errorLogger';

export interface UseSurveyStatusResult {
  hasCompletedSurvey: boolean | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useSurveyStatus = (): UseSurveyStatusResult => {
  const [hasCompletedSurvey, setHasCompletedSurvey] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const checkSurveyStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await surveyApiService.checkAccountSetupSurveyStatus();

      if (response.done) {
        setHasCompletedSurvey(response.body.is_completed);
      } else {
        setHasCompletedSurvey(false);
      }
    } catch (err) {
      logger.error('Failed to check survey status', err);
      setError(err as Error);
      // Assume not completed if there's an error
      setHasCompletedSurvey(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSurveyStatus();
  }, []);

  return {
    hasCompletedSurvey,
    loading,
    error,
    refetch: checkSurveyStatus,
  };
};
