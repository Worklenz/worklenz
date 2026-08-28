import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Modal,
  Input,
  Button,
  Typography,
  Tooltip,
  ColorPicker,
  theme,
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
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { updateGroupColor } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { fetchEnhancedKanbanGroups } from '@/features/enhanced-kanban/enhanced-kanban.slice';

const { Text } = Typography;

interface StatusItemProps {
  status: IKanbanTaskStatus;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
}

interface CategorySectionProps {
  category: any;
  statuses: IKanbanTaskStatus[];
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  onCreateStatus: (categoryId: string, name: string) => void;
  dragOverCategory: string | null;
  activeId: string | null;
  dragOverIndex: number | null;
  localStatuses: IKanbanTaskStatus[];
  // Lifted state for controlling which category's add form is open
  activeAddCategoryId: string | null;
  onSetActiveAddCategory: (categoryId: string | null) => void;
}

// Sortable Status Item Component (compact with hover actions)
const SortableStatusItem: React.FC<StatusItemProps & { id: string }> = ({
  id,
  status,
  onRename,
  onDelete,
  onColorChange,
}) => {
  const { t } = useTranslation('task-list-filters');
  const { token } = theme.useToken();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(status.name || '');
  const [isHovered, setIsHovered] = useState(false);
  const [color, setColor] = useState(status.color_code || '#a9a9a9');
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<any>(null);

  const colorRef = useRef(color);
  colorRef.current = color;
  useEffect(() => {
    setColor(status.color_code || '#a9a9a9');
  }, [status.color_code]);

  const handleColorChangeComplete = useCallback(() => {
    setPickerOpen(false);
    onColorChange(id, colorRef.current);
  }, [id, onColorChange]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    borderRadius: 6,
    border: `1px solid ${isDragging ? token.colorPrimary : 'transparent'}`,
    background: isDragging ? token.colorFillSecondary : isHovered ? token.colorFillTertiary : 'transparent',
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        {...attributes}
        {...listeners}
        style={{
          flexShrink: 0,
          display: 'flex',
          cursor: 'grab',
          color: token.colorTextTertiary,
        }}
      >
        <HolderOutlined style={{ fontSize: 13 }} />
      </div>

      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <ColorPicker
          value={color}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onChange={value => setColor(value.toHexString())}
          size="small"
          disabledAlpha
          panelRender={panel => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {panel}
              <Button type="primary" size="small" block onClick={handleColorChangeComplete}>
                {t('apply')}
              </Button>
            </div>
          )}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              cursor: 'pointer',
              backgroundColor: color,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          />
        </ColorPicker>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <Input
            ref={inputRef}
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            size="small"
            variant="borderless"
            style={{ padding: 0, fontSize: 12, fontWeight: 500 }}
            placeholder={t('enterStatusName')}
          />
        ) : (
          <Text
            style={{ fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
            onClick={() => setIsEditing(true)}
            title={t('rename')}
            ellipsis
          >
            {status.name}
          </Text>
        )}
      </div>

      <div style={{ display: 'flex', gap: 2, opacity: isHovered || isEditing ? 1 : 0 }}>
        <Tooltip title={t('rename')}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined style={{ fontSize: 12 }} />}
            onClick={() => setIsEditing(true)}
          />
        </Tooltip>
        <Tooltip title={t('delete')}>
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined style={{ fontSize: 12 }} />}
            onClick={() => onDelete(id)}
          />
        </Tooltip>
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
  onCreateStatus,
  onColorChange,
  dragOverCategory,
  activeId,
  dragOverIndex,
  localStatuses,
  activeAddCategoryId,
  onSetActiveAddCategory,
}) => {
  const { t } = useTranslation('task-list-filters');
  const { token } = theme.useToken();
  const [newStatusName, setNewStatusName] = useState('');

  // Derived from lifted state — only this category's form is open when IDs match
  const showAddForm = activeAddCategoryId === category.id;

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
      onSetActiveAddCategory(null);
    }
  }, [newStatusName, category.id, onCreateStatus, onSetActiveAddCategory]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleCreateStatus();
      } else if (e.key === 'Escape') {
        setNewStatusName('');
        onSetActiveAddCategory(null);
      }
    },
    [handleCreateStatus, onSetActiveAddCategory]
  );

  // Check if we should show cross-category drop placeholder
  const shouldShowPlaceholder = dragOverCategory === category.id && activeId;
  const draggedStatus = activeId
    ? localStatuses.find((s: IKanbanTaskStatus) => s.id === activeId)
    : null;
  const isDraggedFromDifferentCategory =
    draggedStatus && (draggedStatus as IKanbanTaskStatus).category_id !== category.id;
  const highlightDrop = isOver && isDraggedFromDifferentCategory;

  return (
    <div
      ref={setNodeRef}
      style={{
        borderRadius: 10,
        border: `1px solid ${highlightDrop ? token.colorPrimary : token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        minHeight: 60,
      }}
    >
      {/* Category Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: 600 }}>{category.name}</Text>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '0 6px',
              borderRadius: 8,
              background: token.colorFillSecondary,
              color: token.colorTextSecondary,
            }}
          >
            {statuses.length}
          </span>
        </div>
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined style={{ fontSize: 11 }} />}
          onClick={() => onSetActiveAddCategory(category.id)}
          style={{ fontSize: 12, color: token.colorTextSecondary }}
        >
          {t('addStatus')}
        </Button>
      </div>

      {/* Category Content */}
      <div style={{ padding: 8 }}>
        <SortableContext
          items={statuses.filter(status => status.id).map(status => status.id as string)}
          strategy={verticalListSortingStrategy}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {statuses
              .filter(status => status.id)
              .map((status, index) => (
                <React.Fragment key={status.id}>
                  {shouldShowPlaceholder &&
                    isDraggedFromDifferentCategory &&
                    dragOverIndex !== null &&
                    dragOverIndex === index && (
                      <div
                        style={{
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: `1px dashed ${token.colorPrimary}`,
                          background: token.colorFillTertiary,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: token.colorPrimary }}>
                          {t('dropToMoveToCategory', { categoryName: category.name })}
                        </Text>
                      </div>
                    )}

                  <SortableStatusItem
                    id={status.id!}
                    status={status}
                    onRename={onRename}
                    onDelete={onDelete}
                    onColorChange={onColorChange}
                  />
                </React.Fragment>
              ))}

            {shouldShowPlaceholder &&
              isDraggedFromDifferentCategory &&
              dragOverIndex !== null &&
              dragOverIndex >= statuses.length && (
                <div
                  style={{
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: `1px dashed ${token.colorPrimary}`,
                    background: token.colorFillTertiary,
                  }}
                >
                  <Text style={{ fontSize: 12, color: token.colorPrimary }}>
                    {t('dropToMoveToCategory', { categoryName: category.name })}
                  </Text>
                </div>
              )}
          </div>
        </SortableContext>

        {/* Add Status Form — only renders for the active category */}
        {showAddForm && (
          <div
            style={{
              marginTop: 8,
              padding: 6,
              borderRadius: 6,
              border: `1px dashed ${token.colorBorder}`,
              display: 'flex',
              gap: 6,
            }}
          >
            <Input
              placeholder={t('enterNewStatusName')}
              value={newStatusName}
              onChange={e => setNewStatusName(e.target.value)}
              onKeyDown={handleKeyDown}
              size="small"
              autoFocus
              style={{ flex: 1 }}
            />
            <Button
              type="primary"
              onClick={handleCreateStatus}
              disabled={!newStatusName.trim()}
              size="small"
            >
              {t('create')}
            </Button>
            <Button
              onClick={() => {
                setNewStatusName('');
                onSetActiveAddCategory(null);
              }}
              size="small"
            >
              {t('cancel')}
            </Button>
          </div>
        )}

        {statuses.length === 0 && !showAddForm && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <Text style={{ fontSize: 12 }} type="secondary">
              {t('noStatusesFound')}
            </Text>
            <br />
            <Button
              type="link"
              size="small"
              onClick={() => onSetActiveAddCategory(category.id)}
              style={{ fontSize: 12 }}
            >
              {t('addStatus')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

interface ManageStatusContentProps {
  projectId?: string;
}

/**
 * Inline (non-modal) status management panel. Extracted from ManageStatusModal
 * so it can be embedded directly inside the project settings modal's sidebar
 * as well as rendered inside a standalone Modal wrapper elsewhere.
 */
const ManageStatusContent: React.FC<ManageStatusContentProps> = ({ projectId }) => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();

  // Redux state
  const currentProjectId = useAppSelector(state => state.projectReducer.projectId);
  const { status: statuses } = useAppSelector(state => state.taskStatusReducer);

  const [localStatuses, setLocalStatuses] = useState<IKanbanTaskStatus[]>(statuses);
  const [statusCategories, setStatusCategories] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Single source of truth: tracks which category's "Add Status" form is open.
  // Only one can be open at a time — setting a new category ID closes the previous one.
  const [activeAddCategoryId, setActiveAddCategoryId] = useState<string | null>(null);

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
    if (finalProjectId) {
      dispatch(fetchStatuses(finalProjectId));
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
  }, [finalProjectId, dispatch]);

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

        Modal.error({
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

      Modal.confirm({
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

  const handleColorChange = useCallback(
    async (id: string, colorCode: string) => {
      if (!finalProjectId) return;
      try {
        // 1. Optimistic update in local state
        setLocalStatuses(prev =>
          prev.map(s => (s.id === id ? { ...s, color_code: colorCode } : s))
        );

        // 2. Save to backend
        await statusApiService.updateStatusColor(id, colorCode, finalProjectId);

        // 3. Immediately patch the board column color in Redux — no refetch needed
        dispatch(updateGroupColor({ groupId: id, colorCode }));

        // 4. Refresh everything so next load is also consistent
        dispatch(fetchStatuses(finalProjectId));
        dispatch(fetchTasksV3(finalProjectId));

        dispatch(fetchEnhancedKanbanGroups(finalProjectId));
      } catch (error) {
        console.error('Error updating status color:', error);
        dispatch(fetchStatuses(finalProjectId));
      }
    },
    [finalProjectId, dispatch]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Info Banner */}
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillTertiary,
        }}
      >
        <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
          {t('dragToReorderStatuses')}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {statusesByCategory.map(category => (
            <CategorySection
              key={category.id}
              category={category}
              statuses={category.statuses}
              onRename={handleRenameStatus}
              onDelete={handleDeleteStatus}
              onColorChange={handleColorChange}
              onCreateStatus={handleCreateStatus}
              dragOverCategory={dragOverCategory}
              activeId={activeId}
              dragOverIndex={dragOverIndex}
              localStatuses={localStatuses}
              activeAddCategoryId={activeAddCategoryId}
              onSetActiveAddCategory={setActiveAddCategoryId}
            />
          ))}
        </div>

        <DragOverlay>
          {activeId ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 6,
                border: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorBgElevated,
                boxShadow: token.boxShadowSecondary,
              }}
            >
              <HolderOutlined style={{ fontSize: 13, color: token.colorTextTertiary }} />
              <Text style={{ fontSize: 12, fontWeight: 500 }}>
                {localStatuses.find(s => s.id === activeId)?.name || t('statusText')}
              </Text>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {statusCategories.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Text style={{ fontSize: 13 }} type="secondary">
            {t('noStatusesFound')}
          </Text>
        </div>
      )}
    </div>
  );
};

export default ManageStatusContent;
