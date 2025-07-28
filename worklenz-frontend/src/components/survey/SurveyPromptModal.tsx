import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Result, Spin, Flex } from '@/shared/antd-imports';
import { SurveyStep } from '@/components/account-setup/survey-step';
import { useSurveyStatus } from '@/hooks/useSurveyStatus';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { surveyApiService } from '@/api/survey/survey.api.service';
import { appMessage } from '@/shared/antd-imports';
import { ISurveySubmissionRequest } from '@/types/account-setup/survey.types';
import logger from '@/utils/errorLogger';
import { resetSurveyData, setSurveySubStep } from '@/features/account-setup/account-setup.slice';

interface SurveyPromptModalProps {
  forceShow?: boolean;
  onClose?: () => void;
}

export const SurveyPromptModal: React.FC<SurveyPromptModalProps> = ({ forceShow = false, onClose }) => {
  const { t } = useTranslation('survey');
  const dispatch = useAppDispatch();
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const [surveyInfo, setSurveyInfo] = useState<{ id: string; questions: any[] } | null>(null);
  const { hasCompletedSurvey, loading, refetch } = useSurveyStatus();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const surveyData = useAppSelector(state => state.accountSetupReducer.surveyData);
  const surveySubStep = useAppSelector(state => state.accountSetupReducer.surveySubStep);
  const isDarkMode = themeMode === 'dark';

  useEffect(() => {
    if (forceShow) {
      setVisible(true);
      dispatch(resetSurveyData());
      dispatch(setSurveySubStep(0));
      
      // Fetch survey info
      const fetchSurvey = async () => {
        try {
          const response = await surveyApiService.getAccountSetupSurvey();
          if (response.done && response.body) {
            setSurveyInfo({
              id: response.body.id,
              questions: response.body.questions || []
            });
          }
        } catch (error) {
          logger.error('Failed to fetch survey', error);
        }
      };
      
      fetchSurvey();
    } else if (!loading && hasCompletedSurvey === false) {
      // Reset survey data when modal will be shown
      dispatch(resetSurveyData());
      dispatch(setSurveySubStep(0));
      
      // Fetch survey info
      const fetchSurvey = async () => {
        try {
          const response = await surveyApiService.getAccountSetupSurvey();
          if (response.done && response.body) {
            setSurveyInfo({
              id: response.body.id,
              questions: response.body.questions || []
            });
          }
        } catch (error) {
          logger.error('Failed to fetch survey', error);
        }
      };
      
      fetchSurvey();
      
      // Show modal after a 5 second delay to not interrupt user immediately
      const timer = setTimeout(() => {
        setVisible(true);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [loading, hasCompletedSurvey, dispatch, forceShow]);

  const handleComplete = async () => {
    try {
      setSubmitting(true);
      
      if (!surveyData || !surveyInfo) {
        throw new Error('Survey data not found');
      }

      // Create a map of question keys to IDs
      const questionMap = surveyInfo.questions.reduce((acc, q) => {
        acc[q.question_key] = q.id;
        return acc;
      }, {} as Record<string, string>);

      // Prepare submission data with actual question IDs
      const submissionData: ISurveySubmissionRequest = {
        survey_id: surveyInfo.id,
        answers: [
          {
            question_id: questionMap['organization_type'],
            answer_text: surveyData.organization_type || ''
          },
          {
            question_id: questionMap['user_role'],
            answer_text: surveyData.user_role || ''
          },
          {
            question_id: questionMap['main_use_cases'],
            answer_json: surveyData.main_use_cases || []
          },
          {
            question_id: questionMap['previous_tools'],
            answer_text: surveyData.previous_tools || ''
          },
          {
            question_id: questionMap['how_heard_about'],
            answer_text: surveyData.how_heard_about || ''
          }
        ].filter(answer => answer.question_id) // Filter out any missing question IDs
      };

      const response = await surveyApiService.submitSurveyResponse(submissionData);
      
      if (response.done) {
        setSurveyCompleted(true);
        appMessage.success('Thank you for completing the survey!');
        
        // Wait a moment before closing
        setTimeout(() => {
          setVisible(false);
          refetch(); // Update the survey status
        }, 2000);
      } else {
        throw new Error(response.message || 'Failed to submit survey');
      }
    } catch (error) {
      logger.error('Failed to submit survey', error);
      appMessage.error('Failed to submit survey. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    setVisible(false);
    // Optionally, you can set a flag in localStorage to not show again for some time
    localStorage.setItem('survey_skipped_at', new Date().toISOString());
    onClose?.();
  };

  const isCurrentStepValid = () => {
    switch (surveySubStep) {
      case 0:
        return surveyData.organization_type && surveyData.user_role;
      case 1:
        return surveyData.main_use_cases && surveyData.main_use_cases.length > 0;
      case 2:
        return surveyData.how_heard_about;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (surveySubStep < 2) {
      dispatch(setSurveySubStep(surveySubStep + 1));
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (surveySubStep > 0) {
      dispatch(setSurveySubStep(surveySubStep - 1));
    }
  };

  if (loading) {
    return null;
  }

  return (
    <Modal
      open={visible}
      title={surveyCompleted ? null : "Help Us Improve Your Experience"}
      onCancel={handleSkip}
      footer={
        surveyCompleted ? null : (
          <Flex justify="space-between" align="center">
            <div>
              <Button onClick={handleSkip}>
                Skip for now
              </Button>
            </div>
            <Flex gap={8}>
              {surveySubStep > 0 && (
                <Button onClick={handlePrevious}>
                  Previous
                </Button>
              )}
              <Button 
                type="primary" 
                onClick={handleNext}
                disabled={!isCurrentStepValid()}
                loading={submitting && surveySubStep === 2}
              >
                {surveySubStep === 2 ? 'Complete Survey' : 'Next'}
              </Button>
            </Flex>
          </Flex>
        )
      }
      width={800}
      maskClosable={false}
      centered
    >
      {submitting ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <p style={{ marginTop: 16 }}>Submitting your responses...</p>
        </div>
      ) : surveyCompleted ? (
        <Result
          status="success"
          title="Thank you!"
          subTitle="Your feedback helps us improve Worklenz for everyone."
        />
      ) : (
        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <SurveyStep 
            onEnter={() => {}} // Empty function since we handle navigation via buttons
            styles={{}}
            isDarkMode={isDarkMode}
            isModal={true} // Pass true to indicate modal context
          />
        </div>
      )}
    </Modal>
  );
};