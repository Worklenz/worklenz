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
      width={800}
      title={null}
      bodyStyle={{
        padding: 0,
        height: '80vh', // Strict height
        overflow: 'hidden', // No scroll on modal itself
        display: 'flex',
        flexDirection: 'column',
      }}
      destroyOnClose
    >
      <ImportExportSettings />
    </Modal>
  );
};

export default ProjectImportExportModal;
