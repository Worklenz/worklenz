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

// Import filter components synchronously for better performance
import SearchDropdown from '@components/project-task-filters/filter-dropdowns/search-dropdown';
import SortFilterDropdown from '@components/project-task-filters/filter-dropdowns/sort-filter-dropdown';
import LabelsFilterDropdown from '@components/project-task-filters/filter-dropdowns/labels-filter-dropdown';
import MembersFilterDropdown from '@components/project-task-filters/filter-dropdowns/members-filter-dropdown';
import GroupByFilterDropdown from '@components/project-task-filters/filter-dropdowns/group-by-filter-dropdown';
import ShowFieldsFilterDropdown from '@components/project-task-filters/filter-dropdowns/show-fields-filter-dropdown';
import PriorityFilterDropdown from '@components/project-task-filters/filter-dropdowns/priority-filter-dropdown';

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

  // Optimized filter data loading - staggered and non-blocking
  useEffect(() => {
    const loadFilterData = () => {
      try {
        // Load priorities first (usually cached/fast) - immediate
        if (!priorities.length) {
          dispatch(fetchPriorities());
        }

        if (projectId) {
          // Stagger the loading to prevent overwhelming the server
          // Load project-specific data with delays
          setTimeout(() => {
            dispatch(fetchLabelsByProject(projectId));
          }, 100);

          setTimeout(() => {
            dispatch(fetchTaskAssignees(projectId));
          }, 200);

          // Load team members last (heaviest query)
          setTimeout(() => {
            dispatch(
              getTeamMembers({
                index: 0,
                size: 50, // Reduce initial load size
                field: null,
                order: null,
                search: null,
                all: false, // Don't load all at once
              })
            );
          }, 300);
        }
      } catch (error) {
        console.error('Error loading filter data:', error);
        // Don't throw - filter loading errors shouldn't break the main UI
      }
    };

    // Load immediately without setTimeout to avoid additional delay
    loadFilterData();
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
