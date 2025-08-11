import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AdvancedGanttChart } from '../../components/advanced-gantt';
import { useAppSelector } from '../../hooks/useAppSelector';
import { GanttTask } from '../../types/advanced-gantt.types';

const ProjectGanttView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  
  // Get tasks from your Redux store (adjust based on your actual state structure)
  const tasks = useAppSelector(state => state.tasksReducer?.tasks || []);
  
  // Transform your tasks to GanttTask format
  const ganttTasks = useMemo((): GanttTask[] => {
    return tasks.map(task => ({
      id: task.id,
      name: task.name,
      startDate: task.start_date ? new Date(task.start_date) : new Date(),
      endDate: task.end_date ? new Date(task.end_date) : new Date(),
      progress: task.progress || 0,
      type: 'task',
      status: task.status || 'not-started',
      priority: task.priority || 'medium',
      assignee: task.assignee ? {
        id: task.assignee.id,
        name: task.assignee.name,
        avatar: task.assignee.avatar,
      } : undefined,
      parent: task.parent_task_id,
      level: task.level || 0,
      // Map other fields as needed
    }));
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