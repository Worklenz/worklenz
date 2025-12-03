import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Space,
  Divider,
  Typography,
  Flex,
  Select,
  Tooltip,
} from '@/shared/antd-imports';
import { PlusOutlined, HolderOutlined, EditOutlined, DeleteOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverEvent,
  useDroppable,
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  createStatus,
  fetchStatuses,
  fetchStatusesCategories,
} from '@/features/taskAttributes/taskStatusSlice';
import { statusApiService } from '@/api/taskAttributes/status/status.api.service';
import { ITaskStatusUpdateModel } from '@/types/tasks/task-status-update-model.types';
import { IKanbanTaskStatus } from '@/types/tasks/taskStatus.types';
import { Modal as AntModal } from '@/shared/antd-imports';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { fetchEnhancedKanbanGroups } from '@/features/enhanced-kanban/enhanced-kanban.slice';
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
      className={`${isDarkMode ? 'dark-modal' : ''} status-manage-modal`}
    >
      <div className="space-y-4">
        {statusCategories.length === 0 && (
          <div
            className={`text-center py-8 transition-colors ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            <Text className="text-sm font-medium">{t('noStatusesFound')}</Text>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default DuplicateTaskModal;
