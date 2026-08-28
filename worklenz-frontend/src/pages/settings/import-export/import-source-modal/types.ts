import React from 'react';

export interface ImportSource {
  key: string;
  label: string;
  icon: React.ReactNode;
}

export interface ImportSourceModalProps {
  open: boolean;
  onClose: () => void;
  source: ImportSource | null;
  /**
   * Allows another creation surface to own the target project's configuration.
   * The import job is not attached until the user completes the CSV flow.
   */
  createTargetProject?: () => Promise<string>;
  initialProjectName?: string;
  hideProjectSetup?: boolean;
  onImportStarted?: (projectId: string) => void;
}

export interface ClickupTeam {
  id: string;
  name: string;
  spaces: Array<{
    id: string;
    name: string;
    lists: Array<{ id: string; name: string }>;
  }>;
}
