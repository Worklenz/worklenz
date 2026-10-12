import { useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { Modal } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setCustomColumnModalAttributes,
  toggleCustomColumnModalOpen,
  resetCustomFieldValues,
} from '@features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import CustomColumnFormContent from './custom-column-form-content';

interface CustomColumnModalProps {
  projectId?: string | null;
}

// Module-level render guard. CustomColumnModal is mounted from several places
// (the task drawer, the project-settings custom-columns tab) and is driven by a
// single global redux flag, so without this every mounted instance would render
// its own <Modal> — stacked dialogs and duplicated masks whenever more than one
// is on the page (e.g. a page that mounts the task drawer twice, or project
// settings open on top of the task drawer). Only the first mounted instance
// renders the actual modal; the rest are inert.
let mountedIds: number[] = [];
let nextInstanceId = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/**
 * Standalone Modal wrapper around the custom-column form, driven entirely by
 * redux (isCustomColumnModalOpen / customColumnModalType / customColumnId /
 * customColumnModalProjectId). Safe to mount from more than one place — the
 * guard above keeps exactly one instance rendering.
 */
const CustomColumnModal = ({ projectId: projectIdProp }: CustomColumnModalProps) => {
  const { projectId: routeProjectId } = useParams();
  const { t } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();
  const { isCustomColumnModalOpen, customColumnModalType, customColumnModalProjectId } =
    useAppSelector(state => state.taskListCustomColumnsReducer);

  const [instanceId] = useState(() => nextInstanceId++);
  useLayoutEffect(() => {
    mountedIds.push(instanceId);
    notify();
    return () => {
      mountedIds = mountedIds.filter(id => id !== instanceId);
      notify();
    };
  }, [instanceId]);
  const isPrimary = useSyncExternalStore(
    subscribe,
    () => mountedIds[0] === instanceId
  );

  // Prefer the project the opener recorded in state; fall back to the mount
  // prop, then the route param (task-list surfaces are always project-scoped).
  const projectId = customColumnModalProjectId ?? projectIdProp ?? routeProjectId;

  const handleClose = () => {
    dispatch(toggleCustomColumnModalOpen(false));
    dispatch(resetCustomFieldValues());
    dispatch(setCustomColumnModalAttributes({ modalType: 'create', columnId: null, projectId: null }));
  };

  if (!isPrimary) return null;

  return (
    <Modal
      title={t(
        customColumnModalType === 'edit'
          ? 'customColumns.modal.editFieldTitle'
          : 'customColumns.modal.addFieldTitle',
        {
          defaultValue: customColumnModalType === 'edit' ? 'Edit custom column' : 'Add custom column',
        }
      )}
      centered
      open={isCustomColumnModalOpen}
      onCancel={handleClose}
      styles={{
        header: { position: 'relative' },
        footer: { display: 'none' },
      }}
      destroyOnClose
    >
      {isCustomColumnModalOpen && (
        <CustomColumnFormContent projectId={projectId} onDone={handleClose} />
      )}
    </Modal>
  );
};

export default CustomColumnModal;
