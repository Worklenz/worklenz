import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Checkbox, Flex, Form, Input, Modal, Select, Typography, message, theme } from '@/shared/antd-imports';
import PillToggle from '@/pages/home/PillToggle';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import {
  useCompleteMilestoneMutation,
  useCreateMilestoneMutation,
  useGetProjectFilesQuery,
  useGetProjectTasksQuery,
  useUpdateMilestoneMutation,
} from '@/api/client-portal/portal-projects-api';
import { VisibilityTag, formatPortalDate } from '@/components/client-portal/v2';
import { decodeHtmlEntities } from '@/utils/html-entities';
import type {
  Milestone,
  MilestoneStatus,
  PortalProject,
  PortalVisibility,
  SaveMilestoneRequest,
} from '@/types/client-portal/v2';
import { RichTextField } from '../../shared/rich-text/RichTextField';

const STATUS_OPTIONS: { value: MilestoneStatus; key: string; defaultValue: string }[] = [
  { value: 'upcoming', key: 'milestoneUpcoming', defaultValue: 'Upcoming' },
  { value: 'in_progress', key: 'milestoneInProgress', defaultValue: 'In Progress' },
  { value: 'completed', key: 'milestoneCompleted', defaultValue: 'Completed' },
  { value: 'delayed', key: 'milestoneDelayed', defaultValue: 'Delayed' },
];

interface MilestoneModalProps {
  project: PortalProject;
  /** The milestone being edited, or null to add a new one. */
  editing: Milestone | null;
  onClose: () => void;
}

interface MilestoneFormState {
  name: string;
  description: string;
  target_date: string;
  status: MilestoneStatus;
  visibility: PortalVisibility;
  internal_note: string;
  task_ids: string[];
  file_ids: string[];
}

const blankForm: MilestoneFormState = {
  name: '',
  description: '',
  target_date: '',
  status: 'upcoming',
  visibility: 'internal',
  internal_note: '',
  task_ids: [],
  file_ids: [],
};

const flip = (list: string[], id: string): string[] =>
  list.includes(id) ? list.filter(item => item !== id) : [...list, id];

/** Add or edit one milestone, with optional linked work. Mount it only while it is open (it keys off `editing`). */
export const MilestoneModal = ({ project, editing, onClose }: MilestoneModalProps) => {
  const { t } = useTranslation('client-portal-v2-projects');
  const { t: tShared } = useTranslation('client-portal-v2');
  const { token } = theme.useToken();

  const [form, setForm] = useState<MilestoneFormState>(
    editing
      ? {
          name: editing.name,
          description: editing.description,
          target_date: editing.target_date,
          status: editing.status,
          visibility: editing.visibility,
          internal_note: editing.internal_note,
          task_ids: editing.linked.task_ids,
          file_ids: editing.linked.file_ids,
        }
      : blankForm
  );
  const [createMilestone, { isLoading: isCreating }] = useCreateMilestoneMutation();
  const [updateMilestone, { isLoading: isUpdating }] = useUpdateMilestoneMutation();
  const tasksQuery = useGetProjectTasksQuery({ projectId: project.id, params: { limit: 100 } });
  const filesQuery = useGetProjectFilesQuery({ projectId: project.id });

  const tasks = tasksQuery.data?.body?.items ?? [];
  const files = filesQuery.data?.body ?? [];
  const isSaving = isCreating || isUpdating;
  const canSave = form.name.trim() !== '' && form.target_date !== '';

  const save = async () => {
    if (!canSave) {
      message.error(t('milestones.needsNameAndDate', { defaultValue: 'A milestone needs a name and a target date.' }));
      return;
    }
    const body: SaveMilestoneRequest = {
      name: form.name.trim(),
      description: form.description.trim(),
      target_date: form.target_date,
      status: form.status,
      visibility: form.visibility,
      internal_note: form.internal_note.trim(),
      linked: { task_ids: form.task_ids, file_ids: form.file_ids },
    };

    try {
      if (editing) {
        await updateMilestone({ projectId: project.id, milestoneId: editing.id, body }).unwrap();
        message.success(t('milestones.updated', { defaultValue: 'Milestone updated.' }));
      } else {
        await createMilestone({ projectId: project.id, body }).unwrap();
        message.success(
          form.visibility === 'client'
            ? t('milestones.addedShared', { defaultValue: 'Milestone added and visible to the client.' })
            : t('milestones.addedInternal', { defaultValue: 'Milestone added as Internal Only.' })
        );
      }
      onClose();
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('milestones.saveFailed', { defaultValue: 'The milestone could not be saved.' })));
    }
  };

  return (
    <Modal
      open
      title={
        editing
          ? t('milestones.editTitle', { defaultValue: 'Edit milestone' })
          : t('milestones.addTitle', { defaultValue: 'Add milestone' })
      }
      okText={editing ? t('milestones.save', { defaultValue: 'Save' }) : t('milestones.add', { defaultValue: 'Add milestone' })}
      cancelText={tShared('cancel', { defaultValue: 'Cancel' })}
      onOk={() => void save()}
      onCancel={onClose}
      okButtonProps={{ loading: isSaving, disabled: !canSave }}
      maskClosable={!isSaving}
      width={560}
      destroyOnHidden
    >
      <Form layout="vertical" requiredMark>
        <Form.Item
          required
          label={t('milestones.name', { defaultValue: 'Milestone name' })}
          extra={t('milestones.nameHint', { defaultValue: 'A short business-level label, not a technical task name.' })}
        >
          <Input aria-label={t('milestones.name', { defaultValue: 'Milestone name' })} value={form.name} maxLength={150} onChange={event => setForm({ ...form, name: event.target.value })} />
        </Form.Item>
        <Form.Item label={t('milestones.description', { defaultValue: 'Description (client-facing, optional)' })}>
          <RichTextField
            value={form.description}
            onChange={html => setForm({ ...form, description: html })}
            ariaLabel={t('milestones.description', { defaultValue: 'Description (client-facing, optional)' })}
            maxLength={1000}
          />
        </Form.Item>
        <Flex gap={12} wrap="wrap">
          <Form.Item required label={t('milestones.targetDate', { defaultValue: 'Target date' })} style={{ flex: '1 1 180px' }}>
            <Input aria-label={t('milestones.targetDate', { defaultValue: 'Target date' })} type="date" value={form.target_date} onChange={event => setForm({ ...form, target_date: event.target.value })} />
          </Form.Item>
          <Form.Item label={t('milestones.status', { defaultValue: 'Status' })} style={{ flex: '1 1 180px' }}>
            <Select<MilestoneStatus>
              value={form.status}
              aria-label={t('milestones.status', { defaultValue: 'Status' })}
              onChange={status => setForm({ ...form, status })}
              options={STATUS_OPTIONS.map(option => ({
                value: option.value,
                label: tShared(option.key, { defaultValue: option.defaultValue }),
              }))}
            />
          </Form.Item>
        </Flex>
        <Form.Item label={t('milestones.visibility', { defaultValue: 'Visibility' })}>
          <PillToggle<PortalVisibility>
            value={form.visibility}
            onChange={visibility => setForm({ ...form, visibility })}
            ariaLabel={t('milestones.visibility', { defaultValue: 'Visibility' })}
            options={[
              { value: 'internal', label: tShared('visibilityInternal', { defaultValue: 'Internal only' }) },
              { value: 'client', label: tShared('visibilityClient', { defaultValue: 'Client visible' }) },
            ]}
          />
        </Form.Item>

        <Form.Item
          label={t('milestones.linkedWork', { defaultValue: 'Linked work (optional)' })}
          extra={t('milestones.linkedWorkHint', {
            defaultValue:
              'The client sees only linked items that are Client Visible. Internal Only items stay hidden, and the client is never told they exist.',
          })}
        >
          <div
            style={{
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 8,
              padding: '6px 10px',
              maxHeight: 160,
              overflowY: 'auto',
            }}
          >
            {tasks.map(task => (
              <Flex key={`task-${task.id}`} align="center" gap={8} style={{ padding: '3px 0', fontSize: 12.5 }}>
                <Checkbox
                  checked={form.task_ids.includes(task.id)}
                  onChange={() => setForm({ ...form, task_ids: flip(form.task_ids, task.id) })}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  {t('milestones.linkTask', {
                    title: decodeHtmlEntities(task.title),
                    defaultValue: 'Task: {{title}}',
                  })}
                </span>
                <VisibilityTag visibility={task.visibility} />
              </Flex>
            ))}
            {files.map(file => (
              <Flex key={`file-${file.id}`} align="center" gap={8} style={{ padding: '3px 0', fontSize: 12.5 }}>
                <Checkbox
                  checked={form.file_ids.includes(file.id)}
                  onChange={() => setForm({ ...form, file_ids: flip(form.file_ids, file.id) })}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  {t('milestones.linkFile', { name: file.name, defaultValue: 'File: {{name}}' })}
                </span>
                <VisibilityTag visibility={file.visibility} />
              </Flex>
            ))}
            {tasks.length === 0 && files.length === 0 && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('milestones.noLinkable', { defaultValue: 'This project has no tasks or files to link yet.' })}
              </Typography.Text>
            )}
          </div>
        </Form.Item>

        {form.status === 'delayed' && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={t('milestones.delayedNotice', {
              defaultValue:
                'The client sees “Delayed” and the dates, never your internal reason. Put anything the client should know in the description above.',
            })}
          />
        )}

        <Form.Item label={t('milestones.internalNote', { defaultValue: 'Internal note (private)' })}>
          <RichTextField
            value={form.internal_note}
            onChange={html => setForm({ ...form, internal_note: html })}
            placeholder={t('milestones.internalNotePlaceholder', { defaultValue: 'Delay reasons, capacity, risks…' })}
            ariaLabel={t('milestones.internalNote', { defaultValue: 'Internal note (private)' })}
            maxLength={1000}
            tone="internal"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

interface CompleteMilestoneModalProps {
  project: PortalProject;
  milestone: Milestone;
  onClose: () => void;
}

/** Completing keeps the target date, records today as the completion date and takes an optional client-facing note. */
export const CompleteMilestoneModal = ({ project, milestone, onClose }: CompleteMilestoneModalProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-projects');
  const { t: tShared } = useTranslation('client-portal-v2');
  const [note, setNote] = useState(milestone.completion_note);
  const [completeMilestone, { isLoading }] = useCompleteMilestoneMutation();

  const complete = async () => {
    try {
      await completeMilestone({
        projectId: project.id,
        milestoneId: milestone.id,
        body: { completion_note: note.trim() || undefined },
      }).unwrap();
      message.success(
        milestone.visibility === 'client'
          ? t('milestones.completedShared', {
              name: milestone.name,
              defaultValue: '“{{name}}” marked complete. The client is notified.',
            })
          : t('milestones.completedInternal', {
              name: milestone.name,
              defaultValue: '“{{name}}” marked complete. It is Internal Only, so the client is not notified.',
            })
      );
      onClose();
    } catch (error) {
      message.error(
        getPortalErrorMessage(error, t('milestones.completeFailed', { defaultValue: 'The milestone could not be completed.' }))
      );
    }
  };

  return (
    <Modal
      open
      title={t('milestones.completeTitle', { defaultValue: 'Mark milestone complete' })}
      okText={t('milestones.complete', { defaultValue: 'Mark complete' })}
      cancelText={tShared('cancel', { defaultValue: 'Cancel' })}
      onOk={() => void complete()}
      onCancel={onClose}
      okButtonProps={{ loading: isLoading }}
      maskClosable={!isLoading}
      width={480}
      destroyOnHidden
    >
      <Typography.Paragraph>
        {t('milestones.completeBody', {
          name: milestone.name,
          date: formatPortalDate(milestone.target_date, i18n.language) ?? milestone.target_date,
          defaultValue: '{{name}} will keep its target date ({{date}}) and record today as the completion date.',
        })}
      </Typography.Paragraph>
      <Form layout="vertical">
        <Form.Item
          label={t('milestones.completionNote', { defaultValue: 'Completion note for the client (optional)' })}
          extra={
            milestone.visibility === 'client'
              ? t('milestones.completionNoteShared', { defaultValue: 'Shown on the milestone in the portal.' })
              : t('milestones.completionNoteInternal', {
                  defaultValue: 'This milestone is Internal Only, so nothing is shown to the client.',
                })
          }
        >
          <RichTextField
            value={note}
            onChange={html => setNote(html)}
            placeholder={t('milestones.completionNotePlaceholder', { defaultValue: 'What was delivered?' })}
            ariaLabel={t('milestones.completionNote', { defaultValue: 'Completion note for the client (optional)' })}
            maxLength={1000}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
