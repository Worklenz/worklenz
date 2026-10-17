import React from 'react';
import ImportSourceModal from '@/pages/settings/import-export/ImportSourceModal';
import { AVAILABLE_IMPORT_SOURCES } from '@/pages/settings/import-export/import-source-modal/source-icons';
import type { ImportSource } from '@/pages/settings/import-export/import-source-modal/types';

interface ProjectImportModalProps {
  open: boolean;
  onClose: () => void;
  defaultSource?: string | ImportSource | null;
}

export const ProjectImportModal: React.FC<ProjectImportModalProps> = ({
  open,
  onClose,
  defaultSource = null,
}) => {
  const resolvedSource = React.useMemo(() => {
    if (!defaultSource) return null;
    if (typeof defaultSource === 'string') {
      return AVAILABLE_IMPORT_SOURCES.find(s => s.key === defaultSource) || null;
    }
    return defaultSource;
  }, [defaultSource]);

  return <ImportSourceModal open={open} onClose={onClose} source={resolvedSource} />;
};

export default ProjectImportModal;
