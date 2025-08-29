import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Tabs,
  Space,
  Divider,
  Typography,
  Flex,
  DatePicker,
  Select,
} from '@/shared/antd-imports';
import { PlusOutlined, DragOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
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
import { Modal as AntModal } from '@/shared/antd-imports';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAuthService } from '@/hooks/useAuth';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_project_task_create } from '@/shared/worklenz-analytics-events';
import './CreateTaskModal.css';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  projectId?: string;
}

interface StatusItemProps {
  status: any;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  isDarkMode: boolean;
}

// Sortable Status Item Component
const SortableStatusItem: React.FC<StatusItemProps & { id: string }> = ({
  id,
  status,
  onRename,
  onDelete,
  isDarkMode,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(status.name || '');
  const inputRef = useRef<any>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

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
      className={`flex items-center gap-3 p-3 rounded-md border transition-all duration-200 ${
        isDarkMode
          ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
      }`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className={`cursor-grab active:cursor-grabbing p-1 rounded ${
          isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-600'
        }`}
      >
        <DragOutlined />
      </div>

      {/* Status Color */}
      <div
        className="w-4 h-4 rounded-full border"
        style={{
          backgroundColor: status.color_code || '#gray',
          borderColor: isDarkMode ? '#374151' : '#d1d5db',
        }}
      />

      {/* Status Name */}
      <div className="flex-1">
        {isEditing ? (
          <Input
            ref={inputRef}
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            size="small"
            className="font-medium"
          />
        ) : (
          <Text
            className={`font-medium cursor-pointer ${
              isDarkMode ? 'text-gray-200' : 'text-gray-800'
            }`}
            onClick={() => setIsEditing(true)}
          >
            {status.name}
          </Text>
        )}
      </div>

      {/* Actions */}
      <Space size="small">
        <Button
          type="text"
          size="small"
          onClick={() => setIsEditing(true)}
          className={
            isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-600'
          }
        >
          Rename
        </Button>
        <Button
          type="text"
          size="small"
          danger
          onClick={() => onDelete(id)}
          className="text-red-500 hover:text-red-600"
        >
          Delete
        </Button>
      </Space>
    </div>
  );
};

// Status Management Component
const StatusManagement: React.FC<{
  projectId: string;
  isDarkMode: boolean;
}> = ({ projectId, isDarkMode }) => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();

  const { status: statuses } = useAppSelector(state => state.taskStatusReducer);
  const [localStatuses, setLocalStatuses] = useState(statuses);
  const [newStatusName, setNewStatusName] = useState('');

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

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setLocalStatuses(items => {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return items;

      const newItems = [...items];
      const [movedItem] = newItems.splice(oldIndex, 1);
      newItems.splice(newIndex, 0, movedItem);

      // Update status order via API (fire and forget)
      const columnOrder = newItems.map(item => item.id).filter(Boolean) as string[];
      const requestBody = { status_order: columnOrder };
      statusApiService.updateStatusOrder(requestBody, projectId).catch(error => {
        console.error('Error updating status order:', error);
      });

      return newItems;
    });
  }, []);

  const handleCreateStatus = useCallback(async () => {
    if (!newStatusName.trim()) return;

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
        project_id: projectId,
      };

      const res = await dispatch(createStatus({ body, currentProjectId: projectId })).unwrap();
      if (res.done) {
        setNewStatusName('');
        dispatch(fetchStatuses(projectId));
      }
    } catch (error) {
      console.error('Error creating status:', error);
    }
  }, [newStatusName, projectId, dispatch]);

  const handleRenameStatus = useCallback(
    async (id: string, name: string) => {
      try {
        const body: ITaskStatusUpdateModel = {
          name: name.trim(),
          project_id: projectId,
        };

        await statusApiService.updateNameOfStatus(id, body, projectId);
        dispatch(fetchStatuses(projectId));
      } catch (error) {
        console.error('Error renaming status:', error);
      }
    },
    [projectId, dispatch]
  );

  const handleDeleteStatus = useCallback(
    async (id: string) => {
      AntModal.confirm({
        title: 'Delete Status',
        content: 'Are you sure you want to delete this status? This action cannot be undone.',
        onOk: async () => {
          try {
            const replacingStatusId = localStatuses.find(s => s.id !== id)?.id || '';
            await statusApiService.deleteStatus(id, projectId, replacingStatusId);
            dispatch(fetchStatuses(projectId));
          } catch (error) {
            console.error('Error deleting status:', error);
          }
        },
      });
    },
    [localStatuses, projectId, dispatch]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Title level={5} className={isDarkMode ? 'text-gray-200' : 'text-gray-800'}>
          {t('manageStatuses')}
        </Title>
        <Text type="secondary" className="text-sm">
          Drag to reorder
        </Text>
      </div>

      {/* Create New Status */}
      <div className="flex gap-2">
        <Input
          placeholder="Enter status name"
          value={newStatusName}
          onChange={e => setNewStatusName(e.target.value)}
          onPressEnter={handleCreateStatus}
          className="flex-1"
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreateStatus}
          disabled={!newStatusName.trim()}
        >
          Add
        </Button>
      </div>

      <Divider className={isDarkMode ? 'border-gray-700' : 'border-gray-300'} />

      {/* Status List with Drag & Drop */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext
          items={localStatuses.filter(status => status.id).map(status => status.id as string)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {localStatuses
              .filter(status => status.id)
              .map(status => (
                <SortableStatusItem
                  key={status.id}
                  id={status.id!}
                  status={status}
                  onRename={handleRenameStatus}
                  onDelete={handleDeleteStatus}
                  isDarkMode={isDarkMode}
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
  );
};

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ open, onClose, projectId }) => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('task-info');
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();

  // Redux state
  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');
  const currentProjectId = useAppSelector(state => state.projectReducer.projectId);
  const user = useAppSelector(state => state.auth?.user);

  const finalProjectId = projectId || currentProjectId;

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();

      const { socket } = useSocket();

      if (!socket || !user || !finalProjectId) {
        console.error('Missing socket, user, or project ID');
        return;
      }

      const taskData = {
        name: values.name,
        description: values.description || null,
        project_id: finalProjectId,
        status_id: values.status || null,
        priority_id: values.priority || null,
        assignees: values.assignees || [],
        due_date: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : null,
        reporter_id: user.id,
      };

      // Track analytics event
      trackMixpanelEvent(evt_project_task_create);

      // Create task via socket
      socket.emit(SocketEvents.QUICK_TASK.toString(), taskData);

      // Refresh task list
      dispatch(fetchTasksV3(finalProjectId));

      // Reset form and close modal
      form.resetFields();
      setActiveTab('task-info');
      onClose();
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  }, [form, finalProjectId, dispatch, onClose]);

  const handleCancel = useCallback(() => {
    form.resetFields();
    setActiveTab('task-info');
    onClose();
  }, [form, onClose]);

  return (
    <Modal
      title={
        <Title level={4} className={isDarkMode ? 'text-gray-200' : 'text-gray-800'}>
          {t('createTask')}
        </Title>
      }
      open={open}
      onCancel={handleCancel}
      width={800}
      style={{ top: 20 }}
      bodyStyle={{
        maxHeight: 'calc(100vh - 200px)',
        overflowY: 'auto',
        padding: '24px',
      }}
      footer={
        <Flex justify="space-between" align="center">
          <div></div>
          <Space>
            <Button onClick={handleCancel}>{t('cancel')}</Button>
            <Button type="primary" onClick={handleSubmit}>
              {t('createTask')}
            </Button>
          </Space>
        </Flex>
      }
      className={isDarkMode ? 'dark-modal' : ''}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          {
            key: 'task-info',
            label: t('taskInfo'),
            children: (
              <div className="py-4">
                <Form
                  form={form}
                  layout="vertical"
                  initialValues={{
                    priority: 'medium',
                    billable: false,
                  }}
                >
                  <Form.Item
                    name="name"
                    label={t('taskName')}
                    rules={[{ required: true, message: t('taskNameRequired') }]}
                  >
                    <Input
                      placeholder={t('taskNamePlaceholder')}
                      autoFocus
                      maxLength={250}
                      showCount
                    />
                  </Form.Item>

                  <Form.Item name="description" label={t('description')}>
                    <Input.TextArea
                      placeholder={t('descriptionPlaceholder')}
                      rows={4}
                      maxLength={1000}
                      showCount
                    />
                  </Form.Item>

                  {/* Status Selection */}
                  <Form.Item
                    name="status"
                    label={t('status')}
                    rules={[{ required: true, message: 'Please select a status' }]}
                  >
                    <Select placeholder="Select status">
                      {/* TODO: Populate with actual statuses */}
                      <Select.Option value="todo">To Do</Select.Option>
                      <Select.Option value="inprogress">In Progress</Select.Option>
                      <Select.Option value="done">Done</Select.Option>
                    </Select>
                  </Form.Item>

                  {/* Priority Selection */}
                  <Form.Item name="priority" label={t('priority')}>
                    <Select placeholder="Select priority">
                      <Select.Option value="low">Low</Select.Option>
                      <Select.Option value="medium">Medium</Select.Option>
                      <Select.Option value="high">High</Select.Option>
                    </Select>
                  </Form.Item>

                  {/* Assignees */}
                  <Form.Item name="assignees" label={t('assignees')}>
                    <Select mode="multiple" placeholder="Select assignees">
                      {/* TODO: Populate with team members */}
                    </Select>
                  </Form.Item>

                  {/* Due Date */}
                  <Form.Item name="dueDate" label={t('dueDate')}>
                    <DatePicker className="w-full" placeholder="Select due date" />
                  </Form.Item>
                </Form>
              </div>
            ),
          },
          {
            key: 'status-management',
            label: t('manageStatuses'),
            children: finalProjectId ? (
              <div className="py-4">
                <StatusManagement projectId={finalProjectId} isDarkMode={isDarkMode} />
              </div>
            ) : (
              <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <Text>Project ID is required for status management.</Text>
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};

export default CreateTaskModal;
