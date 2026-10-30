import React from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import EnhancedKanbanBoardNativeDnD from '@/components/enhanced-kanban/EnhancedKanbanBoardNativeDnD/EnhancedKanbanBoardNativeDnD';
import { isProjectTaskEditingReadOnly } from '@/lib/project/project-view-guest';

const ProjectViewEnhancedBoard: React.FC = () => {
  const { project } = useAppSelector(state => state.projectReducer);
  const isGuest = isProjectTaskEditingReadOnly(project);

  if (!project?.id) {
    return <div className="p-4 text-center text-gray-500">Project not found</div>;
  }

  return (
    <div className="project-view-enhanced-board">
      <EnhancedKanbanBoardNativeDnD projectId={project.id} isGuest={isGuest} />
    </div>
  );
};

export default ProjectViewEnhancedBoard;
