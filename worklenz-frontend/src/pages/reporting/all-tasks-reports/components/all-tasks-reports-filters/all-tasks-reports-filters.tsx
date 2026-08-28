import { memo, useCallback } from 'react';
import { Flex } from '@/shared/antd-imports';
import AllTasksFilterPanel from './all-tasks-filter-panel';
import AllTasksShowFieldsDropdown from './all-tasks-show-fields-dropdown';
import CustomSearchbar from '@/components/CustomSearchbar';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import {
  fetchAllTasks,
  setSearchQuery,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';

const AllTasksReportsFilters = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-all-tasks');
  const { searchQuery } = useAppSelector(state => state.allTasksReportsReducer);

  const handleSearchQueryChange = useCallback(
    (text: string) => {
      dispatch(setSearchQuery(text));
      dispatch(fetchAllTasks());
    },
    [dispatch]
  );

  return (
    <Flex gap={8} align="center" justify="flex-end" wrap="wrap" style={{ width: '100%' }}>
      <AllTasksFilterPanel />
      <AllTasksShowFieldsDropdown />
      <CustomSearchbar
        placeholderText={t('searchPlaceholder', { defaultValue: 'Search by task name, key, or description' })}
        searchQuery={searchQuery}
        setSearchQuery={handleSearchQueryChange}
      />
    </Flex>
  );
};

export default memo(AllTasksReportsFilters);
