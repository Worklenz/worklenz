import { Typography } from '@/shared/antd-imports';
import React, { memo } from 'react';

const ProjectClientCell = memo(({ client }: { client: string }) => {
  return (
    <Typography.Text
      style={{ cursor: 'pointer' }}
      ellipsis={{ expanded: false }}
      className="group-hover:text-[#1890ff]"
    >
      {client ? client : '-'}
    </Typography.Text>
  );
});

export default ProjectClientCell;
