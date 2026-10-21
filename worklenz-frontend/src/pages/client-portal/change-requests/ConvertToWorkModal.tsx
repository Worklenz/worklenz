import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Form, Input, Modal, Select, Typography, message } from '@/shared/antd-imports';
import PillToggle from '@/pages/home/PillToggle';
import { useGetPortalStaffQuery } from '@/api/client-portal/portal-access-api';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { useConvertChangeRequestMutation, useGetLinkableTasksQuery } from '@/api/client-portal/portal-workflow-api';
import type { ChangeRequest, ConvertToWorkRequest, PortalVisibility } from '@/types/client-portal/v2';
import { decodeHtmlEntities } from '@/utils/html-entities';

interface ConvertToWorkModalProps {
  changeRequest: ChangeRequest;
  onClose: () => void;
}

type Mode = 'create' | 'link';

/**
 * Turns an approved request into tracked work: a new task (Internal Only by default) or an existing
 * task that is not already linked to a request. The request becomes In Progress and keeps the link.
 */
export const ConvertToWorkModal = ({ changeRequest, onClose }: ConvertToWorkModalProps) => {
  const { t } = useTranslation('client-portal-v2-change-requests');
  const { t: tShared } = useTranslation('client-portal-v2');
  const [mode, setMode] = useState<Mode>('create');
  const [title, setTitle] = useState(`${changeRequest.cr_no}: ${changeRequest.title}`);
  const [assigneeId, setAssigneeId] = useState<string | null>(changeRequest.assignee?.id ?? null);
  const [visibility, setVisibility] = useState<PortalVisibility>('internal');
  const [taskId, setTaskId] = useState<string | undefined>();

  const staffQuery = useGetPortalStaffQuery();
  const linkableQuery = useGetLinkableTasksQuery(changeRequest.project_id);
  const [convert, { isLoading }] = useConvertChangeRequestMutation();

  const linkable = linkableQuery.data?.body ?? [];
  const canSubmit = mode === 'create' ? title.trim() !== '' : Boolean(taskId);

  const submit = async () => {
    const body: ConvertToWorkRequest =
      mode === 'create'
        ? { mode: 'create', title: title.trim(), assignee_id: assigneeId, visibility }
        : { mode: 'link', task_id: taskId ?? '' };
    try {
      const result = await convert({ id: changeRequest.id, body }).unwrap();
      const key = result.body?.linked_work?.task_key ?? '';
      message.success(
        mode === 'create'
          ? t('convert.created', {
              key,
              ref: changeRequest.cr_no,
              defaultValue: '{{key}} created from {{ref}}. The request is now In Progress and keeps a link to the task.',
            })
          : t('convert.linked', {
              key,
              ref: changeRequest.cr_no,
              defaultValue: '{{ref}} is linked to {{key}} and is now In Progress. The task keeps its own visibility.',
            })
      );
      onClose();
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('convert.failed', { defaultValue: 'The request could not be converted to work.' })));
    }
  };

  return (
    <Modal
      open
      title={t('convert.title', { defaultValue: 'Convert to project work' })}
      okText={
        mode === 'create'
          ? t('convert.create', { defaultValue: 'Create work item' })
          : t('convert.link', { defaultValue: 'Link work item' })
      }
      cancelText={tShared('cancel', { defaultValue: 'Cancel' })}
      onOk={() => void submit()}
      onCancel={onClose}
      okButtonProps={{ loading: isLoading, disabled: !canSubmit }}
      maskClosable={!isLoading}
      width={520}
      destroyOnHidden
    >
      <Form layout="vertical">
        <Form.Item label={t('convert.how', { defaultValue: 'How should the work be tracked?' })}>
          <PillToggle<Mode>
            value={mode}
            onChange={setMode}
            ariaLabel={t('convert.how', { defaultValue: 'How should the work be tracked?' })}
            options={[
              { value: 'create', label: t('convert.modeCreate', { defaultValue: 'Create a new task' }) },
              { value: 'link', label: t('convert.modeLink', { defaultValue: 'Link an existing task' }) },
            ]}
          />
        </Form.Item>

        {mode === 'create' ? (
          <>
            <Typography.Paragraph style={{ fontSize: 13 }}>
              {t('convert.createIntro', {
                project: changeRequest.project_name,
                ref: changeRequest.cr_no,
                defaultValue:
                  'Creates a task in {{project}} that keeps a link back to {{ref}}, so the approval and decision history stays with the request.',
              })}
            </Typography.Paragraph>
            <Form.Item label={t('convert.taskTitle', { defaultValue: 'Task title' })} required>
              <Input aria-label={t('convert.taskTitle', { defaultValue: 'Task title' })} value={title} maxLength={200} onChange={event => setTitle(event.target.value)} />
            </Form.Item>
            <Form.Item label={t('convert.assignee', { defaultValue: 'Assignee' })}>
              <Select<string>
                allowClear
                showSearch
                optionFilterProp="label"
                loading={staffQuery.isLoading}
                value={assigneeId ?? undefined}
                aria-label={t('convert.assignee', { defaultValue: 'Assignee' })}
                onChange={value => setAssigneeId(value ?? null)}
                placeholder={t('convert.unassigned', { defaultValue: 'Unassigned' })}
                options={(staffQuery.data?.body ?? []).map(member => ({ value: member.id, label: member.name }))}
              />
            </Form.Item>
            <Form.Item
              label={t('convert.visibility', { defaultValue: 'Task visibility' })}
              extra={t('convert.visibilityHint', {
                defaultValue: 'Internal Only by default, like every other task. Share it later from the project’s Tasks tab.',
              })}
            >
              <PillToggle<PortalVisibility>
                value={visibility}
                onChange={setVisibility}
                ariaLabel={t('convert.visibility', { defaultValue: 'Task visibility' })}
                options={[
                  { value: 'internal', label: tShared('visibilityInternal', { defaultValue: 'Internal only' }) },
                  { value: 'client', label: tShared('visibilityClient', { defaultValue: 'Client visible' }) },
                ]}
              />
            </Form.Item>
          </>
        ) : (
          <>
            <Typography.Paragraph style={{ fontSize: 13 }}>
              {t('convert.linkIntro', {
                project: changeRequest.project_name,
                ref: changeRequest.cr_no,
                defaultValue:
                  'Associates {{ref}} with a task that already exists in {{project}}. The request and the task link to each other, and the task keeps its own visibility.',
              })}
            </Typography.Paragraph>
            <Form.Item
              label={t('convert.existingTask', { defaultValue: 'Existing task' })}
              extra={
                !linkableQuery.isLoading && linkable.length === 0
                  ? t('convert.noLinkable', { defaultValue: 'Every task in this project is already linked to a change request.' })
                  : t('convert.linkableHint', { defaultValue: 'Only tasks that are not already linked to a change request are listed.' })
              }
            >
              <Select<string>
                showSearch
                optionFilterProp="label"
                loading={linkableQuery.isLoading}
                value={taskId}
                aria-label={t('convert.existingTask', { defaultValue: 'Existing task' })}
                onChange={setTaskId}
                placeholder={t('convert.chooseTask', { defaultValue: 'Choose a task…' })}
                options={linkable.map(task => ({
                  value: task.id,
                  label: t('convert.taskOption', {
                    key: task.key,
                    title: decodeHtmlEntities(task.title),
                    defaultValue: '{{key}} · {{title}}',
                  }),
                }))}
              />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
};
