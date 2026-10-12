import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  CloseOutlined,
  EditOutlined,
  Empty,
  Flex,
  Modal,
  PlusOutlined,
  Popconfirm,
  Progress,
  Result,
  RocketOutlined,
  Table,
  Tooltip,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import type { TableColumnsType } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { projectReleasesApiService } from '@/api/project-releases/project-releases.api.service';
import { upsertRelease } from '@/features/projects/singleProject/releases/releases.slice';
import { setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import { formatStoryPoints } from '@/lib/project/story-points';
import { IProjectRelease, IReleaseWorkItem } from '@/types/project/projectRelease.types';
import { ReleaseConfidenceLabel, ReleaseStatusTag } from './release-badges';
import {
  formatReleaseDate,
  getReleaseConfidence,
  getReleaseProgress,
  isAnnouncedApiError,
} from './release-utils';
import {
  WorkItemAssignee,
  WorkItemEpic,
  WorkItemStatus,
  WorkItemSummary,
} from './release-work-item-parts';

interface ReleaseDetailModalProps {
  open: boolean;
  projectId: string;
  releaseId: string | null;
  canManage: boolean;
  canEditItems: boolean;
  /** Changing this value reloads the linked work (e.g. after items were added). */
  refreshKey: number;
  onClose: () => void;
  onEdit: (release: IProjectRelease) => void;
  onAddWork: (release: IProjectRelease) => void;
}

export const ReleaseDetailModal = ({
  open,
  projectId,
  releaseId,
  canManage,
  canEditItems,
  refreshKey,
  onClose,
  onEdit,
  onAddWork,
}: ReleaseDetailModalProps) => {
  const { t } = useTranslation('project-view');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const release = useAppSelector(state =>
    state.releasesReducer.releases.find(item => item.id === releaseId)
  );
  const [items, setItems] = useState<IReleaseWorkItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [removingTaskId, setRemovingTaskId] = useState<string | null>(null);
  const [isReleasing, setIsReleasing] = useState(false);

  const loadItems = useCallback(async () => {
    if (!releaseId) return;
    setIsLoading(true);
    setHasError(false);
    try {
      const response = await projectReleasesApiService.getItems(projectId, releaseId);
      if (!response.done) throw new Error(response.message);
      setItems(response.body ?? []);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, releaseId]);

  useEffect(() => {
    if (!open) return;
    void loadItems();
  }, [loadItems, open, refreshKey]);

  useEffect(() => {
    if (!open) setItems([]);
  }, [open]);

  const isUnreleased = release?.status === 'unreleased';
  const openItemCount = useMemo(() => items.filter(item => !item.is_done).length, [items]);

  const handleOpenItem = (item: IReleaseWorkItem) => {
    onClose();
    dispatch(setSelectedTaskId(item.id));
    dispatch(setShowTaskDrawer(true));
  };

  const handleRemoveItem = async (item: IReleaseWorkItem) => {
    if (!release) return;
    setRemovingTaskId(item.id);
    try {
      const response = await projectReleasesApiService.removeItem(projectId, release.id, item.id);
      if (!response.done || !response.body) return;
      dispatch(upsertRelease(response.body));
      setItems(current => current.filter(entry => entry.id !== item.id));
      message.success(t('releaseItemRemoved', { defaultValue: 'Work item removed' }));
    } catch (error) {
      if (!isAnnouncedApiError(error)) {
        message.error(t('releaseItemRemoveError', { defaultValue: 'Could not remove the work item' }));
      }
    } finally {
      setRemovingTaskId(null);
    }
  };

  const handleMarkReleased = async () => {
    if (!release) return;
    setIsReleasing(true);
    try {
      const response = await projectReleasesApiService.markReleased(projectId, release.id);
      if (!response.done || !response.body) return;
      dispatch(upsertRelease(response.body));
      message.success(
        t('releaseMarkedReleased', { defaultValue: '{{name}} released', name: release.name })
      );
      onClose();
    } catch (error) {
      if (!isAnnouncedApiError(error)) {
        message.error(t('releaseMarkReleasedError', { defaultValue: 'Could not release this version' }));
      }
    } finally {
      setIsReleasing(false);
    }
  };

  const columns: TableColumnsType<IReleaseWorkItem> = [
    {
      key: 'work',
      title: t('releaseColumnWorkItem', { defaultValue: 'Work item' }),
      render: (_, item) => <WorkItemSummary item={item} onOpen={handleOpenItem} />,
    },
    {
      key: 'epic',
      title: t('releaseColumnEpic', { defaultValue: 'Epic' }),
      width: 150,
      render: (_, item) => <WorkItemEpic item={item} />,
    },
    {
      key: 'status',
      title: t('releaseColumnStatus', { defaultValue: 'Status' }),
      width: 120,
      render: (_, item) => <WorkItemStatus item={item} />,
    },
    {
      key: 'assignee',
      title: t('releaseColumnAssignee', { defaultValue: 'Assignee' }),
      width: 120,
      render: (_, item) => <WorkItemAssignee item={item} />,
    },
    {
      key: 'points',
      title: t('releaseColumnPoints', { defaultValue: 'Points' }),
      width: 64,
      align: 'center',
      render: (_, item) => (
        <strong>{item.story_points === null ? '–' : formatStoryPoints(item.story_points)}</strong>
      ),
    },
    ...(isUnreleased && canEditItems
      ? [
          {
            key: 'actions',
            width: 44,
            render: (_: unknown, item: IReleaseWorkItem) => (
              <Tooltip title={t('releaseRemoveItem', { defaultValue: 'Remove from release' })}>
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  loading={removingTaskId === item.id}
                  onClick={() => handleRemoveItem(item)}
                  aria-label={t('releaseRemoveItemAria', {
                    defaultValue: 'Remove {{key}} from {{name}}',
                    key: item.task_key,
                    name: release?.name ?? '',
                  })}
                />
              </Tooltip>
            ),
          },
        ]
      : []),
  ];

  if (!release) return null;

  const progress = getReleaseProgress(release);
  const targetDate = formatReleaseDate(release.target_date);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={800}
      destroyOnHidden
      title={
        <Flex align="center" gap={8} className="pr-6">
          <ReleaseStatusTag status={release.status} />
          <span className="truncate">{release.name}</span>
          {canManage && (
            <Tooltip title={t('editReleaseTitle', { defaultValue: 'Edit release' })}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => onEdit(release)}
                aria-label={t('editReleaseTitle', { defaultValue: 'Edit release' })}
              />
            </Tooltip>
          )}
        </Flex>
      }
      footer={
        <Flex justify="end" gap={8}>
          <Button onClick={onClose}>{t('close', { defaultValue: 'Close' })}</Button>
          {isUnreleased && canManage && (
            <Popconfirm
              title={t('releaseMarkReleasedConfirmTitle', {
                defaultValue: 'Release {{name}}?',
                name: release.name,
              })}
              description={
                openItemCount > 0
                  ? t('releaseMarkReleasedOpenWarning', {
                      defaultValue:
                        '{{count}} work item(s) are not done. Released versions become read-only.',
                      count: openItemCount,
                    })
                  : t('releaseMarkReleasedConfirm', {
                      defaultValue: 'Released versions become read-only.',
                    })
              }
              okText={t('releaseMarkReleased', { defaultValue: 'Mark released' })}
              cancelText={t('cancel', { defaultValue: 'Cancel' })}
              onConfirm={handleMarkReleased}
            >
              <Button icon={<RocketOutlined />} loading={isReleasing}>
                {t('releaseMarkReleased', { defaultValue: 'Mark released' })}
              </Button>
            </Popconfirm>
          )}
        </Flex>
      }
    >
      {release.description && (
        <Typography.Paragraph className="mb-3">{release.description}</Typography.Paragraph>
      )}

      <Flex align="center" gap={12} wrap="wrap" className="mb-4 text-[13px]">
        <strong>
          {t('releaseWorkItemCount', {
            defaultValue: '{{count}} work items',
            count: release.issue_count,
          })}
        </strong>
        <Progress
          percent={progress}
          showInfo={false}
          size="small"
          style={{ width: 150, margin: 0 }}
          aria-label={t('releaseProgressAria', {
            defaultValue: '{{percent}}% complete',
            percent: progress,
          })}
        />
        <span>
          {t('releaseCompletedSummary', {
            defaultValue: '{{done}} completed · {{percent}}%',
            done: release.done_issue_count,
            percent: progress,
          })}
        </span>
        <Typography.Text type="secondary">
          {targetDate
            ? t('releaseTargetOn', { defaultValue: 'Target {{date}}', date: targetDate })
            : t('releaseNoTarget', { defaultValue: 'No target date' })}
        </Typography.Text>
        <ReleaseConfidenceLabel confidence={getReleaseConfidence(release)} />
        {release.open_critical_bug_count > 0 && (
          <span className="text-xs font-semibold" style={{ color: token.colorError }}>
            {t('releaseCriticalBugCount', {
              defaultValue: '{{count}} critical bug(s)',
              count: release.open_critical_bug_count,
            })}
          </span>
        )}
      </Flex>

      <Flex align="center" className="mb-2">
        <strong>{t('releaseLinkedWork', { defaultValue: 'Linked work' })}</strong>
        {isUnreleased && canEditItems && (
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            className="ml-auto"
            onClick={() => onAddWork(release)}
          >
            {t('releaseAddWorkItems', { defaultValue: 'Add work items' })}
          </Button>
        )}
      </Flex>

      {hasError ? (
        <Result
          status="warning"
          title={t('releaseItemsLoadError', { defaultValue: 'Could not load linked work' })}
          extra={
            <Button onClick={() => void loadItems()}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      ) : (
        <Table<IReleaseWorkItem>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={items}
          loading={isLoading}
          pagination={false}
          scroll={{ x: 680, y: 380 }}
          bordered={false}
          style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Flex vertical gap={2}>
                    <strong>{t('releaseNoWorkTitle', { defaultValue: 'No work items yet' })}</strong>
                    <Typography.Text type="secondary" className="text-xs">
                      {isUnreleased
                        ? t('releaseNoWorkHint', {
                            defaultValue:
                              "Add individual work or select an Epic's eligible child items.",
                          })
                        : t('releaseNoWorkReleasedHint', {
                            defaultValue: 'No work was linked to this release.',
                          })}
                    </Typography.Text>
                  </Flex>
                }
              />
            ),
          }}
        />
      )}
    </Modal>
  );
};
