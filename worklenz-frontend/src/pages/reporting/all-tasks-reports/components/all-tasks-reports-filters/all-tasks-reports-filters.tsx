import { memo, useCallback, useMemo } from 'react';
import { Flex } from '@/shared/antd-imports';
import AllTasksTeamFilter from './all-tasks-team-filter';
import AllTasksProjectFilter from './all-tasks-project-filter';
import AllTasksStatusFilter from './all-tasks-status-filter';
import AllTasksPriorityFilter from './all-tasks-priority-filter';
import AllTasksAssigneeFilter from './all-tasks-assignee-filter';
// TODO: Implement group by functionality with backend support
// import AllTasksGroupByDropdown from './all-tasks-group-by-dropdown';
import AllTasksShowFieldsDropdown from './all-tasks-show-fields-dropdown';
import CustomSearchbar from '@/components/CustomSearchbar';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  fetchAllTasks,
  setSearchQuery,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';
import './all-tasks-reports-filters.css';
import AllTasksPhaseFilter from './all-tasks-phase-filter';
import AllTasksClientFilter from './all-tasks-client-filter';

const AllTasksReportsFilters = () => {
  const dispatch = useAppDispatch();
  const { searchQuery } = useAppSelector(state => state.allTasksReportsReducer);

  const handleSearchQueryChange = useCallback(
    (text: string) => {
      dispatch(setSearchQuery(text));
      dispatch(fetchAllTasks());
    },
    [dispatch]
  );

  const filterDropdowns = useMemo(
    () => (
      <Flex gap={8} wrap="wrap" align="center" className="all-tasks-filters-left">
        <AllTasksTeamFilter />
        <AllTasksProjectFilter />
        <AllTasksStatusFilter />
        <AllTasksPriorityFilter />
        <AllTasksAssigneeFilter />
        <AllTasksPhaseFilter />
        <AllTasksClientFilter />
      </Flex>
    ),
    []
  );

  const rightControls = useMemo(
    () => (
      <Flex gap={12} align="center" className="all-tasks-filters-right">
        {/* TODO: Implement group by functionality with backend support */}
        {/* <AllTasksGroupByDropdown /> */}
        <AllTasksShowFieldsDropdown />
        <CustomSearchbar
          placeholderText="Search by task name, key, or description"
          searchQuery={searchQuery}
          setSearchQuery={handleSearchQueryChange}
        />
      </Flex>
    ),
    [searchQuery, handleSearchQueryChange]
  );

  return (
    <Flex gap={24} align="center" justify="space-between" wrap="wrap" className="all-tasks-filters">
      {filterDropdowns}
      {rightControls}
    </Flex>
  );
};

export default memo(AllTasksReportsFilters);
