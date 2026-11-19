import React from 'react';
import { createPortal } from 'react-dom';
import { DeferredMount } from './DeferredMount';
import CustomColumnModal from '@/pages/projects/projectView/taskList/task-list-table/custom-columns/custom-column-modal/CustomColumnModal';
import ConvertToSubtaskDrawer from '@/components/task-list-common/convert-to-subtask-drawer/ConvertToSubtaskDrawer';
import DuplicateTaskModal from './DuplicateTaskModal';

export interface TaskListPortalsProps {
  isOpenConvertToSubtaskDrawer: boolean;
  isOpenDuplicateTaskModal: boolean;
  onCloseDuplicateTaskModal: () => void;
}

/**
 * Portals for task list dialogs and drawers mounted to document.body.
 * CustomColumnModal has an internal render guard ensuring only a single instance is visible.
 * ConvertToSubtaskDrawer and DuplicateTaskModal use DeferredMount to avoid mounting overhead
 * before they are first opened.
 */
export const TaskListPortals: React.FC<TaskListPortalsProps> = React.memo(({
  isOpenConvertToSubtaskDrawer,
  isOpenDuplicateTaskModal,
  onCloseDuplicateTaskModal,
}) => {
  return (
    <>
      {createPortal(<CustomColumnModal />, document.body, 'custom-column-modal')}
      {createPortal(
        <DeferredMount isOpen={isOpenConvertToSubtaskDrawer}>
          <ConvertToSubtaskDrawer />
        </DeferredMount>,
        document.body,
        'convert-to-subtask-drawer'
      )}
      {createPortal(
        <DeferredMount isOpen={isOpenDuplicateTaskModal}>
          <DuplicateTaskModal
            open={isOpenDuplicateTaskModal}
            onClose={onCloseDuplicateTaskModal}
          />
        </DeferredMount>,
        document.body,
        'duplicate-task-modal'
      )}
    </>
  );
});

TaskListPortals.displayName = 'TaskListPortals';
