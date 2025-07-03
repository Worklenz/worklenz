import { Typography } from 'antd';
import React from 'react';

type ProjectUpdateCellProps = {
  updates: string;
};

const ProjectUpdateCell = ({ updates }: ProjectUpdateCellProps) => {
  return (
    <Typography.Text
      style={{ cursor: 'pointer' }}
      ellipsis={{ expanded: false }}
      className="group-hover:text-[#1890ff]"
    >
      <div dangerouslySetInnerHTML={{ __html: updates }} />
    </Typography.Text>
  );
};

export default ProjectUpdateCell;
