import { useTranslation } from 'react-i18next';
import { Button, Result } from '@/shared/antd-imports';
import type { PreviewResponse } from '@/types/client-portal/v2';

export { PreviewDashboard } from './PreviewDashboard';
export { PreviewProjects, PreviewApprovals, PreviewChangeRequests } from './PreviewLists';
export { PreviewDiscussions } from './PreviewDiscussions';

export const PreviewError = ({ onRetry }: { onRetry: () => void }) => {
  const { t } = useTranslation('client-portal-v2-preview');
  return (
    <Result
      status="error"
      title={t('error.title', { defaultValue: 'The preview could not be loaded' })}
      extra={
        <Button type="primary" onClick={onRetry}>
          {t('retry', { defaultValue: 'Retry' })}
        </Button>
      }
    />
  );
};

export type { PreviewResponse };
