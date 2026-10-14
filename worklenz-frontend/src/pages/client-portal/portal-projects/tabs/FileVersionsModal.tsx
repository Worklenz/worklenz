import { useTranslation } from 'react-i18next';
import { Alert, Button, Empty, Flex, Modal, theme } from '@/shared/antd-imports';
import { useGetFileVersionsQuery } from '@/api/client-portal/portal-projects-api';
import { StatusTag, formatPortalDate } from '@/components/client-portal/v2';
import type { PortalFile } from '@/types/client-portal/v2';
import { PortalLoader } from '@/components/client-portal/v2';

interface FileVersionsModalProps {
  file: PortalFile;
  onClose: () => void;
}

/** Every version of a file, newest first, with the approval that covers it (if any). */
export const FileVersionsModal = ({ file, onClose }: FileVersionsModalProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-projects');
  const { token } = theme.useToken();
  const query = useGetFileVersionsQuery(file.id);
  const versions = [...(query.data?.body ?? [])].sort((a, b) => b.version - a.version);

  const renderBody = () => {
    if (query.isLoading) return <PortalLoader />;
    if (query.isError) {
      return (
        <Alert
          type="error"
          showIcon
          message={t('files.versions.loadFailed', { defaultValue: 'The version history could not be loaded.' })}
          action={
            <Button size="small" onClick={() => query.refetch()}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      );
    }
    if (versions.length === 0) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('files.versions.empty', { defaultValue: 'No versions yet.' })} />;
    }
    return versions.map(version => (
      <Flex
        key={version.version}
        justify="space-between"
        align="center"
        gap={8}
        wrap="wrap"
        style={{ padding: '9px 0', borderBottom: `1px solid ${token.colorBorderSecondary}`, fontSize: 13 }}
      >
        <Flex align="center" gap={6} wrap="wrap">
          <strong>{t('files.versions.number', { version: version.version, defaultValue: 'v{{version}}' })}</strong>
          {version.is_current && <StatusTag tone="blue">{t('files.versions.current', { defaultValue: 'Current' })}</StatusTag>}
          {version.approval_ref_no && <StatusTag tone="green">{version.approval_ref_no}</StatusTag>}
        </Flex>
        <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>
          {version.uploaded_by} · {formatPortalDate(version.uploaded_at, i18n.language)}
        </span>
      </Flex>
    ));
  };

  return (
    <Modal
      open
      onCancel={onClose}
      footer={null}
      width={460}
      destroyOnHidden
      title={t('files.versions.title', { name: file.name, defaultValue: 'Version history · {{name}}' })}
    >
      {renderBody()}
    </Modal>
  );
};
