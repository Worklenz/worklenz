import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/app/store';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import '../EnhancedKanbanBoard.css';
import '../EnhancedKanbanGroup.css';
import '../EnhancedKanbanTaskCard.css';
import ImprovedTaskFilters from '../../task-management/improved-task-filters';
import Card from 'antd/es/card';
import Spin from 'antd/es/spin';
import Empty from 'antd/es/empty';
import { reorderGroups, reorderEnhancedKanbanGroups, reorderTasks, reorderEnhancedKanbanTasks, fetchEnhancedKanbanLabels, fetchEnhancedKanbanGroups, fetchEnhancedKanbanTaskAssignees } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { fetchStatusesCategories } from '@/features/taskAttributes/taskStatusSlice';
import { useAppSelector } from '@/hooks/useAppSelector';

// Minimal task card for prototype (reuse your styles)
const TaskCard: React.FC<{
  task: IProjectTask;
  onTaskDragStart: (e: React.DragEvent, taskId: string, groupId: string) => void;
  onTaskDragOver: (e: React.DragEvent, groupId: string, taskIdx: number) => void;
  onTaskDrop: (e: React.DragEvent, groupId: string, taskIdx: number) => void;
  groupId: string;
  isDropIndicator: boolean;
  idx: number;
}> = ({ task, onTaskDragStart, onTaskDragOver, onTaskDrop, groupId, isDropIndicator, idx }) => {
  const themeMode = useSelector((state: RootState) => state.themeReducer.mode);
  const background = themeMode === 'dark' ? '#23272f' : '#fff';
  const color = themeMode === 'dark' ? '#fff' : '#23272f';
  return (
    <>
      {isDropIndicator && (
        <div style={{ height: 80, margin: '8px 0', background: themeMode === 'dark' ? '#2a2a2a' : '#f0f0f0', borderRadius: 6, border: `5px` }} />
      )}
      <div
        className="enhanced-kanban-task-card"
        draggable
        onDragStart={e => onTaskDragStart(e, task.id!, groupId)}
        onDragOver={e => onTaskDragOver(e, groupId, idx)}
        onDrop={e => onTaskDrop(e, groupId, idx)}
        style={{ background, color }}
      >
        <div className="task-content">
          <div className="task-title">{task.name}</div>
          <div className="task-key">{task.task_key}</div>
          <div className="task-assignees">
            {task.assignees?.map(a => a.name).join(', ')}
          </div>
        </div>
      </div>
    </>
  );
};

// Minimal group column for prototype
const KanbanGroup: React.FC<{
  group: ITaskListGroup;
  onGroupDragStart: (e: React.DragEvent, groupId: string) => void;
  onGroupDragOver: (e: React.DragEvent) => void;
  onGroupDrop: (e: React.DragEvent, groupId: string) => void;
  onTaskDragStart: (e: React.DragEvent, taskId: string, groupId: string) => void;
  onTaskDragOver: (e: React.DragEvent, groupId: string, taskIdx: number) => void;
  onTaskDrop: (e: React.DragEvent, groupId: string, taskIdx: number) => void;
  hoveredTaskIdx: number | null;
  hoveredGroupId: string | null;
}> = ({ group, onGroupDragStart, onGroupDragOver, onGroupDrop, onTaskDragStart, onTaskDragOver, onTaskDrop, hoveredTaskIdx, hoveredGroupId }) => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const headerBackgroundColor = useMemo(() => {
    if (themeMode === 'dark') {
      return group.color_code_dark || group.color_code || '#1e1e1e';
    }
    return group.color_code || '#f5f5f5';
  }, [themeMode, group.color_code, group.color_code_dark]);
  return (
    <div className="enhanced-kanban-group">
      <div
        className="enhanced-kanban-group-header"
        style={{
          backgroundColor: headerBackgroundColor,
        }}
        draggable
        onDragStart={e => onGroupDragStart(e, group.id)}
        onDragOver={onGroupDragOver}
        onDrop={e => onGroupDrop(e, group.id)}
      >
        <h3>{group.name}</h3>
        <span className="task-count">{group.tasks.length}</span>
      </div>
      <div className="enhanced-kanban-group-tasks"
        // onDragOver={e => onTaskDragOver(e, group.id, 0)}
        // onDrop={e => onTaskDrop(e, group.id, 0)}
      >
        {/* Drop indicator at the top of the group */}
        {hoveredGroupId === group.id && hoveredTaskIdx === 0 && (
          <div className="drop-preview-indicator"><div className="drop-line" /></div>
        )}
        {group.tasks.map((task, idx) => (
          <React.Fragment key={task.id}>
            <TaskCard
              task={task}
              onTaskDragStart={onTaskDragStart}
              onTaskDragOver={onTaskDragOver}
              onTaskDrop={onTaskDrop}
              groupId={group.id}
              isDropIndicator={hoveredGroupId === group.id && hoveredTaskIdx === idx}
              idx={idx}
            />
          </React.Fragment>
        ))}
        {/* Drop indicator at the end of the group */}
        {hoveredGroupId === group.id && hoveredTaskIdx === group.tasks.length && (
          <div className="drop-preview-indicator"><div className="drop-line" /></div>
        )}
      </div>
    </div>
  )
};

const EnhancedKanbanBoardNativeDnD: React.FC<{ projectId: string }> = ({ projectId }) => {
  const dispatch = useDispatch();
  const {
    taskGroups,
    loadingGroups,
    error,
  } = useSelector((state: RootState) => state.enhancedKanbanReducer);
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedTaskGroupId, setDraggedTaskGroupId] = useState<string | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [hoveredTaskIdx, setHoveredTaskIdx] = useState<number | null>(null);
  const [dragType, setDragType] = useState<'group' | 'task' | null>(null);
  const { statusCategories, status: existingStatuses } = useAppSelector((state) => state.taskStatusReducer);
  useEffect(() => {
    if (projectId) {
      dispatch(fetchEnhancedKanbanGroups(projectId) as any);
      // Load filter data for enhanced kanban
      dispatch(fetchEnhancedKanbanTaskAssignees(projectId) as any);
      dispatch(fetchEnhancedKanbanLabels(projectId) as any);
    }

    if (!statusCategories.length) {
      dispatch(fetchStatusesCategories() as any);
    }
  }, [dispatch, projectId]);
  // Reset drag state if taskGroups changes (e.g., real-time update)
  useEffect(() => {
    setDraggedGroupId(null);
    setDraggedTaskId(null);
    setDraggedTaskGroupId(null);
    setHoveredGroupId(null);
    setHoveredTaskIdx(null);
    setDragType(null);
  }, [taskGroups]);

  // Group drag handlers
  const handleGroupDragStart = (e: React.DragEvent, groupId: string) => {
    setDraggedGroupId(groupId);
    setDragType('group');
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleGroupDragOver = (e: React.DragEvent) => {
    if (dragType !== 'group') return;
    e.preventDefault();
  };
  const handleGroupDrop = (e: React.DragEvent, targetGroupId: string) => {
    if (dragType !== 'group') return;
    e.preventDefault();
    if (!draggedGroupId || draggedGroupId === targetGroupId) return;
    // Calculate new order and dispatch
    const fromIdx = taskGroups.findIndex(g => g.id === draggedGroupId);
    const toIdx = taskGroups.findIndex(g => g.id === targetGroupId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reorderedGroups = [...taskGroups];
    const [moved] = reorderedGroups.splice(fromIdx, 1);
    reorderedGroups.splice(toIdx, 0, moved);
    dispatch(reorderGroups({ fromIndex: fromIdx, toIndex: toIdx, reorderedGroups }));
    dispatch(reorderEnhancedKanbanGroups({ fromIndex: fromIdx, toIndex: toIdx, reorderedGroups }) as any);
    setDraggedGroupId(null);
    setDragType(null);
  };

  // Task drag handlers
  const handleTaskDragStart = (e: React.DragEvent, taskId: string, groupId: string) => {
    setDraggedTaskId(taskId);
    setDraggedTaskGroupId(groupId);
    setDragType('task');
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleTaskDragOver = (e: React.DragEvent, groupId: string, taskIdx: number) => {
    if (dragType !== 'task') return;
    e.preventDefault();
    if (draggedTaskId) {
      setHoveredGroupId(groupId);
      setHoveredTaskIdx(taskIdx);
    }
  };
  const handleTaskDrop = (e: React.DragEvent, targetGroupId: string, targetTaskIdx: number) => {
    if (dragType !== 'task') return;
    e.preventDefault();
    if (!draggedTaskId || !draggedTaskGroupId || hoveredGroupId === null || hoveredTaskIdx === null) return;
    // Calculate new order and dispatch
    const sourceGroup = taskGroups.find(g => g.id === draggedTaskGroupId);
    const targetGroup = taskGroups.find(g => g.id === targetGroupId);
    if (!sourceGroup || !targetGroup) return;
    const taskIdx = sourceGroup.tasks.findIndex(t => t.id === draggedTaskId);
    if (taskIdx === -1) return;
    const movedTask = sourceGroup.tasks[taskIdx];
    // Prepare updated task arrays
    const updatedSourceTasks = [...sourceGroup.tasks];
    updatedSourceTasks.splice(taskIdx, 1);
    let insertIdx = targetTaskIdx;
    if (sourceGroup.id === targetGroup.id && taskIdx < insertIdx) {
      insertIdx--;
    }
    if (insertIdx < 0) insertIdx = 0;
    if (insertIdx > targetGroup.tasks.length) insertIdx = targetGroup.tasks.length;
    const updatedTargetTasks = sourceGroup.id === targetGroup.id
      ? [...updatedSourceTasks]
      : [...targetGroup.tasks];
    updatedTargetTasks.splice(insertIdx, 0, movedTask);
    dispatch(reorderTasks({
      activeGroupId: sourceGroup.id,
      overGroupId: targetGroup.id,
      fromIndex: taskIdx,
      toIndex: insertIdx,
      task: movedTask,
      updatedSourceTasks,
      updatedTargetTasks,
    }));
    dispatch(reorderEnhancedKanbanTasks({
      activeGroupId: sourceGroup.id,
      overGroupId: targetGroup.id,
      fromIndex: taskIdx,
      toIndex: insertIdx,
      task: movedTask,
      updatedSourceTasks,
      updatedTargetTasks,
    }) as any);
    setDraggedTaskId(null);
    setDraggedTaskGroupId(null);
    setHoveredGroupId(null);
    setHoveredTaskIdx(null);
    setDragType(null);
  };

  if (error) {
    return (
      <Card>
        <Empty description={`Error loading tasks: ${error}`} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  return (
    <>
      <div className="mb-4">
        <React.Suspense fallback={<div>Loading filters...</div>}>
          <ImprovedTaskFilters position="board" />
        </React.Suspense>
      </div>
      <div className="enhanced-kanban-board">
        {loadingGroups ? (
          <Card>
            <div className="flex justify-center items-center py-8">
              <Spin size="large" />
            </div>
          </Card>
        ) : taskGroups.length === 0 ? (
          <Card>
            <Empty description="No tasks found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </Card>
        ) : (
          <div className="kanban-groups-container">
            {taskGroups.map(group => (
              <KanbanGroup
                key={group.id}
                group={group}
                onGroupDragStart={handleGroupDragStart}
                onGroupDragOver={handleGroupDragOver}
                onGroupDrop={handleGroupDrop}
                onTaskDragStart={handleTaskDragStart}
                onTaskDragOver={handleTaskDragOver}
                onTaskDrop={handleTaskDrop}
                hoveredTaskIdx={hoveredGroupId === group.id ? hoveredTaskIdx : null}
                hoveredGroupId={hoveredGroupId}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default EnhancedKanbanBoardNativeDnD; 