import React from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/v2';
import { DiscussionsView } from './discussions/DiscussionsView';

/** Every project discussion the signed-in client can open, in one inbox. */
export const DiscussionsPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader
        title={t('discussions.title', { defaultValue: 'Discussions' })}
        subtitle={t('discussions.pageSubtitle', { defaultValue: 'Conversations from all your projects.' })}
      />
      <DiscussionsView />
    </div>
  );
};

export default DiscussionsPage;
