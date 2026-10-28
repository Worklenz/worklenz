import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LockOutlined, PaperClipOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Checkbox, Descriptions, Drawer, Flex, Form, Input, Typography, message, theme } from '@/shared/antd-imports';
import PillToggle from '@/pages/home/PillToggle';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { useGetProjectFilesQuery, useUpdatePortalTaskMutation } from '@/api/client-portal/portal-projects-api';
import { StatusTag, VisibilityTag, formatPortalDate, useVisibilityToast } from '@/components/client-portal/v2';
import type { PortalProject, PortalTask, PortalVisibility } from '@/types/client-portal/v2';
import { useTaskStatusLabels } from './task-labels';
import { RichTextField } from '../../shared/rich-text/RichTextField';
import { decodeHtmlEntities } from '@/utils/html-entities';

interface TaskDrawerProps {
  project: PortalProject;
  task: PortalTask;
  onClose: () => void;
}

/**
 * Sharing for one task: visibility, optional client-facing wording, which of its files travel
 * with it, a live preview of exactly what the client sees, and the list of what is never shared.
 */
export const TaskDrawer = ({ project, task, onClose }: TaskDrawerProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-projects');
  const { t: tShared } = useTranslation('client-portal-v2');
  const { token } = theme.useToken();
  const labels = useTaskStatusLabels();
  const showVisibilityToast = useVisibilityToast();

  const [visibility, setVisibility] = useState<PortalVisibility>(task.visibility);
  // client_title is plain text (backend trims/limits only). Do not decode entities —
  // that would mutate literal "&amp;" into "&" on a no-op save. Decode only legacy task.title.
  const [clientTitle, setClientTitle] = useState(task.client_title);
  const [clientDescription, setClientDescription] = useState(task.client_description);
  const [fileIds, setFileIds] = useState<string[]>(task.attached_file_ids);
  const [updateTask, { isLoading }] = useUpdatePortalTaskMutation();
  const filesQuery = useGetProjectFilesQuery({ projectId: project.id });
  const files = filesQuery.data?.body ?? [];

  const visibleAttachments = files.filter(file => fileIds.includes(file.id) && file.visibility === 'client');
  const dash = '—';
  const trimmedClientTitle = clientTitle.trim();
  const displayTitle = trimmedClientTitle || decodeHtmlEntities(task.title);

  const save = async () => {
    try {
      await updateTask({
        projectId: project.id,
        taskId: task.id,
        body: {
          visibility,
          client_title: trimmedClientTitle,
          client_description: clientDescription.trim(),
          attached_file_ids: fileIds,
        },
      }).unwrap();
      if (visibility !== task.visibility) {
        showVisibilityToast('task', displayTitle, visibility);
      }
      else message.success(t('tasks.drawer.saved', { defaultValue: 'Client-facing wording and attachments saved.' }));
      onClose();
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('tasks.drawer.saveFailed', { defaultValue: 'The task could not be saved.' })));
    }
  };

  const neverShared: [string, ReactNode][] = [
    [
      t('tasks.drawer.never.estimate', { defaultValue: 'Time estimate' }),
      task.never_shared.estimate_hours !== null
        ? t('tasks.drawer.hours', { value: task.never_shared.estimate_hours, defaultValue: '{{value}} h' })
        : dash,
    ],
    [
      t('tasks.drawer.never.logged', { defaultValue: 'Time logged' }),
      task.never_shared.logged_hours !== null
        ? t('tasks.drawer.hours', { value: task.never_shared.logged_hours, defaultValue: '{{value}} h' })
        : dash,
    ],
    [t('tasks.drawer.never.comments', { defaultValue: 'Internal comments' }), task.never_shared.internal_comments],
    [t('tasks.drawer.never.cost', { defaultValue: 'Cost & billing rate' }), t('tasks.drawer.hidden', { defaultValue: 'Hidden' })],
    [t('tasks.drawer.never.dependencies', { defaultValue: 'Dependencies' }), t('tasks.drawer.hidden', { defaultValue: 'Hidden' })],
    [
      t('tasks.drawer.never.assigneeNotes', { defaultValue: 'Private assignee notes' }),
      t('tasks.drawer.hidden', { defaultValue: 'Hidden' }),
    ],
  ];

  return (
    <Drawer
      open
      onClose={onClose}
      width={480}
      destroyOnHidden
      title={
        <div>
          <div>{decodeHtmlEntities(task.title)}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            {t('tasks.drawer.subtitle', { key: task.key, defaultValue: '{{key}} · Client Portal sharing' })}
          </Typography.Text>
        </div>
      }
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button onClick={onClose} disabled={isLoading}>
            {t('close', { defaultValue: 'Close' })}
          </Button>
          <Button type="primary" loading={isLoading} onClick={() => void save()}>
            {t('tasks.drawer.save', { defaultValue: 'Save changes' })}
          </Button>
        </Flex>
      }
    >
      <Form layout="vertical">
        <Form.Item label={t('tasks.drawer.visibility', { defaultValue: 'Visibility' })}>
          <PillToggle<PortalVisibility>
            value={visibility}
            onChange={setVisibility}
            ariaLabel={t('tasks.drawer.visibility', { defaultValue: 'Visibility' })}
            options={[
              { value: 'internal', label: tShared('visibilityInternal', { defaultValue: 'Internal only' }) },
              { value: 'client', label: tShared('visibilityClient', { defaultValue: 'Client visible' }) },
            ]}
          />
        </Form.Item>

        <Form.Item
          label={t('tasks.drawer.clientTitle', { defaultValue: 'Client-facing title' })}
          extra={t('tasks.drawer.clientTitleHint', { defaultValue: 'Optional. Use it when the internal name is too technical.' })}
        >
          <Input
            value={clientTitle}
            maxLength={200}
            placeholder={decodeHtmlEntities(task.title)}
            aria-label={t('tasks.drawer.clientTitle', { defaultValue: 'Client-facing title' })}
            onChange={event => setClientTitle(event.target.value)}
          />
        </Form.Item>

        <Form.Item label={t('tasks.drawer.clientDescription', { defaultValue: 'Client-facing description' })}>
          <RichTextField
            value={clientDescription}
            onChange={html => setClientDescription(html)}
            placeholder={t('tasks.drawer.clientDescriptionPlaceholder', { defaultValue: 'Only client-appropriate content.' })}
            ariaLabel={t('tasks.drawer.clientDescription', { defaultValue: 'Client-facing description' })}
            maxLength={2000}
          />
        </Form.Item>

        <Form.Item
          label={t('tasks.drawer.attachedFiles', { defaultValue: 'Attached files' })}
          extra={t('tasks.drawer.attachedFilesHint', {
            defaultValue:
              'A client sees an attachment only when the file is independently Client Visible. A hidden file is never shown or counted.',
          })}
        >
          <div
            style={{
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 8,
              padding: '6px 10px',
              maxHeight: 140,
              overflowY: 'auto',
            }}
          >
            {files.map(file => (
              <Flex key={file.id} align="center" gap={8} style={{ padding: '3px 0', fontSize: 12.5 }}>
                <Checkbox
                  checked={fileIds.includes(file.id)}
                  onChange={() =>
                    setFileIds(current =>
                      current.includes(file.id) ? current.filter(id => id !== file.id) : [...current, file.id]
                    )
                  }
                />
                <span style={{ flex: 1, minWidth: 0 }}>{file.name}</span>
                <VisibilityTag visibility={file.visibility} />
              </Flex>
            ))}
            {files.length === 0 && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('tasks.drawer.noFiles', { defaultValue: 'No files in this project yet.' })}
              </Typography.Text>
            )}
          </div>
        </Form.Item>
      </Form>

      <Typography.Text strong style={{ display: 'block', margin: '4px 0 8px' }}>
        {t('tasks.drawer.clientSees', { defaultValue: 'What the client sees' })}
      </Typography.Text>
      {visibility === 'client' ? (
        <Card size="small" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {displayTitle}
          </div>
          <div style={{ fontSize: 12, color: token.colorTextSecondary, margin: '3px 0 6px' }}>
            {labels.client[task.status]}
            {task.due_date
              ? ` · ${t('tasks.drawer.due', {
                  date: formatPortalDate(task.due_date, i18n.language) ?? task.due_date,
                  defaultValue: 'Due {{date}}',
                })}`
              : ''}
          </div>
          <div style={{ fontSize: 12.5 }}>
            {clientDescription.trim() || (
              <Typography.Text type="secondary">{t('tasks.drawer.noDescription', { defaultValue: 'No description' })}</Typography.Text>
            )}
          </div>
          {visibleAttachments.length > 0 && (
            <Flex gap={6} wrap="wrap" style={{ marginTop: 8 }}>
              {visibleAttachments.map(file => (
                <StatusTag key={file.id} tone="gray" icon={<PaperClipOutlined />}>
                  {file.name}
                </StatusTag>
              ))}
            </Flex>
          )}
        </Card>
      ) : (
        <Alert
          type="warning"
          showIcon
          icon={<LockOutlined />}
          style={{ marginBottom: 16 }}
          message={t('tasks.drawer.internalNotice', { defaultValue: 'Internal Only. This task does not exist in the portal.' })}
        />
      )}

      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
        {t('tasks.drawer.neverShared', { defaultValue: 'Never shared with the client' })}
      </Typography.Text>
      <Descriptions size="small" column={1} bordered>
        {neverShared.map(([label, value]) => (
          <Descriptions.Item key={label} label={label}>
            {value}
          </Descriptions.Item>
        ))}
      </Descriptions>
    </Drawer>
  );
};
