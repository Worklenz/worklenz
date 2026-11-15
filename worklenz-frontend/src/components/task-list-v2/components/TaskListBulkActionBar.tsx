import React from 'react';
import OptimizedBulkActionBar from '@/components/task-management/OptimizedBulkActionBar';
import { useBulkActions } from '../hooks/useBulkActions';

export interface TaskListBulkActionBarProps {
  selectedTaskIds: string[];
  projectId: string;
  canCreateTask: boolean;
  bulkActions: ReturnType<typeof useBulkActions>;
}

export const TaskListBulkActionBar: React.FC<TaskListBulkActionBarProps> = React.memo(({
  selectedTaskIds,
  projectId,
  canCreateTask,
  bulkActions,
}) => {
  if (selectedTaskIds.length === 0 || !projectId) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <OptimizedBulkActionBar
        selectedTaskIds={selectedTaskIds}
        totalSelected={selectedTaskIds.length}
        projectId={projectId}
        canCreateTask={canCreateTask}
        onClearSelection={bulkActions.handleClearSelection}
        onBulkStatusChange={statusId =>
          bulkActions.handleBulkStatusChange(statusId, selectedTaskIds)
        }
        onBulkPriorityChange={priorityId =>
          bulkActions.handleBulkPriorityChange(priorityId, selectedTaskIds)
        }
        onBulkPhaseChange={phaseId =>
          bulkActions.handleBulkPhaseChange(phaseId, selectedTaskIds)
        }
        onBulkAssignToMe={() => bulkActions.handleBulkAssignToMe(selectedTaskIds)}
        onBulkAssignMembers={memberIds =>
          bulkActions.handleBulkAssignMembers(memberIds, selectedTaskIds)
        }
        onBulkAddLabels={labelIds =>
          bulkActions.handleBulkAddLabels(labelIds, selectedTaskIds)
        }
        onBulkArchive={() => bulkActions.handleBulkArchive(selectedTaskIds)}
        onBulkDelete={() => bulkActions.handleBulkDelete(selectedTaskIds)}
        onBulkDuplicate={() => bulkActions.handleBulkDuplicate(selectedTaskIds)}
        onBulkExport={() => bulkActions.handleBulkExport(selectedTaskIds)}
        onBulkSetDueDate={date => bulkActions.handleBulkSetDueDate(date, selectedTaskIds)}
        onBulkSetStartDate={date =>
          bulkActions.handleBulkSetStartDate(date, selectedTaskIds)
        }
      />
    </div>
  );
});

TaskListBulkActionBar.displayName = 'TaskListBulkActionBar';
