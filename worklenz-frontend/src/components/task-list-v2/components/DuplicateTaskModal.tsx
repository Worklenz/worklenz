import React, { useCallback } from 'react';
import {
  Modal,
  Button,
  Typography
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import './DuplicateTaskModal.css';

const { Title, Text } = Typography;

interface DuplicateTaskModalProps {
  open: boolean;
  onClose: () => void;
  taskId: string;
}

const DuplicateTaskModal: React.FC<DuplicateTaskModalProps> = ({ open, onClose, taskId }) => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();

  // Redux state
  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');
  const currentProjectId = useAppSelector(state => state.projectReducer.projectId);
  const { status: statuses } = useAppSelector(state => state.taskStatusReducer);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Modal
      title={
        <Title
          level={4}
          className={`m-0 font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}
        >
          {t('manageStatuses')}
        </Title>
      }
      open={open}
      onCancel={handleClose}
      width={720}
      style={{ top: 20 }}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
          padding: '16px',
        },
      }}
      footer={
        <div
          className={`flex justify-end pt-3 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}
        >
          <Button
            onClick={handleClose}
            className={`font-medium ${
              isDarkMode
                ? 'text-gray-300 hover:text-gray-200 border-gray-600'
                : 'text-gray-600 hover:text-gray-800 border-gray-300'
            }`}
          >
            {t('close')}
          </Button>
        </div>
      }
      className={`${isDarkMode ? 'dark-modal' : ''} status-manage-modal`}>
    </Modal>
  );
};

export default DuplicateTaskModal;
