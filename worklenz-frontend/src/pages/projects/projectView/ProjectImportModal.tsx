import React from 'react';
import { Modal } from '@/shared/antd-imports';
import ImportExportSettings from '@/pages/settings/import-export/ImportExportSettings';

interface ProjectImportModalProps {
  open: boolean;
  onClose: () => void;
}

export const ProjectImportModal: React.FC<ProjectImportModalProps> = ({ open, onClose }) => {
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
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
      destroyOnHidden
    >
      <ImportExportSettings />
    </Modal>
  );
};

export default ProjectImportModal;
