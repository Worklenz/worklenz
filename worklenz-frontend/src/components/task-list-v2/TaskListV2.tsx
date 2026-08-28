import { useAppSelector } from '@/hooks/useAppSelector';
import ImprovedTaskFilters from '../task-management/improved-task-filters';
import TaskListV2Section from './TaskListV2Table';

const TaskListV2: React.FC = () => {
  const { project } = useAppSelector(state => state.projectReducer);
  const isGuest = project?.is_guest === true;

  return (
    <div>
      {/* Task Filters */}
      <div className="flex-none" style={{ minHeight: '54px', flexShrink: 0 }}>
        <ImprovedTaskFilters position="list" />
      </div>
      <TaskListV2Section isGuest={isGuest} />
    </div>
  );
};

export default TaskListV2;
