import { useState, useEffect } from 'react';
import { surveyApiService } from '@/api/survey/survey.api.service';
import logger from '@/utils/errorLogger';

export interface UseSurveyStatusResult {
  hasCompletedSurvey: boolean | null;
  isNewUser: boolean;
  joinedViaInvitation: boolean;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useSurveyStatus = (): UseSurveyStatusResult => {
  const [hasCompletedSurvey, setHasCompletedSurvey] = useState<boolean | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [joinedViaInvitation, setJoinedViaInvitation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const checkSurveyStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await surveyApiService.checkAccountSetupSurveyStatus();

      if (response.done) {
        setHasCompletedSurvey(response.body.is_completed);
        setIsNewUser(Boolean(response.body.is_new_user));
        setJoinedViaInvitation(Boolean(response.body.joined_via_invitation));
      } else {
        setHasCompletedSurvey(false);
        setIsNewUser(false);
        setJoinedViaInvitation(false);
      }
    } catch (err) {
      logger.error('Failed to check survey status', err);
      setError(err as Error);
      // Assume not completed if there's an error
      setHasCompletedSurvey(false);
      setIsNewUser(false);
      setJoinedViaInvitation(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSurveyStatus();
  }, []);

  return {
    hasCompletedSurvey,
    isNewUser,
    joinedViaInvitation,
    loading,
    error,
    refetch: checkSurveyStatus,
  };
};
