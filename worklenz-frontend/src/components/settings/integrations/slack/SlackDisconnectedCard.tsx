import { useTranslation } from 'react-i18next';
import { Button, Card, Steps } from '@/shared/antd-imports';
import { SlackIcon } from '../IntegrationIcons';

interface SlackDisconnectedCardProps {
  loading: boolean;
  onConnect: () => void;
}

export function SlackDisconnectedCard({ loading, onConnect }: SlackDisconnectedCardProps) {
  const { t } = useTranslation('settings/slack-integration');

  return (
    <Card
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow duration-200"
      styles={{ body: { padding: '32px 24px' } }}
    >
      <div className="flex flex-col">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4 flex justify-center">
            <SlackIcon />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
            {t('title', { defaultValue: 'Connect Your Slack Workspace' })}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed max-w-2xl mx-auto">
            {t('notConnected.description', {
              defaultValue:
                'Integrate Slack with your Worklenz team to receive real-time notifications, create tasks from Slack, and keep your team synchronized across both platforms.',
            })}
          </p>
        </div>

        {/* Setup Instructions */}
        <div className="mb-8">
          <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {t('setup.title', { defaultValue: 'Setup Instructions' })}
          </h4>
          <Steps
            direction="vertical"
            current={0}
            items={[
              {
                title: t('setup.step1.title', { defaultValue: '1. Connect Your Workspace' }),
                description: t('setup.step1.description', {
                  defaultValue:
                    "Click the 'Connect Slack Workspace' button below to authorize Worklenz to access your Slack workspace.",
                }),
              },
              {
                title: t('setup.step2.title', { defaultValue: '2. Invite Bot to Channels' }),
                description: (
                  <div>
                    <p className="mb-2">
                      {t('setup.step2.description', {
                        defaultValue: 'In each Slack channel where you want notifications, type:',
                      })}
                    </p>
                    <code className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded text-sm font-mono">
                      {t('setup.step2.command', { defaultValue: '/invite @Worklenz' })}
                    </code>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {t('setup.step2.note', { defaultValue: 'You only need to do this once per channel.' })}
                    </p>
                  </div>
                ),
              },
              {
                title: t('setup.step3.title', { defaultValue: '3. Configure Notifications' }),
                description: t('setup.step3.description', {
                  defaultValue:
                    "After connecting, click 'Manage' to configure which projects send notifications to which channels.",
                }),
              },
            ]}
          />
        </div>

        {/* Action Button */}
        <div className="w-full">
          <Button
            type="primary"
            size="large"
            onClick={onConnect}
            loading={loading}
            className="w-full h-12 text-base font-medium"
            aria-label={t('connectWorkspace')}
          >
            {t('connectWorkspace', { defaultValue: 'Connect Slack Workspace' })}
          </Button>
        </div>
      </div>
    </Card>
  );
}
