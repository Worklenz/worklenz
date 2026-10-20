import { Typography } from '@/shared/antd-imports';
import React from 'react';
import { decodeHtmlEntities } from '@/utils/html-entities';

const ProjectClientCell = ({ client }: { client: string }) => {
  const decodedClient = client ? decodeHtmlEntities(client) : '';
  return (
    <Typography.Text
      style={{ cursor: 'pointer' }}
      ellipsis={{ expanded: false }}
      className="group-hover:text-[#1890ff]"
    >
      {decodedClient || '-'}
    </Typography.Text>
  );
};

export default ProjectClientCell;
