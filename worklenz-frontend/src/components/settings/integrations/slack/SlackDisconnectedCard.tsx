import { useTranslation } from 'react-i18next';
import { Button, Card } from '@/shared/antd-imports';
import { SlackIcon } from '../IntegrationIcons';

interface SlackDisconnectedCardProps {
  loading: boolean;
  onConnect: () => void;
}

export function SlackDisconnectedCard({ loading, onConnect }: SlackDisconnectedCardProps) {
  const { t } = useTranslation('settings/slack-integration');

  return (
    <Card
      className="text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow duration-200"
      styles={{ body: { padding: '32px 24px', height: '100%', display: 'flex', flexDirection: 'column' } }}
    >
      <div className="flex flex-col h-full">
        {/* Icon */}
        <div className="text-6xl mb-6">
          <SlackIcon />
        </div>

        {/* Content - Takes up remaining space */}
        <div className="flex-1 flex flex-col justify-center">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {t('title', { defaultValue: 'Connect Your Slack Workspace' })}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed max-w-sm mx-auto">
            {t('notConnected.description', {
              defaultValue:
                'Integrate Slack with your Worklenz team to receive real-time notifications, create tasks from Slack, and keep your team synchronized across both platforms.',
            })}
          </p>
        </div>

        {/* Action Button - Sticks to bottom */}
        <div className="w-full mt-8">
          <Button
            type="primary"
            size="large"
            onClick={onConnect}
            loading={loading}
            className="w-full h-12 text-base font-medium bg-blue-500 hover:bg-blue-600 border-blue-500 hover:border-blue-600"
            aria-label={t('connectWorkspace')}
          >
            {t('connectWorkspace', { defaultValue: 'Connect Slack Workspace' })}
          </Button>
        </div>
      </div>
    </Card>
  );
}
