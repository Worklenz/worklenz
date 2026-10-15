import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Flex, Popover, Tooltip } from '@/shared/antd-imports';
import { EyeOutlined } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { toggleColumn, TOGGLEABLE_COLUMNS } from '@/features/reporting/timeInStatus/time-in-status-slice';
import type { TimeInStatusColumnKey } from '@/features/reporting/timeInStatus/time-in-status-slice';

const COLUMN_LABELS: Record<TimeInStatusColumnKey, [string, string]> = {
  taskKey: ['tis.taskKey', 'Key'],
  name: ['tis.task', 'Task'],
  project: ['project', 'Project'],
  status: ['tis.currentStatus', 'Current status'],
  timeInStatus: ['tis.timeInStatus', 'Time in status'],
  timeOverdue: ['tis.timeOverdue', 'Time overdue'],
  assignees: ['tis.assignedTo', 'Assigned to'],
  lastUpdated: ['tis.lastUpdated', 'Last updated'],
};

const TimeInStatusShowFieldsDropdown = () => {
  const { t } = useTranslation('reporting-flow');
  const dispatch = useAppDispatch();
  const columns = useAppSelector(state => state.timeInStatusReducer.columns);
  const label = t('tis.showFields', { defaultValue: 'Show or hide columns' });

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      title={label}
      content={
        <Flex vertical gap={4} className="min-w-[200px]">
          {TOGGLEABLE_COLUMNS.map(key => (
            <Checkbox key={key} checked={columns[key]} onChange={() => dispatch(toggleColumn(key))}>
              {t(COLUMN_LABELS[key][0], { defaultValue: COLUMN_LABELS[key][1] })}
            </Checkbox>
          ))}
        </Flex>
      }
    >
      <Tooltip title={label}>
        <Button icon={<EyeOutlined />} aria-label={label} />
      </Tooltip>
    </Popover>
  );
};

export default memo(TimeInStatusShowFieldsDropdown);
