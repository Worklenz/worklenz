import React, { useState, useCallback } from 'react';
import { Modal, Button, Typography, Checkbox, Space, message } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  duplicateTask,
  selectCurrentGroupingV3,
  setDuplicateTask,
} from '@/features/task-management/task-management.slice';
import {
  evt_project_sub_task_duplicate,
  evt_project_task_duplicate,
} from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { handleNewTaskReceived as handleTaskReceived } from '@/utils/taskHandlers';
import logger from '@/utils/errorLogger';

const { Title, Text } = Typography;

interface DuplicateTaskModalProps {
  open: boolean;
  onClose: () => void;
  projectId?: string; // optional
}

const DuplicateTaskModal: React.FC<DuplicateTaskModalProps> = ({
  open,
  onClose,
  projectId: propProjectId,
}) => {
  const { t } = useTranslation('task-duplicate');
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');
  const currentProjectId = useAppSelector(state => state.projectReducer.projectId);
  const projectId = propProjectId || currentProjectId;
  const task = useAppSelector(state => state.taskManagement.duplicateTask);
  const currentGroupingV3 = useAppSelector(selectCurrentGroupingV3);

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
      const res = await dispatch(
        duplicateTask({
          taskId: task.taskId as string,
          projectId: projectId as string,
          duplicateOptions: options, // exactly the JSON you want
        })
      ).unwrap();
      if (res.done) {
        dispatch(setDuplicateTask({}));
        setOptions({
          subtasks: true,
          attachments: false,
          dates: true,
          dependencies: false,
          assignees: true,
          labels: true,
          customFields: true,
          subscribers: false,
        });
        // Use shared task handler with duplicate-specific event names
        handleTaskReceived(res.body, {
          dispatch,
          currentGroupingV3,
          trackEvent: trackMixpanelEvent,
          subtaskEventName: evt_project_sub_task_duplicate,
          taskEventName: evt_project_task_duplicate,
        });
        onClose();
      }
    } catch (error) {
      logger.error('Failed to duplicate task', error);
    } finally {
      setLoading(false);
    }
  }, [
    dispatch,
    task.taskId,
    projectId,
    options,
    onClose,
    t,
    currentGroupingV3,
    trackMixpanelEvent,
  ]);

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
        {task.title || 'Task Title'}
      </Text>

      <div className="mt-6">
        <Checkbox.Group value={Object.keys(options).filter(k => options[k])} className="w-full">
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
