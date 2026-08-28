import { Badge, Flex, Space, Tooltip, Typography } from '@/shared/antd-imports';
import React from 'react';
import { decodeHtmlEntities } from '@/utils/html-entities';

type ProjectCellProps = {
  projectId: string;
  project: string;
  projectColor: string;
};

const ProjectCell = ({ project, projectColor }: ProjectCellProps) => {
  const decodedProject = decodeHtmlEntities(project);
  return (
    <Tooltip title={decodedProject}>
      <Flex gap={16} align="center" justify="space-between">
        <Space>
          <Badge color={projectColor} />
          <Typography.Text
            style={{ width: 160 }}
            ellipsis={{ expanded: false }}
            className="group-hover:text-[#1890ff]"
          >
            {decodedProject}
          </Typography.Text>
        </Space>
      </Flex>
    </Tooltip>
  );
};

export default ProjectCell;
