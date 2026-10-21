import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Modal, Progress, Select, Typography, message, theme } from '@/shared/antd-imports';
import PillToggle from '@/pages/home/PillToggle';
import projectFilesApiService from '@/api/projects/project-files.api.service';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import {
  useConfirmFileVersionMutation,
  useConfirmPortalFileMutation,
  usePresignFileVersionMutation,
  usePresignPortalFileMutation,
} from '@/api/client-portal/portal-projects-api';
import { formatFileSize, getUploadProblem } from '@/components/client-portal/v2/file-rules';
import { FILE_CATEGORIES, type FileCategory, type PortalFile, type PortalProject, type PortalVisibility } from '@/types/client-portal/v2';

interface UploadFileModalProps {
  project: PortalProject;
  /** The file to add a new version to, or null to upload a brand-new file. */
  replacing: PortalFile | null;
  onClose: () => void;
}

/**
 * Upload a file (Internal Only by default, as a Deliverable) or add a new version to one. The
 * browser sends the bytes straight to storage; the server only issues the link and confirms it landed.
 */
export const UploadFileModal = ({ project, replacing, onClose }: UploadFileModalProps) => {
  const { t } = useTranslation('client-portal-v2-projects');
  const { t: tShared } = useTranslation('client-portal-v2');
  const { token } = theme.useToken();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<FileCategory>('Deliverable');
  const [visibility, setVisibility] = useState<PortalVisibility>('internal');
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const [presignFile] = usePresignPortalFileMutation();
  const [confirmFile] = useConfirmPortalFileMutation();
  const [presignVersion] = usePresignFileVersionMutation();
  const [confirmVersion] = useConfirmFileVersionMutation();

  const problem = file ? getUploadProblem(file) : null;
  const nextVersion = replacing ? replacing.current_version + 1 : null;

  const problemText =
    problem === 'blocked_type'
      ? t('upload.blockedType', { defaultValue: 'This file type is not allowed.' })
      : problem === 'too_large'
        ? t('upload.tooLarge', { defaultValue: 'This file is larger than 250 MB.' })
        : problem === 'empty'
          ? t('upload.empty', { defaultValue: 'This file is empty.' })
          : null;

  const upload = async () => {
    if (!file || problem) return;
    setIsUploading(true);
    setProgress(0);
    const mimeType = file.type || 'application/octet-stream';

    try {
      if (replacing) {
        const presigned = await presignVersion({
          fileId: replacing.id,
          body: { filename: file.name, size: file.size, mime_type: mimeType },
        }).unwrap();
        const target = presigned.body;
        if (!target) throw new Error('No upload link');
        await projectFilesApiService.uploadDirect(target.upload_url, file, setProgress);
        await confirmVersion({ projectId: project.id, fileId: replacing.id, versionId: target.version_id }).unwrap();
        message.success(
          t('upload.versionAdded', {
            name: replacing.name,
            version: target.version,
            defaultValue: '{{name}} is now v{{version}}. Earlier versions are kept, and approvals keep pointing at the version they cover.',
          })
        );
      } else {
        const presigned = await presignFile({
          projectId: project.id,
          body: { filename: file.name, size: file.size, mime_type: mimeType, category, visibility },
        }).unwrap();
        const target = presigned.body;
        if (!target) throw new Error('No upload link');
        await projectFilesApiService.uploadDirect(target.upload_url, file, setProgress);
        await confirmFile({ projectId: project.id, fileId: target.file_id }).unwrap();
        message.success(
          visibility === 'client'
            ? t('upload.addedShared', { name: file.name, defaultValue: '{{name}} uploaded and shared. Client users are notified.' })
            : t('upload.addedInternal', { name: file.name, defaultValue: '{{name}} uploaded as Internal Only.' })
        );
      }
      onClose();
    } catch (error) {
      message.error(
        getPortalErrorMessage(error, t('upload.failed', { defaultValue: 'The file could not be uploaded. Please try again.' }))
      );
      setIsUploading(false);
    }
  };

  return (
    <Modal
      open
      title={
        replacing
          ? t('upload.replaceTitle', { name: replacing.name, defaultValue: 'Replace · {{name}}' })
          : t('upload.title', { defaultValue: 'Upload file' })
      }
      okText={
        replacing
          ? t('upload.uploadVersion', { defaultValue: 'Upload new version' })
          : t('upload.upload', { defaultValue: 'Upload' })
      }
      cancelText={tShared('cancel', { defaultValue: 'Cancel' })}
      onOk={() => void upload()}
      onCancel={isUploading ? undefined : onClose}
      okButtonProps={{ loading: isUploading, disabled: !file || problem !== null }}
      cancelButtonProps={{ disabled: isUploading }}
      maskClosable={false}
      closable={!isUploading}
      width={500}
      destroyOnHidden
    >
      <div
        style={{
          border: `1px dashed ${token.colorBorder}`,
          borderRadius: 8,
          padding: '18px 10px',
          textAlign: 'center',
          marginBottom: 16,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          hidden
          aria-label={t('upload.chooseFile', { defaultValue: 'Choose file' })}
          onChange={event => setFile(event.target.files?.[0] ?? null)}
        />
        <Button icon={<UploadOutlined />} onClick={() => inputRef.current?.click()} disabled={isUploading}>
          {t('upload.chooseFile', { defaultValue: 'Choose file' })}
        </Button>
        <div style={{ fontSize: 12.5, marginTop: 8, fontWeight: 600, wordBreak: 'break-word' }}>
          {file ? `${file.name} (${formatFileSize(file.size)})` : t('upload.noFile', { defaultValue: 'No file chosen' })}
        </div>
        {problemText && <Alert type="error" showIcon message={problemText} style={{ marginTop: 10, textAlign: 'left' }} />}
        {isUploading && <Progress percent={progress} size="small" style={{ marginTop: 10 }} />}
      </div>

      {replacing ? (
        <Alert
          type="info"
          showIcon
          message={t('upload.versionNotice', {
            version: nextVersion ?? 0,
            defaultValue:
              'Saves as v{{version}}. Earlier versions are kept, and an approval keeps pointing at the version that was sent for approval.',
          })}
        />
      ) : (
        <Form layout="vertical">
          <Form.Item label={t('upload.category', { defaultValue: 'Category' })}>
            <Select<FileCategory>
              value={category}
              aria-label={t('upload.category', { defaultValue: 'Category' })}
              onChange={setCategory}
              disabled={isUploading}
              options={FILE_CATEGORIES.map(item => ({ value: item, label: item }))}
            />
          </Form.Item>
          <Form.Item
            label={t('upload.visibility', { defaultValue: 'Visibility' })}
            extra={t('upload.visibilityHint', {
              defaultValue: 'Internal Only by default. A direct file link never bypasses portal permissions.',
            })}
          >
            <PillToggle<PortalVisibility>
              value={visibility}
              onChange={setVisibility}
              ariaLabel={t('upload.visibility', { defaultValue: 'Visibility' })}
              options={[
                { value: 'internal', label: tShared('visibilityInternal', { defaultValue: 'Internal only' }) },
                { value: 'client', label: tShared('visibilityClient', { defaultValue: 'Client visible' }) },
              ]}
            />
          </Form.Item>
        </Form>
      )}
      <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
        {t('upload.limits', { defaultValue: 'Up to 250 MB. Executable and script files are not allowed.' })}
      </Typography.Text>
    </Modal>
  );
};
