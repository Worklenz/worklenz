import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Drawer,
  EditOutlined,
  Empty,
  Flex,
  InboxOutlined,
  PlusOutlined,
  Progress,
  ReloadOutlined,
  SearchOutlined,
  Skeleton,
  Tooltip,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { projectEpicsApiService } from '@/api/project-epics/project-epics.api.service';
import {
  fetchProjectEpics,
  setEpicFilter,
  upsertEpic,
} from '@/features/projects/singleProject/epics/epics.slice';
import { IProjectEpic } from '@/types/project/projectEpic.types';
import { formatStoryPoints } from '@/lib/project/story-points';
import { EpicFormModal, EpicTypeBadge } from './epic-form-modal';

interface EpicsDrawerProps {
  open: boolean;
  projectId: string;
  canManage: boolean;
  onClose: () => void;
  onFilterEpic: (epicId: string | null) => void;
}

export const EpicsDrawer = ({
  open,
  projectId,
  canManage,
  onClose,
  onFilterEpic,
}: EpicsDrawerProps) => {
  const { t } = useTranslation('project-view');
  const dispatch = useAppDispatch();
  const { epics, isLoading, hasError, filterEpicId } = useAppSelector(state => state.epicsReducer);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEpic, setEditingEpic] = useState<IProjectEpic | null>(null);
  const [archivingEpicId, setArchivingEpicId] = useState<string | null>(null);

  const activeEpics = epics.filter(epic => !epic.is_archived);
  const archivedEpics = epics.filter(epic => epic.is_archived);

  const handleOpenCreate = () => {
    setEditingEpic(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (epic: IProjectEpic) => {
    setEditingEpic(epic);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingEpic(null);
  };

  const handleRetry = () => {
    void dispatch(fetchProjectEpics(projectId));
  };

  const handleToggleArchive = async (epic: IProjectEpic) => {
    const nextArchived = !epic.is_archived;
    setArchivingEpicId(epic.id);
    try {
      const response = await projectEpicsApiService.update(projectId, epic.id, {
        name: epic.name,
        description: epic.description,
        color_code: epic.color_code,
        owner_id: epic.owner_id,
        is_archived: nextArchived,
      });
      if (!response.done || !response.body) throw new Error(response.message);

      dispatch(upsertEpic(response.body));
      if (nextArchived && filterEpicId === epic.id) {
        dispatch(setEpicFilter(null));
        onFilterEpic(null);
      }
      message.success(
        nextArchived
          ? t('epicArchived', { defaultValue: 'Epic archived' })
          : t('epicRestored', { defaultValue: 'Epic restored' })
      );
    } catch {
      message.error(t('epicUpdateError', { defaultValue: 'Could not update the Epic' }));
    } finally {
      setArchivingEpicId(null);
    }
  };

  const renderBody = () => {
    if (isLoading && epics.length === 0) {
      return <Skeleton active paragraph={{ rows: 4 }} />;
    }

    if (hasError && epics.length === 0) {
      return (
        <Empty description={t('epicsLoadError', { defaultValue: 'Could not load Epics.' })}>
          <Button icon={<ReloadOutlined />} onClick={handleRetry}>
            {t('retry', { defaultValue: 'Retry' })}
          </Button>
        </Empty>
      );
    }

    return (
      <>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          {t('epicsDescription', {
            defaultValue: 'Group related stories, tasks, and bugs into larger delivery outcomes.',
          })}
        </Typography.Paragraph>

        {activeEpics.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Flex vertical gap={2}>
                <Typography.Text strong>
                  {t('epicsEmptyTitle', { defaultValue: 'No active Epics' })}
                </Typography.Text>
                <Typography.Text type="secondary">
                  {t('epicsEmptyHint', {
                    defaultValue: 'Create an Epic to organize related work.',
                  })}
                </Typography.Text>
              </Flex>
            }
          />
        ) : (
          activeEpics.map(epic => (
            <EpicRow
              key={epic.id}
              epic={epic}
              canManage={canManage}
              isArchiving={archivingEpicId === epic.id}
              onFilter={onFilterEpic}
              onEdit={handleOpenEdit}
              onToggleArchive={handleToggleArchive}
            />
          ))
        )}

        {archivedEpics.length > 0 && (
          <div className="mt-6">
            <Typography.Title level={5} style={{ marginBottom: 0 }}>
              {t('epicsArchivedSection', { defaultValue: 'Archived' })}
            </Typography.Title>
            {archivedEpics.map(epic => (
              <EpicRow
                key={epic.id}
                epic={epic}
                canManage={canManage}
                isArchiving={archivingEpicId === epic.id}
                onFilter={onFilterEpic}
                onEdit={handleOpenEdit}
                onToggleArchive={handleToggleArchive}
              />
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width="min(460px, 100vw)"
        title={
          <Flex align="center" gap={8}>
            <EpicTypeBadge />
            <span>{t('epicsTitle', { defaultValue: 'Epics' })}</span>
            <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              {t('epicsActiveCount', {
                defaultValue: '{{count}} active',
                count: activeEpics.length,
              })}
            </Typography.Text>
          </Flex>
        }
        extra={
          canManage && (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleOpenCreate}>
              {t('createEpicTitle', { defaultValue: 'Create Epic' })}
            </Button>
          )
        }
      >
        {renderBody()}
      </Drawer>

      <EpicFormModal
        open={isFormOpen}
        projectId={projectId}
        epic={editingEpic}
        onClose={handleCloseForm}
      />
    </>
  );
};

interface EpicRowProps {
  epic: IProjectEpic;
  canManage: boolean;
  isArchiving: boolean;
  onFilter: (epicId: string) => void;
  onEdit: (epic: IProjectEpic) => void;
  onToggleArchive: (epic: IProjectEpic) => void;
}

const EpicRow = ({
  epic,
  canManage,
  isArchiving,
  onFilter,
  onEdit,
  onToggleArchive,
}: EpicRowProps) => {
  const { t } = useTranslation('project-view');
  const { token } = theme.useToken();
  const isPointBased = epic.total_points > 0;
  const progressDone = isPointBased ? epic.done_points : epic.done_issue_count;
  const progressTotal = isPointBased ? epic.total_points : epic.issue_count;
  const percent = progressTotal ? Math.round((progressDone / progressTotal) * 100) : 0;
  const archiveLabel = epic.is_archived
    ? t('restoreEpic', { defaultValue: 'Restore Epic' })
    : t('archiveEpic', { defaultValue: 'Archive Epic' });

  return (
    <div className="py-3.5" style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
      <Flex align="center" gap={8}>
        <span
          aria-hidden="true"
          className="inline-block w-2.5 h-2.5 rounded-sm flex-none"
          style={{ backgroundColor: epic.color_code }}
        />
        {epic.is_archived ? (
          <Typography.Text strong type="secondary" ellipsis className="min-w-0">
            {epic.name}
          </Typography.Text>
        ) : (
          <Typography.Link
            strong
            ellipsis
            className="min-w-0"
            onClick={() => onFilter(epic.id)}
            style={{ color: token.colorText }}
          >
            {epic.name}
          </Typography.Link>
        )}
        <Flex gap={2} className="ml-auto flex-none">
          {!epic.is_archived && (
            <Tooltip title={t('filterBacklogByEpic', { defaultValue: 'Filter Backlog' })}>
              <Button
                type="text"
                size="small"
                icon={<SearchOutlined />}
                aria-label={t('filterBacklogByEpic', { defaultValue: 'Filter Backlog' })}
                onClick={() => onFilter(epic.id)}
              />
            </Tooltip>
          )}
          {canManage && (
            <Tooltip title={t('editEpicTitle', { defaultValue: 'Edit Epic' })}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                aria-label={t('editEpicTitle', { defaultValue: 'Edit Epic' })}
                onClick={() => onEdit(epic)}
              />
            </Tooltip>
          )}
          {canManage && (
            <Tooltip title={archiveLabel}>
              <Button
                type="text"
                size="small"
                loading={isArchiving}
                icon={epic.is_archived ? <ReloadOutlined /> : <InboxOutlined />}
                aria-label={archiveLabel}
                onClick={() => onToggleArchive(epic)}
              />
            </Tooltip>
          )}
        </Flex>
      </Flex>

      <Flex align="center" gap={12} wrap="wrap" className="mt-2 ml-[18px]">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('epicWorkItems', {
            defaultValue: '{{count}} work items',
            count: epic.issue_count,
          })}
        </Typography.Text>
        <Progress
          percent={percent}
          size="small"
          showInfo={false}
          style={{ flex: 1, maxWidth: 150, margin: 0 }}
          aria-label={t('epicPercentComplete', {
            defaultValue: '{{percent}}% complete',
            percent,
          })}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {isPointBased
            ? t('epicPointsDone', {
                defaultValue: '{{done}}/{{total}} pts',
                done: formatStoryPoints(epic.done_points),
                total: formatStoryPoints(epic.total_points),
              })
            : t('epicDoneCount', {
                defaultValue: '{{done}}/{{total}} done',
                done: epic.done_issue_count,
                total: epic.issue_count,
              })}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {epic.owner_name || t('epicNoOwner', { defaultValue: 'No owner' })}
        </Typography.Text>
      </Flex>

      {epic.description && (
        <Typography.Paragraph
          type="secondary"
          ellipsis={{ rows: 2, tooltip: epic.description }}
          className="mt-1.5 ml-[18px]"
          style={{ fontSize: 12, marginBottom: 0 }}
        >
          {epic.description}
        </Typography.Paragraph>
      )}
    </div>
  );
};
