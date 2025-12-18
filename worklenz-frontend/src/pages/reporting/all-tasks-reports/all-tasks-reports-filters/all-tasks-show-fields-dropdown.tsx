import { memo } from 'react';
import { Button, Checkbox, Dropdown, Flex } from '@/shared/antd-imports';
import { CaretDownFilled } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  toggleColumnVisibility,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';

const AllTasksShowFieldsDropdown = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();
  const { visibleColumns } = useAppSelector(state => state.allTasksReportsReducer);

  const allColumns = [
    { key: 'taskName', label: t('taskNameColumn') },
    { key: 'taskKey', label: t('taskKeyColumn') },
    { key: 'project', label: t('projectColumn') },
    { key: 'status', label: t('statusColumn') },
    { key: 'priority', label: t('priorityColumn') },
    { key: 'assignees', label: t('assigneesColumn') },
    { key: 'startDate', label: t('startDateColumn') },
    { key: 'dueDate', label: t('dueDateColumn') },
    { key: 'createdDate', label: t('createdDateColumn') },
    { key: 'completedDate', label: t('completedDateColumn') },
    { key: 'lastUpdated', label: t('lastUpdatedColumn') },
    { key: 'daysOverdue', label: t('daysOverdueColumn') },
    { key: 'estimatedTime', label: t('estimatedTimeColumn') },
    { key: 'loggedTime', label: t('loggedTimeColumn') },
    { key: 'overloggedTime', label: t('overloggedTimeColumn') },
    { key: 'phase', label: t('phaseColumn') },
    { key: 'labels', label: t('labelsColumn') },
    { key: 'progress', label: t('progressColumn') },
    { key: 'subtasksCount', label: t('subtasksCountColumn') },
  ];

  const handleToggle = (columnKey: string) => {
    dispatch(toggleColumnVisibility(columnKey));
  };

  const dropdownContent = (
    <Flex vertical gap={4} style={{ padding: 12, minWidth: 180, maxHeight: 300, overflowY: 'auto' }}>
      {allColumns.map(column => (
        <Checkbox
          key={column.key}
          checked={visibleColumns.includes(column.key)}
          onChange={() => handleToggle(column.key)}
          disabled={column.key === 'taskName'}
        >
          {column.label}
        </Checkbox>
      ))}
    </Flex>
  );

  return (
    <Dropdown
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
    >
      <Button>
        <Flex align="center" gap={4}>
          {t('showFields')}
          <CaretDownFilled />
        </Flex>
      </Button>
    </Dropdown>
  );
};

export default memo(AllTasksShowFieldsDropdown);
