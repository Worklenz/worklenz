import React from 'react';
import { Modal, Button, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import ManageStatusContent from './ManageStatusContent';
import './ManageStatusModal.css';

const { Title } = Typography;

interface ManageStatusModalProps {
  open: boolean;
  onClose: () => void;
  projectId?: string;
}

/**
 * Standalone Modal wrapper around ManageStatusContent, kept for call sites
 * that still want the status manager as a popup (e.g. Gantt, task filters).
 */
const ManageStatusModal: React.FC<ManageStatusModalProps> = ({ open, onClose, projectId }) => {
  const { t } = useTranslation('task-list-filters');
  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');

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
      onCancel={onClose}
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
            onClick={onClose}
            className={`font-medium ${isDarkMode
              ? 'text-gray-300 hover:text-gray-200 border-gray-600'
              : 'text-gray-600 hover:text-gray-800 border-gray-300'
              }`}
          >
            {t('close')}
          </Button>
        </div>
      }
      className={`${isDarkMode ? 'dark-modal' : ''} status-manage-modal`}
      destroyOnClose
    >
      {open && <ManageStatusContent projectId={projectId} />}
    </Modal>
  );
};

export default ManageStatusModal;
