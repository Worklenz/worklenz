import { Tooltip, Typography } from '@/shared/antd-imports';
import React from 'react';

const LastActivityCell = ({ activity }: { activity: string }) => {
  return (
    <Tooltip title={activity?.length > 0 && activity}>
      <Typography.Text
        style={{ cursor: 'pointer' }}
        ellipsis={{ expanded: false }}
        className="group-hover:text-[#1890ff]"
      >
        {activity ? activity : '-'}
      </Typography.Text>
    </Tooltip>
  );
};

export default LastActivityCell;
