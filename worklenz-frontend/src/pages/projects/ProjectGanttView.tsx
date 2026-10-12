import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AdvancedGanttChart } from '../../components/advanced-gantt';
import { useAppSelector } from '../../hooks/useAppSelector';
import { GanttTask } from '../../types/advanced-gantt.types';

import { IProjectTask } from '../../types/project/projectTasksViewModel.types';

const ProjectGanttView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  // Get tasks from Redux store
  const tasks = useAppSelector(state => state.taskReducer?.tasks || []);

  // Transform your tasks to GanttTask format
  const ganttTasks = useMemo((): GanttTask[] => {
    return tasks.map((task: IProjectTask) => {
      const statusValue: GanttTask['status'] =
        task.status === 'completed' ||
        task.status === 'in-progress' ||
        task.status === 'on-hold' ||
        task.status === 'overdue'
          ? task.status
          : 'not-started';
      const priorityValue: GanttTask['priority'] =
        task.priority === 'low' ||
        task.priority === 'high' ||
        task.priority === 'critical'
          ? task.priority
          : 'medium';

      const firstAssignee = task.names && task.names.length > 0 ? task.names[0] : undefined;

      return {
        id: task.id || '',
        name: task.name || '',
        startDate: task.start_date ? new Date(task.start_date) : new Date(),
        endDate: task.end_date ? new Date(task.end_date) : new Date(),
        progress: task.progress || 0,
        type: 'task' as const,
        status: statusValue,
        priority: priorityValue,
        assignee: firstAssignee
          ? {
              id: firstAssignee.team_member_id || '',
              name: firstAssignee.name || '',
              avatar: firstAssignee.avatar_url,
            }
          : undefined,
        parent: task.parent_task_id,
        level: 0,
      };
    });
  }, [tasks]);

  const handleTaskUpdate = (taskId: string, updates: Partial<GanttTask>) => {
    // Implement your task update logic here
    console.log('Update task:', taskId, updates);
    // Dispatch Redux action to update task
  };

  const handleTaskMove = (taskId: string, newDates: { start: Date; end: Date }) => {
    // Implement your task move logic here
    console.log('Move task:', taskId, newDates);
    // Dispatch Redux action to update task dates
  };

  return (
    <div className="project-gantt-view h-full">
      <AdvancedGanttChart
        tasks={ganttTasks}
        onTaskUpdate={handleTaskUpdate}
        onTaskMove={handleTaskMove}
        enableDragDrop={true}
        enableResize={true}
        enableProgressEdit={true}
        enableInlineEdit={true}
        className="h-full"
      />
    </div>
  );
};

export default ProjectGanttView;
