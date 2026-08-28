import React from 'react';

import { IProjectViewModel } from '@/types/project/projectViewModel.types';

const EMPTY_STYLE: React.CSSProperties = { color: 'var(--ant-color-text-quaternary)' };

const BADGE_STYLE: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 400,
  color: '#fff',
};

interface ProjectPriorityCellProps {
  record: IProjectViewModel;
  /**
   * Passed down rather than read per cell: the column builder subscribes to the
   * theme once for the whole table, so switching themes doesn't cost one store
   * subscription (or one `document.documentElement` read) per visible row.
   */
  isDarkMode: boolean;
}

const ProjectPriorityCellComponent: React.FC<ProjectPriorityCellProps> = ({
  record,
  isDarkMode,
}) => {
  if (!record.priority_name) return <span style={EMPTY_STYLE}>—</span>;

  const background =
    (isDarkMode ? record.priority_color_dark : record.priority_color) ??
    record.priority_color ??
    'transparent';

  return <span style={{ ...BADGE_STYLE, background }}>{record.priority_name}</span>;
};

export const ProjectPriorityCell = React.memo(ProjectPriorityCellComponent);
ProjectPriorityCell.displayName = 'ProjectPriorityCell';
