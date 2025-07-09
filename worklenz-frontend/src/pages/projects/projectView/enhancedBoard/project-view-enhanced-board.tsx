import React from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import EnhancedKanbanBoardNativeDnD from '@/components/enhanced-kanban/EnhancedKanbanBoardNativeDnD/EnhancedKanbanBoardNativeDnD';

const ProjectViewEnhancedBoard: React.FC = () => {
  const { project } = useAppSelector(state => state.projectReducer);

  if (!project?.id) {
    return <div className="p-4 text-center text-gray-500">Project not found</div>;
  }

  return (
    <div className="project-view-enhanced-board">
      <EnhancedKanbanBoardNativeDnD projectId={project.id} />
    </div>
  );
};

export default ProjectViewEnhancedBoard;
