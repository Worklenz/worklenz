import { Tooltip, Typography } from '@/shared/antd-imports';
import React from 'react';
import { durationDateFormat } from '@/utils/durationDateFormat';
import { formatDate } from '@/utils/timeUtils';

const TaskListCompletedDateCell = ({ completedDate }: { completedDate: string | null }) => {
  return (
    <Tooltip title={completedDate ? formatDate(new Date(completedDate)) : 'N/A'}>
      <Typography.Text>{durationDateFormat(completedDate || null)}</Typography.Text>
    </Tooltip>
  );
};

export default TaskListCompletedDateCell;
