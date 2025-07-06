import React, { useState, useCallback, useMemo, memo } from 'react';
import { Button, Tooltip, Flex, Dropdown, DatePicker } from 'antd';
import { PlusOutlined, SettingOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setCustomColumnModalAttributes,
  toggleCustomColumnModalOpen,
} from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import { toggleProjectMemberDrawer } from '@/features/projects/singleProject/members/projectMembersSlice';
import dayjs from 'dayjs';

// Add Custom Column Button Component
export const AddCustomColumnButton: React.FC = memo(() => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('task-list-table');

  const handleModalOpen = useCallback(() => {
    dispatch(setCustomColumnModalAttributes({ modalType: 'create', columnId: null }));
    dispatch(toggleCustomColumnModalOpen(true));
  }, [dispatch]);

  return (
    <Tooltip title={t('customColumns.addCustomColumn')}>
      <Button
        icon={<PlusOutlined />}
        type="text"
        size="small"
        onClick={handleModalOpen}
        className="hover:bg-gray-100 dark:hover:bg-gray-700"
        style={{
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
        }}
      />
    </Tooltip>
  );
});

AddCustomColumnButton.displayName = 'AddCustomColumnButton';

// Custom Column Header Component
export const CustomColumnHeader: React.FC<{
  column: any;
  onSettingsClick: (columnId: string) => void;
}> = ({ column, onSettingsClick }) => {
  const { t } = useTranslation('task-list-table');

  const displayName = column.name || 
                     column.label || 
                     column.custom_column_obj?.fieldTitle || 
                     column.custom_column_obj?.field_title ||
                     t('customColumns.customColumnHeader');

  return (
    <Flex align="center" justify="space-between" className="w-full">
      <span title={displayName}>{displayName}</span>
      <Tooltip title={t('customColumns.customColumnSettings')}>
        <SettingOutlined
          className="cursor-pointer hover:text-primary"
          onClick={e => {
            e.stopPropagation();
            onSettingsClick(column.key || column.id);
          }}
        />
      </Tooltip>
    </Flex>
  );
};

// Custom Column Cell Component with Interactive Inputs
export const CustomColumnCell: React.FC<{
  column: any;
  task: any;
  updateTaskCustomColumnValue: (taskId: string, columnKey: string, value: string) => void;
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
      return <span className="text-sm text-gray-400">{t('customColumns.unsupportedField')}</span>;
  }
});

CustomColumnCell.displayName = 'CustomColumnCell';

// People Field Cell Component
export const PeopleCustomColumnCell: React.FC<{
  task: any;
  columnKey: string;
  customValue: any;
  updateTaskCustomColumnValue: (taskId: string, columnKey: string, value: string) => void;
}> = memo(({ task, columnKey, customValue, updateTaskCustomColumnValue }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dispatch = useAppDispatch();
  const { t } = useTranslation('task-list-table');
  
  const members = useAppSelector(state => state.teamMembersReducer.teamMembers);
  
  const selectedMemberIds = useMemo(() => {
    try {
      return customValue ? JSON.parse(customValue) : [];
    } catch (e) {
      return [];
    }
  }, [customValue]);

  const filteredMembers = useMemo(() => {
    return members?.data?.filter(member =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];
  }, [members, searchQuery]);

  const selectedMembers = useMemo(() => {
    if (!members?.data || !selectedMemberIds.length) return [];
    return members.data.filter(member => selectedMemberIds.includes(member.id));
  }, [members, selectedMemberIds]);

  const handleMemberSelection = (memberId: string) => {
    const newSelectedIds = selectedMemberIds.includes(memberId)
      ? selectedMemberIds.filter((id: string) => id !== memberId)
      : [...selectedMemberIds, memberId];

    if (task.id) {
      updateTaskCustomColumnValue(task.id, columnKey, JSON.stringify(newSelectedIds));
    }
  };

  const handleInviteProjectMember = () => {
    dispatch(toggleProjectMemberDrawer());
  };

  const dropdownContent = (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 w-80">
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('searchInputPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        
        <div className="max-h-60 overflow-y-auto">
          {filteredMembers.length > 0 ? (
            filteredMembers.map(member => (
              <div
                key={member.id}
                onClick={() => member.id && handleMemberSelection(member.id)}
                className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={member.id ? selectedMemberIds.includes(member.id) : false}
                  onChange={() => member.id && handleMemberSelection(member.id)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.name} className="w-8 h-8 rounded-full" />
                  ) : (
                    member.name?.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{member.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
              {t('noMembersFound')}
            </div>
          )}
        </div>
        
        <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
          <button
            onClick={handleInviteProjectMember}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md"
          >
            <UsergroupAddOutlined className="w-4 h-4" />
            {t('assigneeSelectorInviteButton')}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-1">
      {selectedMembers.length > 0 && (
        <div className="flex -space-x-1">
          {selectedMembers.slice(0, 3).map((member) => (
            <div
              key={member.id}
              className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300 border-2 border-white dark:border-gray-800"
              title={member.name}
            >
              {member.avatar_url ? (
                <img src={member.avatar_url} alt={member.name} className="w-6 h-6 rounded-full" />
              ) : (
                member.name?.charAt(0).toUpperCase()
              )}
            </div>
          ))}
          {selectedMembers.length > 3 && (
            <div className="w-6 h-6 rounded-full bg-gray-400 dark:bg-gray-500 flex items-center justify-center text-xs font-medium text-white border-2 border-white dark:border-gray-800">
              +{selectedMembers.length - 3}
            </div>
          )}
        </div>
      )}
      
      <Dropdown
        open={isDropdownOpen}
        onOpenChange={setIsDropdownOpen}
        dropdownRender={() => dropdownContent}
        trigger={['click']}
        placement="bottomLeft"
      >
        <button className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
          <PlusOutlined className="w-3 h-3 text-gray-400 dark:text-gray-500" />
        </button>
      </Dropdown>
    </div>
  );
});

PeopleCustomColumnCell.displayName = 'PeopleCustomColumnCell';

// Date Field Cell Component
export const DateCustomColumnCell: React.FC<{
  task: any;
  columnKey: string;
  customValue: any;
  updateTaskCustomColumnValue: (taskId: string, columnKey: string, value: string) => void;
}> = memo(({ task, columnKey, customValue, updateTaskCustomColumnValue }) => {
  const dateValue = customValue ? dayjs(customValue) : null;

  return (
    <DatePicker
      value={dateValue}
      onChange={date => {
        if (task.id) {
          updateTaskCustomColumnValue(task.id, columnKey, date ? date.toISOString() : '');
        }
      }}
      placeholder="Set Date"
      format="MMM DD, YYYY"
      suffixIcon={null}
      className="w-full border-none bg-transparent hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
      inputReadOnly
    />
  );
});

DateCustomColumnCell.displayName = 'DateCustomColumnCell';

// Number Field Cell Component
export const NumberCustomColumnCell: React.FC<{
  task: any;
  columnKey: string;
  customValue: any;
  columnObj: any;
  updateTaskCustomColumnValue: (taskId: string, columnKey: string, value: string) => void;
}> = memo(({ task, columnKey, customValue, columnObj, updateTaskCustomColumnValue }) => {
  const [inputValue, setInputValue] = useState(customValue || '');
  const [isEditing, setIsEditing] = useState(false);
  
  const numberType = columnObj?.numberType || 'formatted';
  const decimals = columnObj?.decimals || 0;
  const label = columnObj?.label || '';
  const labelPosition = columnObj?.labelPosition || 'left';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers, decimal point, and minus sign
    if (/^-?\d*\.?\d*$/.test(value) || value === '') {
      setInputValue(value);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (task.id && inputValue !== customValue) {
      updateTaskCustomColumnValue(task.id, columnKey, inputValue);
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
    
    if (!inputValue) return '';
    
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue)) return inputValue;
    
    switch (numberType) {
      case 'formatted':
        return numValue.toFixed(decimals);
      case 'percentage':
        return `${numValue.toFixed(decimals)}%`;
      case 'withLabel':
        return labelPosition === 'left' ? `${label} ${numValue.toFixed(decimals)}` : `${numValue.toFixed(decimals)} ${label}`;
      default:
        return inputValue;
    }
  };

  return (
    <div className="flex items-center gap-1">
      {numberType === 'withLabel' && labelPosition === 'left' && (
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      )}
      <input
        type="text"
        value={getDisplayValue()}
        onChange={handleInputChange}
        onFocus={() => setIsEditing(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full bg-transparent border-none text-sm text-right focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700 px-1 py-0.5 rounded"
        placeholder="0"
      />
      {numberType === 'withLabel' && labelPosition === 'right' && (
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      )}
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
  updateTaskCustomColumnValue: (taskId: string, columnKey: string, value: string) => void;
}> = memo(({ task, columnKey, customValue, columnObj, updateTaskCustomColumnValue }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const selectionsList = columnObj?.selectionsList || [];
  
  const selectedOption = selectionsList.find((option: any) => option.selection_name === customValue);

  const dropdownContent = (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 min-w-[150px]">
      {selectionsList.map((option: any) => (
        <div
          key={option.selection_id}
          onClick={() => {
            if (task.id) {
              updateTaskCustomColumnValue(task.id, columnKey, option.selection_name);
            }
            setIsDropdownOpen(false);
          }}
          className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer"
        >
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: option.selection_color || '#6b7280' }}
          />
          <span className="text-sm text-gray-900 dark:text-gray-100">{option.selection_name}</span>
        </div>
      ))}
      {selectionsList.length === 0 && (
        <div className="text-center py-2 text-gray-500 dark:text-gray-400 text-sm">
          No options available
        </div>
      )}
    </div>
  );

  return (
    <Dropdown
      open={isDropdownOpen}
      onOpenChange={setIsDropdownOpen}
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomLeft"
    >
      <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded min-h-[24px]">
        {selectedOption ? (
          <>
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: selectedOption.selection_color || '#6b7280' }}
            />
            <span className="text-sm text-gray-900 dark:text-gray-100">{selectedOption.selection_name}</span>
          </>
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-500">Select option</span>
        )}
      </div>
    </Dropdown>
  );
});

SelectionCustomColumnCell.displayName = 'SelectionCustomColumnCell'; 