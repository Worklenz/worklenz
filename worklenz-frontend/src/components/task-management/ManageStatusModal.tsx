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
import './ManageStatusModal.css';

const { Title, Text } = Typography;

interface ManageStatusModalProps {
  open: boolean;
  onClose: () => void;
  projectId?: string;
}

interface StatusItemProps {
  status: IKanbanTaskStatus;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onCategoryChange: (id: string, categoryId: string) => void;
  isDarkMode: boolean;
  categories: any[];
}

interface CategorySectionProps {
  category: any;
  statuses: IKanbanTaskStatus[];
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onCategoryChange: (id: string, categoryId: string) => void;
  onCreateStatus: (categoryId: string, name: string) => void;
  isDarkMode: boolean;
  categories: any[];
  dragOverCategory: string | null;
  activeId: string | null;
  dragOverIndex: number | null;
  localStatuses: IKanbanTaskStatus[];
}

// Sortable Status Item Component (compact with hover actions)
const SortableStatusItem: React.FC<StatusItemProps & { id: string }> = ({
  id,
  status,
  onRename,
  onDelete,
  onCategoryChange,
  isDarkMode,
  categories,
}) => {
  const { t } = useTranslation('task-list-filters');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(status.name || '');
  const [isHovered, setIsHovered] = useState(false);
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

  const handleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

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
      className={`group relative py-1.5 px-2 rounded border transition-all duration-200 ${
        isDarkMode
          ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500'
          : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
      } ${isDragging ? 'shadow-lg opacity-50 rotate-2 scale-105' : 'shadow-sm hover:shadow-md'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-2">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className={`flex-shrink-0 cursor-grab active:cursor-grabbing p-1 rounded transition-all duration-200 ${
            isDarkMode
              ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-600'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
        >
          <HolderOutlined className="text-sm" />
        </div>

        {/* Status Color */}
        <div
          className="flex-shrink-0 w-2.5 h-2.5 rounded border shadow-sm"
          style={{
            backgroundColor: status.color_code || '#6b7280',
            borderColor: isDarkMode ? '#6b7280' : '#d1d5db',
          }}
        />

        {/* Status Name */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <Input
              ref={inputRef}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className={`font-medium text-xs border-0 px-1 py-1 shadow-none ${
                isDarkMode
                  ? 'bg-transparent text-gray-200 placeholder-gray-400'
                  : 'bg-transparent text-gray-900 placeholder-gray-500'
              }`}
              placeholder={t('enterStatusName')}
            />
          ) : (
            <Text
              className={`text-xs font-medium cursor-pointer transition-colors select-none ${
                isDarkMode
                  ? 'text-gray-200 hover:text-gray-100'
                  : 'text-gray-800 hover:text-gray-900'
              }`}
              onClick={handleClick}
              title={t('rename')}
            >
              {status.name}
            </Text>
          )}
        </div>

        {/* Hover Actions */}
        <div
          className={`flex items-center gap-1 transition-all duration-200 ${
            isHovered || isEditing ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Tooltip title={t('rename')}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => setIsEditing(true)}
              className={`h-6 w-6 flex items-center justify-center transition-all duration-200 ${
                isDarkMode
                  ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            />
          </Tooltip>
          <Tooltip title={t('delete')}>
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => onDelete(id)}
              className={`h-6 w-6 flex items-center justify-center transition-all duration-200 ${
                isDarkMode
                  ? 'text-red-400 hover:text-red-300 hover:bg-red-800'
                  : 'text-red-500 hover:text-red-600 hover:bg-red-50'
              }`}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

// Category Section Component
const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  statuses,
  onRename,
  onDelete,
  onCategoryChange,
  onCreateStatus,
  isDarkMode,
  categories,
  dragOverCategory,
  activeId,
  dragOverIndex,
  localStatuses,
}) => {
  const { t } = useTranslation('task-list-filters');
  const [newStatusName, setNewStatusName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: `category-${category.id}`,
    data: {
      type: 'category',
      categoryId: category.id,
    },
  });

  const handleCreateStatus = useCallback(() => {
    if (newStatusName.trim()) {
      onCreateStatus(category.id, newStatusName.trim());
      setNewStatusName('');
      setShowAddForm(false);
    }
  }, [newStatusName, category.id, onCreateStatus]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleCreateStatus();
      } else if (e.key === 'Escape') {
        setNewStatusName('');
        setShowAddForm(false);
      }
    },
    [handleCreateStatus]
  );

  // Check if we should show cross-category drop placeholder
  const shouldShowPlaceholder = dragOverCategory === category.id && activeId;
  const draggedStatus = activeId
    ? localStatuses.find((s: IKanbanTaskStatus) => s.id === activeId)
    : null;
  const isDraggedFromDifferentCategory =
    draggedStatus && (draggedStatus as IKanbanTaskStatus).category_id !== category.id;

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border transition-all duration-200 ${
        isDarkMode
          ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
      } ${isOver && isDraggedFromDifferentCategory ? (isDarkMode ? 'ring-2 ring-blue-500 bg-gray-700 shadow-xl' : 'ring-2 ring-blue-500 bg-blue-100 shadow-xl') : ''} shadow-sm hover:shadow-md`}
      style={{ minHeight: '60px' }}
    >
      {/* Category Header */}
      <div
        className={`px-3 py-2 border-b transition-colors ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Title
              level={5}
              className={`m-0 font-semibold text-sm transition-colors ${
                isDarkMode ? 'text-gray-100' : 'text-gray-800'
              }`}
            >
              {category.name}
            </Title>
            <span
              className={`text-xs font-medium px-1.5 py-0.5 rounded transition-all ${
                isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {statuses.length}
            </span>
          </div>
          <Tooltip title={t('addStatus')}>
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setShowAddForm(true)}
              className={`h-7 px-2 text-xs font-medium transition-all duration-200 ${
                isDarkMode
                  ? 'text-gray-300 hover:text-gray-200 hover:bg-gray-700'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              {t('addStatus')}
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Category Content */}
      <div className="p-3">
        {/* Status List */}
        <SortableContext
          items={statuses.filter(status => status.id).map(status => status.id as string)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {statuses
              .filter(status => status.id)
              .map((status, index) => (
                <React.Fragment key={status.id}>
                  {/* Drop Placeholder - show at specific position for cross-category drops */}
                  {shouldShowPlaceholder &&
                    isDraggedFromDifferentCategory &&
                    dragOverIndex !== null &&
                    dragOverIndex === index && (
                      <div
                        className={`py-1.5 px-2 rounded border-2 border-dashed transition-all duration-200 ${
                          isDarkMode
                            ? 'border-blue-400 bg-blue-900/20 text-blue-300'
                            : 'border-blue-400 bg-blue-50 text-blue-600'
                        }`}
                      >
                        <div className="flex items-center gap-2 opacity-75">
                          <div className="flex-shrink-0 w-2.5 h-2.5 rounded border bg-gray-400" />
                          <Text
                            className={`text-xs font-medium ${
                              isDarkMode ? 'text-blue-300' : 'text-blue-600'
                            }`}
                          >
                            Drop here to move to {category.name}
                          </Text>
                        </div>
                      </div>
                    )}

                  <SortableStatusItem
                    id={status.id!}
                    status={status}
                    onRename={onRename}
                    onDelete={onDelete}
                    onCategoryChange={onCategoryChange}
                    isDarkMode={isDarkMode}
                    categories={categories}
                  />
                </React.Fragment>
              ))}

            {/* Drop Placeholder at the end for cross-category drops */}
            {shouldShowPlaceholder &&
              isDraggedFromDifferentCategory &&
              dragOverIndex !== null &&
              dragOverIndex >= statuses.length && (
                <div
                  className={`py-1.5 px-2 rounded border-2 border-dashed transition-all duration-200 ${
                    isDarkMode
                      ? 'border-blue-400 bg-blue-900/20 text-blue-300'
                      : 'border-blue-400 bg-blue-50 text-blue-600'
                  }`}
                >
                  <div className="flex items-center gap-2 opacity-75">
                    <div className="flex-shrink-0 w-2.5 h-2.5 rounded border bg-gray-400" />
                    <Text
                      className={`text-xs font-medium ${
                        isDarkMode ? 'text-blue-300' : 'text-blue-600'
                      }`}
                    >
                      Drop here to move to {category.name}
                    </Text>
                  </div>
                </div>
              )}
          </div>
        </SortableContext>

        {/* Add Status Form */}
        {showAddForm && (
          <div
            className={`mt-3 p-2 rounded border-2 border-dashed transition-all duration-200 ${
              isDarkMode
                ? 'border-gray-600 bg-gray-700 hover:border-gray-500'
                : 'border-gray-300 bg-white hover:border-gray-400'
            } shadow-sm`}
          >
            <div className="flex gap-2">
              <Input
                placeholder={t('enterNewStatusName')}
                value={newStatusName}
                onChange={e => setNewStatusName(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`flex-1 ${
                  isDarkMode
                    ? 'bg-gray-600 border-gray-500 text-gray-100 placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                size="small"
                autoFocus
              />
              <Button
                type="primary"
                onClick={handleCreateStatus}
                disabled={!newStatusName.trim()}
                size="small"
                className="text-xs"
              >
                {t('create')}
              </Button>
              <Button
                onClick={() => {
                  setNewStatusName('');
                  setShowAddForm(false);
                }}
                size="small"
                className={`text-xs ${
                  isDarkMode
                    ? 'text-gray-300 hover:text-gray-200 border-gray-600'
                    : 'text-gray-600 hover:text-gray-800 border-gray-300'
                }`}
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        )}

        {statuses.length === 0 && !showAddForm && (
          <div
            className={`text-center py-6 transition-colors ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            <Text className="text-xs font-medium">{t('noStatusesFound')}</Text>
            <br />
            <Button
              type="link"
              size="small"
              onClick={() => setShowAddForm(true)}
              className={`text-xs mt-1 font-medium ${
                isDarkMode
                  ? 'text-blue-400 hover:text-blue-300'
                  : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              {t('addStatus')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const ManageStatusModal: React.FC<ManageStatusModalProps> = ({ open, onClose, projectId }) => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();

  // Redux state
  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');
  const currentProjectId = useAppSelector(state => state.projectReducer.projectId);
  const { status: statuses } = useAppSelector(state => state.taskStatusReducer);

  const [localStatuses, setLocalStatuses] = useState<IKanbanTaskStatus[]>(statuses);
  const [statusCategories, setStatusCategories] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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
      dispatch(fetchStatusesCategories())
        .then((result: any) => {
          if (result.payload && Array.isArray(result.payload)) {
            setStatusCategories(result.payload);
          }
        })
        .catch(() => {
          setStatusCategories([]);
        });
    }
  }, [open, finalProjectId, dispatch]);

  // Group statuses by category
  const statusesByCategory = statusCategories.map(category => ({
    ...category,
    statuses: localStatuses.filter(
      status => (status as IKanbanTaskStatus).category_id === category.id
    ),
  }));

  const handleCategoryChange = useCallback(
    async (id: string, categoryId: string, insertIndex?: number) => {
      if (!finalProjectId) return;

      // Find the status being moved and its current category
      const statusToMove = localStatuses.find(s => s.id === id) as IKanbanTaskStatus;
      if (!statusToMove) return;

      const currentCategoryId = statusToMove.category_id;

      // Check if moving this status would leave the source category with less than 1 status
      const statusesInCurrentCategory = localStatuses.filter(
        s => (s as IKanbanTaskStatus).category_id === currentCategoryId
      );

      if (statusesInCurrentCategory.length <= 1) {
        // Find the category name for the error message
        const currentCategory = statusCategories.find(c => c.id === currentCategoryId);
        const categoryName = currentCategory?.name || 'category';

        AntModal.error({
          title: t('cannotMoveStatus'),
          content: t('cannotMoveStatusMessage', { categoryName }),
          okText: t('ok'),
        });
        return;
      }

      try {
        // Update local state optimistically first
        setLocalStatuses(prevStatuses => {
          const updatedStatuses = prevStatuses.map(status => {
            if (status.id === id) {
              return { ...status, category_id: categoryId } as IKanbanTaskStatus;
            }
            return status;
          });
          return updatedStatuses;
        });

        await statusApiService.updateStatusCategory(id, categoryId, finalProjectId);

        // If we have an insert index, we need to update the order as well
        if (insertIndex !== undefined) {
          // Create a complete new order for ALL statuses in the project
          const updatedStatuses = localStatuses.map(status => {
            if (status.id === id) {
              return { ...status, category_id: categoryId } as IKanbanTaskStatus;
            }
            return status;
          });

          // Group statuses by category with the updated category assignment
          const statusesByUpdatedCategory = statusCategories.map(category => ({
            ...category,
            statuses: updatedStatuses.filter(
              status => (status as IKanbanTaskStatus).category_id === category.id
            ),
          }));

          // Find the target category and insert the moved status at the correct position
          const targetCategoryIndex = statusesByUpdatedCategory.findIndex(
            cat => cat.id === categoryId
          );
          if (targetCategoryIndex !== -1) {
            const targetCategory = statusesByUpdatedCategory[targetCategoryIndex];
            const movedStatus = updatedStatuses.find((s: IKanbanTaskStatus) => s.id === id);
            const otherStatuses = targetCategory.statuses.filter(
              (s: IKanbanTaskStatus) => s.id !== id
            );

            // Insert at the specified index
            const newCategoryOrder = [...otherStatuses];
            if (movedStatus) {
              newCategoryOrder.splice(insertIndex, 0, movedStatus);
            }

            // Update the category with the new order
            statusesByUpdatedCategory[targetCategoryIndex] = {
              ...targetCategory,
              statuses: newCategoryOrder,
            };
          }

          // Create the final global order: flatten all categories in their display order
          const globalOrder: string[] = [];
          statusesByUpdatedCategory.forEach(category => {
            category.statuses.forEach((status: IKanbanTaskStatus) => {
              if (status.id) {
                globalOrder.push(status.id);
              }
            });
          });

          const requestBody = { status_order: globalOrder };
          await statusApiService.updateStatusOrder(requestBody, finalProjectId);
        }

        // Refresh from server to ensure consistency
        dispatch(fetchStatuses(finalProjectId));
        dispatch(fetchTasksV3(finalProjectId));
        dispatch(fetchEnhancedKanbanGroups(finalProjectId));
      } catch (error) {
        console.error('Error changing status category:', error);
        // Revert optimistic update on error
        dispatch(fetchStatuses(finalProjectId));
      }
    },
    [finalProjectId, dispatch, localStatuses, statusCategories, t]
  );

  const handleDragStart = useCallback((event: any) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over, active } = event;

      if (!over || !active) {
        setDragOverCategory(null);
        setDragOverIndex(null);
        return;
      }

      const overId = over.id.toString();
      const activeId = active.id.toString();

      const draggedStatus = localStatuses.find(s => s.id === activeId) as
        | IKanbanTaskStatus
        | undefined;
      if (!draggedStatus) {
        setDragOverCategory(null);
        setDragOverIndex(null);
        return;
      }

      // Check if we're dragging over a category area
      if (overId.startsWith('category-')) {
        const categoryId = overId.replace('category-', '');

        // Only show placeholder for cross-category drops
        if (draggedStatus.category_id !== categoryId) {
          setDragOverCategory(categoryId);
          // Default to end of category for category drops
          const targetCategory = statusesByCategory.find(c => c.id === categoryId);
          setDragOverIndex(targetCategory?.statuses.length || 0);
        } else {
          setDragOverCategory(null);
          setDragOverIndex(null);
        }
        return;
      }

      // Check if we're dragging over a status item
      const targetStatus = localStatuses.find(s => s.id === overId) as
        | IKanbanTaskStatus
        | undefined;
      if (!targetStatus || !targetStatus.category_id) {
        setDragOverCategory(null);
        setDragOverIndex(null);
        return;
      }

      // Only show placeholder for cross-category drops
      if (draggedStatus.category_id !== targetStatus.category_id) {
        setDragOverCategory(targetStatus.category_id);

        // Find the exact index of the target status in its category
        const targetCategory = statusesByCategory.find(c => c.id === targetStatus.category_id);
        if (targetCategory) {
          const targetIndex = targetCategory.statuses.findIndex(
            (s: IKanbanTaskStatus) => s.id === overId
          );
          setDragOverIndex(targetIndex >= 0 ? targetIndex : 0);
        } else {
          setDragOverIndex(0);
        }
      } else {
        // Same category - no placeholder needed (sortable handles it)
        setDragOverCategory(null);
        setDragOverIndex(null);
      }
    },
    [statusesByCategory, localStatuses]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveId(null);
      setDragOverCategory(null);
      setDragOverIndex(null);

      if (!over || !finalProjectId) {
        return;
      }

      const draggedStatusId = active.id as string;
      const overId = over.id as string;

      const draggedStatus = localStatuses.find(s => s.id === draggedStatusId) as
        | IKanbanTaskStatus
        | undefined;
      if (!draggedStatus) return;

      // Check if we're dropping on a category (cross-category move)
      if (overId.startsWith('category-')) {
        const newCategoryId = overId.replace('category-', '');

        // Only change category if it's different
        if (draggedStatus.category_id !== newCategoryId) {
          handleCategoryChange(draggedStatusId, newCategoryId);
        }
        return;
      }

      // Handle dropping on a status item
      const targetStatus = localStatuses.find(s => s.id === overId) as
        | IKanbanTaskStatus
        | undefined;
      if (!targetStatus || !targetStatus.category_id) return;

      // Check if this is a cross-category move
      if (draggedStatus.category_id !== targetStatus.category_id) {
        // Cross-category move - move to target category at target position
        const targetCategoryId = targetStatus.category_id;
        const targetCategoryStatuses =
          statusesByCategory.find(c => c.id === targetCategoryId)?.statuses || [];
        const targetIndex = targetCategoryStatuses.findIndex(
          (s: IKanbanTaskStatus) => s.id === overId
        );

        handleCategoryChange(draggedStatusId, targetCategoryId, targetIndex);
        return;
      }

      // Same category reordering
      if (draggedStatusId === overId) {
        return;
      }

      setLocalStatuses(items => {
        const oldIndex = items.findIndex(item => item.id === draggedStatusId);
        const newIndex = items.findIndex(item => item.id === overId);

        if (oldIndex === -1 || newIndex === -1) {
          return items;
        }

        // Use arrayMove for proper reordering
        const newItems = arrayMove(items, oldIndex, newIndex);

        // Update status order via API - send ALL statuses in global order
        const globalOrder = newItems.map(item => item.id).filter(Boolean) as string[];
        const requestBody = { status_order: globalOrder };

        statusApiService
          .updateStatusOrder(requestBody, finalProjectId)
          .then(() => {
            // Refresh task lists after status order change
            dispatch(fetchTasksV3(finalProjectId));
            dispatch(fetchEnhancedKanbanGroups(finalProjectId));
          })
          .catch(error => {
            console.error('Error updating status order:', error);
          });

        return newItems;
      });
    },
    [finalProjectId, dispatch, handleCategoryChange, localStatuses, statusesByCategory]
  );

  const handleCreateStatus = useCallback(
    async (categoryId: string, name: string) => {
      if (!name.trim() || !finalProjectId) return;

      try {
        // Find the highest order_index in the same category to add to the bottom
        const categoryStatuses = localStatuses.filter(
          status => (status as IKanbanTaskStatus).category_id === categoryId
        );
        const maxOrderIndex =
          categoryStatuses.length > 0
            ? Math.max(...categoryStatuses.map(s => s.order_index || 0))
            : 0;

        const body = {
          name: name.trim(),
          category_id: categoryId,
          project_id: finalProjectId,
          order_index: maxOrderIndex + 1,
        };

        const res = await dispatch(
          createStatus({ body, currentProjectId: finalProjectId })
        ).unwrap();
        if (res.done) {
          dispatch(fetchStatuses(finalProjectId));
          dispatch(fetchTasksV3(finalProjectId));
          dispatch(fetchEnhancedKanbanGroups(finalProjectId));
        }
      } catch (error) {
        console.error('Error creating status:', error);
      }
    },
    [finalProjectId, dispatch, localStatuses]
  );

  const handleRenameStatus = useCallback(
    async (id: string, name: string) => {
      if (!finalProjectId || !name.trim()) return;

      try {
        // Find the current status to get its category_id (required by backend validator)
        const currentStatus = localStatuses.find(s => s.id === id) as IKanbanTaskStatus;

        const body: ITaskStatusUpdateModel = {
          name: name.trim(),
          project_id: finalProjectId,
          category_id: currentStatus?.category_id || '', // Required by backend validator
        };

        await statusApiService.updateNameOfStatus(id, body, finalProjectId);
        dispatch(fetchStatuses(finalProjectId));
        dispatch(fetchTasksV3(finalProjectId));
        dispatch(fetchEnhancedKanbanGroups(finalProjectId));
      } catch (error) {
        console.error('Error renaming status:', error);
      }
    },
    [finalProjectId, dispatch, localStatuses]
  );

  const handleDeleteStatus = useCallback(
    async (id: string) => {
      if (!finalProjectId) return;

      AntModal.confirm({
        title: t('deleteStatus'),
        content: t('deleteStatusConfirm'),
        okText: t('delete'),
        cancelText: t('cancel'),
        okButtonProps: { danger: true },
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
    },
    [localStatuses, finalProjectId, dispatch, t]
  );

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
        {/* Info Banner */}
        <div
          className={`p-3 rounded border transition-all duration-200 ${
            isDarkMode
              ? 'bg-gray-800 border-gray-700 text-gray-300'
              : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}
        >
          <Text className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-blue-700'}`}>
            💡 Drag statuses to reorder within categories or drag between categories to change their
            type.
          </Text>
          <br />
          <Text className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-blue-600'}`}>
            ⚠️ Note: Each category must have at least one status. You cannot move a status if it's
            the only one in its category.
          </Text>
        </div>

        {/* Category Sections with Drag & Drop */}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          collisionDetection={closestCenter}
        >
          <div className="space-y-3">
            {statusesByCategory.map(category => (
              <CategorySection
                key={category.id}
                category={category}
                statuses={category.statuses}
                onRename={handleRenameStatus}
                onDelete={handleDeleteStatus}
                onCategoryChange={handleCategoryChange}
                onCreateStatus={handleCreateStatus}
                isDarkMode={isDarkMode}
                categories={statusCategories}
                dragOverCategory={dragOverCategory}
                activeId={activeId}
                dragOverIndex={dragOverIndex}
                localStatuses={localStatuses}
              />
            ))}
          </div>

          <DragOverlay>
            {activeId ? (
              <div
                className={`py-1.5 px-2 rounded border transition-all duration-200 shadow-lg ${
                  isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <HolderOutlined className="text-sm text-gray-400" />
                  <div className="flex-shrink-0 w-2.5 h-2.5 rounded border bg-gray-400" />
                  <Text
                    className={`text-xs font-medium ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-800'
                    }`}
                  >
                    {localStatuses.find(s => s.id === activeId)?.name || 'Status'}
                  </Text>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

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

export default ManageStatusModal;
