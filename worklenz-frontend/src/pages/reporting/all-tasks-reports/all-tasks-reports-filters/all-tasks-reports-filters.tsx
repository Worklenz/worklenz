import { memo, useMemo } from 'react';
import { Flex } from '@/shared/antd-imports';
import AllTasksTeamFilter from './all-tasks-team-filter';
import AllTasksProjectFilter from './all-tasks-project-filter';
import AllTasksStatusFilter from './all-tasks-status-filter';
import AllTasksPriorityFilter from './all-tasks-priority-filter';
import AllTasksAssigneeFilter from './all-tasks-assignee-filter';
// TODO: Implement group by functionality with backend support
// import AllTasksGroupByDropdown from './all-tasks-group-by-dropdown';
import AllTasksShowFieldsDropdown from './all-tasks-show-fields-dropdown';
import './all-tasks-reports-filters.css';

const AllTasksReportsFilters = () => {
  const filterDropdowns = useMemo(
    () => (
      <Flex gap={6} wrap="wrap" align="center" className="all-tasks-filters-left">
        <AllTasksTeamFilter />
        <AllTasksProjectFilter />
        <AllTasksStatusFilter />
        <AllTasksPriorityFilter />
        <AllTasksAssigneeFilter />
      </Flex>
    ),
    []
  );

  const rightControls = useMemo(
    () => (
      <Flex gap={6} align="center" className="all-tasks-filters-right">
        {/* TODO: Implement group by functionality with backend support */}
        {/* <AllTasksGroupByDropdown /> */}
        <AllTasksShowFieldsDropdown />
      </Flex>
    ),
    []
  );

  return (
    <Flex gap={12} align="center" justify="space-between" wrap="wrap" className="all-tasks-filters">
      {filterDropdowns}
      {rightControls}
    </Flex>
  );
};

export default memo(AllTasksReportsFilters);
