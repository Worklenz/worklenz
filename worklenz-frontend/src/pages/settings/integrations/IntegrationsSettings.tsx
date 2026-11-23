import { Empty, Spin } from 'antd';
import { IntegrationCenterControls, IntegrationCenterSearch } from './IntegrationCenterControls';
import { IntegrationCategoryNavigation } from './IntegrationCategoryNavigation';
import { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAddonSlotItems } from '@/addons/addon-slots';
import { SlackIntegration } from '@/components/settings/integrations/SlackIntegration';
import { GithubIntegrationCard } from '@/components/github/GithubIntegrationCard';

interface IntegrationsSettingsProps {
  projectId?: string;
  hideTitle?: boolean;
}

function IntegrationsSettings({ projectId, hideTitle = false }: IntegrationsSettingsProps) {
  const { t } = useTranslation('settings/integrations');
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');
  const query = searchQuery.trim().toLocaleLowerCase();
  const matches = (name: string, description: string) =>
    !query || `${name} ${description}`.toLocaleLowerCase().includes(query);
  const slackName = t('slack.title', { defaultValue: 'Slack' });
  const slackDescription = t('slack.description', {
    defaultValue:
      'Integrate Slack to receive real-time notifications, create tasks, and sync your team.',
  });
  const githubName = t('github.title', { defaultValue: 'GitHub' });
  const githubDescription = t('github.description', {
    defaultValue: 'Connect GitHub repositories and synchronize development activity.',
  });

  const showSlack =
    (category === 'all' || category === 'messaging') && matches(slackName, slackDescription);
  const showGithub =
    (category === 'all' || category === 'issue-tracking') && matches(githubName, githubDescription);
  const addonItems = getAddonSlotItems('integrationSettings');

  return (
    <div className="space-y-4">
      <IntegrationCenterControls hideTitle={hideTitle} />
      <div className="flex flex-col lg:flex-row gap-6">
        <IntegrationCategoryNavigation category={category} onChange={setCategory} />
        <div className="min-w-0 flex-1 space-y-4">
          <IntegrationCenterSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {showSlack && <SlackIntegration />}
            {showGithub && <GithubIntegrationCard />}
            {!showSlack && !showGithub && addonItems.length === 0 && (
              <Empty
                className="col-span-full"
                description={t('center.noResults', { defaultValue: 'No integrations found.' })}
              />
            )}
            {addonItems.map(({ key, component: Component }) =>
              Component ? (
                <Suspense
                  key={key}
                  fallback={
                    <div className="col-span-full">
                      <Spin tip={t('loading', { defaultValue: 'Loading' })}>
                        <div />
                      </Spin>
                    </div>
                  }
                >
                  <Component
                    projectId={projectId}
                    searchQuery={searchQuery}
                    category={category}
                    hasBuiltinMatches={showSlack || showGithub}
                  />
                </Suspense>
              ) : null
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default IntegrationsSettings;
