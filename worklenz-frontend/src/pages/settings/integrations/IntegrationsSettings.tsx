import { Card, Badge, Button } from 'antd';
import { GithubOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { SlackIntegration } from '@/components/settings/integrations/SlackIntegration';
import {
  MSTeamsIcon,
  SlackIcon,
  GitHubIcon,
  GoogleDriveIcon,
  GoogleCalendarIcon,
} from '@/components/settings/integrations/IntegrationIcons';

interface IntegrationCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  available: boolean;
  children?: React.ReactNode;
}

function IntegrationCard({ icon, title, description, available, children }: IntegrationCardProps) {
  const { t } = useTranslation('settings/integrations');

  if (available && children) {
    return <>{children}</>;
  }

  return (
    <Card
      className="text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow duration-200"
      styles={{ body: { padding: '32px 24px', height: '100%' } }}
    >
      <div className="flex flex-col items-center justify-between h-full">
        {/* Icon */}
        <div className="text-6xl text-gray-400 dark:text-gray-500 mb-6">{icon}</div>

        {/* Content */}
        <div className="flex-1 flex flex-col justify-center">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
            {description}
          </p>
        </div>

        {/* Action Button */}
        <div className="w-full">
          {available ? (
            <Button
              type="primary"
              size="large"
              className="w-full h-12 text-base font-medium bg-blue-500 hover:bg-blue-600 border-blue-500 hover:border-blue-600"
            >
              {t('connect', { defaultValue: 'Connect' })}
            </Button>
          ) : (
            <Button disabled size="large" className="w-full h-12 text-base font-medium">
              {t('comingSoon', { defaultValue: 'Coming Soon' })}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function IntegrationsSettings() {
  const { t } = useTranslation('settings/integrations');

  return (
    <div className="space-y-6">
      {/* Integration Cards Grid - Consistent Heights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Slack Integration - Active */}
        <IntegrationCard
          icon={<SlackIcon />}
          title={t('slack.title', { defaultValue: 'Slack' })}
          description={t('slack.description', {
            defaultValue:
              'Integrate Slack to receive real-time notifications, create tasks, and sync your team.',
          })}
          available={true}
        >
          <SlackIntegration />
        </IntegrationCard>

        {/* MS Teams Integration - Coming Soon */}
        <IntegrationCard
          icon={<MSTeamsIcon />}
          title={t('teams.title', { defaultValue: 'Microsoft Teams' })}
          description={t('teams.description', {
            defaultValue:
              'Integrate Microsoft Teams with your Worklenz team to receive real-time notifications, create tasks from Teams, and keep your team synchronized across both platforms.',
          })}
          available={false}
        />

        {/* GitHub Integration - Coming Soon */}
        <IntegrationCard
          icon={<GithubOutlined />}
          title={t('github.title', { defaultValue: 'GitHub' })}
          description={t('github.description', {
            defaultValue:
              'Link GitHub repositories to track commits, pull requests, and issues alongside your tasks.',
          })}
          available={false}
        />

        {/* Google Drive Integration - Coming Soon */}
        <IntegrationCard
          icon={<GoogleDriveIcon />}
          title={t('googleDrive.title', { defaultValue: 'Google Drive' })}
          description={t('googleDrive.description', {
            defaultValue:
              'Connect Google Drive to attach files, share documents, and collaborate seamlessly with your team on project deliverables.',
          })}
          available={false}
        />

        {/* Google Calendar Integration - Coming Soon */}
        <IntegrationCard
          icon={<GoogleCalendarIcon />}
          title={t('googleCalendar.title', { defaultValue: 'Google Calendar' })}
          description={t('googleCalendar.description', {
            defaultValue:
              'Sync your tasks and deadlines with Google Calendar to manage your schedule, set reminders, and never miss important project milestones.',
          })}
          available={false}
        />
      </div>
    </div>
  );
}

export default IntegrationsSettings;
