import { memo } from 'react';
import { Flex, Select } from '@/shared/antd-imports';
import { CaretDownFilled } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  setGroupBy,
  fetchAllTasks,
  AllTasksGroupBy,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';

const AllTasksGroupByDropdown = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();
  const { groupBy } = useAppSelector(state => state.allTasksReportsReducer);

  const groupByOptions = [
    { key: 'none', value: 'none', label: t('noGrouping', { defaultValue: 'None' }) },
    { key: 'project', value: 'project', label: t('groupByProject', { defaultValue: 'Project' }) },
    { key: 'status', value: 'status', label: t('groupByStatus', { defaultValue: 'Status' }) },
    { key: 'priority', value: 'priority', label: t('groupByPriority', { defaultValue: 'Priority' }) },
    { key: 'assignee', value: 'assignee', label: t('groupByAssignee', { defaultValue: 'Assignee' }) },
    { key: 'dueDate', value: 'dueDate', label: t('groupByDueDate', { defaultValue: 'Due Date' }) },
    { key: 'phase', value: 'phase', label: t('groupByPhase', { defaultValue: 'Phase' }) },
  ];

  const handleChange = (value: string) => {
    dispatch(setGroupBy(value as AllTasksGroupBy));
    dispatch(fetchAllTasks());
  };

  return (
    <Flex align="center" gap={4}>
      {t('groupBy', { defaultValue: 'Group by' })}
      <Select
        value={groupBy}
        options={groupByOptions}
        onChange={handleChange}
        suffixIcon={<CaretDownFilled />}
        style={{ minWidth: 120 }}
      />
    </Flex>
  );
};

export default memo(AllTasksGroupByDropdown);
