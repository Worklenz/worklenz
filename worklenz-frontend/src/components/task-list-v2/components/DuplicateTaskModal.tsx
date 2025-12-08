import React, { useState, useCallback } from 'react';
import {
  Modal,
  Button,
  Typography,
  Checkbox,
  Space,
  message,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { duplicateTask } from '@/features/task-management/task-management.slice';

// Replace with your actual duplicate thunk/action
// import { duplicateTaskAsync } from '@/store/tasks/tasksThunks';

const { Title, Text } = Typography;

interface DuplicateTaskModalProps {
  open: boolean;
  onClose: () => void;
  taskId: string;
  projectId?: string; // optional
}

const DuplicateTaskModal: React.FC<DuplicateTaskModalProps> = ({
  open,
  onClose,
  taskId,
  projectId: propProjectId,
}) => {
  const { t } = useTranslation('tasks');
  const dispatch = useAppDispatch();

  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');
  const currentProjectId = useAppSelector(state => state.projectReducer.projectId);
  const projectId = propProjectId || currentProjectId;

  // Exactly your 8 options – change defaults if you want
  const [options, setOptions] = useState<Record<string, boolean>>({
    subtasks: true,
    attachments: false,
    dates: true,
    dependencies: false,
    assignees: true,
    labels: true,
    customFields: true,
    subscribers: false,
  });

  const [loading, setLoading] = useState(false);

  const toggle = (key: string) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDuplicate = useCallback(async () => {
    setLoading(true);
    try {
      await dispatch(
        duplicateTask({
          taskId,
          projectId,
          duplicateOptions: options, // exactly the JSON you want
        })
      ).unwrap();

      message.success(t('taskDuplicatedSuccess') || 'Task duplicated successfully');
      onClose();
    } catch {
      message.error(t('taskDuplicatedError') || 'Failed to duplicate task');
    } finally {
      setLoading(false);
    }
  }, [dispatch, taskId, projectId, options, onClose, t]);

  // Your exact list in the order you wrote
  const checkboxItems = [
    { key: 'subtasks', label: 'Subtasks' },
    { key: 'attachments', label: 'Attachments' },
    { key: 'dates', label: 'Dates' },
    { key: 'dependencies', label: 'Dependencies' },
    { key: 'assignees', label: 'Assignees' },
    { key: 'labels', label: 'Labels' },
    { key: 'customFields', label: 'Custom Field Values' },
    { key: 'subscribers', label: 'Subscribers' },
  ] as const;

  return (
    <Modal
      title={
        <Title level={4} className={`m-0 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          {t('duplicateTask') || 'Duplicate Task'}
        </Title>
      }
      open={open}
      onCancel={onClose}
      width={520}
      footer={
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} disabled={loading}>
            {t('cancel') || 'Cancel'}
          </Button>
          <Button type="primary" loading={loading} onClick={handleDuplicate}>
            {t('duplicate') || 'Duplicate'}
          </Button>
        </div>
      }
      className={isDarkMode ? 'dark-modal' : ''}
    >
      <Text className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
        {t('duplicateTaskDescription') || 'Select items to copy to the new task:'}
      </Text>

      <div className="mt-6">
        <Checkbox.Group
          value={Object.keys(options).filter(k => options[k])}
          className="w-full"
        >
          <Space direction="vertical" size={12} className="w-full">
            {checkboxItems.map(item => (
              <Checkbox
                key={item.key}
                value={item.key}
                checked={options[item.key]}
                onChange={() => toggle(item.key)}
                className="text-base"
              >
                {t(`duplicateOptions.${item.key}`) || item.label}
              </Checkbox>
            ))}
          </Space>
        </Checkbox.Group>
      </div>
    </Modal>
  );
};

export default DuplicateTaskModal;