import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Form, Modal, Select, message } from '@/shared/antd-imports';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { useGetPortalProjectsQuery } from '@/api/client-portal/portal-projects-api';
import { useGetThreadOptionsQuery, useStartThreadMutation } from '@/api/client-portal/portal-workflow-api';
import type { Thread, ThreadContextType } from '@/types/client-portal/v2';
import { AttachButton, AttachmentChips } from './AttachmentPicker';
import { RichMessageEditor, type RichMessageChange } from './RichMessageEditor';
import { useMessageAttachments } from './useMessageAttachments';
import { decodeHtmlEntities } from '@/utils/html-entities';

const MAX_MESSAGE_LENGTH = 4000;

interface NewDiscussionModalProps {
  /** Fixed when started from a project's own Discussions tab. */
  projectId?: string;
  /** Limits the project choice to this client (started from a client or client user). */
  organizationId?: string;
  /** Limits the project choice further, e.g. to the projects one client user can open. */
  restrictToProjectIds?: string[];
  /** Client users to notify from the start (started from a client user). */
  initialRecipientIds?: string[];
  onClose: () => void;
  onCreated: (thread: Thread) => void;
}

const GENERAL = 'project:';

/**
 * Starts a client-visible discussion. Only Client Visible tasks and files, and approvals the client
 * can see, can host one, and the first message is always client-visible.
 */
export const NewDiscussionModal = ({
  projectId,
  organizationId,
  restrictToProjectIds,
  initialRecipientIds,
  onClose,
  onCreated,
}: NewDiscussionModalProps) => {
  const { t } = useTranslation('client-portal-v2-discussions');
  const { t: tShared } = useTranslation('client-portal-v2');
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(projectId);
  const [context, setContext] = useState(GENERAL);
  const [draft, setDraft] = useState<RichMessageChange>({ html: '', text: '', mentionIds: [] });
  const attachments = useMessageAttachments(selectedProjectId);
  const hasText = draft.text.trim().length > 0;
  // The first message can be only files, but not while one is still uploading.
  const canSend = (hasText || attachments.fileIds.length > 0) && !attachments.isUploading;
  const isTooLong = draft.text.length > MAX_MESSAGE_LENGTH;
  const [notifyIds, setNotifyIds] = useState<string[]>(initialRecipientIds ?? []);

  const projectsQuery = useGetPortalProjectsQuery(
    { portal: 'on', limit: 100, organization_id: organizationId },
    { skip: Boolean(projectId) }
  );
  const optionsQuery = useGetThreadOptionsQuery(selectedProjectId ?? '', { skip: !selectedProjectId });
  const [startThread, { isLoading }] = useStartThreadMutation();

  const projectOptions = useMemo(
    () =>
      (projectsQuery.data?.body?.items ?? [])
        .filter(project => !restrictToProjectIds || restrictToProjectIds.includes(project.id))
        .map(project => ({ value: project.id, label: decodeHtmlEntities(project.name) })),
    [projectsQuery.data, restrictToProjectIds]
  );
  const contextOptions = optionsQuery.data?.body?.context;

  // Active client users on the chosen project: who can be notified.
  const contactOptions = useMemo(
    () => (optionsQuery.data?.body?.mentions ?? []).map(user => ({ value: user.id, label: user.name })),
    [optionsQuery.data]
  );
  // Someone chosen earlier who is not on the selected project is dropped, not sent.
  const notifyValue = notifyIds.filter(id => contactOptions.some(option => option.value === id));

  // A client with one eligible project needs no choice.
  useEffect(() => {
    if (!projectId && !selectedProjectId && projectOptions.length === 1) setSelectedProjectId(projectOptions[0].value);
  }, [projectId, selectedProjectId, projectOptions]);

  const submit = async () => {
    if (!selectedProjectId || !canSend || isTooLong) return;
    const [type, refId] = context.split(':') as [ThreadContextType, string];
    try {
      const result = await startThread({
        project_id: selectedProjectId,
        context: { type, ref_id: type === 'project' ? null : refId },
        message: draft.html,
        ...(attachments.fileIds.length > 0 ? { attachment_file_ids: attachments.fileIds } : {}),
        ...(notifyValue.length > 0 ? { notify_contact_ids: notifyValue } : {}),
      }).unwrap();
      message.success(
        notifyValue.length > 0
          ? t('new.startedNotified', {
              names: contactOptions
                .filter(option => notifyValue.includes(option.value))
                .map(option => option.label)
                .join(', '),
              defaultValue: 'Discussion started. {{names}} notified.',
            })
          : t('new.started', { defaultValue: 'Discussion started. Client users on this project are notified.' })
      );
      if (result.body) onCreated(result.body);
      onClose();
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('new.failed', { defaultValue: 'The discussion could not be started.' })));
    }
  };

  return (
    <Modal
      open
      title={t('new.title', { defaultValue: 'New client-visible discussion' })}
      okText={t('new.start', { defaultValue: 'Start discussion' })}
      cancelText={tShared('cancel', { defaultValue: 'Cancel' })}
      onOk={() => void submit()}
      onCancel={onClose}
      okButtonProps={{ loading: isLoading, disabled: !selectedProjectId || !canSend || isTooLong }}
      maskClosable={!isLoading}
      width={520}
      destroyOnHidden
    >
      <Form layout="vertical">
        <Form.Item label={t('new.project', { defaultValue: 'Project' })} required>
          <Select<string>
            showSearch
            optionFilterProp="label"
            disabled={Boolean(projectId)}
            loading={projectsQuery.isLoading}
            value={selectedProjectId}
            aria-label={t('new.project', { defaultValue: 'Project' })}
            onChange={value => {
              setSelectedProjectId(value);
              setContext(GENERAL);
            }}
            placeholder={t('new.projectPlaceholder', { defaultValue: 'Choose a project…' })}
            notFoundContent={t('new.noPortalProjects', { defaultValue: 'No projects have the Client Portal turned on.' })}
            options={projectId ? [{ value: projectId, label: t('new.thisProject', { defaultValue: 'This project' }) }] : projectOptions}
          />
        </Form.Item>
        <Form.Item
          label={t('new.about', { defaultValue: 'About' })}
          extra={t('new.aboutHint', {
            defaultValue:
              'Only Client Visible tasks and files, and approvals the client can see, can host a client-visible discussion.',
          })}
        >
          <Select<string>
            value={context}
            aria-label={t('new.about', { defaultValue: 'About' })}
            onChange={setContext}
            loading={optionsQuery.isLoading}
            disabled={!selectedProjectId}
            options={[
              { value: GENERAL, label: t('new.general', { defaultValue: 'The project in general' }) },
              ...(contextOptions?.tasks ?? []).map(item => ({
                value: `task:${item.id}`,
                label: t('new.task', { label: item.label, defaultValue: 'Task: {{label}}' }),
              })),
              ...(contextOptions?.files ?? []).map(item => ({
                value: `file:${item.id}`,
                label: t('new.file', { label: item.label, defaultValue: 'File: {{label}}' }),
              })),
              ...(contextOptions?.approvals ?? []).map(item => ({
                value: `approval:${item.id}`,
                label: t('new.approval', { label: item.label, defaultValue: 'Approval: {{label}}' }),
              })),
            ]}
          />
        </Form.Item>
        <Form.Item
          label={t('new.notify', { defaultValue: 'Notify' })}
          extra={t('new.notifyHint', {
            defaultValue:
              'Everyone on the project can read this discussion. Only the people you choose here are notified.',
          })}
        >
          <Select<string[]>
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            value={notifyValue}
            onChange={setNotifyIds}
            loading={optionsQuery.isLoading}
            disabled={!selectedProjectId}
            options={contactOptions}
            maxTagCount="responsive"
            aria-label={t('new.notify', { defaultValue: 'Notify' })}
            placeholder={t('new.notifyPlaceholder', { defaultValue: 'Everyone on this project' })}
            notFoundContent={t('new.noClientUsers', { defaultValue: 'No active client users on this project.' })}
          />
        </Form.Item>
        <Form.Item
          label={t('new.firstMessage', { defaultValue: 'First message (visible to the client)' })}
          required
          validateStatus={isTooLong ? 'error' : undefined}
          help={
            isTooLong
              ? t('composer.tooLong', {
                  max: MAX_MESSAGE_LENGTH,
                  defaultValue: 'A message can be at most {{max}} characters.',
                })
              : undefined
          }
        >
          <RichMessageEditor
            value={draft.html}
            onChange={setDraft}
            placeholder={t('new.firstMessagePlaceholder', { defaultValue: 'Write your message…' })}
            ariaLabel={t('new.firstMessage', { defaultValue: 'First message (visible to the client)' })}
          />
          <div style={{ marginTop: 6 }}>
            <AttachButton controller={attachments} disabled={!selectedProjectId || isLoading} />
          </div>
          <AttachmentChips controller={attachments} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
