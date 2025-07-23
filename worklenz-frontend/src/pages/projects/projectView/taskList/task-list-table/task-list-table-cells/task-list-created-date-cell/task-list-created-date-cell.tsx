import { Tooltip, Typography } from '@/shared/antd-imports';
import { durationDateFormat } from '@/utils/durationDateFormat';
import { formatDate } from '@/utils/timeUtils';

const TaskListCreatedDateCell = ({ createdDate }: { createdDate: string | null }) => {
  return (
    <Tooltip title={createdDate ? formatDate(new Date(createdDate)) : 'N/A'}>
      <Typography.Text>{durationDateFormat(createdDate || null)}</Typography.Text>
    </Tooltip>
  );
};

export default TaskListCreatedDateCell;
