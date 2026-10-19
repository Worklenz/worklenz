import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Avatar,
  Button,
  Empty,
  Flex,
  Popconfirm,
  Skeleton,
  Tag,
  Tooltip,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import {
  BranchesOutlined,
  CodeOutlined,
  DeleteOutlined,
  GithubOutlined,
  PullRequestOutlined,
} from '@ant-design/icons';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  githubApiService,
  IGithubPullRequest,
  IGithubTaskDevelopment,
} from '@/api/github/github.api.service';
import logger from '@/utils/errorLogger';
import { CreateBranchModal } from '@/components/github/CreateBranchModal';

dayjs.extend(relativeTime);

interface TaskDrawerDevelopmentProps {
  taskId: string;
  taskKey?: string | null;
  /** Bump to re-fetch (e.g. when a GitHub webhook lands for this task). */
  refreshToken?: number;
  canCreateBranch?: boolean;
  canRemoveLinks?: boolean;
}

const MAX_COMMITS_SHOWN = 5;

/** GitHub activity (branches, pull requests, commits) linked to a software issue. */
export const TaskDrawerDevelopment = ({
  taskId,
  taskKey,
  refreshToken = 0,
  canCreateBranch = false,
  canRemoveLinks = false,
}: TaskDrawerDevelopmentProps) => {
  const { t } = useTranslation('github-integration');
  const { token } = theme.useToken();
  const [data, setData] = useState<IGithubTaskDevelopment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showAllCommits, setShowAllCommits] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!taskId) return;
      if (!silent) setIsLoading(true);
      setLoadFailed(false);
      try {
        const response = await githubApiService.getTaskDevelopment(taskId);
        setData(response.body);
      } catch (error) {
        logger.error('Failed to load GitHub development info', error);
        setLoadFailed(true);
      } finally {
        setIsLoading(false);
      }
    },
    [taskId]
  );

  useEffect(() => {
    setShowAllCommits(false);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // Silent refresh keeps the list on screen while new activity is fetched.
  useEffect(() => {
    if (refreshToken > 0) void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  const removeLink = async (linkId: string) => {
    try {
      await githubApiService.removeTaskLink(taskId, linkId);
      message.success(t('development.remove.success', { defaultValue: 'Link removed.' }));
      await load(true);
    } catch (error) {
      logger.error('Failed to remove GitHub link', error);
      message.error(t('development.remove.failed', { defaultValue: 'Could not remove the link.' }));
    }
  };

  const renderRemoveButton = (
    linkId: string,
    kind: 'branch' | 'pullRequest' | 'commit',
    label: string
  ) => {
    if (!canRemoveLinks) return null;
    return (
      <Popconfirm
        title={t(`development.remove.${kind}.title`, { defaultValue: 'Remove this link?' })}
        description={t(`development.remove.${kind}.description`, {
          defaultValue:
            '{{name}} will no longer be shown on this task. Nothing is changed on GitHub.',
          name: label,
        })}
        okText={t('development.remove.confirm', { defaultValue: 'Remove' })}
        cancelText={t('development.remove.cancel', { defaultValue: 'Cancel' })}
        okButtonProps={{ danger: true }}
        onConfirm={() => removeLink(linkId)}
      >
        <Tooltip title={t('development.remove.button', { defaultValue: 'Remove link' })}>
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            aria-label={t('development.remove.button', { defaultValue: 'Remove link' })}
          />
        </Tooltip>
      </Popconfirm>
    );
  };

  const renderPullRequestStatus = (pr: IGithubPullRequest) => {
    if (pr.merged) {
      return <Tag color="purple">{t('development.pr.merged', { defaultValue: 'Merged' })}</Tag>;
    }
    if (pr.state === 'closed') {
      return <Tag>{t('development.pr.closed', { defaultValue: 'Closed' })}</Tag>;
    }
    if (pr.is_draft) {
      return <Tag>{t('development.pr.draft', { defaultValue: 'Draft' })}</Tag>;
    }
    if (pr.review_state === 'approved') {
      return (
        <Tag color="success">{t('development.pr.approved', { defaultValue: 'Approved' })}</Tag>
      );
    }
    if (pr.review_state === 'changes_requested') {
      return (
        <Tag color="warning">
          {t('development.pr.changesRequested', { defaultValue: 'Changes requested' })}
        </Tag>
      );
    }
    return <Tag color="processing">{t('development.pr.open', { defaultValue: 'Open' })}</Tag>;
  };

  if (isLoading) return <Skeleton active paragraph={{ rows: 2 }} title={false} />;

  if (loadFailed || !data) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('development.loadFailed', { defaultValue: 'Could not load GitHub activity.' })}
        action={
          <Button size="small" onClick={() => void load()}>
            {t('actions.retry', { defaultValue: 'Retry' })}
          </Button>
        }
      />
    );
  }

  const isEmpty =
    data.pull_requests.length === 0 && data.branches.length === 0 && data.commits.length === 0;

  const canShowCreateBranch = canCreateBranch && data.repositories.length > 0;
  const createBranchControl = canShowCreateBranch ? (
    <Button icon={<PlusOutlined />} size="small" onClick={() => setIsBranchModalOpen(true)}>
      {t('development.createBranch.button', { defaultValue: 'Create branch' })}
    </Button>
  ) : null;
  // Rendered at a fixed position in both the empty and populated layouts. Otherwise creating the
  // first branch switches layouts, remounts the modal and drops its "Branch created" state.
  const createBranchModal = canShowCreateBranch ? (
    <CreateBranchModal
      open={isBranchModalOpen}
      taskId={taskId}
      taskKey={data.task_key || taskKey || ''}
      taskName={data.task_name}
      repositories={data.repositories}
      onClose={() => setIsBranchModalOpen(false)}
      onCreated={() => void load(true)}
    />
  ) : null;

  if (isEmpty) {
    return (
      <>
        <Flex vertical gap={12} align="center">
          <Empty
            image={<GithubOutlined style={{ fontSize: 32, color: token.colorTextTertiary }} />}
            styles={{ image: { height: 40 } }}
            description={
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {data.has_linked_repositories
                  ? t('development.empty', {
                      defaultValue:
                        'No GitHub activity yet. Include {{key}} in a branch name, commit or pull request title to link it here.',
                      key: taskKey || 'the issue key',
                    })
                  : t('development.noRepositories', {
                      defaultValue:
                        'No repository is linked to this project. Link one in Project Settings > Integrations.',
                    })}
              </Typography.Text>
            }
          />
          {createBranchControl}
        </Flex>
        {createBranchModal}
      </>
    );
  }

  const visibleCommits = showAllCommits ? data.commits : data.commits.slice(0, MAX_COMMITS_SHOWN);
  const groupTitleStyle = { fontSize: 12, color: token.colorTextSecondary } as const;
  const rowStyle = {
    padding: '8px 10px',
    borderRadius: token.borderRadius,
    border: `1px solid ${token.colorBorderSecondary}`,
  } as const;

  return (
    <>
      <Flex vertical gap={16}>
        {createBranchControl && <Flex justify="flex-end">{createBranchControl}</Flex>}
        {data.pull_requests.length > 0 && (
          <Flex vertical gap={6}>
            <Typography.Text strong style={groupTitleStyle}>
              {t('development.pullRequests', { defaultValue: 'Pull requests' })}
            </Typography.Text>
            {data.pull_requests.map(pr => (
              <Flex key={pr.id} align="center" gap={10} style={rowStyle}>
                <PullRequestOutlined
                  aria-hidden
                  style={{ color: pr.merged ? token.purple : token.colorTextSecondary }}
                />
                <Flex vertical style={{ minWidth: 0, flex: 1 }}>
                  <Typography.Link
                    href={pr.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    ellipsis
                  >
                    #{pr.number} {pr.title}
                  </Typography.Link>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                    {pr.repository}
                    {pr.head_branch ? ` · ${pr.head_branch}` : ''}
                  </Typography.Text>
                </Flex>
                {renderPullRequestStatus(pr)}
                {pr.author_login && (
                  <Tooltip title={pr.author_login}>
                    <Avatar size={22} src={pr.author_avatar_url || undefined}>
                      {pr.author_login.charAt(0).toUpperCase()}
                    </Avatar>
                  </Tooltip>
                )}
                {renderRemoveButton(pr.link_id, 'pullRequest', `#${pr.number} ${pr.title}`)}
              </Flex>
            ))}
          </Flex>
        )}

        {data.branches.length > 0 && (
          <Flex vertical gap={6}>
            <Typography.Text strong style={groupTitleStyle}>
              {t('development.branches', { defaultValue: 'Branches' })}
            </Typography.Text>
            {data.branches.map(branch => (
              <Flex key={branch.id} align="center" gap={10} style={rowStyle}>
                <BranchesOutlined aria-hidden style={{ color: token.colorTextSecondary }} />
                <Flex vertical style={{ minWidth: 0, flex: 1 }}>
                  <Typography.Link
                    href={branch.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    ellipsis
                  >
                    {branch.name}
                  </Typography.Link>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                    {branch.repository}
                  </Typography.Text>
                </Flex>
                {branch.is_deleted && (
                  <Tag>{t('development.branchDeleted', { defaultValue: 'Deleted' })}</Tag>
                )}
                {renderRemoveButton(branch.link_id, 'branch', branch.name)}
              </Flex>
            ))}
          </Flex>
        )}

        {data.commits.length > 0 && (
          <Flex vertical gap={6}>
            <Typography.Text strong style={groupTitleStyle}>
              {t('development.commits', { defaultValue: 'Commits' })}
            </Typography.Text>
            {visibleCommits.map(commit => {
              const subject = commit.message.split('\n')[0];
              return (
                <Flex key={commit.id} align="center" gap={10} style={rowStyle}>
                  <CodeOutlined aria-hidden style={{ color: token.colorTextSecondary }} />
                  <Flex vertical style={{ minWidth: 0, flex: 1 }}>
                    <Typography.Text ellipsis>{subject}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                      {commit.author_name || commit.author_login || ''}
                      {commit.committed_at ? ` · ${dayjs(commit.committed_at).fromNow()}` : ''}
                    </Typography.Text>
                  </Flex>
                  {commit.html_url ? (
                    <Typography.Link
                      href={commit.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      code
                      style={{ fontSize: 12 }}
                    >
                      {commit.sha.slice(0, 7)}
                    </Typography.Link>
                  ) : (
                    <Typography.Text code style={{ fontSize: 12 }}>
                      {commit.sha.slice(0, 7)}
                    </Typography.Text>
                  )}
                  {renderRemoveButton(commit.link_id, 'commit', commit.sha.slice(0, 7))}
                </Flex>
              );
            })}
            {data.commits.length > MAX_COMMITS_SHOWN && (
              <Button type="link" size="small" onClick={() => setShowAllCommits(prev => !prev)}>
                {showAllCommits
                  ? t('development.showFewer', { defaultValue: 'Show fewer' })
                  : t('development.showAll', {
                      defaultValue: 'Show all {{count}} commits',
                      count: data.commits.length,
                    })}
              </Button>
            )}
          </Flex>
        )}
      </Flex>
      {createBranchModal}
    </>
  );
};

export default TaskDrawerDevelopment;
