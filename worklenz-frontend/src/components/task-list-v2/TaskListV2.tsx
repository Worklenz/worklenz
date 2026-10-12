import type { ReactNode } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import ImprovedTaskFilters from '../task-management/improved-task-filters';
import TaskListV2Section from './TaskListV2Table';
import type { TaskListMode } from '@/features/task-management/task-list-mode-context';
import { TaskListModeContext } from '@/features/task-management/task-list-mode-context';

interface TaskListV2Props {
  mode?: TaskListMode;
  /** Rendered between the filter toolbar and the table. */
  belowToolbar?: ReactNode;
}

const TaskListV2: React.FC<TaskListV2Props> = ({ mode = 'default', belowToolbar }) => {
  const { project } = useAppSelector(state => state.projectReducer);
  const isGuest = project?.is_guest === true;

  return (
    <TaskListModeContext.Provider value={mode}>
      <div>
        <div className="flex-none" style={{ minHeight: '54px', flexShrink: 0 }}>
          <ImprovedTaskFilters position="list" mode={mode} />
        </div>
        {belowToolbar}
        <TaskListV2Section isGuest={isGuest} />
      </div>
    </TaskListModeContext.Provider>
  );
};

export default TaskListV2;
