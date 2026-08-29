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

/**
 * Standalone Modal wrapper around the custom-column form, driven entirely by
 * redux (isCustomColumnModalOpen / customColumnModalType / customColumnId).
 * Kept for call sites that open it as a popup from the task list table.
 */
const CustomColumnModal = () => {
  const { projectId } = useParams();
  const { t } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();
  const { isCustomColumnModalOpen } = useAppSelector(state => state.taskListCustomColumnsReducer);

  const handleClose = () => {
    dispatch(toggleCustomColumnModalOpen(false));
    dispatch(resetCustomFieldValues());
    dispatch(setCustomColumnModalAttributes({ modalType: 'create', columnId: null }));
  };

  return (
    <Modal
      title={t('customColumns.modal.addFieldTitle')}
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
