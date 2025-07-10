import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Modal, Form, Input, Button, Space, Divider, Typography, Flex, Select } from 'antd';
import { PlusOutlined, HolderOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { createStatus, fetchStatuses, fetchStatusesCategories } from '@/features/taskAttributes/taskStatusSlice';
import { statusApiService } from '@/api/taskAttributes/status/status.api.service';
import { ITaskStatusUpdateModel } from '@/types/tasks/task-status-update-model.types';
import { Modal as AntModal } from 'antd';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { fetchEnhancedKanbanGroups } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import './ManageStatusModal.css';

const { Title, Text } = Typography;

interface ManageStatusModalProps {
  open: boolean;
  onClose: () => void;
  projectId?: string;
}

interface StatusItemProps {
  status: any;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onCategoryChange: (id: string, categoryId: string) => void;
  isDarkMode: boolean;
  categories: any[];
}

// Sortable Status Item Component
const SortableStatusItem: React.FC<StatusItemProps & { id: string }> = ({
  id,
  status,
  onRename,
  onDelete,
  onCategoryChange,
  isDarkMode,
  categories,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(status.name || '');
  const inputRef = useRef<any>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = useCallback(() => {
    if (editName.trim() && editName.trim() !== status.name) {
      onRename(id, editName.trim());
    }
    setIsEditing(false);
  }, [editName, id, onRename, status.name]);

  const handleCancel = useCallback(() => {
    setEditName(status.name || '');
    setIsEditing(false);
  }, [status.name]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

    return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 rounded-md border transition-all duration-200 ${
        isDarkMode
          ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
          : 'bg-white border-gray-200 hover:bg-gray-50 shadow-sm'
      }`}
    >
      {/* Header Row - Drag Handle, Color, Name, Actions */}
      <div className="flex items-center gap-2 mb-2">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className={`cursor-grab active:cursor-grabbing p-1 rounded transition-colors ${
            isDarkMode 
              ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' 
              : 'text-gray-500 hover:text-gray-600 hover:bg-gray-100'
          }`}
        >
          <HolderOutlined />
        </div>

        {/* Status Color */}
        <div
          className="w-4 h-4 rounded-full border shadow-sm"
          style={{
            backgroundColor: status.color_code || '#gray',
            borderColor: isDarkMode ? '#374151' : '#e5e7eb',
          }}
        />

        {/* Status Name */}
        <div className="flex-1">
          {isEditing ? (
            <Input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="font-medium"
              placeholder="Enter status name"
            />
          ) : (
            <Text
              className={`text-sm font-medium cursor-pointer transition-colors ${
                isDarkMode ? 'text-gray-100 hover:text-white' : 'text-gray-900 hover:text-gray-700'
              }`}
              onClick={() => setIsEditing(true)}
            >
              {status.name}
            </Text>
          )}
        </div>

        {/* Actions */}
        <Space size={4}>
          <Button
            type="text"
            size="small"
            onClick={() => setIsEditing(true)}
            className={`text-xs ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-600'} hover:bg-transparent`}
          >
            Rename
          </Button>
          <Button
            type="text"
            size="small"
            danger
            onClick={() => onDelete(id)}
            className="text-xs text-red-500 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Delete
          </Button>
        </Space>
      </div>

      {/* Category Row */}
      <div className="flex items-center gap-1.5">
        <Text 
          className={`text-xs font-medium ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          Category:
        </Text>
        <Select
          value={status.category_id}
          onChange={(value) => onCategoryChange(id, value)}
          size="small"
          style={{ width: 120 }}
          className="category-select"
          placeholder="Select category"
        >
          {categories.map(category => (
            <Select.Option key={category.id} value={category.id}>
              {category.name}
            </Select.Option>
          ))}
        </Select>
      </div>
    </div>
  );
};

const ManageStatusModal: React.FC<ManageStatusModalProps> = ({
  open,
  onClose,
  projectId,
}) => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();
  
  // Redux state
  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');
  const currentProjectId = useAppSelector(state => state.projectReducer.projectId);
  const { status: statuses } = useAppSelector(state => state.taskStatusReducer);
  
  const [localStatuses, setLocalStatuses] = useState(statuses);
  const [newStatusName, setNewStatusName] = useState('');
  const [statusCategories, setStatusCategories] = useState<any[]>([]);

  const finalProjectId = projectId || currentProjectId;

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    setLocalStatuses(statuses);
  }, [statuses]);

  useEffect(() => {
    if (open && finalProjectId) {
      dispatch(fetchStatuses(finalProjectId));
      // Fetch status categories
      dispatch(fetchStatusesCategories()).then((result: any) => {
        if (result.payload && Array.isArray(result.payload)) {
          setStatusCategories(result.payload);
        }
      }).catch(() => {
        setStatusCategories([]);
      });
    }
  }, [open, finalProjectId, dispatch]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !finalProjectId) {
      return;
    }

    setLocalStatuses((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return items;

      const newItems = [...items];
      const [movedItem] = newItems.splice(oldIndex, 1);
      newItems.splice(newIndex, 0, movedItem);

      // Update status order via API (fire and forget)
      const columnOrder = newItems.map(item => item.id).filter(Boolean) as string[];
      const requestBody = { status_order: columnOrder };
      statusApiService.updateStatusOrder(requestBody, finalProjectId).then(() => {
        // Refresh enhanced kanban after status order change
        dispatch(fetchEnhancedKanbanGroups(finalProjectId));
      }).catch(error => {
        console.error('Error updating status order:', error);
      });

      return newItems;
    });
  }, [finalProjectId]);

  const handleCreateStatus = useCallback(async () => {
    if (!newStatusName.trim() || !finalProjectId) return;

    try {
      const statusCategories = await dispatch(fetchStatusesCategories()).unwrap();
      const defaultCategory = statusCategories[0]?.id;
      
      if (!defaultCategory) {
        console.error('No status categories found');
        return;
      }

      const body = {
        name: newStatusName.trim(),
        category_id: defaultCategory,
        project_id: finalProjectId,
      };

      const res = await dispatch(createStatus({ body, currentProjectId: finalProjectId })).unwrap();
      if (res.done) {
        setNewStatusName('');
        dispatch(fetchStatuses(finalProjectId));
        dispatch(fetchTasksV3(finalProjectId));
        dispatch(fetchEnhancedKanbanGroups(finalProjectId));
      }
    } catch (error) {
      console.error('Error creating status:', error);
    }
  }, [newStatusName, finalProjectId, dispatch]);

  const handleRenameStatus = useCallback(async (id: string, name: string) => {
    if (!finalProjectId) return;
    
    try {
      const body: ITaskStatusUpdateModel = {
        name: name.trim(),
        project_id: finalProjectId,
      };
      
      await statusApiService.updateNameOfStatus(id, body, finalProjectId);
      dispatch(fetchStatuses(finalProjectId));
      dispatch(fetchTasksV3(finalProjectId));
      dispatch(fetchEnhancedKanbanGroups(finalProjectId));
    } catch (error) {
      console.error('Error renaming status:', error);
    }
  }, [finalProjectId, dispatch]);

  const handleDeleteStatus = useCallback(async (id: string) => {
    if (!finalProjectId) return;
    
    AntModal.confirm({
      title: 'Delete Status',
      content: 'Are you sure you want to delete this status? This action cannot be undone.',
      onOk: async () => {
        try {
          const replacingStatusId = localStatuses.find(s => s.id !== id)?.id || '';
          await statusApiService.deleteStatus(id, finalProjectId, replacingStatusId);
          dispatch(fetchStatuses(finalProjectId));
          dispatch(fetchTasksV3(finalProjectId));
          dispatch(fetchEnhancedKanbanGroups(finalProjectId));
        } catch (error) {
          console.error('Error deleting status:', error);
        }
      },
    });
  }, [localStatuses, finalProjectId, dispatch]);

  const handleCategoryChange = useCallback(async (id: string, categoryId: string) => {
    if (!finalProjectId) return;
    
    try {
      const body: ITaskStatusUpdateModel = {
        category_id: categoryId,
        project_id: finalProjectId,
      };
      
      await statusApiService.updateNameOfStatus(id, body, finalProjectId);
      dispatch(fetchStatuses(finalProjectId));
      dispatch(fetchTasksV3(finalProjectId));
      dispatch(fetchEnhancedKanbanGroups(finalProjectId));
    } catch (error) {
      console.error('Error changing status category:', error);
    }
  }, [finalProjectId, dispatch]);

  const handleClose = useCallback(() => {
    setNewStatusName('');
    onClose();
  }, [onClose]);

  return (
    <Modal
      title={
        <Title level={4} className={isDarkMode ? 'text-gray-200' : 'text-gray-800'}>
          {t('manageStatuses')}
        </Title>
      }
      open={open}
      onCancel={handleClose}
      width={600}
      style={{ top: 20 }}
      bodyStyle={{
        maxHeight: 'calc(100vh - 200px)',
        overflowY: 'auto',
        padding: '24px',
      }}
      footer={
        <Flex justify="flex-end">
          <Button onClick={handleClose}>
            Close
          </Button>
        </Flex>
      }
      className={isDarkMode ? 'dark-modal' : ''}
    >
      <div className="space-y-4">
        <div className={`p-2.5 rounded-md ${
          isDarkMode ? 'bg-gray-800/50' : 'bg-blue-50'
        }`}>
          <Text 
            type="secondary" 
            className={`text-xs ${
              isDarkMode ? 'text-gray-400' : 'text-blue-600'
            }`}
          >
            💡 Drag statuses to reorder them. Each status can have a different category.
          </Text>
        </div>

        {/* Create New Status */}
        <div className={`p-3 rounded-md border-2 border-dashed transition-colors ${
          isDarkMode 
            ? 'border-gray-600 bg-gray-800/50 hover:border-gray-500' 
            : 'border-gray-300 bg-gray-50/50 hover:border-gray-400'
        }`}>
          <div className="flex gap-2">
            <Input
              placeholder="Enter new status name..."
              value={newStatusName}
              onChange={(e) => setNewStatusName(e.target.value)}
              onPressEnter={handleCreateStatus}
              className="flex-1"
              size="small"
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateStatus}
              disabled={!newStatusName.trim()}
              size="small"
            >
              Add Status
            </Button>
          </div>
        </div>

        <Divider className={isDarkMode ? 'border-gray-700' : 'border-gray-300'} />

        {/* Status List with Drag & Drop */}
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext
            items={localStatuses.filter(status => status.id).map(status => status.id as string)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {localStatuses.filter(status => status.id).map((status) => (
                <SortableStatusItem
                  key={status.id}
                  id={status.id!}
                  status={status}
                  onRename={handleRenameStatus}
                  onDelete={handleDeleteStatus}
                  onCategoryChange={handleCategoryChange}
                  isDarkMode={isDarkMode}
                  categories={statusCategories}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {localStatuses.length === 0 && (
          <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <Text>No statuses found. Create your first status above.</Text>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ManageStatusModal; 