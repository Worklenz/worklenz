import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Typography } from '@/shared/antd-imports';
import { DiscussionsPanel } from './DiscussionsPanel';

/** Client conversations, each attached to the project, task, file or approval it is about. */
const DiscussionsPage = () => {
  const { t } = useTranslation('client-portal-v2-discussions');
  const { threadId } = useParams<{ threadId: string }>();

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0, fontSize: 22 }}>
          {t('page.title', { defaultValue: 'Discussions' })}
        </Typography.Title>
        <Typography.Text type="secondary">
          {t('page.description', {
            defaultValue:
              'Client conversations attached to the project, task, file or approval they are about. Internal comments live beside them and are never sent to the portal.',
          })}
        </Typography.Text>
      </div>
      <DiscussionsPanel initialThreadId={threadId} />
    </div>
  );
};

export default DiscussionsPage;
