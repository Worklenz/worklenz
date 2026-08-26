import React from 'react';
import ImportSourceModal from '@/pages/settings/import-export/ImportSourceModal';

interface ProjectImportModalProps {
  open: boolean;
  onClose: () => void;
  defaultSource?: string | null;
}

export const ProjectImportModal: React.FC<ProjectImportModalProps> = ({
  open,
  onClose,
  defaultSource = null,
}) => {
  return <ImportSourceModal open={open} onClose={onClose} source={defaultSource} />;
};

export default ProjectImportModal;
