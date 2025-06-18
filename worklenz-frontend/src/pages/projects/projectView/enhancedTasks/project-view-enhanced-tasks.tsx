import React from 'react';
import { useParams } from 'react-router-dom';
import TaskListBoard from '@/components/task-management/TaskListBoard';

const ProjectViewEnhancedTasks: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();

  if (!projectId) {
    return (
      <div className="p-4 text-center text-gray-500">
        Project ID not found
      </div>
    );
  }

  return (
    <div className="project-view-enhanced-tasks">
      <TaskListBoard projectId={projectId} />
    </div>
  );
};

export default ProjectViewEnhancedTasks; 