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
