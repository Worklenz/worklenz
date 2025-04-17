import { Tooltip, Typography } from 'antd';
import { durationDateFormat } from '@/utils/durationDateFormat';
import { formatDate } from '@/utils/timeUtils';

const TaskListLastUpdatedCell = ({ lastUpdated }: { lastUpdated: string | null }) => {
  return (
    <Tooltip title={lastUpdated ? formatDate(new Date(lastUpdated)) : 'N/A'}>
      <Typography.Text>{durationDateFormat(lastUpdated || null)}</Typography.Text>
    </Tooltip>
  );
};

export default TaskListLastUpdatedCell;
