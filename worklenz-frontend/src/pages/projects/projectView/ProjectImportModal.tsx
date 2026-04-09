import React from 'react';
import ImportSourceModal from '@/pages/settings/import-export/ImportSourceModal';

interface ProjectImportModalProps {
  open: boolean;
  onClose: () => void;
}

export const ProjectImportModal: React.FC<ProjectImportModalProps> = ({ open, onClose }) => {
  return <ImportSourceModal open={open} onClose={onClose} source={null} />;
};

export default ProjectImportModal;
