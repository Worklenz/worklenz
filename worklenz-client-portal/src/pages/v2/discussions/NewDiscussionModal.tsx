import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Form, Modal, Select } from '@/shared/antd-imports';
import { useMessage } from '@/hooks/useMessage';
import {
  useGetApprovalsQuery,
  useGetFilesQuery,
  useGetProjectsV2Query,
  useGetTasksQuery,
  usePostCommentMutation,
} from '@/store/api-v2';
import { errorMessage } from '@/components/v2';
import { RichTextEditor, type RichTextChange } from '@/components/v2/RichTextEditor';
import type { ClientProjectV2, ThreadContextType } from '@/types/v2';
import { AttachButton, AttachmentChips } from './AttachmentPicker';
import { useMessageAttachments } from './useMessageAttachments';

const MAX_MESSAGE_LENGTH = 4000;
const GENERAL = 'project:';
const EMPTY_DRAFT: RichTextChange = { html: '', text: '', mentionIds: [] };

interface NewDiscussionModalProps {
  open: boolean;
  /** Fixed when started from a project's own Discussions tab. */
  project?: ClientProjectV2;
  /** Why files can't be attached (the role cannot upload), or null. */
  uploadBlockedReason: string | null;
  onClose: () => void;
  onCreated: (threadId: string) => void;
}

/**
 * Starts a discussion about the project in general, one of its shared tasks or files, or an approval.
 * The first message can carry files where the role and the project allow uploads.
 */
export const NewDiscussionModal = ({ open, project, uploadBlockedReason, onClose, onCreated }: NewDiscussionModalProps) => {
  const { t } = useTranslation();
  const message = useMessage();
  const { data: projects, isLoading: isLoadingProjects } = useGetProjectsV2Query(undefined, { skip: Boolean(project) });
  const [postComment, { isLoading }] = usePostCommentMutation();
  const [projectId, setProjectId] = useState<string>(project?.id ?? '');
  const [context, setContext] = useState(GENERAL);
  const [draft, setDraft] = useState<RichTextChange>(EMPTY_DRAFT);

  const effectiveProjectId = project?.id ?? projectId;
  const chosenProject = project ?? projects?.find(item => item.id === effectiveProjectId);
  const canAttach = uploadBlockedReason === null && chosenProject?.allow_uploads === true;
  const attachBlockedReason =
    uploadBlockedReason ??
    (chosenProject && !chosenProject.allow_uploads
      ? t('discussions.uploadsOff', { defaultValue: 'Uploads are turned off for this project.' })
      : null);
  const attachments = useMessageAttachments(canAttach ? effectiveProjectId : undefined);

  const { data: tasks } = useGetTasksQuery(effectiveProjectId, { skip: !open || !effectiveProjectId });
  const { data: files } = useGetFilesQuery(effectiveProjectId, { skip: !open || !effectiveProjectId });
  const { data: approvals } = useGetApprovalsQuery(undefined, { skip: !open });

  const hasText = draft.text.trim().length > 0;
  const canSend = (hasText || attachments.fileIds.length > 0) && !attachments.isUploading;
  const isTooLong = draft.text.length > MAX_MESSAGE_LENGTH;

  useEffect(() => {
    if (open) {
      setProjectId(project?.id ?? projects?.[0]?.id ?? '');
      setContext(GENERAL);
      setDraft(EMPTY_DRAFT);
      attachments.reset();
    }
    // Reset only when the dialog opens or the fixed project changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?.id]);

  // Once the projects load, an unset choice falls to the first one.
  useEffect(() => {
    if (open && !project && !projectId && projects?.[0]) setProjectId(projects[0].id);
  }, [open, project, projectId, projects]);

  const aboutOptions = useMemo(
    () => [
      { value: GENERAL, label: t('discussions.aboutProject', { defaultValue: 'The project in general' }) },
      ...(tasks ?? []).map(task => ({
        value: `task:${task.id}`,
        label: t('discussions.aboutTask', { title: task.title, defaultValue: 'Task: {{title}}' }),
      })),
      ...(files ?? []).map(file => ({
        value: `file:${file.id}`,
        label: t('discussions.aboutFile', { name: file.name, defaultValue: 'File: {{name}}' }),
      })),
      ...(approvals ?? [])
        .filter(approval => approval.project_id === effectiveProjectId)
        .map(approval => ({
          value: `approval:${approval.id}`,
          label: t('discussions.aboutApproval', { name: `${approval.ref_no} · ${approval.title}`, defaultValue: 'Approval: {{name}}' }),
        })),
    ],
    [tasks, files, approvals, effectiveProjectId, t]
  );

  const create = async () => {
    if (!canSend || isTooLong || !effectiveProjectId || isLoading) return;
    const [type, refId] = context.split(':') as [ThreadContextType, string];
    try {
      const result = await postComment({
        project_id: effectiveProjectId,
        context: type === 'project' ? { type } : { type, ref_id: refId },
        text: draft.html,
        ...(attachments.fileIds.length > 0 ? { attachment_file_ids: attachments.fileIds } : {}),
      }).unwrap();
      void message.success(t('discussions.started', { defaultValue: 'Discussion started. Your team is notified.' }));
      onCreated(result.thread_id);
      onClose();
    } catch (error) {
      void message.error(errorMessage(error) ?? t('discussions.postFailed', { defaultValue: 'We could not post your comment. Please try again.' }));
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={520}
      title={t('discussions.newTitle', { defaultValue: 'New discussion' })}
      maskClosable={!isLoading}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onClose}>
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </Button>,
        <Button
          key="start"
          type="primary"
          loading={isLoading}
          disabled={!canSend || isTooLong || !effectiveProjectId}
          onClick={() => void create()}
        >
          {t('discussions.start', { defaultValue: 'Start discussion' })}
        </Button>,
      ]}
    >
      <Form layout="vertical">
        {!project && (
          <Form.Item
            label={t('discussions.project', { defaultValue: 'Project' })}
            required
            extra={t('discussions.projectHint', { defaultValue: 'Everyone assigned to this project can see the discussion.' })}
          >
            <Select<string>
              showSearch
              optionFilterProp="label"
              loading={isLoadingProjects}
              value={projectId || undefined}
              aria-label={t('discussions.project', { defaultValue: 'Project' })}
              onChange={value => {
                setProjectId(value);
                setContext(GENERAL);
              }}
              placeholder={t('discussions.projectPlaceholder', { defaultValue: 'Choose a project…' })}
              options={(projects ?? []).map(item => ({ value: item.id, label: item.name }))}
            />
          </Form.Item>
        )}
        <Form.Item label={t('discussions.about', { defaultValue: 'About' })}>
          <Select<string>
            value={context}
            aria-label={t('discussions.about', { defaultValue: 'About' })}
            onChange={setContext}
            disabled={!effectiveProjectId}
            options={aboutOptions}
          />
        </Form.Item>
        <Form.Item
          label={t('discussions.message', { defaultValue: 'Message' })}
          required
          validateStatus={isTooLong ? 'error' : undefined}
          help={
            isTooLong
              ? t('discussions.tooLong', { max: MAX_MESSAGE_LENGTH, defaultValue: 'A message can be at most {{max}} characters.' })
              : undefined
          }
        >
          <RichTextEditor
            value={draft.html}
            onChange={setDraft}
            placeholder={t('discussions.messagePlaceholder', { defaultValue: 'Write your message…' })}
            ariaLabel={t('discussions.message', { defaultValue: 'Message' })}
            minHeight={72}
          />
          <div style={{ marginTop: 6 }}>
            <AttachButton
              controller={attachments}
              disabled={!effectiveProjectId || isLoading || attachBlockedReason !== null}
              disabledReason={attachBlockedReason ?? undefined}
            />
          </div>
          <AttachmentChips controller={attachments} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
