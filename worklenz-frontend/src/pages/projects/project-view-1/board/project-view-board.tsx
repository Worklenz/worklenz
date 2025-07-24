import React, { useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

import { useAppSelector } from '@/hooks/useAppSelector';
import TaskListFilters from '../taskList/taskListFilters/TaskListFilters';
import { Button, Skeleton } from '@/shared/antd-imports';
import { PlusOutlined } from '@/shared/antd-imports';
import { useDispatch } from 'react-redux';
import { toggleDrawer } from '@/features/projects/status/StatusSlice';
import KanbanGroup from '@/components/board/kanban-group/kanban-group';

const ProjectViewBoard: React.FC = () => {
  const dispatch = useDispatch();

  const { taskGroups, loadingGroups } = useAppSelector(state => state.taskReducer);
  const { statusCategories } = useAppSelector(state => state.taskStatusReducer);
  const groupBy = useAppSelector(state => state.groupByFilterDropdownReducer.groupBy);
  const projectId = useAppSelector(state => state.projectReducer.projectId);

  useEffect(() => {
    console.log('projectId', projectId);
    // if (projectId) {
    //   const config: ITaskListConfigV2 = {
    //     id: projectId,
    //     field: 'id',
    //     order: 'desc',
    //     search: '',
    //     statuses: '',
    //     members: '',
    //     projects: '',
    //     isSubtasksInclude: false,
    //   };
    //   dispatch(fetchTaskGroups(config) as any);
    // }
    // if (!statusCategories.length) {
    //   dispatch(fetchStatusesCategories() as any);
    // }
  }, [dispatch, projectId, groupBy]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeTask = active.data.current?.task;
    const overId = over.id;

    // Find which group the task is being dragged over
    const targetGroup = taskGroups.find(
      group => group.id === overId || group.tasks.some(task => task.id === overId)
    );

    if (targetGroup && activeTask) {
      // Here you would dispatch an action to update the task's status
      // For example:
      // dispatch(updateTaskStatus({ taskId: activeTask.id, newStatus: targetGroup.id }));
      console.log('Moving task', activeTask.id, 'to group', targetGroup.id);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeTask = active.data.current?.task;
    const overId = over.id;

    // Similar to handleDragOver, but this is where you'd make the final update
    const targetGroup = taskGroups.find(
      group => group.id === overId || group.tasks.some(task => task.id === overId)
    );

    if (targetGroup && activeTask) {
      // Make the final update to your backend/state
      console.log('Final move of task', activeTask.id, 'to group', targetGroup.id);
    }
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      <TaskListFilters position={'board'} />

      <Skeleton active loading={loadingGroups}>
        <div
          style={{
            width: '100%',
            padding: '0 12px',
            display: 'flex',
            justifyContent: 'center',
            flexDirection: 'column',
            marginTop: '14px',
          }}
        >
          <DndContext sensors={sensors} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <div
              style={{
                paddingTop: '6px',
                display: 'flex',
                gap: '10px',
                overflowX: 'scroll',
                paddingBottom: '10px',
              }}
            >
              {taskGroups.map(group => (
                <KanbanGroup
                  key={group.id}
                  title={group.name}
                  tasks={group.tasks}
                  id={group.id}
                  color={group.color_code}
                />
              ))}

              <Button
                icon={<PlusOutlined />}
                onClick={() => dispatch(toggleDrawer())}
                style={{ flexShrink: 0 }}
              />
            </div>
          </DndContext>
        </div>
      </Skeleton>
    </div>
  );
};

export default ProjectViewBoard;
