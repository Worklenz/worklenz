import { Badge, Flex, Space, Tooltip, Typography } from '@/shared/antd-imports';
import React from 'react';

type ProjectCellProps = {
  projectId: string;
  project: string;
  projectColor: string;
};

const ProjectCell = ({ project, projectColor }: ProjectCellProps) => {
  return (
    <Tooltip title={project}>
      <Flex gap={16} align="center" justify="space-between">
        <Space>
          <Badge color={projectColor} />
          <Typography.Text
            style={{ width: 160 }}
            ellipsis={{ expanded: false }}
            className="group-hover:text-[#1890ff]"
          >
            {project}
          </Typography.Text>
        </Space>
      </Flex>
    </Tooltip>
  );
};

export default ProjectCell;
