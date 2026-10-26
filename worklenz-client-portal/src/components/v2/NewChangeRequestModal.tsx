import React, { useEffect, useRef, useState } from 'react';
import { Button, Flex, Input, Modal, Segmented, Select, Tag, Typography, PaperClipOutlined } from '@/shared/antd-imports';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMessage } from '@/hooks/useMessage';
import { useGetProjectsV2Query, useSubmitChangeRequestMutation } from '@/store/api-v2';
import { useUploadFile } from '@/hooks/useFileActions';
import { errorMessage } from '@/components/v2/queryErrors';
import { RichTextField } from '@/components/v2/RichTextField';
import { isRichTextEmpty } from '@/components/v2/richTextUtils';
import type { ChangeRequestPriority } from '@/types/v2';
import { decodeHtmlEntities } from '@/utils/html-entities';

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;

interface Attachment {
  fileId: string;
  name: string;
}

export const NewChangeRequestModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t } = useTranslation();
  const message = useMessage();
  const navigate = useNavigate();
  const { data: projects } = useGetProjectsV2Query();
  const [submitRequest] = useSubmitChangeRequestMutation();
  const upload = useUploadFile();
  const fileInput = useRef<HTMLInputElement>(null);

  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<ChangeRequestPriority>('medium');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reset only when the modal opens. Do not depend on `projects`: confirming an
  // attachment upload invalidates V2Projects, and a refetch would wipe the form.
  useEffect(() => {
    if (!open) return;
    setProjectId('');
    setTitle('');
    setDescription('');
    setNotes('');
    setPriority('medium');
    setAttachments([]);
    setBusy(false);
    setUploading(false);
  }, [open]);

  // Seed the default project after open (or when the list arrives) without clearing draft fields.
  useEffect(() => {
    if (!open) return;
    setProjectId(current => current || projects?.[0]?.id || '');
  }, [open, projects]);

  const attach = async (file: File | undefined) => {
    if (!file || !projectId) return;
    if (attachments.length >= MAX_ATTACHMENTS) {
      void message.warning(t('changeRequests.tooMany', { count: MAX_ATTACHMENTS, defaultValue: 'You can attach at most {{count}} files.' }));
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      void message.warning(t('changeRequests.tooLarge', { defaultValue: 'Each attachment can be at most 100 MB.' }));
      return;
    }
    setUploading(true);
    try {
      const uploaded = await upload(projectId, file, 'Supporting Document');
      setAttachments(list => [...list, { fileId: uploaded.id, name: file.name }]);
    } catch (error) {
      void message.error(errorMessage(error) ?? t('files.uploadFailed', { defaultValue: 'The upload failed. Please try again.' }));
    } finally {
      setUploading(false);
    }
  };

  const valid = Boolean(projectId && title.trim() && !isRichTextEmpty(description));

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const created = await submitRequest({
        project_id: projectId,
        title: title.trim(),
        description,
        notes: isRichTextEmpty(notes) ? undefined : notes,
        priority,
        attachment_file_ids: attachments.map(item => item.fileId),
      }).unwrap();
      void message.success(
        t('changeRequests.submittedToast', {
          crNo: created.cr_no,
          defaultValue: '{{crNo}} submitted. Your team reviews it first. It does not create a task by itself.',
        })
      );
      onClose();
      navigate(`/change-requests/${created.id}`);
    } catch (error) {
      void message.error(errorMessage(error) ?? t('changeRequests.submitFailed', { defaultValue: 'We could not submit your request. Please try again.' }));
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={540}
      title={t('changeRequests.newTitle', { defaultValue: 'New change request' })}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </Button>,
        <Button key="submit" type="primary" loading={busy} disabled={!valid || uploading} onClick={() => void submit()}>
          {t('changeRequests.submitAction', { defaultValue: 'Submit request' })}
        </Button>,
      ]}
    >
      <FormRow label={t('changeRequests.project', { defaultValue: 'Project' })} required>
        <Select
          style={{ width: '100%' }}
          value={projectId}
          onChange={value => {
            setProjectId(value);
            setAttachments([]);
          }}
          options={(projects ?? []).map(project => ({ value: project.id, label: decodeHtmlEntities(project.name) }))}
        />
      </FormRow>
      <FormRow label={t('changeRequests.titleField', { defaultValue: 'Title' })} required>
        <Input
          value={title}
          maxLength={200}
          placeholder={t('changeRequests.titlePlaceholder', { defaultValue: 'A short summary of the change' })}
          onChange={event => setTitle(event.target.value)}
        />
      </FormRow>
      <FormRow label={t('changeRequests.description', { defaultValue: 'Description' })} required>
        <RichTextField
          value={description}
          onChange={setDescription}
          maxLength={5000}
          minHeight={96}
          ariaLabel={t('changeRequests.description', { defaultValue: 'Description' })}
          placeholder={t('changeRequests.descriptionPlaceholder', { defaultValue: 'What do you need, and why?' })}
        />
      </FormRow>
      <Flex gap={16} wrap="wrap">
        <FormRow label={t('changeRequests.priority', { defaultValue: 'Priority' })}>
          <Segmented<ChangeRequestPriority>
            value={priority}
            onChange={setPriority}
            options={(['low', 'medium', 'high'] as const).map(value => ({ value, label: t(`status.priority.${value}`, { defaultValue: value }) }))}
          />
        </FormRow>
        <FormRow label={t('changeRequests.attachments', { defaultValue: 'Attachments (optional)' })}>
          <input
            ref={fileInput}
            type="file"
            hidden
            data-testid="cr-attachment-input"
            onChange={event => {
              void attach(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <Button size="small" icon={<PaperClipOutlined />} loading={uploading} disabled={!projectId} onClick={() => fileInput.current?.click()}>
            {t('changeRequests.addFile', { defaultValue: 'Add file' })}
          </Button>
          <Flex gap={6} wrap="wrap" style={{ marginTop: 6, maxWidth: '100%', minWidth: 0 }}>
            {attachments.map(item => (
              <Tag
                key={item.fileId}
                closable
                title={item.name}
                style={{ maxWidth: '100%', marginInlineEnd: 0, display: 'inline-flex', alignItems: 'center' }}
                onClose={() => setAttachments(list => list.filter(entry => entry.fileId !== item.fileId))}
              >
                <Typography.Text ellipsis style={{ maxWidth: 200 }}>
                  {item.name}
                </Typography.Text>
              </Tag>
            ))}
          </Flex>
        </FormRow>
      </Flex>
      <FormRow label={t('changeRequests.notes', { defaultValue: 'Notes (optional)' })}>
        <RichTextField
          toolbar="basic"
          value={notes}
          onChange={setNotes}
          maxLength={5000}
          minHeight={48}
          ariaLabel={t('changeRequests.notes', { defaultValue: 'Notes (optional)' })}
          placeholder={t('changeRequests.notesPlaceholder', { defaultValue: 'Anything else the team should know' })}
        />
      </FormRow>
    </Modal>
  );
};

const FormRow = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div style={{ marginBottom: 14, flex: 1, minWidth: 180, maxWidth: '100%', overflow: 'hidden' }}>
    <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
      {label}
      {required && <span aria-hidden style={{ color: 'var(--ant-color-error, #ff4d4f)' }}> *</span>}
    </Typography.Text>
    {children}
  </div>
);
