import { Checkbox, Flex, Typography } from '@/shared/antd-imports';
import SearchDropdown from './SearchDropdown';
import SortFilterDropdown from './SortFilterDropdown';
import LabelsFilterDropdown from './LabelsFilterDropdown';
import MembersFilterDropdown from './MembersFilterDropdown';
import GroupByFilterDropdown from './GroupByFilterDropdown';
import ShowFieldsFilterDropdown from './ShowFieldsFilterDropdown';
import PriorityFilterDropdown from './PriorityFilterDropdown';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useEffect } from 'react';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import { fetchLabels } from '@/features/taskAttributes/taskLabelSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';

interface TaskListFiltersProps {
  position: 'board' | 'list';
}

const TaskListFilters: React.FC<TaskListFiltersProps> = ({ position }) => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();

  // Selectors
  const priorities = useAppSelector(state => state.priorityReducer.priorities);
  const labels = useAppSelector(state => state.taskLabelsReducer.labels);

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!priorities.length) {
        await dispatch(fetchPriorities());
      }
      if (!labels.length) {
        await dispatch(fetchLabels());
      }
    };

    fetchInitialData();
  }, [dispatch, priorities.length, labels.length]);

  return (
    <Flex gap={8} align="center" justify="space-between">
      <Flex gap={8} wrap={'wrap'}>
        {/* search dropdown  */}
        <SearchDropdown />
        {/* sort dropdown  */}
        <SortFilterDropdown />
        {/* prioriy dropdown  */}
        <PriorityFilterDropdown priorities={priorities} />
        {/* labels dropdown  */}
        <LabelsFilterDropdown labels={labels} />
        {/* members dropdown  */}
        <MembersFilterDropdown />
        {/* group by dropdown */}
        {<GroupByFilterDropdown position={position} />}
      </Flex>

      {position === 'list' && (
        <Flex gap={12} wrap={'wrap'}>
          <Flex gap={4} align="center">
            <Checkbox />
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
