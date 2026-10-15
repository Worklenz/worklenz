import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Result } from '@/shared/antd-imports';

/**
 * Services, Requests and Chats were retired in Client Portal v2. Their old addresses (bookmarks,
 * emailed links) land here instead of a page that no longer works, so nobody writes into a place
 * the team can no longer see.
 */
const MovedPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Result
      status="info"
      title={t('moved.title', { defaultValue: 'This area is no longer available' })}
      subTitle={t('moved.description', {
        defaultValue:
          'Services, requests and chats have been replaced. Your project team shares updates, approvals and changes with you through your projects.',
      })}
      extra={
        <Button type="primary" onClick={() => navigate('/dashboard')}>
          {t('moved.backToDashboard', { defaultValue: 'Back to the overview' })}
        </Button>
      }
    />
  );
};

export default MovedPage;
