import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, LockOutlined, MoreOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Alert, Button, Dropdown, Empty, Flex, Select, Table, Typography, message, theme } from '@/shared/antd-imports';
import type { MenuProps } from '@/shared/antd-imports';
import PillToggle from '@/pages/home/PillToggle';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import {
  useDeleteMilestoneMutation,
  useGetProjectMilestonesQuery,
  useGetProjectOverviewQuery,
  useSaveProjectOverviewMutation,
  useUpdateMilestoneMutation,
} from '@/api/client-portal/portal-projects-api';
import {
  ConfirmEffectModal,
  MilestoneStatusTag,
  VisibilitySwitch,
  VisibilityTag,
  formatPortalDate,
  useVisibilityToast,
} from '@/components/client-portal/v2';
import type { Milestone, MilestoneSource, MilestoneStatus, PortalProject, PortalVisibility } from '@/types/client-portal/v2';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { CompleteMilestoneModal, MilestoneModal } from './MilestoneModals';
import { PortalLoader } from '@/components/client-portal/v2';
import { RichTextView } from '../../shared/rich-text/RichTextView';

interface MilestonesTabProps {
  project: PortalProject;
}

const STATUS_OPTIONS: { value: MilestoneStatus; key: string; defaultValue: string }[] = [
  { value: 'upcoming', key: 'milestoneUpcoming', defaultValue: 'Upcoming' },
  { value: 'in_progress', key: 'milestoneInProgress', defaultValue: 'In Progress' },
  { value: 'completed', key: 'milestoneCompleted', defaultValue: 'Completed' },
  { value: 'delayed', key: 'milestoneDelayed', defaultValue: 'Delayed' },
];

/** Business-level milestones for the client. Each is Internal Only until staff share it. */
export const MilestonesTab = ({ project }: MilestonesTabProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-projects');
  const { t: tShared } = useTranslation('client-portal-v2');
  const { token } = theme.useToken();
  const showVisibilityToast = useVisibilityToast();

  const query = useGetProjectMilestonesQuery(project.id);
  const overviewQuery = useGetProjectOverviewQuery(project.id);
  const [saveOverview, { isLoading: isSwitching }] = useSaveProjectOverviewMutation();
  const source: MilestoneSource = overviewQuery.data?.body?.milestone_source ?? 'manual';
  const isPhases = source === 'worklenz';
  const [updateMilestone, { isLoading: isUpdating }] = useUpdateMilestoneMutation();
  const [deleteMilestone, { isLoading: isDeleting }] = useDeleteMilestoneMutation();

  // `undefined` = closed, `null` = adding a new milestone, a milestone = editing it.
  const [editing, setEditing] = useState<Milestone | null | undefined>(undefined);
  const [completing, setCompleting] = useState<Milestone | null>(null);
  const [deleting, setDeleting] = useState<Milestone | null>(null);

  const milestones = [...(query.data?.body ?? [])].sort((a, b) => a.target_date.localeCompare(b.target_date));
  const internalCount = milestones.filter(milestone => milestone.visibility === 'internal').length;

  const changeSource = async (next: MilestoneSource) => {
    try {
      await saveOverview({ projectId: project.id, body: { milestone_source: next } }).unwrap();
    } catch (error) {
      message.error(
        getPortalErrorMessage(error, t('milestones.sourceFailed', { defaultValue: 'The milestone source could not be changed.' }))
      );
    }
  };

  const changeStatus = async (milestone: Milestone, status: MilestoneStatus) => {
    if (status === 'completed') {
      setCompleting(milestone);
      return;
    }
    try {
      await updateMilestone({ projectId: project.id, milestoneId: milestone.id, body: { status } }).unwrap();
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('milestones.statusFailed', { defaultValue: 'The status could not be changed.' })));
    }
  };

  const changeVisibility = async (milestone: Milestone, visibility: PortalVisibility) => {
    try {
      await updateMilestone({ projectId: project.id, milestoneId: milestone.id, body: { visibility } }).unwrap();
      showVisibilityToast('milestone', milestone.name, visibility);
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('milestones.visibilityFailed', { defaultValue: 'The visibility could not be changed.' })));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMilestone({ projectId: project.id, milestoneId: deleting.id }).unwrap();
      message.success(t('milestones.deleted', { name: deleting.name, defaultValue: '“{{name}}” was deleted.' }));
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('milestones.deleteFailed', { defaultValue: 'The milestone could not be deleted.' })));
    } finally {
      setDeleting(null);
    }
  };

  const menuFor = (milestone: Milestone): MenuProps['items'] => [
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: t('milestones.menu.edit', { defaultValue: 'Edit milestone' }),
      onClick: () => setEditing(milestone),
    },
    ...(milestone.status !== 'completed'
      ? [
          {
            key: 'complete',
            icon: <CheckCircleOutlined />,
            label: t('milestones.menu.complete', { defaultValue: 'Mark complete…' }),
            onClick: () => setCompleting(milestone),
          },
        ]
      : []),
    { type: 'divider' as const },
    {
      key: 'delete',
      danger: true,
      icon: <DeleteOutlined />,
      label: t('milestones.menu.delete', { defaultValue: 'Delete milestone' }),
      onClick: () => setDeleting(milestone),
    },
  ];

  const columns: ColumnsType<Milestone> = [
    {
      key: 'milestone',
      title: t('milestones.columns.milestone', { defaultValue: 'Milestone' }),
      render: (_value, milestone) => {
        const linkedTasks = milestone.linked.task_ids.length;
        const linkedFiles = milestone.linked.file_ids.length;
        return (
          <div style={{ opacity: milestone.visibility === 'internal' ? 0.8 : 1 }}>
            <Flex align="center" gap={6} style={{ fontWeight: 600, fontSize: 13 }}>
              {milestone.visibility === 'internal' && <LockOutlined aria-hidden style={{ fontSize: 12 }} />}
              {decodeHtmlEntities(milestone.name)}
            </Flex>
            {milestone.description && (
              <div style={{ fontSize: 11.5, color: token.colorTextSecondary }}>
                <RichTextView value={milestone.description} />
              </div>
            )}
            {linkedTasks + linkedFiles > 0 && (
              <div style={{ fontSize: 11.5, color: token.colorTextSecondary, marginTop: 3 }}>
                {t('milestones.linkedSummary', {
                  tasks: linkedTasks,
                  files: linkedFiles,
                  visible: milestone.linked_visible_count,
                  total: milestone.linked_total_count,
                  defaultValue: 'Linked: {{tasks}} task(s), {{files}} file(s) · client sees {{visible}} of {{total}}',
                })}
              </div>
            )}
            {milestone.internal_note && (
              <div style={{ fontSize: 11.5, color: token.colorWarning, marginTop: 3 }}>
                {t('milestones.internalNoteLabel', { defaultValue: 'Internal:' })} <RichTextView value={milestone.internal_note} />
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      title: t('milestones.columns.status', { defaultValue: 'Status' }),
      render: (_value, milestone) =>
        milestone.read_only ? (
          <MilestoneStatusTag status={milestone.status} />
        ) : (
        <Select<MilestoneStatus>
          size="small"
          value={milestone.status}
          style={{ minWidth: 130 }}
          disabled={isUpdating}
          onChange={status => void changeStatus(milestone, status)}
          aria-label={t('milestones.statusLabel', { name: milestone.name, defaultValue: 'Status of {{name}}' })}
          options={STATUS_OPTIONS.map(option => ({
            value: option.value,
            label: tShared(option.key, { defaultValue: option.defaultValue }),
          }))}
        />
        ),
    },
    {
      key: 'target',
      title: t('milestones.columns.target', { defaultValue: 'Target' }),
      render: (_value, milestone) => formatPortalDate(milestone.target_date, i18n.language) ?? '—',
    },
    {
      key: 'completed',
      title: t('milestones.columns.completed', { defaultValue: 'Completed' }),
      render: (_value, milestone) => formatPortalDate(milestone.completed_at, i18n.language) ?? '—',
    },
    {
      key: 'visible',
      title: t('milestones.columns.visible', { defaultValue: 'Client visible' }),
      render: (_value, milestone) =>
        milestone.read_only ? (
          <VisibilityTag visibility="client" />
        ) : (
        <VisibilitySwitch
          visibility={milestone.visibility}
          itemLabel={milestone.name}
          disabled={isUpdating}
          onChange={visibility => void changeVisibility(milestone, visibility)}
        />
        ),
    },
    {
      key: 'actions',
      align: 'right',
      render: (_value, milestone) =>
        milestone.read_only ? null : (
        <Dropdown menu={{ items: menuFor(milestone) }} trigger={['click']}>
          <Button
            size="small"
            type="text"
            icon={<MoreOutlined />}
            aria-label={t('milestones.rowActions', { name: milestone.name, defaultValue: 'Actions for {{name}}' })}
          />
        </Dropdown>
        ),
    },
  ];

  if (query.isLoading) return <PortalLoader />;
  if (query.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('milestones.loadFailed', { defaultValue: 'The milestones could not be loaded.' })}
        action={
          <Button size="small" onClick={() => query.refetch()}>
            {t('retry', { defaultValue: 'Retry' })}
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <Flex align="center" gap={10} wrap="wrap" style={{ marginBottom: 10 }}>
        <PillToggle<MilestoneSource>
          value={source}
          onChange={value => void changeSource(value)}
          ariaLabel={t('milestones.sourceLabel', { defaultValue: 'Milestone source' })}
          options={[
            { value: 'worklenz', label: t('milestones.sourceWorklenz', { defaultValue: 'WorkLenz phases' }) },
            { value: 'manual', label: t('milestones.sourceManual', { defaultValue: 'Set manually' }) },
          ]}
        />
        {isSwitching && <Typography.Text type="secondary">…</Typography.Text>}
      </Flex>
      <Flex justify="space-between" align="center" gap={12} wrap="wrap" style={{ marginBottom: 12 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
          {isPhases
            ? t('milestones.phasesHint', {
                defaultValue:
                  'Showing this project’s WorkLenz phases with their real dates. Clients see these. Switch to Set manually to add your own milestones.',
              })
            : t('milestones.summary', {
            shared: milestones.length - internalCount,
            internal: internalCount,
            defaultValue:
              '{{shared}} shared with the client · {{internal}} internal only. Internal milestones are never counted or hinted at in the portal.',
          })}
        </Typography.Text>
        {!isPhases && (
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setEditing(null)}>
            {t('milestones.addMilestone', { defaultValue: 'Add milestone' })}
          </Button>
        )}
      </Flex>

      <div style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8, overflow: 'hidden' }}>
        <Table<Milestone>
          aria-label={t('milestones.tableLabel', { defaultValue: 'Milestones' })}
          size="middle"
          columns={columns}
          dataSource={milestones}
          rowKey={milestone => milestone.id}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  isPhases
                    ? t('milestones.emptyPhases', {
                        defaultValue: 'This project has no dated phases yet. Add phases with dates in the WorkLenz project.',
                      })
                    : t('milestones.empty', {
                        defaultValue: 'No milestones yet. Add one to show the client where the project is heading.',
                      })
                }
              />
            ),
          }}
        />
      </div>

      {editing !== undefined && (
        <MilestoneModal key={editing?.id ?? 'new'} project={project} editing={editing} onClose={() => setEditing(undefined)} />
      )}
      {completing && <CompleteMilestoneModal project={project} milestone={completing} onClose={() => setCompleting(null)} />}

      <ConfirmEffectModal
        open={deleting !== null}
        danger
        title={t('milestones.deleteTitle', { defaultValue: 'Delete this milestone?' })}
        confirmLabel={t('milestones.deleteConfirm', { defaultValue: 'Delete milestone' })}
        loading={isDeleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      >
        {deleting &&
          (deleting.visibility === 'client'
            ? t('milestones.deleteBodyShared', {
                name: deleting.name,
                defaultValue:
                  '“{{name}}” disappears from the client portal immediately. Linked tasks and files are not deleted. The deletion is recorded in the audit log.',
              })
            : t('milestones.deleteBodyInternal', {
                name: deleting.name,
                defaultValue:
                  '“{{name}}” is removed. Linked tasks and files are not deleted. The deletion is recorded in the audit log.',
              }))}
      </ConfirmEffectModal>
    </div>
  );
};
