import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  Popconfirm,
  Select,
  Skeleton,
  Tag,
  Tooltip,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import { DeleteOutlined, GithubOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons';
import {
  githubApiService,
  GithubTransitionEvent,
  IGithubProjectRepositories,
} from '@/api/github/github.api.service';
import { GithubStatusAutomation } from './GithubStatusAutomation';
import logger from '@/utils/errorLogger';

interface GithubProjectRepositoriesProps {
  projectId: string;
  /** Project key shown in the "how it works" hint, e.g. "WEB". */
  projectKey?: string | null;
  /** False for members without project settings permission (read-only). */
  canManage: boolean;
  onNavigate?: () => void;
}

/** Repository links for a software project (Project Settings > Integrations). */
export const GithubProjectRepositories = ({
  projectId,
  projectKey,
  canManage,
  onNavigate,
}: GithubProjectRepositoriesProps) => {
  const { t } = useTranslation('github-integration');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();

  const [data, setData] = useState<IGithubProjectRepositories | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const response = await githubApiService.getProjectRepositories(projectId);
      setData(response.body);
    } catch (error) {
      logger.error('Failed to load GitHub repositories', error);
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const repositoryOptions = useMemo(
    () =>
      (data?.available || []).map(repo => ({
        value: repo.id,
        label: (
          <Flex align="center" gap={6}>
            {repo.is_private && <LockOutlined aria-hidden />}
            <span>{repo.full_name}</span>
          </Flex>
        ),
        searchText: repo.full_name,
      })),
    [data?.available]
  );

  const handleLink = async () => {
    if (!selectedRepositoryId) return;
    setIsLinking(true);
    try {
      await githubApiService.linkRepository(projectId, selectedRepositoryId);
      setSelectedRepositoryId(null);
      await load();
      messageApi.success(t('project.linked', { defaultValue: 'Repository linked.' }));
    } catch (error) {
      logger.error('Failed to link GitHub repository', error);
      messageApi.error(t('project.linkFailed', { defaultValue: 'Could not link repository.' }));
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (linkId: string) => {
    try {
      await githubApiService.unlinkRepository(projectId, linkId);
      await load();
      messageApi.success(t('project.unlinked', { defaultValue: 'Repository unlinked.' }));
    } catch (error) {
      logger.error('Failed to unlink GitHub repository', error);
      messageApi.error(t('project.unlinkFailed', { defaultValue: 'Could not unlink repository.' }));
    }
  };

  const handleBaseBranchChange = async (linkId: string, value: string) => {
    const branch = value.trim();
    try {
      await githubApiService.updateRepositoryLink(projectId, linkId, {
        default_base_branch: branch || null,
      });
      await load();
    } catch (error) {
      logger.error('Failed to update base branch', error);
      messageApi.error(
        t('project.updateFailed', { defaultValue: 'Could not update the base branch.' })
      );
    }
  };

  const handleStatusMapChange = async (
    linkId: string,
    event: GithubTransitionEvent,
    statusId: string | null
  ) => {
    const link = data?.linked.find(item => item.id === linkId);
    if (!link) return;
    const nextMap = { ...(link.settings?.status_map || {}), [event]: statusId };

    // Optimistic update; roll back if the server rejects it.
    const previous = data;
    setData(current =>
      current
        ? {
            ...current,
            linked: current.linked.map(item =>
              item.id === linkId
                ? { ...item, settings: { ...(item.settings || {}), status_map: nextMap } }
                : item
            ),
          }
        : current
    );
    try {
      await githubApiService.updateRepositoryLink(projectId, linkId, { status_map: nextMap });
    } catch (error) {
      logger.error('Failed to update GitHub status automation', error);
      setData(previous);
      messageApi.error(
        t('project.automation.saveFailed', { defaultValue: 'Could not update automation.' })
      );
    }
  };

  const goToIntegrations = () => {
    onNavigate?.();
    navigate('/worklenz/settings/integrations');
  };

  const header = (
    <Flex align="center" gap={10}>
      <GithubOutlined style={{ fontSize: 20 }} aria-hidden />
      <div>
        <Typography.Text strong>{t('title', { defaultValue: 'GitHub' })}</Typography.Text>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('project.subtitle', {
              defaultValue: 'See branches, pull requests and commits on this project’s issues.',
            })}
          </Typography.Text>
        </div>
      </div>
    </Flex>
  );

  const renderBody = () => {
    if (isLoading) return <Skeleton active paragraph={{ rows: 2 }} />;

    if (loadFailed || !data) {
      return (
        <Alert
          type="error"
          showIcon
          message={t('errors.loadFailed', { defaultValue: 'Could not load GitHub status.' })}
          action={
            <Button size="small" onClick={load}>
              {t('actions.retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      );
    }

    if (!data.configured) {
      return (
        <Alert
          type="info"
          showIcon
          message={t('notConfigured.title', { defaultValue: 'Not configured' })}
          description={t('notConfigured.description', {
            defaultValue:
              'The GitHub App has not been set up for this Worklenz installation. Ask your administrator to configure it.',
          })}
        />
      );
    }

    if (!data.connected) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('project.notConnected', {
            defaultValue: 'Connect your GitHub account in team settings before linking repositories.',
          })}
        >
          <Button type="primary" onClick={goToIntegrations}>
            {t('project.openIntegrations', { defaultValue: 'Go to Integrations' })}
          </Button>
        </Empty>
      );
    }

    return (
      <Flex vertical gap={16}>
        {canManage && (
          <Flex gap={8} wrap>
            <Select
              showSearch
              allowClear
              style={{ flex: 1, minWidth: 220 }}
              placeholder={t('project.selectPlaceholder', {
                defaultValue: 'Select a repository to link',
              })}
              aria-label={t('project.selectPlaceholder', {
                defaultValue: 'Select a repository to link',
              })}
              value={selectedRepositoryId}
              onChange={value => setSelectedRepositoryId(value ?? null)}
              options={repositoryOptions}
              optionFilterProp="searchText"
              notFoundContent={t('project.noRepositories', {
                defaultValue: 'No more repositories available',
              })}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!selectedRepositoryId}
              loading={isLinking}
              onClick={handleLink}
            >
              {t('project.link', { defaultValue: 'Link' })}
            </Button>
          </Flex>
        )}

        {data.linked.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              canManage
                ? t('project.emptyManage', {
                    defaultValue: 'No repositories linked yet. Pick one above to get started.',
                  })
                : t('project.empty', { defaultValue: 'No repositories linked to this project.' })
            }
          />
        ) : (
          <Flex vertical gap={8}>
            {data.linked.map(link => (
              <div
                key={link.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: token.borderRadiusLG,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  background: token.colorBgContainer,
                }}
              >
              <Flex align="center" justify="space-between" gap={12} wrap>
                <Flex vertical style={{ minWidth: 0, flex: 1 }}>
                  <Flex align="center" gap={6} wrap>
                    <Typography.Text strong ellipsis>
                      {link.full_name}
                    </Typography.Text>
                    {link.is_private && (
                      <Tag icon={<LockOutlined />} style={{ margin: 0 }}>
                        {t('project.private', { defaultValue: 'Private' })}
                      </Tag>
                    )}
                    {!link.is_available && (
                      <Tag color="warning" style={{ margin: 0 }}>
                        {t('project.unavailable', { defaultValue: 'No longer accessible' })}
                      </Tag>
                    )}
                  </Flex>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {t('project.baseBranch', { defaultValue: 'Base branch' })}:{' '}
                    {canManage ? (
                      <Typography.Text
                        style={{ fontSize: 12 }}
                        code
                        editable={{
                          onChange: value => void handleBaseBranchChange(link.id, value),
                          tooltip: t('project.editBaseBranch', {
                            defaultValue: 'Edit base branch',
                          }),
                        }}
                      >
                        {link.default_base_branch}
                      </Typography.Text>
                    ) : (
                      <Typography.Text style={{ fontSize: 12 }} code>
                        {link.default_base_branch}
                      </Typography.Text>
                    )}
                  </Typography.Text>
                </Flex>
                {canManage && (
                  <Popconfirm
                    title={t('project.unlinkTitle', { defaultValue: 'Unlink this repository?' })}
                    description={t('project.unlinkDescription', {
                      defaultValue:
                        'Existing links on issues stay, but new activity will no longer be tracked.',
                    })}
                    okText={t('project.unlink', { defaultValue: 'Unlink' })}
                    cancelText={t('actions.cancel', { defaultValue: 'Cancel' })}
                    okButtonProps={{ danger: true }}
                    onConfirm={() => handleUnlink(link.id)}
                  >
                    <Tooltip title={t('project.unlink', { defaultValue: 'Unlink' })}>
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label={t('project.unlinkAria', {
                          defaultValue: 'Unlink {{name}}',
                          name: link.full_name,
                        })}
                      />
                    </Tooltip>
                  </Popconfirm>
                )}
              </Flex>
              <GithubStatusAutomation
                statuses={data.statuses}
                value={link.settings?.status_map || {}}
                disabled={!canManage}
                onChange={(event, statusId) => void handleStatusMapChange(link.id, event, statusId)}
              />
              </div>
            ))}
          </Flex>
        )}

        <Alert
          type="info"
          showIcon={false}
          message={t('project.howItWorks', {
            defaultValue:
              'Include an issue key such as {{example}} in a branch name, commit message or pull request title to link it to that issue.',
            example: `${projectKey || 'KEY'}-12`,
          })}
          style={{ fontSize: 13 }}
        />
      </Flex>
    );
  };

  return (
    <>
      {contextHolder}
      <Card title={header} styles={{ body: { paddingTop: 16 } }}>
        {renderBody()}
      </Card>
    </>
  );
};

export default GithubProjectRepositories;
