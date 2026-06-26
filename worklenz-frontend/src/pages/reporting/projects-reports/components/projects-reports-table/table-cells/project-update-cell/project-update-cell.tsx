import { Typography } from '@/shared/antd-imports';
import React from 'react';
import { sanitizeHtml } from '@/utils/sanitizeInput';

type ProjectUpdateCellProps = {
  updates: string;
};

const ProjectUpdateCell = ({ updates }: ProjectUpdateCellProps) => {
  // Sanitize content to prevent XSS attacks
  const sanitizedContent = sanitizeHtml(updates || '');

  return (
    <Typography.Text
      style={{ cursor: 'pointer' }}
      ellipsis={{ expanded: false }}
      className="group-hover:text-[#1890ff]"
    >
      <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
    </Typography.Text>
  );
};

export default ProjectUpdateCell;
