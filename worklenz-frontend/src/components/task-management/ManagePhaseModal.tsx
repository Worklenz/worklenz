import React from 'react';
import { Modal, Button, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import ManagePhaseContent from './ManagePhaseContent';
import './ManagePhaseModal.css';

const { Title, Text } = Typography;

interface ManagePhaseModalProps {
  open: boolean;
  onClose: () => void;
  projectId?: string;
}

/**
 * Standalone Modal wrapper around ManagePhaseContent, kept for call sites
 * that still want the phase manager as a popup (e.g. Gantt, task filters).
 */
const ManagePhaseModal: React.FC<ManagePhaseModalProps> = ({ open, onClose, projectId }) => {
  const { t } = useTranslation('phases-drawer');
  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');
  const { project } = useAppSelector(state => state.projectReducer);

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <Title
            level={4}
            className={`m-0 font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}
          >
            {t('configure')}
          </Title>
          <Text
            className={`text-sm font-medium px-2 py-0.5 rounded ${
              isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-blue-50 text-blue-700'
            }`}
          >
            {t('phasesText', { defaultValue: 'Phases' })}
          </Text>
        </div>
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
      className={`${isDarkMode ? 'dark-modal' : ''} phase-manage-modal`}
      destroyOnClose
    >
      {open && <ManagePhaseContent projectId={projectId} />}
    </Modal>
  );
};

export default ManagePhaseModal;
