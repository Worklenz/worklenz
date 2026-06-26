import React, { useState, useCallback, useMemo, memo, useEffect, useRef } from 'react';
import { Tooltip, Flex, Dropdown, DatePicker, Input, Popover, Button, Typography } from '@/shared/antd-imports';
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
import { useBusinessFeatures } from '@/worklenz-ee/hooks/use-business-features';
import { useUpgradePrompt } from '@/worklenz-ee/hooks/use-upgrade-prompt';
import { ISUBSCRIPTION_TYPE } from '@/shared/constants';
import { useAppSumoTracking } from '@/hooks/useAppSumoTracking';
import { AppSumoUpsellEvents } from '@/types/mixpanel-events.types';
import {
  getTaskCustomFieldDisplayName,
  parsePeopleCustomFieldValue,
} from '@/utils/task-custom-columns';
import { selectCustomColumns } from '@/features/task-management/task-management.selectors';
import { LICENSING_SETTINGS } from '@/shared/licensing_settings';

// Add Custom Column Button Component
export const AddCustomColumnButton: React.FC = memo(() => {
  const dispatch = useAppDispatch();
  const isDarkMode = useAppSelector(state => state.themeReducer.mode === 'dark');
  const { t } = useTranslation('task-list-table');
  const { t: tCommon } = useTranslation('common');
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const { isFreeUser: isFree, hasBusinessAccess } = useBusinessFeatures();
  const { promptUpgrade } = useUpgradePrompt();
  const isLtdUser =
    currentSession?.subscription_type === ISUBSCRIPTION_TYPE.LIFE_TIME_DEAL ||
    String(currentSession?.subscription_status || '').toLowerCase() === 'life_time_deal';

  const customColumns = useAppSelector(selectCustomColumns);
  const customColumnsCount = customColumns?.length ?? 0;

  // At or over the custom field limit (non-business users)
  const hasReachedLimit = !hasBusinessAccess && customColumnsCount >= LICENSING_SETTINGS.CUSTOM_FIELDS_LIMIT;
  // AppSumo/LTD users who already had >limit fields before the limit was enforced
  const isGrandfathered = !hasBusinessAccess && isLtdUser && customColumnsCount >= LICENSING_SETTINGS.CUSTOM_FIELDS_LIMIT;

  const [popoverOpen, setPopoverOpen] = useState(false);
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
  }, [popoverOpen]);

  const handleModalOpen = useCallback(() => {
    if (isFree) {
      promptUpgrade();
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
    dispatch(setCustomColumnModalAttributes({ modalType: 'create', columnId: null }));
    dispatch(toggleCustomColumnModalOpen(true));
  }, [dispatch, isFree, hasReachedLimit, isGrandfathered]);

  const handleUpgradeNow = useCallback(() => {
    setPopoverOpen(false);
    if (isAppSumoUser) {
      trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_NOW_CLICKED, { feature: 'custom_fields' });
    }
    promptUpgrade('customFields');
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
          'You have used all 10 custom fields available on your plan. Upgrade to add unlimited custom fields to your projects.',
      });

  const popoverContent = (
    <Flex vertical gap={12} style={{ maxWidth: 260 }}>
      <Typography.Text>{popoverBody}</Typography.Text>
      <Button type="primary" size="small" onClick={handleUpgradeNow}>
        {t('customColumns.limitPopover.cta', { defaultValue: 'Upgrade Now' })}
      </Button>
    </Flex>
  );

  const tooltipTitle = hasReachedLimit || isGrandfathered
    ? t('customColumns.limitPopover.title', { defaultValue: 'Custom Field Limit Reached' })
    : isFree
      ? tCommon('upgrade-plan', { defaultValue: 'Upgrade plan' })
      : t('customColumns.addCustomColumn', { defaultValue: 'Add a custom column' });

  return (
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
          onClick={handleModalOpen}
          disabled={isFree}
          className={`
            group relative w-9 h-9 rounded-lg border-2 border-dashed transition-all duration-200
            flex items-center justify-center
            ${
              isFree
                ? isDarkMode
                  ? 'border-gray-600 text-gray-500 cursor-pointer'
                  : 'border-gray-300 text-gray-400 cursor-pointer'
                : isDarkMode
                  ? 'border-gray-600 hover:border-blue-500 hover:bg-blue-500/10 text-gray-500 hover:text-blue-400'
                  : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50 text-gray-400 hover:text-blue-600'
            }
          `}
        >
          {isFree ? (
            <CrownOutlined style={{ fontSize: '16px', color: '#faad14' }} />
          ) : (
            <PlusOutlined className="text-sm transition-transform duration-200 group-hover:scale-110" />
          )}

          {/* Subtle glow effect on hover - only for non-free users */}
          {!isFree && (
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

// Custom Column Header Component
export const CustomColumnHeader: React.FC<{
  column: any;
  onSettingsClick: (columnId: string) => void;
  dragListeners?: any;
  dragAttributes?: any;
  setDragActivatorRef?: (element: HTMLElement | null) => void;
}> = ({ column, onSettingsClick, dragListeners, dragAttributes, setDragActivatorRef }) => {
  const { t } = useTranslation('task-list-table');
  const [isHovered, setIsHovered] = useState(false);

  const displayName =
    getTaskCustomFieldDisplayName(column) || t('customColumns.customColumnHeader');

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
        style={{ minWidth: 0, cursor: dragListeners ? 'grab' : 'default' }}
      >
        {displayName}
      </span>
      {/* Right-side icons: settings icon only */}
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
    </Flex>
  );
};

// Custom Column Cell Component with Interactive Inputs
export const CustomColumnCell: React.FC<{
  column: any;
  task: any;
  updateTaskCustomColumnValue: (
    taskId: string,
    columnKey: string,
    value: string | number | boolean | string[] | null
  ) => void;
}> = memo(({ column, task, updateTaskCustomColumnValue }) => {
  const { t } = useTranslation('task-list-table');

  const customValue = task.custom_column_values?.[column.key];
  const fieldType = column.custom_column_obj?.fieldType;

  if (!fieldType || !column.custom_column) {
    return <span className="text-gray-400 text-sm">-</span>;
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
    return members.data.filter(member => displayedMemberIds.includes(member.id));
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
