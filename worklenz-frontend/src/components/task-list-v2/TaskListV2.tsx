import React, { useEffect } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchStatusesCategories } from '@/features/taskAttributes/taskStatusSlice';
import ImprovedTaskFilters from "../task-management/improved-task-filters";
import TaskListV2Section from "./TaskListV2Table";

const TaskListV2: React.FC = () => {
  const dispatch = useAppDispatch();
  const { statusCategories } = useAppSelector(state => state.taskStatusReducer);

  useEffect(() => {
    // Fetch status categories if not already loaded
    if (!statusCategories.length) {
      dispatch(fetchStatusesCategories());
    }
  }, [dispatch, statusCategories.length]);

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
