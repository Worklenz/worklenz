import { Tag, Tooltip } from '@/shared/antd-imports';
import React from 'react';

const TaskListTaskIdCell = ({ taskId }: { taskId: string | null }) => {
  return (
    <Tooltip title={taskId} className="flex justify-center">
      <Tag>{taskId}</Tag>
    </Tooltip>
  );
};

export default TaskListTaskIdCell;
