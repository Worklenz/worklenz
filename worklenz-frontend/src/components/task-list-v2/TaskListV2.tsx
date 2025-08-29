import ImprovedTaskFilters from '../task-management/improved-task-filters';
import TaskListV2Section from './TaskListV2Table';

const TaskListV2: React.FC = () => {
  return (
    <div>
      {/* Task Filters */}
      <div className="flex-none" style={{ height: '54px', flexShrink: 0 }}>
        <ImprovedTaskFilters position="list" />
      </div>
      <TaskListV2Section />
    </div>
  );
};

export default TaskListV2;
