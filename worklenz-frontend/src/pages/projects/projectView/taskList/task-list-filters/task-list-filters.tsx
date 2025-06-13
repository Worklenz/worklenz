import React, { useEffect } from 'react';
import Flex from 'antd/es/flex';
import Checkbox from 'antd/es/checkbox';
import Typography from 'antd/es/typography';

import { useTranslation } from 'react-i18next';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useFilterDataLoader } from '@/hooks/useFilterDataLoader';
import {
  fetchLabelsByProject,
  fetchTaskAssignees,
  toggleArchived,
} from '@/features/tasks/tasks.slice';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import useTabSearchParam from '@/hooks/useTabSearchParam';

const SearchDropdown = React.lazy(() => import('@components/project-task-filters/filter-dropdowns/search-dropdown'));
const SortFilterDropdown = React.lazy(() => import('@components/project-task-filters/filter-dropdowns/sort-filter-dropdown'));
const LabelsFilterDropdown = React.lazy(() => import('@components/project-task-filters/filter-dropdowns/labels-filter-dropdown'));
const MembersFilterDropdown = React.lazy(() => import('@components/project-task-filters/filter-dropdowns/members-filter-dropdown'));
const GroupByFilterDropdown = React.lazy(() => import('@components/project-task-filters/filter-dropdowns/group-by-filter-dropdown'));
const ShowFieldsFilterDropdown = React.lazy(() => import('@components/project-task-filters/filter-dropdowns/show-fields-filter-dropdown'));
const PriorityFilterDropdown = React.lazy(() => import('@components/project-task-filters/filter-dropdowns/priority-filter-dropdown'));

interface TaskListFiltersProps {
  position: 'board' | 'list';
}

const TaskListFilters: React.FC<TaskListFiltersProps> = ({ position }) => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();
  const { projectView } = useTabSearchParam();

  const priorities = useAppSelector(state => state.priorityReducer.priorities);
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const archived = useAppSelector(state => state.taskReducer.archived);

  const handleShowArchivedChange = () => dispatch(toggleArchived());

  // Load filter data asynchronously and non-blocking
  // This runs independently of the main task list loading
  useEffect(() => {
    const loadFilterData = async () => {
      try {
        // Load priorities first (usually cached/fast)
        if (!priorities.length) {
          dispatch(fetchPriorities());
        }

        // Load project-specific filter data in parallel, but don't await
        // This allows the main task list to load while filters are still loading
        if (projectId) {
          // Fire and forget - these will update the UI when ready
          dispatch(fetchLabelsByProject(projectId));
          dispatch(fetchTaskAssignees(projectId));
        }

        // Load team members (usually needed for member filters)
        dispatch(getTeamMembers({ 
          index: 0, 
          size: 100, 
          field: null, 
          order: null, 
          search: null, 
          all: true 
        }));
      } catch (error) {
        console.error('Error loading filter data:', error);
        // Don't throw - filter loading errors shouldn't break the main UI
      }
    };

    // Use setTimeout to ensure this runs after the main component render
    // This prevents filter loading from blocking the initial render
    const timeoutId = setTimeout(loadFilterData, 0);
    
    return () => clearTimeout(timeoutId);
  }, [dispatch, priorities.length, projectId]);

  return (
    <Flex gap={8} align="center" justify="space-between">
      <Flex gap={8} wrap={'wrap'}>
        <SearchDropdown />
        {projectView === 'list' && <SortFilterDropdown />}
        <PriorityFilterDropdown priorities={priorities} />
        <LabelsFilterDropdown />
        <MembersFilterDropdown />
        <GroupByFilterDropdown />
      </Flex>

      {position === 'list' && (
        <Flex gap={12} wrap={'wrap'}>
          <Flex
            gap={4}
            align="center"
            style={{ cursor: 'pointer' }}
            onClick={handleShowArchivedChange}
          >
            <Checkbox checked={archived} />
            <Typography.Text>{t('showArchivedText')}</Typography.Text>
          </Flex>
          {/* show fields dropdown  */}
          <ShowFieldsFilterDropdown />
        </Flex>
      )}
    </Flex>
  );
};

export default TaskListFilters;
