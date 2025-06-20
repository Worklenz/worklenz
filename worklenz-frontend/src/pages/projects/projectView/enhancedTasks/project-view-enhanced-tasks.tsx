import React from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import TaskListBoard from '@/components/task-management/TaskListBoard';

const ProjectViewEnhancedTasks: React.FC = () => {
  const { project } = useAppSelector(state => state.projectReducer);

  if (!project?.id) {
    return (
      <div className="p-4 text-center text-gray-500">
        Project not found
      </div>
    );
  }

  return (
    <div className="project-view-enhanced-tasks">
      <TaskListBoard projectId={project.id} />
    </div>
  );
};

export default ProjectViewEnhancedTasks; 