import React from 'react';

export const BACKLOG_COLUMN_HEADER_HEIGHT = 32;

/** Keeps sprint headers under the pinned column labels instead of on the first row. */
const BacklogStickyGroup = ({
  style,
  children,
  context: _context,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { context?: unknown }) => (
  <div
    {...rest}
    className="tasklist-backlog-group-header"
    style={{
      ...style,
      top: BACKLOG_COLUMN_HEADER_HEIGHT,
      zIndex: 20,
      backgroundColor: 'var(--tl-backlog-group-header-bg)',
    }}
  >
    {children}
  </div>
);
export const BACKLOG_VIRTUOSO_COMPONENTS = {
  Group: BacklogStickyGroup,
  TopItemList: BacklogStickyGroup,
};
export const DEFAULT_VIRTUOSO_COMPONENTS = {};
