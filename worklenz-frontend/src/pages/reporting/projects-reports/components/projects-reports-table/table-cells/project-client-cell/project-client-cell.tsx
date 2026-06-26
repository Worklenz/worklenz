import { Typography } from '@/shared/antd-imports';
import React from 'react';

const ProjectClientCell = ({ client }: { client: string }) => {
  return (
    <Typography.Text
      style={{ cursor: 'pointer' }}
      ellipsis={{ expanded: false }}
      className="group-hover:text-[#1890ff]"
    >
      {client ? client : '-'}
    </Typography.Text>
  );
};

export default ProjectClientCell;
