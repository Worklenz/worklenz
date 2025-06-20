import Tag from 'antd/es/tag';
import Tooltip from 'antd/es/tooltip';
import React from 'react';

const TaskListTaskIdCell = ({ taskId }: { taskId: string | null }) => {
  return (
    <Tooltip title={taskId} className="flex justify-center">
      <Tag>{taskId}</Tag>
    </Tooltip>
  );
};

export default TaskListTaskIdCell;
