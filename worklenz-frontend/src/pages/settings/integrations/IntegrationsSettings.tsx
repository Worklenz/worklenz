import { Alert, Badge, Button, Card, Empty, Modal, Segmented, Space, Spin } from 'antd';
import { IntegrationCenterControls, IntegrationCenterSearch } from './IntegrationCenterControls';
import { IntegrationCategoryNavigation } from './IntegrationCategoryNavigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAddonSlotItems } from '@/addons/addon-slots';
import { SlackIntegration } from '@/components/settings/integrations/SlackIntegration';
import { GithubIntegrationCard } from '@/components/github/GithubIntegrationCard';
import { IntegrationTile } from '@/components/settings/integrations/IntegrationTile';
import { GithubOutlined } from '@ant-design/icons';
import { SlackIcon } from '@/components/settings/integrations/IntegrationIcons';
import { Typography } from 'antd';
import { slackApiService } from '@/api/slack/slack.api.service';
import { githubApiService } from '@/api/github/github.api.service';
import { SlackProjectQuickAddModal } from '@/components/projects/integrations/SlackProjectQuickAddModal';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchProjectData, setProjectId as setDrawerProjectId } from '@/features/project/project-drawer.slice';
import { openProjectSettingsModal, setActiveSettingsSection } from '@/features/project/project-settings-modal.slice';
import { useAppSelector } from '@/hooks/useAppSelector';
import { isSoftwareProjectType } from '@/lib/project/software-project';

interface IntegrationsSettingsProps {
  projectId?: string;
  hideTitle?: boolean;
  projectName?: string;
  onClose?: () => void;
}

function IntegrationsSettings({ projectId, projectName, onClose, hideTitle = false }: IntegrationsSettingsProps) {
  const { t } = useTranslation('settings/integrations');
  const dispatch = useAppDispatch();
  const isSoftwareProject = useAppSelector(state => isSoftwareProjectType(state.projectReducer.project?.project_type));
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [projectView, setProjectView] = useState<'connected' | 'explore'>('connected');
  const [projectConnections, setProjectConnections] = useState<{ slack: boolean; github: boolean; hasError: boolean } | null>(null);
  const [statusAttempt, setStatusAttempt] = useState(0);
  const [isSlackModalOpen, setIsSlackModalOpen] = useState(false);
  const [detailsIntegration, setDetailsIntegration] = useState<'slack' | 'github' | null>(null);
  const openGithubSettings = () => {
    if (!projectId) return;
    onClose?.();
    dispatch(setActiveSettingsSection('integrations'));
    dispatch(setDrawerProjectId(projectId));
    void dispatch(fetchProjectData(projectId)).finally(() => dispatch(openProjectSettingsModal()));
  };
  const loadProjectConnections = useCallback(async (id: string) => {
    const [slack, github] = await Promise.allSettled([
      slackApiService.getProjectChannelConfigs(id), githubApiService.getProjectRepositories(id),
    ]);
    return {
      slack: slack.status === 'fulfilled' && Boolean(slack.value.done) && (slack.value.body || []).some(channel => channel.isActive),
      github: github.status === 'fulfilled' && Boolean(github.value.done) && Boolean(github.value.body?.connected && github.value.body.linked.length),
      hasError: slack.status === 'rejected' || github.status === 'rejected' ||
        (slack.status === 'fulfilled' && !slack.value.done) || (github.status === 'fulfilled' && !github.value.done),
    };
  }, []);
  useEffect(() => {
    if (!projectId) return;
    let isCurrent = true;
    setProjectConnections(null);
    void loadProjectConnections(projectId).then(result => { if (isCurrent) setProjectConnections(result); });
    return () => { isCurrent = false; };
  }, [projectId, loadProjectConnections, statusAttempt]);
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
    (category === 'all' || category === 'messaging') && matches(slackName, slackDescription) &&
    (!projectId || projectView === 'explore' || Boolean(projectConnections?.slack));
  const showGithub =
    (category === 'all' || category === 'issue-tracking') && matches(githubName, githubDescription) &&
    (!projectId || projectView === 'explore' || Boolean(projectConnections?.github));
  const addonItems = getAddonSlotItems('integrationSettings');

  return (
    <div className="space-y-4">
      <IntegrationCenterControls hideTitle={hideTitle} />
      {projectId && <Segmented aria-label={t('center.projectViewLabel', { defaultValue: 'Project integration view' })}
        value={projectView} onChange={value => setProjectView(value as 'connected' | 'explore')}
        options={[
          { value: 'connected', label: t('center.connectedTab', { defaultValue: 'Connected to this project' }) },
          { value: 'explore', label: t('center.exploreTab', { defaultValue: 'Explore integrations' }) },
        ]} />}
      {projectId && projectConnections?.hasError && <Alert type="warning" showIcon
        message={t('center.projectStatusError', { defaultValue: 'Some project connection statuses could not be loaded.' })}
        action={<Button size="small" onClick={() => setStatusAttempt(attempt => attempt + 1)}>{t('center.retry', { defaultValue: 'Retry' })}</Button>} />}
      <div className="flex flex-col lg:flex-row gap-6">
        <IntegrationCategoryNavigation category={category} onChange={setCategory} />
        <div className="min-w-0 flex-1 space-y-4">
          <IntegrationCenterSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
          {projectId && projectView === 'connected' && !projectConnections && <Spin size="small" />}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {showSlack && (projectId ? (
              projectView === 'connected' ? <Card className="col-span-full" size="small"><div className="flex flex-wrap items-center justify-between gap-3">
                <Space><SlackIcon /><Typography.Text strong>{slackName}</Typography.Text></Space>
                <Button onClick={() => setDetailsIntegration('slack')}>{t('center.manage', { defaultValue: 'Manage' })}</Button>
              </div></Card> : <IntegrationTile icon={<SlackIcon />} title={slackName} onOpenDetails={() => setDetailsIntegration('slack')}>
                <Typography.Paragraph style={{ marginBottom: 0 }}>{slackDescription}</Typography.Paragraph>
              </IntegrationTile>
            ) : <SlackIntegration />)}
            {showGithub && (projectId ? (
              projectView === 'connected' ? <Card className="col-span-full" size="small"><div className="flex flex-wrap items-center justify-between gap-3">
                <Space><GithubOutlined /><Typography.Text strong>{githubName}</Typography.Text></Space>
                <Button onClick={() => setDetailsIntegration('github')}>{t('center.manage', { defaultValue: 'Manage' })}</Button>
              </div></Card> : <IntegrationTile icon={<GithubOutlined />} title={githubName} onOpenDetails={() => setDetailsIntegration('github')}>
                <Typography.Paragraph style={{ marginBottom: 0 }}>{githubDescription}</Typography.Paragraph>
              </IntegrationTile>
            ) : <GithubIntegrationCard />)}
            {!showSlack && !showGithub && addonItems.length === 0 && (!projectId || projectView === 'explore' || (projectConnections && !projectConnections.hasError)) && (
              <Empty
                className="col-span-full"
                description={projectId && projectView === 'connected'
                  ? t('center.noProjectConnections', { defaultValue: 'No integrations are configured for this project. Explore integrations to add one.' })
                  : t('center.noResults', { defaultValue: 'No integrations found.' })}
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
                    projectView={projectId ? projectView : undefined}
                    searchQuery={searchQuery}
                    category={category}
                    hasBuiltinMatches={showSlack || showGithub || Boolean(projectId && projectView === 'connected' && (!projectConnections || projectConnections.hasError))}
                  />
                </Suspense>
              ) : null
            )}
          </div>
        </div>
      </div>
      <Modal open={Boolean(detailsIntegration)} onCancel={() => setDetailsIntegration(null)} footer={null}
        title={<Space>{detailsIntegration === 'slack' ? <SlackIcon /> : <GithubOutlined />}{detailsIntegration === 'slack' ? slackName : githubName}</Space>} destroyOnHidden>
        {detailsIntegration === 'slack' ? <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {projectConnections && !projectConnections.hasError && <Badge status={projectConnections.slack ? 'success' : 'default'} text={projectConnections.slack ? t('center.configuredForProject', { defaultValue: 'Configured for this project' }) : t('center.notConnectedToProject', { defaultValue: 'Not configured for this project' })} />}
          <Typography.Paragraph>{slackDescription}</Typography.Paragraph>
          <Typography.Text type="secondary">{t('center.slackTeamScope', { defaultValue: 'The Slack workspace connection is shared by the team.' })}</Typography.Text>
          <Button type="primary" onClick={() => { setDetailsIntegration(null); setIsSlackModalOpen(true); }}>{t('center.addSlackChannel', { defaultValue: 'Add project channel' })}</Button>
        </Space> : detailsIntegration === 'github' && <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {projectConnections && !projectConnections.hasError && <Badge status={projectConnections.github ? 'success' : 'default'} text={projectConnections.github ? t('center.configuredForProject', { defaultValue: 'Configured for this project' }) : t('center.notConnectedToProject', { defaultValue: 'Not configured for this project' })} />}
          <Typography.Paragraph>{githubDescription}</Typography.Paragraph>
          <Typography.Text type="secondary">{t('center.githubTeamScope', { defaultValue: 'The GitHub account connection is shared by the team.' })}</Typography.Text>
          {isSoftwareProject ? <Button type="primary" onClick={openGithubSettings}>{t('center.manageRepositories', { defaultValue: 'Manage project repositories' })}</Button>
            : <Typography.Text type="secondary">{t('center.githubSoftwareOnly', { defaultValue: 'Available for software projects' })}</Typography.Text>}
        </Space>}
      </Modal>
      {projectId && <SlackProjectQuickAddModal open={isSlackModalOpen} projectId={projectId} projectName={projectName}
        onClose={() => setIsSlackModalOpen(false)} onSuccess={() => setStatusAttempt(attempt => attempt + 1)} />}
    </div>
  );
}

export default IntegrationsSettings;
