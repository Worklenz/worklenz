import React from 'react';
import { Modal } from '@/shared/antd-imports';
import ImportExportSettings from '@/pages/settings/import-export/ImportExportSettings';

interface ProjectImportExportModalProps {
  open: boolean;
  onClose: () => void;
}

export const ProjectImportExportModal: React.FC<ProjectImportExportModalProps> = ({
  open,
  onClose,
}) => {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      title={null}
      styles={{
        body: {
          padding: 0,
          height: 834,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
        content: {
          borderRadius: 20,
          overflow: 'hidden',
        },
      }}
      destroyOnClose
    >
      <ImportExportSettings />
    </Modal>
  );
};

export default ProjectImportExportModal;
