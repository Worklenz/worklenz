import type { GroupProps } from 'react-virtuoso';

interface VirtuosoGroupProps extends GroupProps {
  context?: unknown;
}

// Virtuoso measures this wrapper, so retain its data attributes and inline styles.
export const VirtuosoGroup = ({ context: _context, ...props }: VirtuosoGroupProps) => (
  <div {...props} className="virtuoso-group-header-wrapper" />
);

export const TASK_LIST_VIRTUOSO_COMPONENTS = { Group: VirtuosoGroup };
