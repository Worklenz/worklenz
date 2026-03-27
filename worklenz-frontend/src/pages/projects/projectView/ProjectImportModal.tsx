import React from 'react';
import { Modal, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import ImportExportSettings from '@/pages/settings/import-export/ImportExportSettings';

interface ProjectImportModalProps {
  open: boolean;
  onClose: () => void;
}

export const ProjectImportModal: React.FC<ProjectImportModalProps> = ({ open, onClose }) => {
  const { t } = useTranslation('settings/import-export');
  const modalTitle = (
    <div>
      <Typography.Title level={2} style={{ margin: 0 }}>
        {t('importHeader', { defaultValue: 'Create a project by importing tasks' })}
      </Typography.Title>
      <Typography.Paragraph style={{ margin: '4px 0 0 0' }}>
        {t('importSubHeader', {
          defaultValue: 'Import from Asana, Jira, Trello, Monday.com, or CSV.',
        })}
      </Typography.Paragraph>
    </div>
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      title={modalTitle}
      styles={{
        header: {
          paddingBottom: 8,
        },
        body: {
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
      destroyOnHidden
    >
      <ImportExportSettings showHeader={false} />
    </Modal>
  );
};

export default ProjectImportModal;
