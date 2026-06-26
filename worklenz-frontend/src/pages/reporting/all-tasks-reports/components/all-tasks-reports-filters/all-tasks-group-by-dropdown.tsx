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
    { key: 'none', value: 'none', label: t('noGrouping') },
    { key: 'project', value: 'project', label: t('groupByProject') },
    { key: 'status', value: 'status', label: t('groupByStatus') },
    { key: 'priority', value: 'priority', label: t('groupByPriority') },
    { key: 'assignee', value: 'assignee', label: t('groupByAssignee') },
    { key: 'dueDate', value: 'dueDate', label: t('groupByDueDate') },
    { key: 'phase', value: 'phase', label: t('groupByPhase') },
  ];

  const handleChange = (value: string) => {
    dispatch(setGroupBy(value as AllTasksGroupBy));
    dispatch(fetchAllTasks());
  };

  return (
    <Flex align="center" gap={4}>
      {t('groupBy')}
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
