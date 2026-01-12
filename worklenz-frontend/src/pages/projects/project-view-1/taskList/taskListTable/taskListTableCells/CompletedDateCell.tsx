import { Tooltip, Typography } from '@/shared/antd-imports';
import React from 'react';
import { durationDateFormat } from '@/utils/durationDateFormat';
import { formatDate } from '@/utils/timeUtils';

interface CompletedDateCellProps {
  completedDate: string | null;
}

const CompletedDateCell: React.FC<CompletedDateCellProps> = ({ completedDate }) => {
  return (
    <Tooltip title={completedDate ? formatDate(completedDate) : 'N/A'}>
      <Typography.Text>{durationDateFormat(completedDate || null)}</Typography.Text>
    </Tooltip>
  );
};

export default CompletedDateCell;
