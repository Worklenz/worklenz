import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/app/store';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import './EnhancedKanbanBoard.css';
import './EnhancedKanbanGroup.css';
import './EnhancedKanbanTaskCard.css';

// Minimal task card for prototype (reuse your styles)
const TaskCard: React.FC<{
  task: IProjectTask;
  onTaskDragStart: (e: React.DragEvent, taskId: string, groupId: string) => void;
  onTaskDragOver: (e: React.DragEvent, groupId: string, taskIdx: number) => void;
  onTaskDrop: (e: React.DragEvent, groupId: string, taskIdx: number) => void;
  groupId: string;
  isDropIndicator: boolean;
}> = ({ task, onTaskDragStart, onTaskDragOver, onTaskDrop, groupId, isDropIndicator }) => {
  const themeMode = useSelector((state: RootState) => state.themeReducer.mode);
  const background = themeMode === 'dark' ? '#23272f' : '#fff';
  const color = themeMode === 'dark' ? '#fff' : '#23272f';
  return (
    <>
      {isDropIndicator && (
        <div style={{ height: 32, margin: '8px 0', background: themeMode === 'dark' ? '#2a2a2a' : '#f0f0f0', borderRadius: 6, border: `2px dashed ${themeMode === 'dark' ? '#555' : '#bbb'}` }} />
      )}
      <div
        className="enhanced-kanban-task-card"
        draggable
        onDragStart={e => onTaskDragStart(e, task.id!, groupId)}
        onDragOver={e => onTaskDragOver(e, groupId, -1)}
        onDrop={e => onTaskDrop(e, groupId, -1)}
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
}> = ({ group, onGroupDragStart, onGroupDragOver, onGroupDrop, onTaskDragStart, onTaskDragOver, onTaskDrop, hoveredTaskIdx, hoveredGroupId }) => (
  <div
    className="enhanced-kanban-group"
    // Only group header is draggable for group drag
    >
    <div
      className="enhanced-kanban-group-header"
      draggable
      onDragStart={e => onGroupDragStart(e, group.id)}
      onDragOver={onGroupDragOver}
      onDrop={e => onGroupDrop(e, group.id)}
    >
      <h3>{group.name}</h3>
      <span className="task-count">{group.tasks.length}</span>
    </div>
    <div className="enhanced-kanban-group-tasks"
      onDragOver={e => onTaskDragOver(e, group.id, 0)}
      onDrop={e => onTaskDrop(e, group.id, 0)}
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
            isDropIndicator={hoveredGroupId === group.id && hoveredTaskIdx === idx + 1}
          />
        </React.Fragment>
      ))}
      {/* Drop indicator at the end of the group */}
      {hoveredGroupId === group.id && hoveredTaskIdx === group.tasks.length && (
        <div className="drop-preview-indicator"><div className="drop-line" /></div>
      )}
    </div>
  </div>
);

const EnhancedKanbanBoardNativeDnD: React.FC<{ projectId: string }> = ({ projectId }) => {
  // Get initial groups from Redux
  const reduxGroups = useSelector((state: RootState) => state.enhancedKanbanReducer.taskGroups);
  // Local state for groups/tasks
  const [groups, setGroups] = useState<ITaskListGroup[]>([]);
  // Drag state
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedTaskGroupId, setDraggedTaskGroupId] = useState<string | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [hoveredTaskIdx, setHoveredTaskIdx] = useState<number | null>(null);
  const [dragType, setDragType] = useState<'group' | 'task' | null>(null);

  // Sync local state with Redux on mount or when reduxGroups or projectId change
  useEffect(() => {
    setGroups(reduxGroups.map(g => ({ ...g, tasks: [...g.tasks] })));
  }, [reduxGroups, projectId]);

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
    const updated = [...groups];
    const fromIdx = updated.findIndex(g => g.id === draggedGroupId);
    const [moved] = updated.splice(fromIdx, 1);
    const toIdx = updated.findIndex(g => g.id === targetGroupId);
    updated.splice(toIdx, 0, moved);
    setGroups(updated);
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
    const updated = [...groups];
    const sourceGroup = updated.find(g => g.id === draggedTaskGroupId);
    const targetGroup = updated.find(g => g.id === targetGroupId);
    if (!sourceGroup || !targetGroup) return;
    // Remove from source
    const taskIdx = sourceGroup.tasks.findIndex(t => t.id === draggedTaskId);
    if (taskIdx === -1) return;
    const [movedTask] = sourceGroup.tasks.splice(taskIdx, 1);
    // Insert into target at the correct index
    let insertIdx = targetTaskIdx;
    if (sourceGroup.id === targetGroup.id && taskIdx < insertIdx) {
      insertIdx--;
    }
    if (insertIdx < 0) insertIdx = 0;
    if (insertIdx > targetGroup.tasks.length) insertIdx = targetGroup.tasks.length;
    targetGroup.tasks.splice(insertIdx, 0, movedTask);
    setGroups(updated);
    setDraggedTaskId(null);
    setDraggedTaskGroupId(null);
    setHoveredGroupId(null);
    setHoveredTaskIdx(null);
    setDragType(null);
  };

  return (
    <div className="enhanced-kanban-board">
      <div className="kanban-groups-container">
        {groups.map(group => (
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
    </div>
  );
};

export default EnhancedKanbanBoardNativeDnD; 