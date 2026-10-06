import React, { useState, useCallback, useMemo, memo, useEffect, useRef } from 'react';
import { Tooltip, Flex, Dropdown, DatePicker, Input, Popover, Button, Typography, message } from '@/shared/antd-imports';
import { PlusOutlined, SettingOutlined, CrownOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setCustomColumnModalAttributes,
  toggleCustomColumnModalOpen,
} from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import { toggleProjectMemberDrawer } from '@/features/projects/singleProject/members/projectMembersSlice';
import PeopleDropdown from '@/components/common/people-dropdown/PeopleDropdown';
import AvatarGroup from '@/components/AvatarGroup';
import dayjs from 'dayjs';
import { useAuthService } from '@/hooks/useAuth';
import { isFreeUser, hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import { openUpgradeModal, toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import { useAppSumoTracking } from '@/ee/hooks/useAppSumoTracking';
import { AppSumoUpsellEvents } from '@/types/mixpanel-events.types';
import {
  getTaskCustomFieldDisplayName,
  parsePeopleCustomFieldValue,
} from '@/utils/task-custom-columns';
import { selectCustomColumns } from '@/features/task-management/task-management.selectors';
import { LICENSING_SETTINGS } from '@/shared/licensing_settings';
import { isUserGuest } from '@/lib/project/project-view-guest';

// Add Custom Column Button Component
export const AddCustomColumnButton: React.FC = memo(() => {
  const dispatch = useAppDispatch();
  const isDarkMode = useAppSelector(state => state.themeReducer.mode === 'dark');
  const { t } = useTranslation('task-list-table');
  const { t: tCommon } = useTranslation('common');
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const isFree = isFreeUser(currentSession);
  const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);
  const isLtdUser =
    currentSession?.subscription_type === ISUBSCRIPTION_TYPE.LIFE_TIME_DEAL ||
    String(currentSession?.subscription_status || '').toLowerCase() === 'life_time_deal';

  const customColumns = useAppSelector(selectCustomColumns);
  const customColumnsCount = customColumns?.length ?? 0;

  // Check if current user is a guest
  const selectedProject = useAppSelector(state => state.projectReducer.project);
  const isGuest = isUserGuest(selectedProject);

  // At or over the custom field limit (non-business users)
  const hasReachedLimit = !hasBusinessAccess && customColumnsCount >= LICENSING_SETTINGS.CUSTOM_FIELDS_LIMIT;
  // AppSumo/LTD users who already had >limit fields before the limit was enforced
  const isGrandfathered = !hasBusinessAccess && isLtdUser && customColumnsCount >= LICENSING_SETTINGS.CUSTOM_FIELDS_LIMIT;

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { trackAppSumoEvent } = useAppSumoTracking();
  const isAppSumoUser = String(currentSession?.subscription_type || '').toLowerCase().includes('appsumo');

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      // Ignore clicks on the trigger button itself (handleModalOpen handles those)
      if (buttonRef.current?.contains(e.target as Node)) return;
      // Ignore clicks inside the popover overlay (Ant Design renders it in document.body)
      const popoverEl = document.querySelector('.ant-popover');
      if (popoverEl?.contains(e.target as Node)) return;
      setPopoverOpen(false);
      if (isAppSumoUser) {
        trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_PROMPT_DISMISSED, { feature: 'custom_fields' });
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [popoverOpen, isAppSumoUser, trackAppSumoEvent]);

  const handleCreateColumn = useCallback(async () => {
    // Prevent guests from creating custom columns
    if (isGuest) {
      return;
    }
    if (isFree) {
      dispatch(toggleUpgradeModal());
      return;
    }
    if (isGrandfathered || hasReachedLimit) {
      setPopoverOpen(true);
      if (isAppSumoUser) {
        trackAppSumoEvent(AppSumoUpsellEvents.CUSTOM_FIELD_LIMIT_HIT, { feature: 'custom_fields' });
        trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_PROMPT_SHOWN, { feature: 'custom_fields' });
      }
      return;
    }

    if (isCreating) return;
    setIsCreating(true);

    try {
      // Import necessary modules
      const { nanoid } = await import('@reduxjs/toolkit');
      const { tasksCustomColumnsService } = await import('@/api/tasks/tasks-custom-columns.service');
      const { addCustomColumn } = await import('@/features/task-management/task-management.slice');
      const { SocketEvents } = await import('@/shared/socket-events');
      
      const columnKey = nanoid();
      const defaultFieldTitle = t('customColumns.newColumn', { defaultValue: 'New Column' });
      const projectId = selectedProject?.id;

      if (!projectId) {
        message.error(t('customColumns.projectNotFound', { defaultValue: 'Project not found' }));
        setIsCreating(false);
        return;
      }

      const configuration = {
        field_title: defaultFieldTitle,
        field_type: 'text',
        number_type: undefined,
        decimals: undefined,
        label: undefined,
        label_position: undefined,
        preview_value: undefined,
        expression: undefined,
        first_numeric_column_key: undefined,
        second_numeric_column_key: undefined,
        selections_list: [],
        labels_list: [],
      };

      // Create column in backend
      const res = await tasksCustomColumnsService.createCustomColumn(projectId, {
        name: defaultFieldTitle,
        key: columnKey,
        field_type: 'text',
        width: 120,
        is_visible: true,
        configuration,
      });

      if (res.done) {
        const newColumn: any = {
          key: columnKey,
          name: defaultFieldTitle,
          columnHeader: null, // Will be rendered dynamically
          width: 120,
          isVisible: true,
          custom_column: true,
          custom_column_obj: {
            fieldTitle: defaultFieldTitle,
            fieldType: 'text',
            labelsList: [],
            selectionsList: [],
          },
          id: res.body.id,
          uuid: res.body.id,
          project_id: projectId,
          pinned: true, // Make column visible by default
          isEditingHeader: true, // Flag to trigger inline editing
        };

        dispatch(addCustomColumn(newColumn));
        
        // Emit socket event if available
        if ((window as any).socket) {
          (window as any).socket.emit(SocketEvents.CUSTOM_COLUMN_CREATED.toString(), JSON.stringify({ project_id: projectId }));
        }
        
        message.success(t('customColumns.columnCreated', { defaultValue: 'Column created. Click on the header to edit.' }));
      }
    } catch (error) {
      console.error('Error creating custom column:', error);
      message.error(t('customColumns.columnCreationFailed', { defaultValue: 'Failed to create column' }));
    } finally {
      setIsCreating(false);
    }
  }, [dispatch, isFree, hasReachedLimit, isGrandfathered, isGuest, isCreating, isAppSumoUser, selectedProject, t, trackAppSumoEvent]);

  const handleUpgradeNow = useCallback(() => {
    setPopoverOpen(false);
    if (isAppSumoUser) {
      trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_NOW_CLICKED, { feature: 'custom_fields' });
    }
    dispatch(openUpgradeModal('customFields'));
  }, [dispatch, isAppSumoUser, trackAppSumoEvent]);

  const popoverTitle = isGrandfathered
    ? t('customColumns.limitPopover.appSumoTitle', { defaultValue: 'Plan Upgrade Required' })
    : t('customColumns.limitPopover.title', { defaultValue: 'Custom Field Limit Reached' });

  const popoverBody = isGrandfathered
    ? t('customColumns.limitPopover.appSumoBody', {
        defaultValue:
          'Adding custom fields beyond your current plan limit requires a Business plan.',
      })
    : t('customColumns.limitPopover.body', {
        defaultValue:
          'You have used all {{limit}} custom fields available on your plan. Upgrade to add unlimited custom fields to your projects.',
        limit: LICENSING_SETTINGS.CUSTOM_FIELDS_LIMIT,
      });

  const popoverContent = (
    <Flex vertical gap={12} style={{ maxWidth: 260 }}>
      <Typography.Text>{popoverBody}</Typography.Text>
      <Button type="primary" size="small" onClick={handleUpgradeNow}>
        {t('customColumns.limitPopover.cta', { defaultValue: 'Upgrade Now' })}
      </Button>
    </Flex>
  );

  const tooltipTitle = isGuest
    ? t('customColumns.guestCannotAddColumn', { defaultValue: 'Guest users cannot add custom columns' })
    : hasReachedLimit || isGrandfathered
      ? t('customColumns.limitPopover.title', { defaultValue: 'Custom Field Limit Reached' })
      : isFree
        ? tCommon('upgrade-plan', { defaultValue: 'Upgrade plan' })
        : t('customColumns.addCustomColumn', { defaultValue: 'Add a custom column' });

  return isGuest ? null : (
    <Popover
      open={popoverOpen}
      title={popoverTitle}
      content={popoverContent}
      trigger={[]}
      placement="bottomRight"
    >
      <Tooltip title={!popoverOpen ? tooltipTitle : undefined} placement="top">
        <button
          ref={buttonRef}
          onClick={handleCreateColumn}
          disabled={isFree || isGuest || isCreating}
          className={`
            group relative w-9 h-9 rounded-lg border-2 border-dashed transition-all duration-200
            flex items-center justify-center
            ${
              isFree || isGuest || isCreating
                ? isDarkMode
                  ? 'border-gray-600 text-gray-500 cursor-not-allowed opacity-50'
                  : 'border-gray-300 text-gray-400 cursor-not-allowed opacity-50'
                : isDarkMode
                  ? 'border-gray-600 hover:border-blue-500 hover:bg-blue-500/10 text-gray-500 hover:text-blue-400'
                  : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50 text-gray-400 hover:text-blue-600'
            }
          `}
        >
          {isFree ? (
            <CrownOutlined style={{ fontSize: '16px', color: '#faad14' }} />
          ) : isCreating ? (
            <div className="animate-spin">⟳</div>
          ) : (
            <PlusOutlined className="text-sm transition-transform duration-200 group-hover:scale-110" />
          )}

          {/* Subtle glow effect on hover - only for non-free, non-guest, and non-creating users */}
          {!isFree && !isGuest && !isCreating && (
            <div
              className={`
              absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200
              ${
                isDarkMode
                  ? 'bg-blue-500/5 shadow-lg shadow-blue-500/20'
                  : 'bg-blue-500/5 shadow-lg shadow-blue-500/10'
              }
            `}
            />
          )}
        </button>
      </Tooltip>
    </Popover>
  );
});

AddCustomColumnButton.displayName = 'AddCustomColumnButton';

// Custom Column Header Component with Inline Editing
export const CustomColumnHeader: React.FC<{
  column: any;
  onSettingsClick: (columnId: string) => void;
  dragListeners?: any;
  dragAttributes?: any;
  setDragActivatorRef?: (element: HTMLElement | null) => void;
  isGuest?: boolean;
}> = ({ column, onSettingsClick, dragListeners, dragAttributes, setDragActivatorRef, isGuest = false }) => {
  const { t } = useTranslation('task-list-table');
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(column.isEditingHeader || false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const saveInProgressRef = useRef(false);
  const inputRef = useRef<any>(null);
  const dispatch = useAppDispatch();

  const displayName =
    getTaskCustomFieldDisplayName(column) || t('customColumns.customColumnHeader');

  // Initialize edit value when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditValue(displayName);
      // Focus input after a short delay to ensure it's rendered
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 100);
    }
  }, [isEditing, displayName]);

  // Auto-trigger edit mode for newly created columns
  useEffect(() => {
    if (column.isEditingHeader) {
      setIsEditing(true);
    }
  }, [column.isEditingHeader]);

  const handleSave = async () => {
    if (saveInProgressRef.current) return;

    if (!editValue.trim()) {
      message.error(t('customColumns.columnNameRequired', { defaultValue: 'Column name is required' }));
      return;
    }

    const columnId = column.id || column.uuid;
    const openInitialSetupModal = (columnData: typeof column) => {
      if (!columnId) return;

      dispatch(
        setCustomColumnModalAttributes({
          modalType: 'edit',
          columnId,
          columnData,
          canChangeColumnType: true,
        })
      );
      dispatch(toggleCustomColumnModalOpen(true));
    };

    if (editValue.trim() === displayName) {
      setIsEditing(false);
      if (column.isEditingHeader) {
        openInitialSetupModal(column);
      }
      return;
    }

    saveInProgressRef.current = true;
    setIsSaving(true);
    try {
      // CRITICAL: Use UUID from id field, never use the key (which is a nanoid)
      if (!columnId) {
        message.error(t('customColumns.columnIdNotFound', { defaultValue: 'Column ID not found - please refresh and try again' }));
        setIsSaving(false);
        return;
      }
      
      // Import the service
      const { tasksCustomColumnsService } = await import('@/api/tasks/tasks-custom-columns.service');
      const { updateCustomColumn } = await import('@/features/task-management/task-management.slice');
      
      // Build complete configuration with existing values (convert camelCase to snake_case)
      const existingConfig = column.custom_column_obj || {};
      const configuration = {
        field_title: editValue.trim(),
        field_type: existingConfig.fieldType || 'text',
        number_type: existingConfig.numberType || null,
        decimals: existingConfig.decimals || null,
        label: existingConfig.label || null,
        label_position: existingConfig.labelPosition || null,
        preview_value: existingConfig.previewValue || null,
        expression: existingConfig.expression || null,
        first_numeric_column_key: existingConfig.firstNumericColumnKey || null,
        second_numeric_column_key: existingConfig.secondNumericColumnKey || null,
        selections_list: existingConfig.selectionsList || [],
        labels_list: existingConfig.labelsList || [],
      };
      
      // Update backend
      const response = await tasksCustomColumnsService.updateCustomColumn(columnId, {
        name: editValue.trim(),
        field_type: existingConfig.fieldType || 'text',
        width: Number.parseInt(String(column.width || 120), 10) || 120,
        is_visible: true,
        configuration,
      });

      if (!response.done) {
        setIsEditing(false);
        return;
      }

      // Update the local column immediately so the header reflects the saved name.
      const updatedColumn = {
        ...column,
        name: editValue.trim(),
        pinned: column.pinned ?? true,
        custom_column: true,
        isEditingHeader: false,
        custom_column_obj: {
          ...existingConfig,
          fieldTitle: editValue.trim(),
        },
      };
      dispatch(updateCustomColumn({ key: column.key, column: updatedColumn }));

      message.success(t('customColumns.columnUpdated', { defaultValue: 'Column name updated' }));
      setIsEditing(false);
      openInitialSetupModal(updatedColumn);
    } catch (error) {
      console.error('Error updating column name:', error);
      message.error(t('customColumns.updateFailed', { defaultValue: 'Failed to update column name' }));
    } finally {
      saveInProgressRef.current = false;
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(displayName);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing && !isGuest) {
    return (
      <Flex align="center" gap={4} className="w-full px-2" style={{ minWidth: 0 }}>
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('customColumns.enterColumnName', { defaultValue: 'Enter column name' })}
          size="small"
          style={{ flex: 1, minWidth: 0 }}
          disabled={isSaving}
        />
        <Tooltip title={t('save', { defaultValue: 'Save' })}>
          <Button
            type="text"
            size="small"
            icon={<span style={{ color: '#52c41a' }}>✓</span>}
            onClick={handleSave}
            loading={isSaving}
            style={{ padding: '0 4px', minWidth: 24 }}
          />
        </Tooltip>
        <Tooltip title={t('cancel', { defaultValue: 'Cancel' })}>
          <Button
            type="text"
            size="small"
            icon={<span style={{ color: '#ff4d4f' }}>✕</span>}
            onClick={handleCancel}
            disabled={isSaving}
            style={{ padding: '0 4px', minWidth: 24 }}
          />
        </Tooltip>
      </Flex>
    );
  }

  return (
    <Flex
      align="center"
      justify="space-between"
      className="w-full px-2 group"
      style={{ minWidth: 0 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        ref={setDragActivatorRef}
        {...dragAttributes}
        {...dragListeners}
        title={displayName}
        className="truncate flex-1 mr-1"
        style={{ minWidth: 0, cursor: dragListeners ? 'grab' : (!isGuest ? 'pointer' : 'default') }}
        onClick={!isGuest ? () => setIsEditing(true) : undefined}
      >
        {displayName}
      </span>
      {/* Right-side icons: settings icon only - hidden for guests */}
      {!isGuest && (
        <Flex align="center" gap={4} className="flex-shrink-0" onClick={e => e.stopPropagation()}>
          <Tooltip title={t('customColumns.customColumnSettings')}>
            <SettingOutlined
              className={`hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 ${
                isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
              onClick={e => {
                e.stopPropagation();
                onSettingsClick(column.key || column.id);
              }}
            />
          </Tooltip>
        </Flex>
      )}
    </Flex>
  );
};

// Custom Column Cell Component with Interactive Inputs
export const CustomColumnCell: React.FC<{
  column: any;
  task: any;
  disabled?: boolean;
  updateTaskCustomColumnValue: (
    taskId: string,
    columnKey: string,
    value: string | number | boolean | string[] | null
  ) => void;
}> = memo(({ column, task, disabled = false, updateTaskCustomColumnValue }) => {
  const { t } = useTranslation('task-list-table');

  const customValue = task.custom_column_values?.[column.key];
  const fieldType = column.custom_column_obj?.fieldType;

  if (!fieldType || !column.custom_column) {
    return <span className="text-gray-400 text-sm">-</span>;
  }

  if (disabled) {
    return <ReadOnlyCustomColumnCell fieldType={fieldType} customValue={customValue} />;
  }

  // Render different input types based on field type
  switch (fieldType) {
    case 'people':
      return (
        <PeopleCustomColumnCell
          task={task}
          columnKey={column.key}
          customValue={customValue}
          updateTaskCustomColumnValue={updateTaskCustomColumnValue}
        />
      );
    case 'date':
      return (
        <DateCustomColumnCell
          task={task}
          columnKey={column.key}
          customValue={customValue}
          updateTaskCustomColumnValue={updateTaskCustomColumnValue}
        />
      );
    case 'number':
      return (
        <NumberCustomColumnCell
          task={task}
          columnKey={column.key}
          customValue={customValue}
          columnObj={column.custom_column_obj}
          updateTaskCustomColumnValue={updateTaskCustomColumnValue}
        />
      );
    case 'text':
      return (
        <TextCustomColumnCell
          task={task}
          columnKey={column.key}
          customValue={customValue}
          updateTaskCustomColumnValue={updateTaskCustomColumnValue}
        />
      );
    case 'selection':
      return (
        <SelectionCustomColumnCell
          task={task}
          columnKey={column.key}
          customValue={customValue}
          columnObj={column.custom_column_obj}
          updateTaskCustomColumnValue={updateTaskCustomColumnValue}
        />
      );
    default:
      return (
        <span className="text-sm text-gray-400 px-2">{t('customColumns.unsupportedField')}</span>
      );
  }
});

CustomColumnCell.displayName = 'CustomColumnCell';

const ReadOnlyCustomColumnCell: React.FC<{
  fieldType: string;
  customValue: any;
}> = memo(({ fieldType, customValue }) => {
  const members = useAppSelector(state => state.teamMembersReducer.teamMembers);
  const displayValue =
    fieldType === 'people'
      ? parsePeopleCustomFieldValue(customValue)
          .map(memberId => members?.data?.find(member => member.id === memberId)?.name)
          .filter(Boolean)
          .join(', ')
      : fieldType === 'date' && customValue
        ? dayjs(customValue).format('MMM DD, YYYY')
        : Array.isArray(customValue)
          ? customValue.join(', ')
          : String(customValue ?? '');

  return <span className="text-sm px-2 truncate">{displayValue || '-'}</span>;
});

ReadOnlyCustomColumnCell.displayName = 'ReadOnlyCustomColumnCell';

export const TextCustomColumnCell: React.FC<{
  task: any;
  columnKey: string;
  customValue: any;
  updateTaskCustomColumnValue: (
    taskId: string,
    columnKey: string,
    value: string | number | boolean | string[] | null
  ) => void;
}> = memo(({ task, columnKey, customValue, updateTaskCustomColumnValue }) => {
  const { t } = useTranslation('task-list-table');
  const [inputValue, setInputValue] = useState(String(customValue || ''));

  useEffect(() => {
    setInputValue(String(customValue || ''));
  }, [customValue]);

  const handleBlur = () => {
    if (!task.id) return;

    const nextValue = inputValue.trim();
    const currentValue = String(customValue || '').trim();

    if (nextValue === currentValue) return;
    updateTaskCustomColumnValue(task.id, columnKey, nextValue || null);
  };

  return (
    <div className="px-2" style={{ minWidth: 0, width: '100%' }}>
      <Input
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onBlur={handleBlur}
        onPressEnter={event => {
          if (!task.id) return;
          updateTaskCustomColumnValue(task.id, columnKey, event.currentTarget.value.trim() || null);
        }}
        placeholder={t('customColumns.textPlaceholder', { defaultValue: 'Enter text' })}
        size="small"
        variant="borderless"
        style={{ width: '100%', minWidth: 0 }}
        className="custom-column-text-input"
      />
    </div>
  );
});

TextCustomColumnCell.displayName = 'TextCustomColumnCell';

// People Field Cell Component
export const PeopleCustomColumnCell: React.FC<{
  task: any;
  columnKey: string;
  customValue: any;
  updateTaskCustomColumnValue: (
    taskId: string,
    columnKey: string,
    value: string | number | boolean | string[] | null
  ) => void;
}> = memo(({ task, columnKey, customValue, updateTaskCustomColumnValue }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());
  const [optimisticSelectedIds, setOptimisticSelectedIds] = useState<string[]>([]);

  const members = useAppSelector(state => state.teamMembersReducer.teamMembers);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';

  // Parse selected member IDs from custom value
  const selectedMemberIds = useMemo(() => {
    return parsePeopleCustomFieldValue(customValue);
  }, [customValue]);

  // Use optimistic updates when there are pending changes, otherwise use actual value
  const displayedMemberIds = useMemo(() => {
    // If we have pending changes, use optimistic state
    if (pendingChanges.size > 0) {
      return optimisticSelectedIds;
    }
    // Otherwise use the actual value from the server
    return selectedMemberIds;
  }, [pendingChanges.size, optimisticSelectedIds, selectedMemberIds]);

  // Initialize optimistic state and update when actual value changes (from socket updates)
  useEffect(() => {
    // Only update optimistic state if there are no pending changes
    // This prevents the socket update from overriding our optimistic state
    if (pendingChanges.size === 0) {
      setOptimisticSelectedIds(selectedMemberIds);
    }
  }, [selectedMemberIds, pendingChanges.size]);

  const selectedMembers = useMemo(() => {
    if (!members?.data || !displayedMemberIds.length) return [];
    return members.data.filter(member => !!member.id && displayedMemberIds.includes(member.id));
  }, [members, displayedMemberIds]);

  const handleMemberToggle = useCallback(
    (memberId: string, checked: boolean) => {
      // Add to pending changes for visual feedback
      setPendingChanges(prev => new Set(prev).add(memberId));

      const newSelectedIds = checked
        ? [...selectedMemberIds, memberId]
        : selectedMemberIds.filter((id: string) => id !== memberId);

      // Update optimistic state immediately for instant UI feedback
      setOptimisticSelectedIds(newSelectedIds);

      if (task.id) {
        updateTaskCustomColumnValue(task.id, columnKey, newSelectedIds);
      }

      // Remove from pending changes after socket update is processed
      // Use a longer timeout to ensure the socket update has been received and processed
      setTimeout(() => {
        setPendingChanges(prev => {
          const newSet = new Set<string>(Array.from(prev));
          newSet.delete(memberId);
          return newSet;
        });
      }, 1500); // Even longer delay to ensure socket update is fully processed
    },
    [selectedMemberIds, task.id, columnKey, updateTaskCustomColumnValue]
  );

  const loadMembers = useCallback(async () => {
    if (members?.data?.length === 0) {
      setIsLoading(true);
      // The members are loaded through Redux, so we just need to wait
      setTimeout(() => setIsLoading(false), 500);
    }
  }, [members]);

  return (
    <div className="flex items-center gap-1 px-2 relative custom-column-cell" style={{ minWidth: 0, width: '100%' }}>
      {selectedMembers.length > 0 && (
        <AvatarGroup
          members={selectedMembers.map(member => ({
            id: member.id,
            team_member_id: member.id,
            name: member.name,
            avatar_url: member.avatar_url,
            color_code: member.color_code,
          }))}
          maxCount={3}
          size={24}
          isDarkMode={isDarkMode}
        />
      )}

      <PeopleDropdown
        selectedMemberIds={displayedMemberIds}
        onMemberToggle={handleMemberToggle}
        isDarkMode={isDarkMode}
        isLoading={isLoading}
        loadMembers={loadMembers}
        pendingChanges={pendingChanges}
        buttonClassName="w-6 h-6 flex-shrink-0"
      />
    </div>
  );
});

PeopleCustomColumnCell.displayName = 'PeopleCustomColumnCell';

// Date Field Cell Component
export const DateCustomColumnCell: React.FC<{
  task: any;
  columnKey: string;
  customValue: any;
  updateTaskCustomColumnValue: (
    taskId: string,
    columnKey: string,
    value: string | number | boolean | string[] | null
  ) => void;
}> = memo(({ task, columnKey, customValue, updateTaskCustomColumnValue }) => {
  const { t } = useTranslation('task-list-table');
  const [isOpen, setIsOpen] = useState(false);
  const dateValue = customValue ? dayjs(customValue) : null;
  const isDarkMode = useAppSelector(state => state.themeReducer.mode === 'dark');

  const handleDateChange = (date: dayjs.Dayjs | null) => {
    if (task.id) {
      updateTaskCustomColumnValue(task.id, columnKey, date ? date.toISOString() : '');
    }
    setIsOpen(false);
  };

  return (
    <div className={`px-2 relative custom-column-cell ${isOpen ? 'custom-column-focused' : ''}`} style={{ minWidth: 0, width: '100%' }}>
      <div className="relative" style={{ minWidth: 0, width: '100%' }}>
        <DatePicker
          open={isOpen}
          onOpenChange={setIsOpen}
          value={dateValue}
          onChange={handleDateChange}
          placeholder={
            dateValue
              ? ''
              : t('customColumns.datePlaceholder', {
                  defaultValue: 'Set date',
                })
          }
          format="MMM DD, YYYY"
          suffixIcon={null}
          size="small"
          variant="borderless"
          className={`
            w-full text-sm transition-colors duration-200 custom-column-date-picker
            ${isDarkMode ? 'dark-mode' : 'light-mode'}
          `}
          popupClassName={isDarkMode ? 'dark-date-picker' : 'light-date-picker'}
          inputReadOnly
          getPopupContainer={() => document.body}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            boxShadow: 'none',
            width: '100%',
            minWidth: 0,
          }}
        />
      </div>
    </div>
  );
});

DateCustomColumnCell.displayName = 'DateCustomColumnCell';

// Number Field Cell Component
export const NumberCustomColumnCell: React.FC<{
  task: any;
  columnKey: string;
  customValue: any;
  columnObj: any;
  updateTaskCustomColumnValue: (
    taskId: string,
    columnKey: string,
    value: string | number | boolean | string[] | null
  ) => void;
}> = memo(({ task, columnKey, customValue, columnObj, updateTaskCustomColumnValue }) => {
  const { t } = useTranslation('task-list-table');
  const [inputValue, setInputValue] = useState(String(customValue || ''));
  const [isEditing, setIsEditing] = useState(false);
  const isDarkMode = useAppSelector(state => state.themeReducer.mode === 'dark');

  const numberType = columnObj?.numberType || 'formatted';
  const decimals = columnObj?.decimals || 0;
  const label = columnObj?.label || '';
  const labelPosition = columnObj?.labelPosition || 'left';

  // Sync inputValue with customValue to prevent NaN issues
  useEffect(() => {
    setInputValue(String(customValue || ''));
  }, [customValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers, decimal point, and minus sign
    if (/^-?\d*\.?\d*$/.test(value) || value === '') {
      setInputValue(value);
    }
  };

  const handleFocus = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    // Only update if there's a valid value and it's different from the current value
    if (task.id && inputValue !== customValue) {
      // Safely convert inputValue to string to avoid .trim() errors
      const stringValue = String(inputValue || '');
      // Don't save empty values or invalid numbers
      if (stringValue.trim() === '' || isNaN(parseFloat(stringValue))) {
        setInputValue(customValue || ''); // Reset to original value
      } else {
        updateTaskCustomColumnValue(task.id, columnKey, stringValue);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    if (e.key === 'Escape') {
      setInputValue(customValue || '');
      setIsEditing(false);
    }
  };

  const getDisplayValue = () => {
    if (isEditing) return inputValue;

    // Safely convert inputValue to string to avoid .trim() errors
    const stringValue = String(inputValue || '');
    if (!stringValue || stringValue.trim() === '') return '';

    const numValue = parseFloat(stringValue);
    if (isNaN(numValue)) return ''; // Return empty string instead of showing NaN

    switch (numberType) {
      case 'formatted':
        return numValue.toFixed(decimals);
      case 'percentage':
        return `${numValue.toFixed(decimals)}%`;
      case 'withLabel':
        return labelPosition === 'left'
          ? `${label} ${numValue.toFixed(decimals)}`
          : `${numValue.toFixed(decimals)} ${label}`;
      default:
        return numValue.toString();
    }
  };

  const addonBefore = numberType === 'withLabel' && labelPosition === 'left' ? label : undefined;
  const addonAfter = numberType === 'withLabel' && labelPosition === 'right' ? label : undefined;

  return (
    <div className="px-2" style={{ minWidth: 0, width: '100%' }}>
      <Input
        value={getDisplayValue()}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={
          numberType === 'percentage'
            ? t('customColumns.percentagePlaceholder', {
                defaultValue: '0%',
              })
            : t('customColumns.numberPlaceholder', {
                defaultValue: '0',
              })
        }
        size="small"
        variant="borderless"
        style={{
          textAlign: 'right',
          width: '100%',
          minWidth: 0,
        }}
        className={`
          custom-column-number-input
          ${isDarkMode ? 'dark-mode' : 'light-mode'}
        `}
      />
    </div>
  );
});

NumberCustomColumnCell.displayName = 'NumberCustomColumnCell';

// Selection Field Cell Component
export const SelectionCustomColumnCell: React.FC<{
  task: any;
  columnKey: string;
  customValue: any;
  columnObj: any;
  updateTaskCustomColumnValue: (
    taskId: string,
    columnKey: string,
    value: string | number | boolean | string[] | null
  ) => void;
}> = memo(({ task, columnKey, customValue, columnObj, updateTaskCustomColumnValue }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isDarkMode = useAppSelector(state => state.themeReducer.mode === 'dark');
  const { t } = useTranslation('task-list-table');
  const selectionsList = columnObj?.selectionsList || [];

  const selectedOption = selectionsList.find(
    (option: any) => option.selection_name === customValue
  );

  const handleOptionSelect = async (option: any) => {
    if (!task.id) return;

    setIsDropdownOpen(false);
    setIsLoading(true);

    try {
      // Send the update to the server - Redux store will be updated immediately
      updateTaskCustomColumnValue(task.id, columnKey, option.selection_name);

      // Short loading state for visual feedback
      setTimeout(() => {
        setIsLoading(false);
      }, 200);
    } catch (error) {
      console.error('Error updating selection:', error);
      setIsLoading(false);
    }
  };

  const dropdownContent = (
    <div
      className={`
      rounded-lg shadow-xl border min-w-[180px] max-h-64 overflow-y-auto custom-column-dropdown
      ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}
    `}
    >
      {/* Header */}
      <div
        className={`
        px-3 py-2 border-b text-xs font-medium
        ${
          isDarkMode
            ? 'border-gray-600 text-gray-300 bg-gray-750'
            : 'border-gray-200 text-gray-600 bg-gray-50'
        }
      `}
      >
        {t('customColumns.selectOption', {
          defaultValue: 'Select option',
        })}
      </div>

      {/* Options */}
      <div className="p-1">
        {selectionsList.map((option: any) => (
          <div
            key={option.selection_id}
            onClick={() => handleOptionSelect(option)}
            className={`
              flex items-center gap-3 p-2 rounded-md cursor-pointer transition-all duration-200
              ${
                selectedOption?.selection_id === option.selection_id
                  ? isDarkMode
                    ? 'bg-blue-900/50 text-blue-200'
                    : 'bg-blue-50 text-blue-700'
                  : isDarkMode
                    ? 'hover:bg-gray-700 text-gray-200'
                    : 'hover:bg-gray-100 text-gray-900'
              }
            `}
          >
            <div
              className="w-3 h-3 rounded-full border border-white/20 shadow-sm"
              style={{ backgroundColor: option.selection_color || '#6b7280' }}
            />
            <span className="text-sm font-medium flex-1">{option.selection_name}</span>
            {selectedOption?.selection_id === option.selection_id && (
              <div
                className={`
                w-4 h-4 rounded-full flex items-center justify-center
                ${isDarkMode ? 'bg-blue-600' : 'bg-blue-500'}
              `}
              >
                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </div>
        ))}

        {selectionsList.length === 0 && (
          <div
            className={`
            text-center py-8 text-sm
            ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}
          `}
          >
            <div className="mb-2">📋</div>
            <div>
              {t('customColumns.noOptionsAvailable', {
                defaultValue: 'No options available',
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`px-2 relative custom-column-cell ${isDropdownOpen ? 'custom-column-focused' : ''}`}
      style={{ minWidth: 0, width: '100%' }}
    >
      <Dropdown
        open={isDropdownOpen}
        onOpenChange={setIsDropdownOpen}
        dropdownRender={() => dropdownContent}
        trigger={['click']}
        placement="bottomLeft"
        overlayClassName="custom-selection-dropdown"
        getPopupContainer={() => document.body}
      >
        <div
          className={`
          flex items-center gap-2 cursor-pointer rounded-md px-2 py-1 min-h-[28px] transition-all duration-200 relative
          ${
            isDropdownOpen
              ? isDarkMode
                ? 'bg-gray-700 ring-1 ring-blue-500/50'
                : 'bg-gray-100 ring-1 ring-blue-500/50'
              : isDarkMode
                ? 'hover:bg-gray-700/50'
                : 'hover:bg-gray-100/50'
          }
        `}
          style={{ minWidth: 0, width: '100%' }}
        >
          {isLoading ? (
            <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
              <div
                className={`
                w-3 h-3 rounded-full animate-spin border-2 border-transparent flex-shrink-0
                ${isDarkMode ? 'border-t-gray-400' : 'border-t-gray-600'}
              `}
              />
              <span className={`text-sm truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('customColumns.updating', {
                  defaultValue: 'Updating...',
                })}
              </span>
            </div>
          ) : selectedOption ? (
            <>
              <div
                className="w-3 h-3 rounded-full border border-white/20 shadow-sm flex-shrink-0"
                style={{ backgroundColor: selectedOption.selection_color || '#6b7280' }}
              />
              <span
                className={`text-sm font-medium truncate flex-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}
                style={{ minWidth: 0 }}
              >
                {selectedOption.selection_name}
              </span>
              <svg
                className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''} ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </>
          ) : (
            <>
              <div
                className={`w-3 h-3 rounded-full border-2 border-dashed flex-shrink-0 ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
              />
              <span className={`text-sm truncate flex-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} style={{ minWidth: 0 }}>
                {t('selectText', {
                  defaultValue: 'Select',
                })}
              </span>
              <svg
                className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''} ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </>
          )}
        </div>
      </Dropdown>
    </div>
  );
});

SelectionCustomColumnCell.displayName = 'SelectionCustomColumnCell';
