import { memo } from 'react';
import { Button, Card, Checkbox, Dropdown, Flex } from '@/shared/antd-imports';
import { CaretDownFilled } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { toggleColumnVisibility } from '@/features/reporting/allTasksReports/all-tasks-reports-slice';

const AllTasksShowFieldsDropdown = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();
  const { visibleColumns } = useAppSelector(state => state.allTasksReportsReducer);

  const allColumns = [
    { key: 'taskName', label: t('taskNameColumn', { defaultValue: 'Task' }) },
    { key: 'taskKey', label: t('taskKeyColumn', { defaultValue: 'Key' }) },
    { key: 'project', label: t('projectColumn', { defaultValue: 'Project' }) },
    { key: 'status', label: t('statusColumn', { defaultValue: 'Status' }) },
    { key: 'priority', label: t('priorityColumn', { defaultValue: 'Priority' }) },
    { key: 'assignees', label: t('assigneesColumn', { defaultValue: 'Assignees' }) },
    { key: 'startDate', label: t('startDateColumn', { defaultValue: 'Start Date' }) },
    { key: 'dueDate', label: t('dueDateColumn', { defaultValue: 'Due Date' }) },
    { key: 'createdDate', label: t('createdDateColumn', { defaultValue: 'Created' }) },
    { key: 'completedDate', label: t('completedDateColumn', { defaultValue: 'Completed' }) },
    { key: 'lastUpdated', label: t('lastUpdatedColumn', { defaultValue: 'Last Updated' }) },
    { key: 'daysOverdue', label: t('daysOverdueColumn', { defaultValue: 'Days Overdue' }) },
    { key: 'estimatedTime', label: t('estimatedTimeColumn', { defaultValue: 'Estimated' }) },
    { key: 'loggedTime', label: t('loggedTimeColumn', { defaultValue: 'Logged' }) },
    { key: 'overloggedTime', label: t('overloggedTimeColumn', { defaultValue: 'Overlogged' }) },
    { key: 'phase', label: t('phaseColumn', { defaultValue: 'Phase' }) },
    { key: 'labels', label: t('labelsColumn', { defaultValue: 'Labels' }) },
    { key: 'progress', label: t('progressColumn', { defaultValue: 'Progress' }) },
    { key: 'subtasksCount', label: t('subtasksCountColumn', { defaultValue: 'Subtasks' }) },
    { key: 'client', label: t('clientColumn', { defaultValue: 'Client' }) },
  ];

  const handleToggle = (columnKey: string) => {
    dispatch(toggleColumnVisibility(columnKey));
  };

  const dropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 220 } }}>
      <Flex vertical gap={4} style={{ maxHeight: 300, overflowY: 'auto' }}>
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
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
    >
      <Button>
        <Flex align="center" gap={4}>
          {t('showFields', { defaultValue: 'Show Fields' })}
          <CaretDownFilled />
        </Flex>
      </Button>
    </Dropdown>
  );
};

export default memo(AllTasksShowFieldsDropdown);
