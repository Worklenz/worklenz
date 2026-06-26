import React, { useState } from 'react';
import { Card, Button, Result, Alert } from '@/shared/antd-imports';
import { CheckCircleOutlined, FormOutlined } from '@/shared/antd-imports';
import { useSurveyStatus } from '@/hooks/useSurveyStatus';
import { SurveyPromptModal } from './SurveyPromptModal';
import { useTranslation } from 'react-i18next';

export const SurveySettingsCard: React.FC = () => {
  const { t } = useTranslation('settings');
  const [showModal, setShowModal] = useState(false);
  const { hasCompletedSurvey, loading } = useSurveyStatus();

  if (loading) {
    return <Card loading={true} />;
  }

  return (
    <>
      <Card
        title={
          <span>
            <FormOutlined style={{ marginRight: 8 }} />
            Personalization Survey
          </span>
        }
        extra={
          hasCompletedSurvey && (
            <Button type="link" onClick={() => setShowModal(true)}>
              Update Responses
            </Button>
          )
        }
      >
        {hasCompletedSurvey ? (
          <Result
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            title="Survey Completed"
            subTitle="Thank you for completing the personalization survey. Your responses help us improve Worklenz."
            extra={<Button onClick={() => setShowModal(true)}>Update Your Responses</Button>}
          />
        ) : (
          <>
            <Alert
              message="Help us personalize your experience"
              description="Take a quick survey to tell us about your organization and how you use Worklenz."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <div style={{ textAlign: 'center' }}>
              <Button type="primary" size="large" onClick={() => setShowModal(true)}>
                Take Survey Now
              </Button>
            </div>
          </>
        )}
      </Card>

      {showModal && <SurveyPromptModal forceShow={true} onClose={() => setShowModal(false)} />}
    </>
  );
};
